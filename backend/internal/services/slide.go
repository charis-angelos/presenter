// Package services provides core business logic services for the intelligent presenter application.
// This package includes services for slide generation, content processing, and AI integration.
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"intelligent-presenter-backend/internal/models"
	"intelligent-presenter-backend/pkg/config"
)

// SlideService provides functionality for generating presentation slides
// using AI-powered content generation and project data from Backlog.
// It integrates with multiple AI providers (OpenAI, AWS Bedrock) and
// supports various slide themes and content types.
type SlideService struct {
	config            *config.Config
	mcpService        *MCPService
	bedrockService    *BedrockService
	bedrockSDKService *BedrockSDKService
}

// NewSlideService creates a new instance of SlideService with the provided configuration.
func NewSlideService(cfg *config.Config) *SlideService {
	var bedrockSDKService *BedrockSDKService
	if cfg.AWSAccessKeyID != "" && cfg.AWSSecretAccessKey != "" {
		if sdkService, err := NewBedrockSDKService(cfg); err == nil {
			bedrockSDKService = sdkService
		} else {
			slog.Warn("Failed to create Bedrock SDK service, falling back to custom implementation", "error", err)
		}
	}

	return &SlideService{
		config:            cfg,
		mcpService:        NewMCPService(cfg),
		bedrockService:    NewBedrockService(cfg),
		bedrockSDKService: bedrockSDKService,
	}
}

// GenerateSlideContent creates a complete slide with markdown content
// for the specified project, theme, and language.
func (s *SlideService) GenerateSlideContent(projectID string, theme models.SlideTheme, language, backlogToken string) (*models.SlideContent, error) {
	projectData, err := s.getProjectDataForTheme(projectID, theme, backlogToken)
	if err != nil {
		return nil, fmt.Errorf("failed to get project data: %w", err)
	}

	markdown, title, err := s.generateMarkdownContent(projectData, theme, language)
	if err != nil {
		return nil, fmt.Errorf("failed to generate markdown: %w", err)
	}

	return &models.SlideContent{
		Theme:       theme,
		Title:       title,
		Markdown:    markdown,
		GeneratedAt: time.Now(),
	}, nil
}

// GenerateSlideNarration creates spoken narration text for a slide.
func (s *SlideService) GenerateSlideNarration(slide *models.SlideContent, language string) (*models.SlideNarration, error) {
	narrationText, err := s.generateNarrationText(slide.Markdown, slide.Title, language)
	if err != nil {
		return nil, fmt.Errorf("failed to generate narration: %w", err)
	}

	return &models.SlideNarration{
		SlideIndex: slide.Index,
		Text:       narrationText,
		Language:   language,
	}, nil
}

func (s *SlideService) GenerateSlideAudio(narration *models.SlideNarration) (*models.SlideAudio, error) {
	audioURL, err := s.mcpService.SynthesizeSpeech(narration.Text, narration.Language, "")
	if err != nil {
		return nil, fmt.Errorf("failed to synthesize speech: %w", err)
	}

	wordCount := len(strings.Fields(narration.Text))
	if wordCount < 1 {
		wordCount = 1
	}
	duration := (wordCount * 60) / 150

	return &models.SlideAudio{
		SlideIndex: narration.SlideIndex,
		AudioURL:   audioURL,
		Duration:   duration,
	}, nil
}

