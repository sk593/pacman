package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pacman-speckit/pacman/backend/internal/ai"
	"github.com/pacman-speckit/pacman/backend/internal/cache"
	"github.com/pacman-speckit/pacman/backend/internal/model"
)

// Handler holds dependencies for HTTP handlers.
type Handler struct {
	pool   *pgxpool.Pool
	redis  *cache.Client
	aiCli  *ai.Client
	logger *slog.Logger
}

// NewHandler creates a new Handler with the given dependencies.
func NewHandler(pool *pgxpool.Pool, redis *cache.Client, aiCli *ai.Client, logger *slog.Logger) *Handler {
	return &Handler{pool: pool, redis: redis, aiCli: aiCli, logger: logger}
}

// HealthCheck returns 200 OK if the process is alive (liveness probe).
func (h *Handler) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ReadinessCheck returns 200 if the DB and Redis are reachable, 503 otherwise.
func (h *Handler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if err := h.pool.Ping(r.Context()); err != nil {
		h.logger.Warn("readiness check failed (db)", "error", err)
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "reason": "database"})
		return
	}

	if h.redis != nil {
		if err := h.redis.Ping(r.Context()); err != nil {
			h.logger.Warn("readiness check failed (redis)", "error", err)
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "reason": "redis"})
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// writeJSON encodes v as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ---------------------------------------------------------------------------
// Score Endpoints
// ---------------------------------------------------------------------------

