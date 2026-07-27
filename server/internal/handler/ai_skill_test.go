package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupAISkillTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("DISABLE_FILE_LOG", "1")
	logger.InitLogger()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.AISkill{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.User{ID: 101, Username: "skill-owner", Role: "user", IsActive: true}).Error; err != nil {
		t.Fatal(err)
	}
	previous := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previous
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			_ = sqlDB.Close()
		}
	})
	router := gin.New()
	auth := router.Group("/ai")
	auth.Use(middleware.Auth(&config.Config{JWT: config.JWTConfig{Secret: workflowRuntimeTestSecret}}))
	auth.GET("/skills", ListAISkills)
	auth.GET("/skills/:skillId", GetAISkill)
	auth.POST("/skills/preview", PreviewAISkillImport)
	auth.POST("/skills/install", InstallAISkill)
	auth.DELETE("/skills/:skillId", ArchiveAISkill)
	return router
}

func TestInstallAISkillStoresSkillBodyServerSide(t *testing.T) {
	router := setupAISkillTestRouter(t)
	previousDiscover := discoverAISkillSources
	discoveryCount := 0
	discoverAISkillSources = func(context.Context, string) ([]aiSkillImportSource, error) {
		discoveryCount++
		references := "## 参考资料：skills/minimal-zine/references/style.md\nold paper and large negative space"
		if discoveryCount > 1 {
			references = "## 参考资料：skills/minimal-zine/references/style.md\nrefreshed paper texture"
		}
		return []aiSkillImportSource{{
			RepositoryURL: "https://github.com/example/minimal-zine",
			Path:          "skills/minimal-zine/SKILL.md", Name: "minimal-zine",
			URL: "https://github.com/example/minimal-zine/blob/main/skills/minimal-zine/SKILL.md", Author: "example",
			Description:      "Generate a minimal zine poster",
			Content:          "---\nname: minimal-zine\ndescription: Generate a minimal zine poster\n---\n# Skill body",
			ReferenceContent: references,
			ReferenceCount:   1,
		}}, nil
	}
	t.Cleanup(func() { discoverAISkillSources = previousDiscover })

	body, err := json.Marshal(installAISkillPayload{URL: "https://github.com/example/minimal-zine"})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/ai/skills/install", bytes.NewReader(body))
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	installedResult := decodeAIPromptData[struct {
		List []aiSkillView `json:"list"`
	}](t, recorder)
	if len(installedResult.List) != 1 {
		t.Fatalf("installed skills=%+v", installedResult)
	}
	installed := installedResult.List[0]
	if installed.Name != "minimal-zine" || installed.SourceAuthor != "example" || installed.Description != "Generate a minimal zine poster" {
		t.Fatalf("installed skill=%+v", installed)
	}
	if installed.ID == 0 {
		t.Fatalf("missing installed skill ID: %+v", installed)
	}

	var stored model.AISkill
	if err := database.GetDB().First(&stored, installed.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Content == "" || stored.Content == installed.Description {
		t.Fatalf("skill body was not stored separately: %+v", stored)
	}
	if stored.ReferenceContent == "" {
		t.Fatalf("skill references were not stored: %+v", stored)
	}

	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodPost, "/ai/skills/install", bytes.NewReader(body))
	secondRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	secondRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(secondRecorder, secondRequest)
	secondResult := decodeAIPromptData[struct {
		List []aiSkillView `json:"list"`
	}](t, secondRecorder)
	if len(secondResult.List) != 1 {
		t.Fatalf("installed skills=%+v", secondResult)
	}
	second := secondResult.List[0]
	if second.ID != installed.ID {
		t.Fatalf("same source should not duplicate skill: first=%s second=%s", installed.ID, second.ID)
	}
	if err := database.GetDB().First(&stored, installed.ID).Error; err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stored.ReferenceContent, "refreshed paper texture") {
		t.Fatalf("reinstall should refresh bundled references: %+v", stored)
	}
}

func TestPreviewAISkillImportReturnsReferencesAndSelectedInstallStoresThem(t *testing.T) {
	router := setupAISkillTestRouter(t)
	previousDiscover := discoverAISkillSources
	discoverAISkillSources = func(context.Context, string) ([]aiSkillImportSource, error) {
		return []aiSkillImportSource{
			{RepositoryURL: "https://github.com/example/collection", Path: "skills/a/SKILL.md", Name: "skill-a", ReferenceCount: 2, URL: "https://github.com/example/collection/blob/main/skills/a/SKILL.md", Author: "example", Content: "a"},
			{RepositoryURL: "https://github.com/example/collection", Path: "skills/b/SKILL.md", Name: "skill-b", URL: "https://github.com/example/collection/blob/main/skills/b/SKILL.md", Author: "example", Content: "b"},
		}, nil
	}
	t.Cleanup(func() { discoverAISkillSources = previousDiscover })

	previewRecorder := httptest.NewRecorder()
	router.ServeHTTP(previewRecorder, aiPromptRequest(t, http.MethodPost, "/ai/skills/preview", "101", installAISkillPayload{URL: "https://github.com/example/collection"}))
	preview := decodeAIPromptData[aiSkillImportPreviewView](t, previewRecorder)
	if len(preview.Skills) != 2 || preview.Skills[0].ReferenceCount != 2 {
		t.Fatalf("preview=%+v", preview)
	}

	installRecorder := httptest.NewRecorder()
	router.ServeHTTP(installRecorder, aiPromptRequest(t, http.MethodPost, "/ai/skills/install", "101", installAISkillPayload{
		URL: "https://github.com/example/collection", Paths: []string{"skills/b/SKILL.md"},
	}))
	installed := decodeAIPromptData[struct {
		List []aiSkillView `json:"list"`
	}](t, installRecorder)
	if len(installed.List) != 1 || installed.List[0].Name != "skill-b" {
		t.Fatalf("installed=%+v", installed)
	}
}

