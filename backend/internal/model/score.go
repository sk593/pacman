package model

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// HighScoreEntry represents a single leaderboard entry.
type HighScoreEntry struct {
	ID           int       `json:"id"`
	PlayerName   string    `json:"player_name"`
	Score        int       `json:"score"`
	LevelReached int       `json:"level_reached"`
	CreatedAt    time.Time `json:"created_at"`
}

// ScoreSubmission is the payload for submitting a new score.
type ScoreSubmission struct {
	PlayerName   string `json:"player_name"`
	Score        int    `json:"score"`
	LevelReached int    `json:"level_reached"`
}

// nameRegex matches 1-10 printable ASCII characters.
var nameRegex = regexp.MustCompile(`^[\x20-\x7E]{1,10}$`)

// Validate checks the submission and returns an error if invalid.
func (s *ScoreSubmission) Validate() error {
	s.PlayerName = strings.TrimSpace(s.PlayerName)

	if s.PlayerName == "" {
		return fmt.Errorf("player_name must not be empty")
	}
	if len(s.PlayerName) > 10 {
		return fmt.Errorf("player_name must be at most 10 characters")
	}
	if !nameRegex.MatchString(s.PlayerName) {
		return fmt.Errorf("player_name must be 1-10 printable ASCII characters")
	}
	if s.Score <= 0 {
		return fmt.Errorf("score must be a positive integer")
	}
	if s.LevelReached < 1 {
		return fmt.Errorf("level_reached must be at least 1")
	}
	return nil
}
