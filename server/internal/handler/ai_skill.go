package handler

import (
	"errors"
	"net/http"
	pathpkg "path"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"valley-server/internal/aiclient"
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
	Tags          []string          `json:"tags"`
	InstalledAt   time.Time         `json:"installedAt"`
}

type installAISkillPayload struct {
	URL   string   `json:"url"`
	Paths []string `json:"paths"`
}

type updateAISkillPayload struct {
	Tags []string `json:"tags"`
}

type aiSkillImportCandidateView struct {
	Path             string `json:"path"`
	Name             string `json:"name"`
	Description      string `json:"description"`
	ReferenceCount   int    `json:"referenceCount"`
	ScriptCount      int    `json:"scriptCount"`
	IgnoredFileCount int    `json:"ignoredFileCount"`
	SourceURL        string `json:"sourceUrl"`
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

const (
	maxAISkillRuntimeInstructions      = 16_000
	maxAISkillRuntimeInstructionsPerID = 6_000
)

func viewAISkill(skill model.AISkill) aiSkillView {
	return aiSkillView{
		ID: skill.ID, Name: skill.Name, Description: skill.Description, SourceURL: skill.SourceURL,
		SourceAuthor: skill.SourceAuthor, SourceLicense: skill.SourceLicense,
		Tags: decodeAIPromptTags(skill.Tags), InstalledAt: skill.InstalledAt,
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
	sources, _, err := readAISkillImportRequest(c)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	candidates := make([]aiSkillImportCandidateView, 0, len(sources))
	for _, source := range sources {
		candidates = append(candidates, aiSkillImportCandidateView{
			Path: source.Path, Name: source.Name, Description: source.Description,
			ReferenceCount: source.ReferenceCount, ScriptCount: source.ScriptCount,
			IgnoredFileCount: source.IgnoredFileCount, SourceURL: source.URL,
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
	sources, paths, err := readAISkillImportRequest(c)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	selectedSources, err := selectAISkillImportSources(sources, paths)
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
				"script_content":    source.ScriptContent,
				"tags":              encodeAIPromptTags(mergeAISkillTags(decodeAIPromptTags(existing.Tags), source.Tags)),
				"source_author":     source.Author,
			}).Error; updateErr != nil {
				Error(c, http.StatusInternalServerError, "更新已安装技能失败")
				return
			}
			existing.Name = source.Name
			existing.Description = source.Description
			existing.Content = source.Content
			existing.ReferenceContent = source.ReferenceContent
			existing.ScriptContent = source.ScriptContent
			existing.Tags = encodeAIPromptTags(mergeAISkillTags(decodeAIPromptTags(existing.Tags), source.Tags))
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
			Content: source.Content, ReferenceContent: source.ReferenceContent, ScriptContent: source.ScriptContent, Tags: encodeAIPromptTags(source.Tags),
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

func UpdateAISkill(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "skillId")
	if err != nil || id <= 0 {
		Error(c, http.StatusBadRequest, "无效的技能 ID")
		return
	}
	var payload updateAISkillPayload
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "技能参数无效")
		return
	}
	tags, err := normalizeAIPromptTags(payload.Tags)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var skill model.AISkill
	if err := database.GetDB().Where("id = ? AND user_id = ? AND archived_at IS NULL", id, userID).First(&skill).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "技能不存在或不可用")
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "加载技能失败", err)
		return
	}
	if err := database.GetDB().Model(&skill).Update("tags", encodeAIPromptTags(tags)).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "保存技能标签失败", err)
		return
	}
	skill.Tags = encodeAIPromptTags(tags)
	Success(c, viewAISkill(skill))
}

func mergeAISkillTags(values ...[]string) []string {
	merged := make([]string, 0, 8)
	seen := make(map[string]struct{}, 8)
	for _, group := range values {
		for _, value := range group {
			if _, exists := seen[value]; exists {
				continue
			}
			seen[value] = struct{}{}
			merged = append(merged, value)
			if len(merged) == 8 {
				return merged
			}
		}
	}
	return merged
}

func resolveAISkillRuntimeInstructions(db *gorm.DB, userID model.Int64String, rawIDs []string) (string, error) {
	if len(rawIDs) == 0 {
		return "", nil
	}
	ids := make([]model.Int64String, 0, len(rawIDs))
	seen := make(map[model.Int64String]struct{}, len(rawIDs))
	for _, rawID := range rawIDs {
		id, err := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
		if err != nil || id <= 0 {
			return "", errors.New("技能配置无效")
		}
		skillID := model.Int64String(id)
		if _, exists := seen[skillID]; !exists {
			seen[skillID] = struct{}{}
			ids = append(ids, skillID)
		}
	}
	var skills []model.AISkill
	if err := db.Where("user_id = ? AND archived_at IS NULL AND id IN ?", userID, ids).Find(&skills).Error; err != nil {
		return "", err
	}
	if len(skills) != len(ids) {
		return "", errors.New("已绑定技能不存在或不可用")
	}
	byID := make(map[model.Int64String]model.AISkill, len(skills))
	for _, skill := range skills {
		byID[skill.ID] = skill
	}
	var builder strings.Builder
	for _, id := range ids {
		skill := byID[id]
		body := strings.TrimSpace(skill.Content)
		if references := strings.TrimSpace(skill.ReferenceContent); references != "" {
			body = strings.TrimSpace(body + "\n\n" + references)
		}
		body = aiclient.TrimRunes(body, maxAISkillRuntimeInstructionsPerID)
		if body == "" {
			continue
		}
		entry := "已启用技能：" + skill.Name + "\n" + body
		if builder.Len()+len(entry) > maxAISkillRuntimeInstructions {
			break
		}
		if builder.Len() > 0 {
			builder.WriteString("\n\n")
		}
		builder.WriteString(entry)
	}
	return builder.String(), nil
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
	files = appendAISkillBundledFiles(files, skill.ReferenceContent, "## 参考资料：", "reference")
	return appendAISkillBundledFiles(files, skill.ScriptContent, "## 脚本：", "script")
}

func appendAISkillBundledFiles(files []aiSkillFileView, bundledContent, marker, kind string) []aiSkillFileView {
	for _, section := range strings.Split(bundledContent, marker)[1:] {
		filePath, content, found := strings.Cut(strings.TrimSpace(section), "\n")
		if !found || strings.TrimSpace(content) == "" {
			continue
		}
		files = append(files, aiSkillFileView{
			Path:    normalizeAISkillBundledPath(filePath, kind),
			Kind:    kind,
			Content: strings.TrimSpace(content),
		})
	}
	return files
}

func normalizeAISkillBundledPath(rawPath, kind string) string {
	value := strings.Trim(strings.TrimSpace(rawPath), "/")
	directory := kind + "s/"
	if index := strings.Index(value, directory); index >= 0 {
		return value[index:]
	}
	if value == "" {
		return directory + "未命名文件"
	}
	return directory + pathpkg.Base(value)
}