func TestGetAISkillShowsImportedDirectoryFiles(t *testing.T) {
	router := setupAISkillTestRouter(t)
	skill := model.AISkill{
		UserID: 101, Name: "photography-scene", Content: "# Skill\nUse camera details.",
		ReferenceContent: "## 参考资料：skills/photography-scene/references/camera.md\n# Cameras\nUse 50mm lens.\n\n## 参考资料：skills/photography-scene/references/examples/portrait.mdx\n# Portrait",
		SourceURL:        "https://github.com/example/skills/blob/main/skills/photography-scene/SKILL.md",
	}
	if err := database.GetDB().Create(&skill).Error; err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, aiPromptRequest(t, http.MethodGet, "/ai/skills/"+skill.ID.String(), "101", nil))
	detail := decodeAIPromptData[aiSkillDetailView](t, recorder)
	if detail.Name != "photography-scene" || len(detail.Files) != 3 ||
		detail.Files[0].Path != "SKILL.md" || detail.Files[1].Path != "references/camera.md" ||
		detail.Files[2].Path != "references/examples/portrait.mdx" {
		t.Fatalf("detail=%+v", detail)
	}
}

func TestDiscoverGitHubAISkillSourcesImportsBundledReferences(t *testing.T) {
	previousClient := promptImportHTTPClient
	promptImportHTTPClient = &http.Client{Transport: aiPromptImportRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		status := http.StatusNotFound
		body := `{"message":"Not Found"}`
		switch request.URL.Host + request.URL.Path {
		case "api.github.com/repos/owner/collection/contents/skills":
			status = http.StatusOK
			body = `[{"name":"zelda-style","type":"dir"}]`
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/SKILL.md":
			status = http.StatusOK
			body = "---\nname: zelda-style\ndescription: Zelda image style\n---\n# Skill"
		case "api.github.com/repos/owner/collection/contents/skills/zelda-style/references":
			status = http.StatusOK
			body = `[{"name":"palette.md","type":"file"},{"name":"rendering.md","type":"file"}]`
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/references/palette.md":
			status = http.StatusOK
			body = "warm forest palette"
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/references/rendering.md":
			status = http.StatusOK
			body = "hand-painted rendering"
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     make(http.Header),
		}, nil
	})}
	t.Cleanup(func() { promptImportHTTPClient = previousClient })

	sources, err := discoverGitHubAISkillSources(context.Background(), "https://github.com/owner/collection")
	if err != nil {
		t.Fatal(err)
	}
	if len(sources) != 1 || sources[0].Name != "zelda-style" || sources[0].ReferenceCount != 2 ||
		!strings.Contains(sources[0].ReferenceContent, "hand-painted rendering") {
		t.Fatalf("sources=%+v", sources)
	}
}

func TestDiscoverGitHubAISkillSourcesFallsBackToArchiveWhenContentsAPIIsRateLimited(t *testing.T) {
	var archiveBuffer bytes.Buffer
	archiveWriter := zip.NewWriter(&archiveBuffer)
	for _, path := range []string{
		"collection-main/skills/zelda-style/SKILL.md",
		"collection-main/skills/zelda-style/references/palette.md",
	} {
		writer, err := archiveWriter.Create(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write([]byte("placeholder")); err != nil {
			t.Fatal(err)
		}
	}
	if err := archiveWriter.Close(); err != nil {
		t.Fatal(err)
	}

	previousClient := promptImportHTTPClient
	promptImportHTTPClient = &http.Client{Transport: aiPromptImportRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		status := http.StatusNotFound
		body := `{"message":"Not Found"}`
		var responseBody io.Reader
		switch request.URL.Host + request.URL.Path {
		case "api.github.com/repos/owner/collection/contents/skills", "api.github.com/repos/owner/collection/contents/skills/zelda-style/references":
			status = http.StatusForbidden
			body = `{"message":"API rate limit exceeded"}`
		case "codeload.github.com/owner/collection/zip/HEAD":
			status = http.StatusOK
			responseBody = bytes.NewReader(archiveBuffer.Bytes())
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/SKILL.md":
			status = http.StatusOK
			body = "---\nname: zelda-style\ndescription: Zelda image style\n---\n# Skill"
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/references/palette.md":
			status = http.StatusOK
			body = "warm forest palette"
		}
		if responseBody == nil {
			responseBody = strings.NewReader(body)
		}
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(responseBody),
			Header:     make(http.Header),
		}, nil
	})}
	t.Cleanup(func() { promptImportHTTPClient = previousClient })

	sources, err := discoverGitHubAISkillSources(context.Background(), "https://github.com/owner/collection")
	if err != nil {
		t.Fatal(err)
	}
	if len(sources) != 1 || sources[0].ReferenceCount != 1 || !strings.Contains(sources[0].ReferenceContent, "warm forest palette") {
		t.Fatalf("sources=%+v", sources)
	}
}
