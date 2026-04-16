package handlers

import (
	"log/slog"
	"net/http"

	"intelligent-presenter-backend/internal/services"
	"intelligent-presenter-backend/pkg/config"

	"github.com/gin-gonic/gin"
)

type MCPHandler struct {
	config     *config.Config
	mcpService *services.MCPService
}

func NewMCPHandler(cfg *config.Config) *MCPHandler {
	return &MCPHandler{
		config:     cfg,
		mcpService: services.NewMCPService(cfg),
	}
}

func (h *MCPHandler) GetProjects(c *gin.Context) {
	backlogToken := c.GetString("backlogToken")

	projects, err := h.mcpService.GetProjects(backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get projects",
		})
		return
	}

	c.JSON(http.StatusOK, projects)
}

func (h *MCPHandler) GetProjectOverview(c *gin.Context) {
	projectID := c.Param("projectId")
	backlogToken := c.GetString("backlogToken")

	overview, err := h.mcpService.GetProjectOverview(projectID, backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get project overview",
		})
		return
	}

	c.JSON(http.StatusOK, overview)
}

func (h *MCPHandler) GetProjectProgress(c *gin.Context) {
	projectID := c.Param("projectId")
	backlogToken := c.GetString("backlogToken")

	progress, err := h.mcpService.GetProjectProgress(projectID, backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get project progress",
		})
		return
	}

	c.JSON(http.StatusOK, progress)
}

func (h *MCPHandler) GetProjectIssues(c *gin.Context) {
	projectID := c.Param("projectId")
	backlogToken := c.GetString("backlogToken")

	issues, err := h.mcpService.GetProjectIssues(projectID, backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get project issues",
		})
		return
	}

	c.JSON(http.StatusOK, issues)
}

func (h *MCPHandler) GetProjectTeam(c *gin.Context) {
	projectID := c.Param("projectId")
	backlogToken := c.GetString("backlogToken")

	team, err := h.mcpService.GetProjectTeam(projectID, backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get project team",
		})
		return
	}

	c.JSON(http.StatusOK, team)
}

func (h *MCPHandler) GetProjectRisks(c *gin.Context) {
	projectID := c.Param("projectId")
	backlogToken := c.GetString("backlogToken")

	risks, err := h.mcpService.GetProjectRisks(projectID, backlogToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get project risks",
		})
		return
	}

	c.JSON(http.StatusOK, risks)
}

func (h *MCPHandler) SynthesizeSpeech(c *gin.Context) {
	var req struct {
		Text      string `json:"text" binding:"required"`
		Language  string `json:"language" binding:"required"`
		Voice     string `json:"voice"`
		Streaming bool   `json:"streaming"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
		})
		return
	}

	audioURL, err := h.mcpService.SynthesizeSpeech(req.Text, req.Language, req.Voice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to synthesize speech",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"audioUrl": audioURL,
		"text":     req.Text,
		"language": req.Language,
	})
}

func (h *MCPHandler) GetAudioFile(c *gin.Context) {
	filename := c.Param("filename")

	// Proxy request to Speech MCP server
	speechURL := h.config.MCPSpeechURL + "/cache/" + filename

	slog.Debug("proxying audio file request", "filename", filename, "url", speechURL)

	// Create HTTP client
	client := &http.Client{}

	// Create request to Speech MCP server
	req, err := http.NewRequest("GET", speechURL, nil)
	if err != nil {
		slog.Error("failed to create audio file request", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create request",
		})
		return
	}

	// Forward the request
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("audio file request failed", "error", err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Audio file not found",
		})
		return
	}
	defer resp.Body.Close()

	slog.Debug("speech server response", "status", resp.StatusCode)

	// Forward status code
	if resp.StatusCode != http.StatusOK {
		slog.Error("speech server returned non-200", "status", resp.StatusCode)
		c.JSON(resp.StatusCode, gin.H{
			"error": "Audio file not found",
		})
		return
	}

	// Set appropriate headers for audio streaming
	c.Header("Content-Type", "audio/wav")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Header("Content-Length", resp.Header.Get("Content-Length"))

	slog.Debug("streaming audio file", "content_length", resp.Header.Get("Content-Length"))

	// Stream the audio file content
	c.DataFromReader(http.StatusOK, resp.ContentLength, "audio/wav", resp.Body, nil)
}