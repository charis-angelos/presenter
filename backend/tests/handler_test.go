package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"intelligent-presenter-backend/internal/api"
	"intelligent-presenter-backend/pkg/config"

	"github.com/gin-gonic/gin"
)

func newTestRouter(cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api.SetupRoutes(router, cfg)
	return router
}

func TestHealthEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
			"version":   "1.0.0",
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["status"] != "healthy" {
		t.Errorf("expected status 'healthy', got %v", body["status"])
	}
}

func TestAuthCallbackMissingCode(t *testing.T) {
	cfg := &config.Config{
		BacklogDomain:    "example.backlog.jp",
		BacklogClientID:  "test-client-id",
		JWTSecret:        "test-secret-key",
		OAuthRedirectURL: "http://localhost:8080/api/v1/auth/callback",
		FrontendBaseURL:  "http://localhost:3003",
	}
	router := newTestRouter(cfg)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/callback", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if _, hasError := body["error"]; !hasError {
		t.Error("expected error field in response")
	}
}

func TestSlideGenerateUnauthorized(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-secret-key",
		Port:      "8080",
	}
	router := newTestRouter(cfg)

	payload := strings.NewReader(`{"projectId":"TEST","themes":["project_overview"],"language":"ja"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/slides/generate", payload)
	req.Header.Set("Content-Type", "application/json")
	// No Authorization header — middleware should reject
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}
