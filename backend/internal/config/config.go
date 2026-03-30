package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all environment-based configuration for the backend server.
type Config struct {
	// Database connection
	DBHost     string
	DBPort     int
	DBName     string
	DBUser     string
	DBPassword string

	// Redis connection
	RedisHost     string
	RedisPort     int
	RedisPassword string

	// AI model connection
	AIEndpoint string
	AIModel    string
	AIAPIKey   string

	// Blob storage connection
	StorageEndpoint  string
	StorageBucket    string
	StorageAccessKey string
	StorageSecretKey string

	// Server
	Port     int
	LogLevel string
}

// Load reads configuration from environment variables.
// Radius custom resource types inject CONNECTION_<NAME>_PROPERTIES as JSON.
// We parse that JSON to extract host, port, database, username, password, etc.
// Falls back to individual CONNECTION_<NAME>_* env vars for compatibility.
func Load() (*Config, error) {
	// Parse connection properties JSON blobs from Radius
	dbProps := parseConnectionProperties("CONNECTION_DB_PROPERTIES")
	cacheProps := parseConnectionProperties("CONNECTION_CACHE_PROPERTIES")
	aiProps := parseConnectionProperties("CONNECTION_AI_PROPERTIES")
	storageProps := parseConnectionProperties("CONNECTION_STORAGE_PROPERTIES")

	cfg := &Config{
		// Database
		DBHost:     getEnvOrProp("CONNECTION_DB_HOST", dbProps, "host", "localhost"),
		DBName:     getEnvOrProp("CONNECTION_DB_DATABASE", dbProps, "database", "pacman"),
		DBUser:     getEnvOrProp("CONNECTION_DB_USERNAME", dbProps, "username", "pacman"),
		DBPassword: getEnvOrProp("CONNECTION_DB_PASSWORD", dbProps, "password", "pacman"),

		// Redis
		RedisHost:     getEnvOrProp("CONNECTION_CACHE_HOST", cacheProps, "host", "localhost"),
		RedisPassword: getEnvOrProp("CONNECTION_CACHE_PASSWORD", cacheProps, "password", ""),

		// AI Model
		AIEndpoint: getEnvOrProp("CONNECTION_AI_ENDPOINT", aiProps, "endpoint", "http://localhost:11434"),
		AIModel:    getEnvOrProp("CONNECTION_AI_MODEL", aiProps, "model", "phi3:mini"),
		AIAPIKey:   getEnvOrProp("CONNECTION_AI_APIKEY", aiProps, "apiKey", ""),

		// Blob Storage
		StorageEndpoint:  getEnvOrProp("CONNECTION_STORAGE_ENDPOINT", storageProps, "endpoint", "http://localhost:9000"),
		StorageBucket:    getEnvOrProp("CONNECTION_STORAGE_BUCKET", storageProps, "bucket", "pacman-themes"),
		StorageAccessKey: getEnvOrProp("CONNECTION_STORAGE_ACCESSKEY", storageProps, "accessKey", "minioadmin"),
		StorageSecretKey: getEnvOrProp("CONNECTION_STORAGE_SECRETKEY", storageProps, "secretKey", "minioadmin"),

		LogLevel: strings.ToLower(getEnv("LOG_LEVEL", "info")),
	}

	var err error

	// DB port
	if v := os.Getenv("CONNECTION_DB_PORT"); v != "" {
		cfg.DBPort, err = strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid CONNECTION_DB_PORT: %w", err)
		}
	} else if p, ok := dbProps["port"]; ok {
		cfg.DBPort = parseIntProp(p, 5432)
	} else {
		cfg.DBPort = 5432
	}

	// Redis port
	if v := os.Getenv("CONNECTION_CACHE_PORT"); v != "" {
		cfg.RedisPort, err = strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("invalid CONNECTION_CACHE_PORT: %w", err)
		}
	} else if p, ok := cacheProps["port"]; ok {
		cfg.RedisPort = parseIntProp(p, 6379)
	} else {
		cfg.RedisPort = 6379
	}

	cfg.Port, err = getEnvInt("PORT", 8080)
	if err != nil {
		return nil, fmt.Errorf("invalid PORT: %w", err)
	}

	return cfg, nil
}

// RedisAddr returns the Redis connection address as host:port.
func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%d", c.RedisHost, c.RedisPort)
}

// DSN returns the PostgreSQL connection string.
func (c *Config) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

// parseConnectionProperties parses a JSON env var into a map.
// Radius custom resource types provide connection data as a JSON object
// in CONNECTION_<NAME>_PROPERTIES containing resource-specific fields.
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

// parseIntProp extracts an int from a JSON property value (float64 or string).
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

// getEnvOrProp returns the value from env var, then from parsed properties, then fallback.
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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	return strconv.Atoi(v)
}
