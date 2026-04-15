package tests

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"intelligent-presenter-backend/internal/services"
	"intelligent-presenter-backend/pkg/config"
)

// ---------------------------------------------------------------------------
// SpeechService
// ---------------------------------------------------------------------------

func TestSpeechService_New(t *testing.T) {
	cfg := &config.Config{}
	svc := services.NewSpeechService(cfg)
	if svc == nil {
		t.Fatal("NewSpeechService returned nil")
	}
}

func TestSpeechService_NoURLReturnsError(t *testing.T) {
	cfg := &config.Config{MCPSpeechURL: ""}
	svc := services.NewSpeechService(cfg)

	_, err := svc.SynthesizeSpeech("test", "ja", "")
	if err == nil {
		t.Fatal("Expected error when MCPSpeechURL is empty")
	}
	if !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected 'not configured' in error, got: %v", err)
	}
}

func TestSpeechService_CallsConfiguredURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"audioUrl":"/api/v1/speech/audio/test.wav","duration":0}`))
	}))
	defer srv.Close()

	cfg := &config.Config{MCPSpeechURL: srv.URL}
	svc := services.NewSpeechService(cfg)

	// Use unique input so it won't hit cache from a previous test run
	url, err := svc.SynthesizeSpeech("unique_test_phrase_xyz123", "en", "test")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if url == "" {
		t.Error("Expected non-empty audio URL")
	}
}

func TestSpeechService_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	defer srv.Close()

	cfg := &config.Config{MCPSpeechURL: srv.URL}
	svc := services.NewSpeechService(cfg)

	_, err := svc.SynthesizeSpeech("error_test_phrase_abc999", "en", "")
	if err == nil {
		t.Fatal("Expected error from speech server 500 response")
	}
}

// ---------------------------------------------------------------------------
// BedrockService
// ---------------------------------------------------------------------------

func TestBedrockService_New(t *testing.T) {
	cfg := &config.Config{
		AWSRegion:      "us-east-1",
		BedrockModelID: "anthropic.claude-3-haiku-20240307-v1:0",
	}
	svc := services.NewBedrockService(cfg)
	if svc == nil {
		t.Fatal("NewBedrockService returned nil")
	}
}

func TestBedrockService_MissingCredentials(t *testing.T) {
	cfg := &config.Config{
		AWSRegion:      "us-east-1",
		BedrockModelID: "anthropic.claude-3-haiku-20240307-v1:0",
		// No AWSAccessKeyID or AWSSecretAccessKey
	}
	svc := services.NewBedrockService(cfg)

	_, err := svc.GenerateText("test prompt")
	if err == nil {
		t.Fatal("Expected error when AWS credentials are missing")
	}
}

// ---------------------------------------------------------------------------
// BedrockSDKService
// ---------------------------------------------------------------------------

func TestBedrockSDKService_RequiresCredentials(t *testing.T) {
	cfg := &config.Config{
		AWSRegion:         "us-east-1",
		BedrockModelID:    "anthropic.claude-3-haiku-20240307-v1:0",
		AWSAccessKeyID:    "test-key",
		AWSSecretAccessKey: "test-secret",
	}
	// Construction should succeed with valid-looking credentials
	svc, err := services.NewBedrockSDKService(cfg)
	if err != nil {
		t.Fatalf("Unexpected construction error: %v", err)
	}
	if svc == nil {
		t.Fatal("NewBedrockSDKService returned nil")
	}
}