func (s *SlideService) getProjectDataForTheme(projectID string, theme models.SlideTheme, backlogToken string) (map[string]interface{}, error) {
	data := make(map[string]interface{})
	slog.Debug("getting project data", "theme", theme, "projectID", projectID)

	fetch := func(key string, fn func(string, string) (interface{}, error)) error {
		result, err := fn(projectID, backlogToken)
		if err != nil {
			return err
		}
		data[key] = result
		return nil
	}

	switch theme {
	case models.ThemeProjectOverview:
		return data, fetch("overview", s.mcpService.GetProjectOverview)

	case models.ThemeProjectProgress:
		return data, fetch("progress", s.mcpService.GetProjectProgress)

	case models.ThemeIssueManagement:
		return data, fetch("issues", s.mcpService.GetProjectIssues)

	case models.ThemeRiskAnalysis:
		return data, fetch("risks", s.mcpService.GetProjectRisks)

	case models.ThemeTeamCollaboration:
		if err := fetch("team", s.mcpService.GetProjectTeam); err != nil {
			slog.Warn("failed to get project team, using fallback data", "error", err)
			data["team"] = map[string]interface{}{
				"users":    []map[string]interface{}{{"name": "プロジェクトメンバー", "role": "開発者"}},
				"fallback": true,
				"error":    "API access limited - using sample data",
			}
		}

	case models.ThemeDocumentManagement, models.ThemeCodebaseActivity, models.ThemeNotifications:
		focusMap := map[models.SlideTheme]string{
			models.ThemeDocumentManagement: "documents",
			models.ThemeCodebaseActivity:   "codebase",
			models.ThemeNotifications:      "notifications",
		}
		if err := fetch("overview", s.mcpService.GetProjectOverview); err != nil {
			return nil, err
		}
		data["focus"] = focusMap[theme]

	case models.ThemePredictiveAnalysis:
		if err := fetch("progress", s.mcpService.GetProjectProgress); err != nil {
			return nil, err
		}
		if err := fetch("issues", s.mcpService.GetProjectIssues); err != nil {
			return nil, err
		}
		data["focus"] = "prediction"

	case models.ThemeSummaryPlan:
		if err := fetch("overview", s.mcpService.GetProjectOverview); err != nil {
			return nil, err
		}
		_ = fetch("progress", s.mcpService.GetProjectProgress)
		data["focus"] = "summary"

	default:
		return data, fetch("overview", s.mcpService.GetProjectOverview)
	}

	slog.Debug("project data collection completed", "theme", theme)
	return data, nil
}

func (s *SlideService) generateMarkdownContent(projectData map[string]interface{}, theme models.SlideTheme, language string) (string, string, error) {
	prompt := s.buildPromptForTheme(projectData, theme, language)

	slog.Debug("calling AI provider", "provider", s.config.AIProvider)
	response, err := s.generateText(prompt)
	if err != nil {
		return "", "", err
	}

	themeDefaultTitles := map[models.SlideTheme]string{
		models.ThemeProjectOverview:    "プロジェクト概要",
		models.ThemeProjectProgress:    "プロジェクト進捗",
		models.ThemeIssueManagement:    "課題管理",
		models.ThemeRiskAnalysis:       "リスク分析",
		models.ThemeTeamCollaboration:  "チーム協力",
		models.ThemeDocumentManagement: "ドキュメント管理",
		models.ThemeCodebaseActivity:   "コードベース活動",
		models.ThemeNotifications:      "通知管理",
		models.ThemePredictiveAnalysis: "予測分析",
		models.ThemeSummaryPlan:        "総括と計画",
	}

	themeDefaultTitlesEN := map[models.SlideTheme]string{
		models.ThemeProjectOverview:    "Project Overview",
		models.ThemeProjectProgress:    "Project Progress",
		models.ThemeIssueManagement:    "Issue Management",
		models.ThemeRiskAnalysis:       "Risk Analysis",
		models.ThemeTeamCollaboration:  "Team Collaboration",
		models.ThemeDocumentManagement: "Document Management",
		models.ThemeCodebaseActivity:   "Codebase Activity",
		models.ThemeNotifications:      "Notifications",
		models.ThemePredictiveAnalysis: "Predictive Analysis",
		models.ThemeSummaryPlan:        "Summary & Plan",
	}

	lines := strings.Split(response, "\n")

	var title string
	if language == "ja" {
		if defaultTitle, exists := themeDefaultTitles[theme]; exists {
			title = defaultTitle
		} else {
			title = "Project Slide"
		}
	} else {
		if defaultTitle, exists := themeDefaultTitlesEN[theme]; exists {
			title = defaultTitle
		} else {
			title = "Project Slide"
		}
	}

	markdown := response

	if len(lines) > 0 && strings.HasPrefix(lines[0], "#") {
		title = strings.TrimSpace(strings.TrimPrefix(lines[0], "#"))
		slog.Debug("AI generated title", "title", title, "theme", theme)
	} else {
		slog.Debug("no # title in AI response, using default", "title", title, "theme", theme)
	}

	return markdown, title, nil
}

