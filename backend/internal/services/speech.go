package services

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"intelligent-presenter-backend/pkg/config"
)

type SpeechService struct {
	config    *config.Config
	cacheDir  string
	client    *http.Client
}

type SpeechRequest struct {
	Text      string `json:"text"`
	Language  string `json:"language"`
	Voice     string `json:"voice"`
	Streaming bool   `json:"streaming"`
}

type SpeechResponse struct {
	AudioURL  string        `json:"audioUrl"`
	Duration  time.Duration `json:"duration"`
	Language  string        `json:"language"`
	Voice     string        `json:"voice"`
	CacheHit  bool          `json:"cacheHit"`
	RequestID string        `json:"requestId"`
}

func NewSpeechService(cfg *config.Config) *SpeechService {
	cacheDir := "./cache/audio"
	os.MkdirAll(cacheDir, 0755)
	
	return &SpeechService{
		config:   cfg,
		cacheDir: cacheDir,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *SpeechService) SynthesizeSpeech(text, language, voice string) (string, error) {
	// Generate cache key
	cacheKey := s.generateCacheKey(text, language, voice)
	audioFile := filepath.Join(s.cacheDir, cacheKey+".wav")
	
	// Check if audio file already exists in cache
	if _, err := os.Stat(audioFile); err == nil {
		// Return cached file URL
		return fmt.Sprintf("/api/v1/speech/audio/%s.wav", cacheKey), nil
	}
	
	// Require a speech server to be configured
	if s.config.MCPSpeechURL == "" {
		return "", fmt.Errorf("speech service URL not configured")
	}
	return s.callSpeechServer(text, language, voice, cacheKey)
}

func (s *SpeechService) callSpeechServer(text, language, voice, cacheKey string) (string, error) {
	request := SpeechRequest{
		Text:      text,
		Language:  language,
		Voice:     voice,
		Streaming: false,
	}
	
	requestBody, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}
	
	resp, err := s.client.Post(
		s.config.MCPSpeechURL+"/api/v1/synthesize",
		"application/json",
		bytes.NewBuffer(requestBody),
	)
	if err != nil {
		return "", fmt.Errorf("failed to call speech server: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("speech server returned status %d", resp.StatusCode)
	}
	
	var speechResponse SpeechResponse
	if err := json.NewDecoder(resp.Body).Decode(&speechResponse); err != nil {
		return "", fmt.Errorf("failed to decode speech response: %w", err)
	}
	
	return speechResponse.AudioURL, nil
}

func (s *SpeechService) generateCacheKey(text, language, voice string) string {
	content := fmt.Sprintf("%s:%s:%s", text, language, voice)
	hash := md5.Sum([]byte(content))
	return fmt.Sprintf("%x", hash)
}

func (s *SpeechService) ServeAudioFile(filename string) (string, error) {
	audioPath := filepath.Join(s.cacheDir, filename)
	
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		return "", fmt.Errorf("audio file not found: %s", filename)
	}
	
	return audioPath, nil
}