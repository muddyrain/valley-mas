package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"io/fs"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/model"
	"valley-server/internal/service"

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
	if err := db.AutoMigrate(&model.User{}, &model.AISkill{}, &model.AISkillFile{}); err != nil {
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
	auth.GET("/skills/:skillId/files/:fileId/image-data", GetAISkillFileImageData)
	auth.POST("/skills/preview", PreviewAISkillImport)
	auth.POST("/skills/install", InstallAISkill)
	auth.PATCH("/skills/:skillId", UpdateAISkill)
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
			Tags:             []string{"写作", "智能体"},
			Content:          "---\nname: minimal-zine\ndescription: Generate a minimal zine poster\n---\n# Skill body",
			ReferenceContent: references,
			ReferenceCount:   1,
			ScriptContent:    "## 脚本：skills/minimal-zine/scripts/compose.py\nprint('compose')",
			ScriptCount:      1,
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
	if got := strings.Join(installed.Tags, ","); got != "写作,智能体" {
		t.Fatalf("installed tags=%q", got)
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
	if stored.ScriptContent == "" {
		t.Fatalf("skill scripts were not stored: %+v", stored)
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

func TestUpdateAISkillTagsAndRuntimeInstructionsExcludeScripts(t *testing.T) {
	router := setupAISkillTestRouter(t)
	skill := model.AISkill{
		UserID:           101,
		Name:             "writing",
		Content:          "# Writing\nUse concise prose.",
		ReferenceContent: "# Reference\nPrefer active voice.",
		ScriptContent:    "print('must not reach the model')",
	}
	if err := database.GetDB().Create(&skill).Error; err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, aiPromptRequest(t, http.MethodPatch, "/ai/skills/"+skill.ID.String(), "101", updateAISkillPayload{Tags: []string{"智能体", "写作", "智能体"}}))
	updated := decodeAIPromptData[aiSkillView](t, recorder)
	if got := strings.Join(updated.Tags, ","); got != "智能体,写作" {
		t.Fatalf("updated tags=%q", got)
	}

	instructions, err := resolveAISkillRuntimeInstructions(database.GetDB(), 101, []string{skill.ID.String()})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(instructions, "Use concise prose.") || !strings.Contains(instructions, "Prefer active voice.") || strings.Contains(instructions, "must not reach the model") {
		t.Fatalf("instructions=%q", instructions)
	}
}

func TestNormalizeAISkillInstallSourceSupportsNpxSkillsAdd(t *testing.T) {
	url, names, err := normalizeAISkillInstallSource("npx skills add owner/collection --skill writing,review")
	if err != nil {
		t.Fatal(err)
	}
	if url != "https://github.com/owner/collection" || strings.Join(names, ",") != "writing,review" {
		t.Fatalf("url=%q names=%v", url, names)
	}
	if _, _, err := normalizeAISkillInstallSource("npx skills add owner/collection --all"); err == nil {
		t.Fatal("expected unsupported npx option to fail")
	}
}

func TestPreviewAISkillImportReturnsReferencesAndSelectedInstallStoresThem(t *testing.T) {
	router := setupAISkillTestRouter(t)
	previousDiscover := discoverAISkillSources
	discoverAISkillSources = func(context.Context, string) ([]aiSkillImportSource, error) {
		return []aiSkillImportSource{
			{RepositoryURL: "https://github.com/example/collection", Path: "skills/a/SKILL.md", Name: "skill-a", ReferenceCount: 2, ScriptCount: 1, URL: "https://github.com/example/collection/blob/main/skills/a/SKILL.md", Author: "example", Content: "a"},
			{RepositoryURL: "https://github.com/example/collection", Path: "skills/b/SKILL.md", Name: "skill-b", URL: "https://github.com/example/collection/blob/main/skills/b/SKILL.md", Author: "example", Content: "b"},
		}, nil
	}
	t.Cleanup(func() { discoverAISkillSources = previousDiscover })

	previewRecorder := httptest.NewRecorder()
	router.ServeHTTP(previewRecorder, aiPromptRequest(t, http.MethodPost, "/ai/skills/preview", "101", installAISkillPayload{URL: "https://github.com/example/collection"}))
	preview := decodeAIPromptData[aiSkillImportPreviewView](t, previewRecorder)
	if len(preview.Skills) != 2 || preview.Skills[0].ReferenceCount != 2 || preview.Skills[0].ScriptCount != 1 {
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

func TestPreviewAndInstallAISkillFromZip(t *testing.T) {
	router := setupAISkillTestRouter(t)
	imageBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	if err != nil {
		t.Fatal(err)
	}
	previousPersist := persistAISkillImage
	persistAISkillImage = func(_ context.Context, _ model.Int64String, _ string, content []byte) (*service.UploadResult, error) {
		return &service.UploadResult{Key: "ai-skills/test.png", Size: int64(len(content)), FileHash: "test"}, nil
	}
	t.Cleanup(func() { persistAISkillImage = previousPersist })
	archive := buildAISkillTestZip(t, []aiSkillTestZipEntry{
		{Name: "yier-bubu-creative/SKILL.md", Content: "---\nname: yier-bubu-creative\ndescription: 一二和布布视觉创作\ntags: [生图]\n---\n# Skill"},
		{Name: "yier-bubu-creative/references/character.md", Content: "一二是熊猫，布布是棕熊。"},
		{Name: "yier-bubu-creative/references/images/model.png", Binary: imageBytes},
		{Name: "yier-bubu-creative/scripts/build_prompt.py", Content: "print('prompt')"},
		{Name: "yier-bubu-creative/assets/template.md", Content: "# Template"},
		{Name: "yier-bubu-creative/agents/openai.yaml", Content: "interface: {}"},
	})

	previewRecorder := httptest.NewRecorder()
	router.ServeHTTP(previewRecorder, aiSkillZipRequest(t, http.MethodPost, "/ai/skills/preview", archive, nil))
	preview := decodeAIPromptData[aiSkillImportPreviewView](t, previewRecorder)
	if preview.Author != "ZIP 文件" || len(preview.Skills) != 1 {
		t.Fatalf("preview=%+v", preview)
	}
	candidate := preview.Skills[0]
	if candidate.Path != "yier-bubu-creative/SKILL.md" || candidate.ReferenceCount != 1 ||
		candidate.ReferenceImageCount != 1 || candidate.ScriptCount != 1 || candidate.AssetCount != 1 || candidate.IgnoredFileCount != 1 {
		t.Fatalf("candidate=%+v", candidate)
	}

	installRecorder := httptest.NewRecorder()
	router.ServeHTTP(installRecorder, aiSkillZipRequest(t, http.MethodPost, "/ai/skills/install", archive, []string{candidate.Path}))
	installed := decodeAIPromptData[struct {
		List []aiSkillView `json:"list"`
	}](t, installRecorder)
	if len(installed.List) != 1 || installed.List[0].Name != "yier-bubu-creative" ||
		installed.List[0].SourceAuthor != "ZIP 文件" || !strings.HasPrefix(installed.List[0].SourceURL, "zip://") {
		t.Fatalf("installed=%+v", installed)
	}

	var stored model.AISkill
	if err := database.GetDB().First(&stored, installed.List[0].ID).Error; err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stored.ReferenceContent, "一二是熊猫") ||
		!strings.Contains(stored.ScriptContent, "print('prompt')") ||
		strings.Contains(stored.ReferenceContent, "Template") {
		t.Fatalf("stored=%+v", stored)
	}
	var storedFiles []model.AISkillFile
	if err := database.GetDB().Where("skill_id = ?", stored.ID).Find(&storedFiles).Error; err != nil || len(storedFiles) != 4 {
		t.Fatalf("stored files=%+v err=%v", storedFiles, err)
	}

	reinstallRecorder := httptest.NewRecorder()
	router.ServeHTTP(reinstallRecorder, aiSkillZipRequest(t, http.MethodPost, "/ai/skills/install", archive, []string{candidate.Path}))
	reinstalled := decodeAIPromptData[struct {
		List []aiSkillView `json:"list"`
	}](t, reinstallRecorder)
	if len(reinstalled.List) != 1 || reinstalled.List[0].ID != installed.List[0].ID {
		t.Fatalf("same ZIP should update the installed skill: first=%+v second=%+v", installed, reinstalled)
	}
}

func TestDiscoverZipAISkillSourcesRejectsUnsafeArchives(t *testing.T) {
	tests := []struct {
		name    string
		entries []aiSkillTestZipEntry
	}{
		{
			name: "path traversal",
			entries: []aiSkillTestZipEntry{
				{Name: "../SKILL.md", Content: "# unsafe"},
			},
		},
		{
			name: "symbolic link",
			entries: []aiSkillTestZipEntry{
				{Name: "skill/SKILL.md", Content: "# Skill"},
				{Name: "skill/references/link.md", Content: "target", Mode: fs.ModeSymlink | 0o777},
			},
		},
		{
			name: "invalid UTF-8",
			entries: []aiSkillTestZipEntry{
				{Name: "skill/SKILL.md", Content: string([]byte{0xff, 0xfe})},
			},
		},
		{
			name: "missing SKILL.md",
			entries: []aiSkillTestZipEntry{
				{Name: "skill/README.md", Content: "# Readme"},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			archive := buildAISkillTestZip(t, test.entries)
			if _, err := discoverZipAISkillSources(archive, "skill.zip"); err == nil {
				t.Fatal("expected archive to be rejected")
			}
		})
	}
}

type aiSkillTestZipEntry struct {
	Name    string
	Content string
	Binary  []byte
	Mode    fs.FileMode
}

func buildAISkillTestZip(t *testing.T, entries []aiSkillTestZipEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.Name, Method: zip.Deflate}
		if entry.Mode != 0 {
			header.SetMode(entry.Mode)
		}
		file, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		content := entry.Binary
		if content == nil {
			content = []byte(entry.Content)
		}
		if _, err := file.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func aiSkillZipRequest(t *testing.T, method, requestPath string, archive []byte, paths []string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "skill.zip")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(archive); err != nil {
		t.Fatal(err)
	}
	for _, skillPath := range paths {
		if err := writer.WriteField("paths", skillPath); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(method, requestPath, &body)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request
}

func TestGetAISkillShowsImportedDirectoryFiles(t *testing.T) {
	router := setupAISkillTestRouter(t)
	skill := model.AISkill{
		UserID: 101, Name: "photography-scene", Content: "# Skill\nUse camera details.",
		ReferenceContent: "## 参考资料：skills/photography-scene/references/camera.md\n# Cameras\nUse 50mm lens.\n\n## 参考资料：skills/photography-scene/references/examples/portrait.mdx\n# Portrait",
		ScriptContent:    "## 脚本：skills/photography-scene/scripts/crop.py\nprint('crop')",
		SourceURL:        "https://github.com/example/skills/blob/main/skills/photography-scene/SKILL.md",
	}
	if err := database.GetDB().Create(&skill).Error; err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, aiPromptRequest(t, http.MethodGet, "/ai/skills/"+skill.ID.String(), "101", nil))
	detail := decodeAIPromptData[aiSkillDetailView](t, recorder)
	if detail.Name != "photography-scene" || len(detail.Files) != 4 ||
		detail.Files[0].Path != "SKILL.md" || detail.Files[1].Path != "references/camera.md" ||
		detail.Files[2].Path != "references/examples/portrait.mdx" ||
		detail.Files[3].Path != "scripts/crop.py" || detail.Files[3].Kind != "script" {
		t.Fatalf("detail=%+v", detail)
	}
}

func TestGetAISkillFileImageDataRejectsAnotherOwner(t *testing.T) {
	router := setupAISkillTestRouter(t)
	if err := database.GetDB().Create(&model.User{ID: 202, Username: "other-owner", Role: "user", IsActive: true}).Error; err != nil {
		t.Fatal(err)
	}
	skill := model.AISkill{UserID: 101, Name: "owner skill", Content: "# Skill", SourceURL: "zip://owner"}
	if err := database.GetDB().Create(&skill).Error; err != nil {
		t.Fatal(err)
	}
	file := model.AISkillFile{SkillID: skill.ID, UserID: 101, Path: "references/images/model.png", Kind: "reference_image", MimeType: "image/png", StorageKey: "ai-skills/owner/model.png"}
	if err := database.GetDB().Create(&file).Error; err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/ai/skills/"+skill.ID.String()+"/files/"+file.ID.String()+"/image-data", nil)
	request.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	router.ServeHTTP(recorder, request)
	if !strings.Contains(recorder.Body.String(), `"code":404`) {
		t.Fatalf("foreign owner image response=%d body=%s", recorder.Code, recorder.Body.String())
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
		case "api.github.com/repos/owner/collection/contents/skills/zelda-style/scripts":
			status = http.StatusOK
			body = `[{"name":"render.py","type":"file"},{"name":"ignored.json","type":"file"}]`
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/references/palette.md":
			status = http.StatusOK
			body = "warm forest palette"
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/references/rendering.md":
			status = http.StatusOK
			body = "hand-painted rendering"
		case "raw.githubusercontent.com/owner/collection/HEAD/skills/zelda-style/scripts/render.py":
			status = http.StatusOK
			body = "print('render')"
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
		sources[0].ScriptCount != 1 || !strings.Contains(sources[0].ReferenceContent, "hand-painted rendering") ||
		!strings.Contains(sources[0].ScriptContent, "print('render')") {
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