// GetLeaderboard returns the top 10 high scores (cached via Redis).
func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Try Redis cache first
	if h.redis != nil {
		if cached, err := h.redis.GetLeaderboard(ctx); err == nil && cached != nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache", "HIT")
			w.Write(cached)
			return
		}
	}

	entries, err := h.queryLeaderboard(ctx)
	if err != nil {
		h.logger.Error("query leaderboard", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to fetch leaderboard")
		return
	}

	data, _ := json.Marshal(entries)

	// Cache in Redis
	if h.redis != nil {
		if err := h.redis.SetLeaderboard(ctx, data); err != nil {
			h.logger.Warn("failed to cache leaderboard", "error", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(data)
}

func (h *Handler) queryLeaderboard(ctx context.Context) ([]model.HighScoreEntry, error) {
	rows, err := h.pool.Query(ctx,
		"SELECT id, player_name, score, level_reached, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 10")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]model.HighScoreEntry, 0, 10)
	for rows.Next() {
		var e model.HighScoreEntry
		if err := rows.Scan(&e.ID, &e.PlayerName, &e.Score, &e.LevelReached, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// SubmitScore validates, inserts a new high score, and queues for async processing.
func (h *Handler) SubmitScore(w http.ResponseWriter, r *http.Request) {
	var sub model.ScoreSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := sub.Validate(); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	var entry model.HighScoreEntry
	err := h.pool.QueryRow(r.Context(),
		"INSERT INTO scores (player_name, score, level_reached) VALUES ($1, $2, $3) RETURNING id, player_name, score, level_reached, created_at",
		sub.PlayerName, sub.Score, sub.LevelReached,
	).Scan(&entry.ID, &entry.PlayerName, &entry.Score, &entry.LevelReached, &entry.CreatedAt)
	if err != nil {
		h.logger.Error("insert score", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to save score")
		return
	}

	// Invalidate leaderboard cache + push to queue for async processing
	if h.redis != nil {
		_ = h.redis.InvalidateLeaderboard(r.Context())
		_ = h.redis.PushScore(r.Context(), cache.ScoreMessage{
			PlayerName:   sub.PlayerName,
			Score:        sub.Score,
			LevelReached: sub.LevelReached,
		})
	}

	writeJSON(w, http.StatusCreated, entry)
}

// ---------------------------------------------------------------------------
// Theme Endpoints
// ---------------------------------------------------------------------------

// ListThemes returns all available themes.
func (h *Handler) ListThemes(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, name, description, wall_color, pellet_color, pacman_color, background_color,
		        ghost1_name, ghost2_name, ghost3_name, ghost4_name,
		        ghost1_color, ghost2_color, ghost3_color, ghost4_color,
		        wall_sprite, pellet_sprite, pacman_sprite, power_pellet_sprite,
		        ghost1_sprite, ghost2_sprite, ghost3_sprite, ghost4_sprite, created_at
		 FROM themes ORDER BY created_at ASC`)
	if err != nil {
		h.logger.Error("query themes", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to fetch themes")
		return
	}
	defer rows.Close()

	themes := make([]model.Theme, 0)
	for rows.Next() {
		var t model.Theme
		if err := rows.Scan(&t.ID, &t.Name, &t.Description,
			&t.WallColor, &t.PelletColor, &t.PacManColor, &t.BgColor,
			&t.Ghost1Name, &t.Ghost2Name, &t.Ghost3Name, &t.Ghost4Name,
			&t.Ghost1Color, &t.Ghost2Color, &t.Ghost3Color, &t.Ghost4Color,
			&t.WallSprite, &t.PelletSprite, &t.PacmanSprite, &t.PowerPelletSprite,
			&t.Ghost1Sprite, &t.Ghost2Sprite, &t.Ghost3Sprite, &t.Ghost4Sprite,
			&t.CreatedAt); err != nil {
			h.logger.Error("scan theme row", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to read theme")
			return
		}
		themes = append(themes, t)
	}
	if err := rows.Err(); err != nil {
		h.logger.Error("iterate theme rows", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to read themes")
		return
	}

	writeJSON(w, http.StatusOK, themes)
}

// GetTheme returns a single theme by ID.
func (h *Handler) GetTheme(w http.ResponseWriter, r *http.Request) {
	// Extract ID from path: /api/themes/{id}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		writeError(w, http.StatusBadRequest, "missing theme ID")
		return
	}
	idStr := parts[len(parts)-1]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid theme ID")
		return
	}

	var t model.Theme
	err = h.pool.QueryRow(r.Context(),
		`SELECT id, name, description, wall_color, pellet_color, pacman_color, background_color,
		        ghost1_name, ghost2_name, ghost3_name, ghost4_name,
		        ghost1_color, ghost2_color, ghost3_color, ghost4_color,
		        wall_sprite, pellet_sprite, pacman_sprite, power_pellet_sprite,
		        ghost1_sprite, ghost2_sprite, ghost3_sprite, ghost4_sprite, created_at
		 FROM themes WHERE id = $1`, id,
	).Scan(&t.ID, &t.Name, &t.Description,
		&t.WallColor, &t.PelletColor, &t.PacManColor, &t.BgColor,
		&t.Ghost1Name, &t.Ghost2Name, &t.Ghost3Name, &t.Ghost4Name,
		&t.Ghost1Color, &t.Ghost2Color, &t.Ghost3Color, &t.Ghost4Color,
		&t.WallSprite, &t.PelletSprite, &t.PacmanSprite, &t.PowerPelletSprite,
		&t.Ghost1Sprite, &t.Ghost2Sprite, &t.Ghost3Sprite, &t.Ghost4Sprite,
		&t.CreatedAt)
	if err != nil {
		h.logger.Error("query theme", "error", err, "id", id)
		writeError(w, http.StatusNotFound, "theme not found")
		return
	}

	writeJSON(w, http.StatusOK, t)
}

// GenerateTheme calls the AI model to generate a new theme from a description.
func (h *Handler) GenerateTheme(w http.ResponseWriter, r *http.Request) {
	var req model.ThemeGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := req.Validate(); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	if h.aiCli == nil {
		writeError(w, http.StatusServiceUnavailable, "AI model not configured")
		return
	}

	aiTheme, err := h.aiCli.GenerateTheme(r.Context(), req.Description)
	if err != nil {
		h.logger.Error("AI theme generation failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to generate theme — AI model may be warming up, try again shortly")
		return
	}

	// Ensure we have valid data
	if len(aiTheme.GhostNames) < 4 {
		aiTheme.GhostNames = append(aiTheme.GhostNames, "Blinky", "Pinky", "Inky", "Clyde")
		aiTheme.GhostNames = aiTheme.GhostNames[:4]
	}
	if len(aiTheme.GhostColors) < 4 {
		aiTheme.GhostColors = append(aiTheme.GhostColors, "#FF0000", "#FFB8FF", "#00FFFF", "#FFB852")
		aiTheme.GhostColors = aiTheme.GhostColors[:4]
	}
	if len(aiTheme.GhostSprites) < 4 {
		aiTheme.GhostSprites = append(aiTheme.GhostSprites, "👻", "👻", "👻", "👻")
		aiTheme.GhostSprites = aiTheme.GhostSprites[:4]
	}

	// Store in database
	var t model.Theme
	err = h.pool.QueryRow(r.Context(),
		`INSERT INTO themes (name, description, wall_color, pellet_color, pacman_color, background_color,
		                     ghost1_name, ghost2_name, ghost3_name, ghost4_name,
		                     ghost1_color, ghost2_color, ghost3_color, ghost4_color,
		                     wall_sprite, pellet_sprite, pacman_sprite, power_pellet_sprite,
		                     ghost1_sprite, ghost2_sprite, ghost3_sprite, ghost4_sprite)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
		 RETURNING id, name, description, wall_color, pellet_color, pacman_color, background_color,
		           ghost1_name, ghost2_name, ghost3_name, ghost4_name,
		           ghost1_color, ghost2_color, ghost3_color, ghost4_color,
		           wall_sprite, pellet_sprite, pacman_sprite, power_pellet_sprite,
		           ghost1_sprite, ghost2_sprite, ghost3_sprite, ghost4_sprite, created_at`,
		aiTheme.Name, req.Description,
		aiTheme.Wall, aiTheme.Pellet, aiTheme.PacMan, aiTheme.Background,
		aiTheme.GhostNames[0], aiTheme.GhostNames[1], aiTheme.GhostNames[2], aiTheme.GhostNames[3],
		aiTheme.GhostColors[0], aiTheme.GhostColors[1], aiTheme.GhostColors[2], aiTheme.GhostColors[3],
		aiTheme.WallSprite, aiTheme.PelletSprite, aiTheme.PacmanSprite, aiTheme.PowerPelletSprite,
		aiTheme.GhostSprites[0], aiTheme.GhostSprites[1], aiTheme.GhostSprites[2], aiTheme.GhostSprites[3],
	).Scan(&t.ID, &t.Name, &t.Description,
		&t.WallColor, &t.PelletColor, &t.PacManColor, &t.BgColor,
		&t.Ghost1Name, &t.Ghost2Name, &t.Ghost3Name, &t.Ghost4Name,
		&t.Ghost1Color, &t.Ghost2Color, &t.Ghost3Color, &t.Ghost4Color,
		&t.WallSprite, &t.PelletSprite, &t.PacmanSprite, &t.PowerPelletSprite,
		&t.Ghost1Sprite, &t.Ghost2Sprite, &t.Ghost3Sprite, &t.Ghost4Sprite,
		&t.CreatedAt)
	if err != nil {
		h.logger.Error("insert theme", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to save theme")
		return
	}

	writeJSON(w, http.StatusCreated, t)
}
