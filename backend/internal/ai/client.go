package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// Theme represents an AI-generated game theme with colors, ghost names, and emoji sprites.
type Theme struct {
	Name        string   `json:"name"`
	Wall        string   `json:"wallColor"`
	Pellet      string   `json:"pelletColor"`
	PacMan      string   `json:"pacmanColor"`
	Background  string   `json:"backgroundColor"`
	GhostNames  []string `json:"ghostNames"`
	GhostColors []string `json:"ghostColors"`
	// Emoji sprites
	WallSprite        string   `json:"wallSprite"`
	PelletSprite      string   `json:"pelletSprite"`
	PacmanSprite      string   `json:"pacmanSprite"`
	PowerPelletSprite string   `json:"powerPelletSprite"`
	GhostSprites      []string `json:"ghostSprites"`
}

// Client calls an OpenAI-compatible API (Ollama or Azure OpenAI).
type Client struct {
	endpoint   string
	model      string
	apiKey     string
	httpClient *http.Client
	logger     *slog.Logger
}

// NewClient creates a new AI client.
func NewClient(endpoint, model, apiKey string, logger *slog.Logger) *Client {
	return &Client{
		endpoint: strings.TrimRight(endpoint, "/"),
		model:    model,
		apiKey:   apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		logger: logger,
	}
}

type ollamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Format string `json:"format"`
}

type ollamaResponse struct {
	Response string `json:"response"`
}

type openAIChatRequest struct {
	Model    string          `json:"model"`
	Messages []openAIMessage `json:"messages"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// GenerateTheme asks the AI model to generate a Pac-Man theme from a description.
func (c *Client) GenerateTheme(ctx context.Context, description string) (*Theme, error) {
	prompt := fmt.Sprintf(`You are a creative game designer. Generate a Pac-Man game theme based on this description: "%s"

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "name": "Theme Name (2-3 words)",
  "wallColor": "#hex color for maze walls",
  "pelletColor": "#hex color for pellets",
  "pacmanColor": "#hex color for pac-man",
  "backgroundColor": "#hex color for background",
  "ghostNames": ["Ghost1Name", "Ghost2Name", "Ghost3Name", "Ghost4Name"],
  "ghostColors": ["#hex for ghost 1", "#hex for ghost 2", "#hex for ghost 3", "#hex for ghost 4"],
  "wallSprite": "single emoji for wall blocks",
  "pelletSprite": "single emoji for pellets/collectibles",
  "pacmanSprite": "single emoji for pac-man character",
  "powerPelletSprite": "single emoji for power pellets",
  "ghostSprites": ["emoji for ghost 1", "emoji for ghost 2", "emoji for ghost 3", "emoji for ghost 4"]
}

Rules:
- All colors must be valid 6-digit hex codes starting with #
- Ghost names should be fun and thematic (replace Blinky, Pinky, Inky, Clyde)
- Colors should be visually distinct and match the theme
- Background should be dark enough for good contrast
- Each sprite field must be exactly ONE emoji character that matches the theme
- Example sprites for "Halloween": wall🧱 pellet🍬 pacman🎃 power⭐ ghosts[👻,💀,🦇,🕷️]
- Example sprites for "Ocean": wall🪸 pellet🫧 pacman🐠 power🌊 ghosts[🦈,🐙,🪼,🐡]
- Choose creative, thematic emoji that visually represent the game elements`, description)

	c.logger.Info("Generating theme via AI", "description", description, "model", c.model)

	// Try Ollama API first (local model)
	theme, err := c.callOllama(ctx, prompt)
	if err != nil {
		c.logger.Warn("Ollama call failed, trying OpenAI-compatible API", "error", err)
		theme, err = c.callOpenAI(ctx, prompt)
		if err != nil {
			return nil, fmt.Errorf("AI generation failed: %w", err)
		}
	}

	return theme, nil
}

func (c *Client) callOllama(ctx context.Context, prompt string) (*Theme, error) {
	reqBody := ollamaRequest{
		Model:  c.model,
		Prompt: prompt,
		Stream: false,
		Format: "json",
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := c.endpoint + "/api/generate"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama returned %d: %s", resp.StatusCode, string(body))
	}

	var ollamaResp ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, fmt.Errorf("failed to decode ollama response: %w", err)
	}

	var theme Theme
	if err := json.Unmarshal([]byte(ollamaResp.Response), &theme); err != nil {
		return nil, fmt.Errorf("failed to parse theme JSON from AI: %w (raw: %s)", err, ollamaResp.Response)
	}

	return &theme, nil
}

func (c *Client) callOpenAI(ctx context.Context, prompt string) (*Theme, error) {
	reqBody := openAIChatRequest{
		Model: c.model,
		Messages: []openAIMessage{
			{Role: "user", Content: prompt},
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := c.endpoint + "/v1/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" && c.apiKey != "not-required-for-ollama" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API returned %d: %s", resp.StatusCode, string(body))
	}

	var chatResp openAIChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenAI response")
	}

	content := chatResp.Choices[0].Message.Content
	content = extractJSON(content)

	var theme Theme
	if err := json.Unmarshal([]byte(content), &theme); err != nil {
		return nil, fmt.Errorf("failed to parse theme from OpenAI: %w (raw: %s)", err, content)
	}

	return &theme, nil
}

// extractJSON strips markdown code fences from a JSON response.
func extractJSON(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```json") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimSuffix(s, "```")
		s = strings.TrimSpace(s)
	} else if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(s, "```")
		s = strings.TrimSpace(s)
	}
	return s
}

// Healthy checks if the AI model endpoint is reachable.
func (c *Client) Healthy(ctx context.Context) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.endpoint, nil)
	if err != nil {
		return false
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode < 500
}
