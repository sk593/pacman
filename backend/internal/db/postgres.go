package db

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	maxRetries    = 5
	retryInterval = 3 * time.Second
)

// NewPool creates a PostgreSQL connection pool with retry logic.
func NewPool(ctx context.Context, dsn string, logger *slog.Logger) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse DSN: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	var pool *pgxpool.Pool
	for attempt := 1; attempt <= maxRetries; attempt++ {
		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				logger.Info("database connected",
					"host", config.ConnConfig.Host,
					"port", config.ConnConfig.Port,
					"database", config.ConnConfig.Database,
				)
				return pool, nil
			}
			pool.Close()
		}

		logger.Warn("database connection failed, retrying",
			"attempt", attempt,
			"max_retries", maxRetries,
			"error", err,
		)

		if attempt < maxRetries {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(retryInterval):
			}
		}
	}

	return nil, fmt.Errorf("failed to connect after %d attempts: %w", maxRetries, err)
}
