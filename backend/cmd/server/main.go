package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pacman-speckit/pacman/backend/internal/ai"
	"github.com/pacman-speckit/pacman/backend/internal/api"
	"github.com/pacman-speckit/pacman/backend/internal/cache"
	"github.com/pacman-speckit/pacman/backend/internal/config"
	"github.com/pacman-speckit/pacman/backend/internal/db"
	schema "github.com/pacman-speckit/pacman/backend/sql"
)

func main() {
	// Setup structured JSON logger
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	level := slog.LevelInfo
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
	slog.SetDefault(logger)

	// Connect to database with retries
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DSN(), logger)
	if err != nil {
		logger.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Run migrations
	db.MigrationSQL = schema.SQL
	if err := db.Migrate(ctx, pool, logger); err != nil {
		logger.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Connect to Redis (optional — gracefully degrade if unavailable)
	var redisClient *cache.Client
	if cfg.RedisHost != "" && cfg.RedisHost != "localhost" {
		rctx, rcancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer rcancel()
		redisClient, err = cache.NewClient(rctx, cfg.RedisAddr(), cfg.RedisPassword, logger)
		if err != nil {
			logger.Warn("Redis unavailable — running without cache", "error", err)
			redisClient = nil
		} else {
			defer redisClient.Close()
		}
	} else {
		logger.Info("Redis not configured — running without cache")
	}

	// Setup AI client (optional — gracefully degrade if unavailable)
	var aiClient *ai.Client
	if cfg.AIEndpoint != "" && cfg.AIEndpoint != "http://localhost:11434" {
		aiClient = ai.NewClient(cfg.AIEndpoint, cfg.AIModel, cfg.AIAPIKey, logger)
		logger.Info("AI model configured", "endpoint", cfg.AIEndpoint, "model", cfg.AIModel)
	} else {
		logger.Info("AI model not configured — theme generation disabled")
	}

	// Start HTTP server
	router := api.NewRouter(pool, redisClient, aiClient, logger)
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 120 * time.Second, // Allow long writes for AI generation
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	errCh := make(chan error, 1)
	go func() {
		logger.Info("server starting", "port", cfg.Port,
			"redis", redisClient != nil,
			"ai", aiClient != nil)
		errCh <- srv.ListenAndServe()
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		logger.Info("shutting down", "signal", sig.String())
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	logger.Info("server stopped")
}