func (s *SlideService) generateNarrationText(markdown, title, language string) (string, error) {
	var prompt string
	if language == "ja" {
		prompt = fmt.Sprintf(`
以下のMarkdown形式のスライド内容に基づいて、日本語で自然な口頭発表用のナレーションを生成してください。

スライド内容:
%s

ナレーションの要件:
1. 聞き手に分かりやすい自然な日本語
2. プロフェッショナルなプレゼンテーション調
3. 2-3分程度で読める長さ
4. スライドの内容を効果的に説明

ナレーション:`, markdown)
	} else {
		prompt = fmt.Sprintf(`
Generate natural narration text in English for the following slide content:

Slide Content:
%s

Requirements:
1. Natural, professional presentation style
2. 2-3 minutes reading time
3. Clear explanation of slide content

Narration:`, markdown)
	}

	return s.generateText(prompt)
}

// generateText calls the configured AI provider with automatic fallback.
// If Bedrock is the primary provider and fails, it falls back to OpenAI.
func (s *SlideService) generateText(prompt string) (string, error) {
	switch s.config.AIProvider {
	case "bedrock":
		response, err := s.callBedrock(prompt)
		if err != nil {
			slog.Warn("Bedrock API failed, falling back to OpenAI", "error", err)
			response, err = s.callOpenAI(prompt)
			if err != nil {
				return "", err
			}
			slog.Info("OpenAI fallback successful")
		}
		return response, nil
	default:
		return s.callOpenAI(prompt)
	}
}

func (s *SlideService) buildPromptForTheme(projectData map[string]interface{}, theme models.SlideTheme, language string) string {
	dataJSON, _ := json.Marshal(projectData)
	if len(dataJSON) > 8000 {
		dataJSON = dataJSON[:8000]
		dataJSON = append(dataJSON, []byte("...}")...)
	}

	themePrompts := map[models.SlideTheme]string{
		models.ThemeProjectOverview:    `プロジェクトの概要と基本情報のスライドを生成してください。プロジェクト名、目的、期間、チーム構成などを含めてください。`,
		models.ThemeProjectProgress:    `プロジェクトの進捗状況のスライドを生成してください。完了率、マイルストーン、現在の状況などを含めてください。`,
		models.ThemeIssueManagement:    `プロジェクトの課題管理状況のスライドを生成してください。未解決の課題、優先度分布、進行中のタスクなどを含めてください。`,
		models.ThemeRiskAnalysis:       `プロジェクトのリスク分析のスライドを生成してください。潜在的なリスク、遅延要因、対策などを含めてください。`,
		models.ThemeTeamCollaboration:  `チームの協力状況のスライドを生成してください。メンバー構成、役割分担、コミュニケーション状況などを含めてください。`,
		models.ThemeDocumentManagement: `プロジェクトの文書管理状況のスライドを生成してください。文書数、更新頻度、アクセス状況、知識共有などを含めてください。`,
		models.ThemeCodebaseActivity:   `プロジェクトの開発活動のスライドを生成してください。コミット数、開発者活動量、コード品質指標、リリース頻度などを含めてください。`,
		models.ThemeNotifications:      `プロジェクトのコミュニケーション状況のスライドを生成してください。通知数、応答率、情報伝達効率、重要通知の処理状況などを含めてください。`,
		models.ThemePredictiveAnalysis: `プロジェクトの予測分析のスライドを生成してください。完了予測日、リスク発生確率、必要リソース予測、目標達成可能性などを含めてください。`,
		models.ThemeSummaryPlan:        `プロジェクトの総括・計画のスライドを生成してください。主要成果、KPI達成状況、残課題、次期計画の要点などを含めてください。`,
	}

	themePromptsEN := map[models.SlideTheme]string{
		models.ThemeProjectOverview:    "Generate a slide for project overview and basic information. Include project name, purpose, duration, team composition, etc.",
		models.ThemeProjectProgress:    "Generate a slide for project progress status. Include completion rate, milestones, current status, etc.",
		models.ThemeIssueManagement:    "Generate a slide for project issue management status. Include unresolved issues, priority distribution, ongoing tasks, etc.",
		models.ThemeRiskAnalysis:       "Generate a slide for project risk analysis. Include potential risks, delay factors, countermeasures, etc.",
		models.ThemeTeamCollaboration:  "Generate a slide for team collaboration status. Include member composition, role assignments, communication status, etc.",
		models.ThemeDocumentManagement: "Generate a slide for project document management status. Include document count, update frequency, access status, knowledge sharing, etc.",
		models.ThemeCodebaseActivity:   "Generate a slide for project development activity. Include commit count, developer activity levels, code quality metrics, release frequency, etc.",
		models.ThemeNotifications:      "Generate a slide for project communication status. Include notification count, response rate, information transmission efficiency, important notification processing status, etc.",
		models.ThemePredictiveAnalysis: "Generate a slide for project predictive analysis. Include predicted completion date, risk occurrence probability, required resource forecast, goal achievement feasibility, etc.",
		models.ThemeSummaryPlan:        "Generate a slide for project summary and planning. Include key achievements, KPI achievement status, remaining issues, key points of next plan, etc.",
	}

	var themePrompt string
	var exists bool

	if language == "ja" {
		themePrompt, exists = themePrompts[theme]
		if !exists {
			themePrompt = "プロジェクト関連のスライドを生成してください。"
		}
		return fmt.Sprintf(`
以下のBacklogプロジェクトデータを基に、%s

データ:
%s

要件:
1. **必ず # で始まるタイトル行から開始してください**
2. **上司への報告用**として簡潔に作成
3. スライドは1枚、レイアウトはコンパクトに、3-5個の要点のみ（詳細は避ける）
4. データ可視化のため以下のうち1つを含める：
   - Mermaidダイアグラム（シンプルなフローチャート、円グラフ、ガントチャートなど）
   - Chart.jsグラフ（必要に応じて）
5. 箇条書きを多用し、読みやすく構成
6. 数値や結果を強調
7. Mermaidを使用する場合は `+"```"+`mermaid で始めること
8. **重要**: 冗長な説明は避け、核心的な情報のみ記載

スライド内容:`, themePrompt, string(dataJSON))
	} else {
		themePrompt, exists = themePromptsEN[theme]
		if !exists {
			themePrompt = "Generate a slide about the project."
		}
		return fmt.Sprintf(`
Generate a slide based on the following Backlog project data for theme: %s

Data:
%s

Requirements:
1. **Must start with a title line beginning with #**
2. **Executive briefing format** - concise and focused
3. Only generate one slide; use a compact layout.　Maximum 3-5 key points (avoid details)
4. Include one data visualization:
   - Simple Mermaid diagrams (flowcharts, pie charts, gantt charts)
   - Chart.js graphs (when appropriate)
5. Use bullet points for readability
6. Emphasize numbers and results
7. For Mermaid, use `+"```"+`mermaid code blocks
8. **Important**: Avoid verbose explanations, focus on core information only
9. **Important**: Only generate one slide
10. **Important**: Use a compact layout

Slide Content:`, themePrompt, string(dataJSON))
	}
}

