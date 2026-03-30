package db

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// MigrationSQL holds the embedded SQL migration content.
// Set from the main package which embeds sql/*.sql files.
var MigrationSQL []byte

// Migrate runs the embedded SQL migration against the database.
func Migrate(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	if len(MigrationSQL) == 0 {
		logger.Info("no migrations to run")
		return nil
	}

	logger.Info("running migration", "file", "001_create_scores.sql")

	if _, err := pool.Exec(ctx, string(MigrationSQL)); err != nil {
		return fmt.Errorf("execute migration: %w", err)
	}

	logger.Info("migration complete")
	return nil
}
