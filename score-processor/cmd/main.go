package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// scoreMessage matches the JSON pushed by the backend.
type scoreMessage struct {
	PlayerName   string `json:"player_name"`
	Score        int    `json:"score"`
	LevelReached int    `json:"level_reached"`
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown on SIGINT / SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		logger.Info("Received signal, shutting down", "signal", sig)
		cancel()
	}()

	// --- Config from Radius connection env vars ---
	cfg, err := loadConfig()
	if err != nil {
		logger.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	// --- PostgreSQL ---
	pool, err := connectDB(ctx, cfg, logger)
	if err != nil {
		logger.Error("Failed to connect to PostgreSQL", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// --- Redis ---
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.redisAddr,
		Password: cfg.redisPassword,
		DB:       0,
	})
	defer rdb.Close()

	if err := pingRedis(ctx, rdb, logger); err != nil {
		logger.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}

	logger.Info("Score processor started, draining queue...",
		"redis", cfg.redisAddr, "db", cfg.dbHost)

	// --- Main processing loop ---
	processLoop(ctx, rdb, pool, logger)

	logger.Info("Score processor stopped")
}

// config holds parsed environment configuration.
type config struct {
	dbHost        string
	dbPort        int
	dbName        string
	dbUser        string
	dbPassword    string
	redisAddr     string
	redisPassword string
}

func (c *config) dsn() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		c.dbUser, c.dbPassword, c.dbHost, c.dbPort, c.dbName)
}

func loadConfig() (*config, error) {
	dbProps := parseConnectionProperties("CONNECTION_DB_PROPERTIES")
	cacheProps := parseConnectionProperties("CONNECTION_CACHE_PROPERTIES")

	cfg := &config{
		dbHost:        getEnvOrProp("CONNECTION_DB_HOST", dbProps, "host", "localhost"),
		dbName:        getEnvOrProp("CONNECTION_DB_DATABASE", dbProps, "database", "pacman"),
		dbUser:        getEnvOrProp("CONNECTION_DB_USERNAME", dbProps, "username", "pacman"),
		dbPassword:    getEnvOrProp("CONNECTION_DB_PASSWORD", dbProps, "password", "pacman"),
		redisPassword: getEnvOrProp("CONNECTION_CACHE_PASSWORD", cacheProps, "password", ""),
	}

	// DB port
	dbPort := 5432
	if v := os.Getenv("CONNECTION_DB_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid CONNECTION_DB_PORT: %w", err)
		}
		dbPort = p
	} else if p, ok := dbProps["port"]; ok {
		dbPort = parseIntProp(p, 5432)
	}
	cfg.dbPort = dbPort

	// Redis address
	redisHost := getEnvOrProp("CONNECTION_CACHE_HOST", cacheProps, "host", "localhost")
	redisPort := 6379
	if v := os.Getenv("CONNECTION_CACHE_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid CONNECTION_CACHE_PORT: %w", err)
		}
		redisPort = p
	} else if p, ok := cacheProps["port"]; ok {
		redisPort = parseIntProp(p, 6379)
	}
	cfg.redisAddr = fmt.Sprintf("%s:%d", redisHost, redisPort)

	return cfg, nil
}

func connectDB(ctx context.Context, cfg *config, logger *slog.Logger) (*pgxpool.Pool, error) {
	var pool *pgxpool.Pool
	var lastErr error

	for i := 0; i < 15; i++ {
		p, err := pgxpool.New(ctx, cfg.dsn())
		if err != nil {
			lastErr = err
			logger.Warn("DB connect failed, retrying...", "attempt", i+1, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		if err := p.Ping(ctx); err != nil {
			p.Close()
			lastErr = err
			logger.Warn("DB ping failed, retrying...", "attempt", i+1, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		pool = p
		logger.Info("Connected to PostgreSQL", "host", cfg.dbHost)
		return pool, nil
	}
	return nil, fmt.Errorf("failed to connect to PostgreSQL after retries: %w", lastErr)
}

func pingRedis(ctx context.Context, rdb *redis.Client, logger *slog.Logger) error {
	for i := 0; i < 15; i++ {
		if err := rdb.Ping(ctx).Err(); err != nil {
			logger.Warn("Redis ping failed, retrying...", "attempt", i+1, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		logger.Info("Connected to Redis")
		return nil
	}
	return fmt.Errorf("failed to connect to Redis after retries")
}

const scoreQueueKey = "pacman:score:queue"
const leaderboardKey = "pacman:leaderboard"

func processLoop(ctx context.Context, rdb *redis.Client, pool *pgxpool.Pool, logger *slog.Logger) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// BRPOP with 5-second timeout so we re-check ctx.Done periodically
		result, err := rdb.BRPop(ctx, 5*time.Second, scoreQueueKey).Result()
		if err != nil {
			if err == redis.Nil || strings.Contains(err.Error(), "context canceled") {
				continue
			}
			logger.Error("BRPOP error", "error", err)
			time.Sleep(1 * time.Second)
			continue
		}
		if len(result) < 2 {
			continue
		}

		var msg scoreMessage
		if err := json.Unmarshal([]byte(result[1]), &msg); err != nil {
			logger.Error("Failed to unmarshal score message", "error", err, "raw", result[1])
			continue
		}

		logger.Info("Processing score", "player", msg.PlayerName, "score", msg.Score, "level", msg.LevelReached)

		insertSQL := "INSERT INTO scores (player_name, score, level_reached) VALUES ($1, $2, $3)"
		if _, err := pool.Exec(ctx, insertSQL, msg.PlayerName, msg.Score, msg.LevelReached); err != nil {
			logger.Error("Failed to insert score", "error", err, "player", msg.PlayerName)
			// Re-push to queue so the message is not lost
			data, _ := json.Marshal(msg)
			rdb.LPush(ctx, scoreQueueKey, data)
			time.Sleep(2 * time.Second)
			continue
		}

		// Invalidate the cached leaderboard so the next GET picks up the new score
		if err := rdb.Del(ctx, leaderboardKey).Err(); err != nil {
			logger.Warn("Failed to invalidate leaderboard cache", "error", err)
		}

		logger.Info("Score persisted successfully", "player", msg.PlayerName, "score", msg.Score)
	}
}

// --- Helpers (same pattern as backend/internal/config) ---

func parseConnectionProperties(envKey string) map[string]interface{} {
	raw := os.Getenv(envKey)
	if raw == "" {
		return nil
	}
	var props map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &props); err != nil {
		return nil
	}
	return props
}

func parseIntProp(v interface{}, fallback int) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case string:
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvOrProp(envKey string, props map[string]interface{}, propKey, fallback string) string {
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	if props != nil {
		if v, ok := props[propKey]; ok {
			return fmt.Sprintf("%v", v)
		}
	}
	return fallback
}
