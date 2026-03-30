package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps a Redis client with domain-specific operations.
type Client struct {
	rdb    *redis.Client
	logger *slog.Logger
}

// NewClient creates a Redis client and verifies connectivity.
func NewClient(ctx context.Context, addr, password string, logger *slog.Logger) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	// Retry ping up to 10 times
	var lastErr error
	for i := 0; i < 10; i++ {
		if err := rdb.Ping(ctx).Err(); err != nil {
			lastErr = err
			logger.Warn("Redis ping failed, retrying...", "attempt", i+1, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}
		logger.Info("Connected to Redis", "addr", addr)
		return &Client{rdb: rdb, logger: logger}, nil
	}
	return nil, fmt.Errorf("failed to connect to Redis after retries: %w", lastErr)
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// Ping checks Redis connectivity.
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// --- Leaderboard Cache ---

const leaderboardKey = "pacman:leaderboard"
const leaderboardTTL = 30 * time.Second

// GetLeaderboard retrieves the cached leaderboard JSON.
// Returns nil if cache miss.
func (c *Client) GetLeaderboard(ctx context.Context) ([]byte, error) {
	val, err := c.rdb.Get(ctx, leaderboardKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return val, nil
}

// SetLeaderboard caches leaderboard JSON with TTL.
func (c *Client) SetLeaderboard(ctx context.Context, data []byte) error {
	return c.rdb.Set(ctx, leaderboardKey, data, leaderboardTTL).Err()
}

// InvalidateLeaderboard removes the cached leaderboard.
func (c *Client) InvalidateLeaderboard(ctx context.Context) error {
	return c.rdb.Del(ctx, leaderboardKey).Err()
}

// --- Score Queue ---

const scoreQueueKey = "pacman:score:queue"

// ScoreMessage represents a score submission queued for async processing.
type ScoreMessage struct {
	PlayerName   string `json:"player_name"`
	Score        int    `json:"score"`
	LevelReached int    `json:"level_reached"`
}

// PushScore enqueues a score for async processing.
func (c *Client) PushScore(ctx context.Context, msg ScoreMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return c.rdb.LPush(ctx, scoreQueueKey, data).Err()
}

// PopScore dequeues a score from the queue (blocking, with timeout).
func (c *Client) PopScore(ctx context.Context, timeout time.Duration) (*ScoreMessage, error) {
	result, err := c.rdb.BRPop(ctx, timeout, scoreQueueKey).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(result) < 2 {
		return nil, nil
	}

	var msg ScoreMessage
	if err := json.Unmarshal([]byte(result[1]), &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}