func (s *SlideService) callOpenAI(prompt string) (string, error) {
	if s.config.OpenAIAPIKey == "" {
		return "", fmt.Errorf("OpenAI API key not configured")
	}

	requestBody := map[string]interface{}{
		"model": "gpt-3.5-turbo",
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens":  800,
		"temperature": 0.7,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		slog.Error("OpenAI request marshal error", "error", err)
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		slog.Error("OpenAI request creation error", "error", err)
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.OpenAIAPIKey)

	slog.Debug("making OpenAI API call")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("OpenAI API call error", "error", err)
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		slog.Error("OpenAI API error", "status", resp.StatusCode)
		var errorBytes bytes.Buffer
		errorBytes.ReadFrom(resp.Body)
		slog.Debug("OpenAI error response body", "body", errorBytes.String())
		return "", fmt.Errorf("OpenAI API returned status %d", resp.StatusCode)
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		slog.Error("OpenAI response decode error", "error", err)
		return "", err
	}

	if response.Error.Message != "" {
		slog.Error("OpenAI API error", "message", response.Error.Message, "type", response.Error.Type)
		return "", fmt.Errorf("OpenAI API error: %s", response.Error.Message)
	}

	if len(response.Choices) == 0 {
		slog.Error("OpenAI returned no choices")
		return "", fmt.Errorf("no response from OpenAI")
	}

	slog.Debug("OpenAI API call successful")
	return response.Choices[0].Message.Content, nil
}

func (s *SlideService) callBedrock(prompt string) (string, error) {
	if s.config.AWSAccessKeyID == "" || s.config.AWSSecretAccessKey == "" {
		return "", fmt.Errorf("AWS credentials not configured")
	}

	if s.bedrockSDKService != nil {
		slog.Debug("using AWS SDK for Bedrock")
		return s.bedrockSDKService.GenerateText(prompt)
	}

	slog.Debug("using custom implementation for Bedrock")
	return s.bedrockService.GenerateText(prompt)
}
