package handler

import (
	"errors"
	"net/http"
	pathpkg "path"
	"strings"
	"time"
	"unicode/utf8"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type aiSkillView struct {
	ID            model.Int64String `json:"id"`
	Name          string            `json:"name"`
	Description   string            `json:"description"`
	SourceURL     string            `json:"sourceUrl"`
	SourceAuthor  string            `json:"sourceAuthor"`
	SourceLicense string            `json:"sourceLicense"`
	InstalledAt   time.Time         `json:"installedAt"`
}

type installAISkillPayload struct {
	URL   string   `json:"url"`
	Paths []string `json:"paths"`
}

type aiSkillImportCandidateView struct {
	Path           string `json:"path"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	ReferenceCount int    `json:"referenceCount"`
	SourceURL      string `json:"sourceUrl"`
}

type aiSkillImportPreviewView struct {
	RepositoryURL string                       `json:"repositoryUrl"`
	Author        string                       `json:"author"`
	Skills        []aiSkillImportCandidateView `json:"skills"`
}

type aiSkillFileView struct {
	Path    string `json:"path"`
	Kind    string `json:"kind"`
	Content string `json:"content"`
}

type aiSkillDetailView struct {
	aiSkillView
	Files []aiSkillFileView `json:"files"`
}

var discoverAISkillSources = discoverGitHubAISkillSources

func viewAISkill(skill model.AISkill) aiSkillView {
	return aiSkillView{
		ID: skill.ID, Name: skill.Name, Description: skill.Description, SourceURL: skill.SourceURL,
		SourceAuthor: skill.SourceAuthor, SourceLicense: skill.SourceLicense,
		InstalledAt: skill.InstalledAt,
	}
}

func ListAISkills(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var skills []model.AISkill
	if err := database.GetDB().Where("user_id = ? AND archived_at IS NULL", userID).Order("updated_at DESC").Find(&skills).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "加载技能失败", err)
		return
	}
	list := make([]aiSkillView, 0, len(skills))
	for _, skill := range skills {
		list = append(list, viewAISkill(skill))
	}
	Success(c, gin.H{"list": list})
}

func GetAISkill(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "skillId")
	if err != nil || id <= 0 {
		Error(c, http.StatusBadRequest, "无效的技能 ID")
		return
	}
	var skill model.AISkill
	if err := database.GetDB().Where(
		"id = ? AND user_id = ? AND archived_at IS NULL", id, userID,
	).First(&skill).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "技能不存在或不可用")
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "加载技能详情失败", err)
		return
	}
	Success(c, aiSkillDetailView{aiSkillView: viewAISkill(skill), Files: viewAISkillFiles(skill)})
}

func PreviewAISkillImport(c *gin.Context) {
	_, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload installAISkillPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "技能链接无效")
		return
	}
	sources, err := discoverAISkillSources(c.Request.Context(), payload.URL)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	candidates := make([]aiSkillImportCandidateView, 0, len(sources))
	for _, source := range sources {
		candidates = append(candidates, aiSkillImportCandidateView{
			Path: source.Path, Name: source.Name, Description: source.Description,
			ReferenceCount: source.ReferenceCount, SourceURL: source.URL,
		})
	}
	Success(c, aiSkillImportPreviewView{
		RepositoryURL: sources[0].RepositoryURL,
		Author:        sources[0].Author,
		Skills:        candidates,
	})
}

func InstallAISkill(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload installAISkillPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "技能链接无效")
		return
	}
	sources, err := discoverAISkillSources(c.Request.Context(), payload.URL)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	selectedSources, err := selectAISkillImportSources(sources, payload.Paths)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	installed := make([]aiSkillView, 0, len(selectedSources))
	for _, source := range selectedSources {
		var existing model.AISkill
		err = database.GetDB().Where(
			"user_id = ? AND source_url = ? AND archived_at IS NULL",
			userID,
			source.URL,
		).First(&existing).Error
		if err == nil {
			if updateErr := database.GetDB().Model(&existing).Updates(map[string]any{
				"name":              source.Name,
				"description":       source.Description,
				"content":           source.Content,
				"reference_content": source.ReferenceContent,
				"source_author":     source.Author,
			}).Error; updateErr != nil {
				Error(c, http.StatusInternalServerError, "更新已安装技能失败")
				return
			}
			existing.Name = source.Name
			existing.Description = source.Description
			existing.Content = source.Content
			existing.ReferenceContent = source.ReferenceContent
			existing.SourceAuthor = source.Author
			installed = append(installed, viewAISkill(existing))
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusInternalServerError, "检查已安装技能失败")
			return
		}
		skill := model.AISkill{
			UserID: userID, Name: source.Name, Description: source.Description,
			Content: source.Content, ReferenceContent: source.ReferenceContent,
			SourceURL: source.URL, SourceAuthor: source.Author,
		}
		if err := database.GetDB().Create(&skill).Error; err != nil {
			Error(c, http.StatusInternalServerError, "安装技能失败")
			return
		}
		installed = append(installed, viewAISkill(skill))
	}
	Success(c, gin.H{"list": installed})
}

func selectAISkillImportSources(sources []aiSkillImportSource, paths []string) ([]aiSkillImportSource, error) {
	if len(sources) == 1 && len(paths) == 0 {
		return sources, nil
	}
	if len(paths) == 0 {
		return nil, errors.New("请选择至少一个技能")
	}
	byPath := make(map[string]aiSkillImportSource, len(sources))
	for _, source := range sources {
		byPath[source.Path] = source
	}
	selected := make([]aiSkillImportSource, 0, len(paths))
	seen := make(map[string]struct{}, len(paths))
	for _, rawPath := range paths {
		skillPath := strings.TrimSpace(rawPath)
		if _, exists := seen[skillPath]; exists {
			continue
		}
		source, found := byPath[skillPath]
		if !found {
			return nil, errors.New("选择的技能已不可用，请重新解析仓库")
		}
		seen[skillPath] = struct{}{}
		selected = append(selected, source)
	}
	return selected, nil
}

func ArchiveAISkill(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "skillId")
	if err != nil || id <= 0 {
		Error(c, http.StatusBadRequest, "无效的技能 ID")
		return
	}
	var skill model.AISkill
	if err := database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&skill).Error; err != nil {
		Error(c, http.StatusNotFound, "技能不存在")
		return
	}
	if skill.ArchivedAt == nil {
		now := time.Now()
		if err := database.GetDB().Model(&skill).Update("archived_at", now).Error; err != nil {
			Error(c, http.StatusInternalServerError, "卸载技能失败")
			return
		}
	}
	Success(c, nil)
}

func extractAISkillDescription(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "description:") {
			continue
		}
		description := strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "description:")), "\"'")
		if utf8.RuneCountInString(description) > 500 {
			return string([]rune(description)[:500])
		}
		return description
	}
	return ""
}

func viewAISkillFiles(skill model.AISkill) []aiSkillFileView {
	files := []aiSkillFileView{{Path: "SKILL.md", Kind: "skill", Content: strings.TrimSpace(skill.Content)}}
	for _, section := range strings.Split(skill.ReferenceContent, "## 参考资料：")[1:] {
		referencePath, content, found := strings.Cut(strings.TrimSpace(section), "\n")
		if !found || strings.TrimSpace(content) == "" {
			continue
		}
		files = append(files, aiSkillFileView{
			Path:    normalizeAISkillReferencePath(referencePath),
			Kind:    "reference",
			Content: strings.TrimSpace(content),
		})
	}
	return files
}

func normalizeAISkillReferencePath(rawPath string) string {
	value := strings.Trim(strings.TrimSpace(rawPath), "/")
	if index := strings.Index(value, "references/"); index >= 0 {
		return value[index:]
	}
	if value == "" {
		return "references/未命名文件"
	}
	return "references/" + pathpkg.Base(value)
}
