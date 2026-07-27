package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const maxAIPromptImportSkillSize = 48_000

type aiPromptImportPreviewRequest struct {
	URL string `json:"url"`
}

type aiPromptImportSource struct {
	Name    string
	Content string
	URL     string
	Author  string
}

type aiPromptImportDraft struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Content       string   `json:"content"`
	Tags          []string `json:"tags"`
	SourceURL     string   `json:"sourceUrl"`
	SourceAuthor  string   `json:"sourceAuthor"`
	SourceLicense string   `json:"sourceLicense"`
}

type aiPromptImportPayload struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	Content       string   `json:"content"`
	Tags          []string `json:"tags"`
	SourceURL     string   `json:"sourceUrl"`
	SourceAuthor  string   `json:"sourceAuthor"`
	SourceLicense string   `json:"sourceLicense"`
}

var promptImportHTTPClient = &http.Client{Timeout: 15 * time.Second}

var fetchAIPromptImportSource = fetchGitHubAIPromptImportSource

func PreviewAIPromptImport(c *gin.Context) {
	_, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiPromptImportPreviewRequest
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "导入链接无效")
		return
	}
	source, err := fetchAIPromptImportSource(c.Request.Context(), payload.URL)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	draft := aiPromptImportDraft{
		Name:         source.Name,
		Content:      source.Content,
		Tags:         []string{},
		SourceURL:    source.URL,
		SourceAuthor: source.Author,
	}
	Success(c, draft)
}

func CreateImportedAIPrompt(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var imported aiPromptImportPayload
	if c.ShouldBindJSON(&imported) != nil {
		Error(c, http.StatusBadRequest, "导入提示词参数无效")
		return
	}
	sourceURL, _, _, err := normalizeGitHubRepositoryURL(imported.SourceURL)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	payload, err := normalizeAIPromptPayload(aiPromptPayload{
		Name: imported.Name, Description: imported.Description, Content: imported.Content, Tags: imported.Tags,
	})
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	imported.SourceAuthor = strings.TrimSpace(imported.SourceAuthor)
	imported.SourceLicense = strings.TrimSpace(imported.SourceLicense)
	if utf8.RuneCountInString(imported.SourceAuthor) > 200 {
		Error(c, http.StatusBadRequest, "来源作者不能超过 200 个字符")
		return
	}
	if utf8.RuneCountInString(imported.SourceLicense) > 100 {
		Error(c, http.StatusBadRequest, "来源许可证不能超过 100 个字符")
		return
	}
	now := time.Now()
	prompt := model.AIPrompt{
		UserID: userID, Name: payload.Name, Description: payload.Description,
		Content: payload.Content, Tags: encodeAIPromptTags(payload.Tags),
		SourceURL: sourceURL, SourceAuthor: imported.SourceAuthor,
		SourceLicense: imported.SourceLicense, ImportedAt: &now,
	}
	if err := database.GetDB().Create(&prompt).Error; err != nil {
		Error(c, http.StatusInternalServerError, "导入提示词失败")
		return
	}
	Success(c, viewAIPrompt(prompt))
}

func fetchGitHubAIPromptImportSource(ctx context.Context, rawURL string) (aiPromptImportSource, error) {
	canonicalURL, owner, repository, err := normalizeGitHubRepositoryURL(rawURL)
	if err != nil {
		return aiPromptImportSource{}, err
	}
	content, err := fetchGitHubRawFile(ctx, owner, repository, "HEAD", "SKILL.md")
	if err != nil {
		return aiPromptImportSource{}, errors.New("无法读取仓库根目录的 SKILL.md，请确认仓库公开且文件存在")
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return aiPromptImportSource{}, errors.New("仓库根目录的 SKILL.md 为空")
	}
	return aiPromptImportSource{
		Name:    truncateAIPromptImportName(repository),
		Content: content,
		URL:     canonicalURL,
		Author:  owner,
	}, nil
}

func truncateAIPromptImportName(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= 20 {
		return string(runes)
	}
	return string(runes[:20])
}

func normalizeGitHubRepositoryURL(rawURL string) (string, string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme != "https" {
		return "", "", "", errors.New("首期仅支持公开 GitHub 仓库链接")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "github.com" && host != "www.github.com" {
		return "", "", "", errors.New("首期仅支持公开 GitHub 仓库链接")
	}
	segments := strings.Split(strings.Trim(parsed.EscapedPath(), "/"), "/")
	if len(segments) < 2 {
		return "", "", "", errors.New("请输入完整的 GitHub 仓库链接")
	}
	owner, ownerErr := url.PathUnescape(segments[0])
	repository, repositoryErr := url.PathUnescape(strings.TrimSuffix(segments[1], ".git"))
	if ownerErr != nil || repositoryErr != nil || owner == "" || repository == "" ||
		strings.ContainsAny(owner+repository, "\\?#") {
		return "", "", "", errors.New("GitHub 仓库链接无效")
	}
	return "https://github.com/" + owner + "/" + repository, owner, repository, nil
}

func fetchGitHubRawFile(ctx context.Context, owner, repository, branch, filename string) (string, error) {
	endpoint := fmt.Sprintf(
		"https://raw.githubusercontent.com/%s/%s/%s/%s",
		url.PathEscape(owner), url.PathEscape(repository), url.PathEscape(branch), escapeGitHubRepositoryPath(filename),
	)
	body, err := fetchGitHubBody(ctx, endpoint)
	return string(body), err
}

func fetchGitHubBody(ctx context.Context, endpoint string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, errors.New("无法读取 GitHub 仓库")
	}
	req.Header.Set("Accept", "text/plain")
	req.Header.Set("User-Agent", "Valley-MAS-Prompt-Importer")
	response, err := promptImportHTTPClient.Do(req)
	if err != nil {
		return nil, errors.New("读取 GitHub 仓库失败")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return nil, errors.New("GitHub 仓库或提示词文件不存在")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, errors.New("GitHub 暂时无法返回该仓库")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAIPromptImportSkillSize+1))
	if err != nil {
		return nil, errors.New("读取 GitHub 仓库失败")
	}
	if len(body) > maxAIPromptImportSkillSize {
		return nil, errors.New("SKILL.md 过大，暂时无法导入")
	}
	return body, nil
}
