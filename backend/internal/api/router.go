package api

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pacman-speckit/pacman/backend/internal/ai"
	"github.com/pacman-speckit/pacman/backend/internal/cache"
)

// NewRouter creates the HTTP router with all middleware and routes registered.
func NewRouter(pool *pgxpool.Pool, redis *cache.Client, aiCli *ai.Client, logger *slog.Logger) http.Handler {
	h := NewHandler(pool, redis, aiCli, logger)
	mux := http.NewServeMux()

	// Health endpoints — no rate limit or security headers
	mux.HandleFunc("GET /healthz", h.HealthCheck)
	mux.HandleFunc("GET /readyz", h.ReadinessCheck)

	// Score API endpoints — rate limited
	scoreMux := http.NewServeMux()
	scoreMux.HandleFunc("GET /api/scores", h.GetLeaderboard)
	scoreMux.HandleFunc("POST /api/scores", h.SubmitScore)

	// Theme API endpoints — rate limited
	scoreMux.HandleFunc("GET /api/themes", h.ListThemes)
	scoreMux.HandleFunc("GET /api/themes/", h.GetTheme)
	scoreMux.HandleFunc("POST /api/themes/generate", h.GenerateTheme)

	rateLimited := RateLimitMiddleware(scoreMux)
	mux.Handle("/api/", rateLimited)

	// Compose middleware (applied inside-out)
	var handler http.Handler = mux
	handler = SecurityHeadersMiddleware(handler)
	handler = LoggingMiddleware(logger)(handler)
	handler = RequestIDMiddleware(handler)

	return handler
}
