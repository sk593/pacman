package model

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Theme represents a stored game theme.
type Theme struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	WallColor   string    `json:"wall_color"`
	PelletColor string    `json:"pellet_color"`
	PacManColor string    `json:"pacman_color"`
	BgColor     string    `json:"background_color"`
	Ghost1Name  string    `json:"ghost1_name"`
	Ghost2Name  string    `json:"ghost2_name"`
	Ghost3Name  string    `json:"ghost3_name"`
	Ghost4Name  string    `json:"ghost4_name"`
	Ghost1Color string    `json:"ghost1_color"`
	Ghost2Color string    `json:"ghost2_color"`
	Ghost3Color string    `json:"ghost3_color"`
	Ghost4Color string    `json:"ghost4_color"`
	// Emoji sprites for visual theming (optional)
	WallSprite        string `json:"wall_sprite"`
	PelletSprite      string `json:"pellet_sprite"`
	PacmanSprite      string `json:"pacman_sprite"`
	PowerPelletSprite string `json:"power_pellet_sprite"`
	Ghost1Sprite      string `json:"ghost1_sprite"`
	Ghost2Sprite      string `json:"ghost2_sprite"`
	Ghost3Sprite      string `json:"ghost3_sprite"`
	Ghost4Sprite      string `json:"ghost4_sprite"`
	CreatedAt         time.Time `json:"created_at"`
}

// ThemeGenerateRequest is the request body for generating a new theme.
type ThemeGenerateRequest struct {
	Description string `json:"description"`
}

// Validate checks the theme generation request.
func (r *ThemeGenerateRequest) Validate() error {
	r.Description = strings.TrimSpace(r.Description)
	if r.Description == "" {
		return fmt.Errorf("description is required")
	}
	if len(r.Description) > 200 {
		return fmt.Errorf("description must be 200 characters or fewer")
	}
	return nil
}

var hexColorRegex = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// ValidateHexColor checks if a string is a valid hex color.
func ValidateHexColor(c string) bool {
	return hexColorRegex.MatchString(c)
}
