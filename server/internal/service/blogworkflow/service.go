// Package blogworkflow contains the domain operations used by the blog
// import workflow. It deliberately has no Gin or SSE dependency so the
// existing import handler and the graph runtime can share the same rules.
package blogworkflow

import (
	"fmt"
	"strconv"
	"strings"

	"valley-server/internal/model"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

const (
	TagModeMerge      = "merge"
	TagModeManualOnly = "manual_only"
)

type ParsedMarkdown struct {
	Title          string
	Content        string
	Excerpt        string
	Cover          string
	FrontMatterTag []string
}

// ParseMarkdown normalizes the existing front-matter parser into the values
// required by a blog draft. A Markdown body is mandatory even when a title is
// supplied in front matter.
func ParseMarkdown(fileName string, content []byte) (ParsedMarkdown, error) {
	parsed, err := utils.ParseFrontMatter(content)
	if err != nil {
		return ParsedMarkdown{}, fmt.Errorf("parse markdown: %w", err)
	}
	body := strings.TrimSpace(parsed.Content)
	if body == "" {
		return ParsedMarkdown{}, fmt.Errorf("Markdown 内容为空")
	}
	title := strings.TrimSpace(parsed.FrontMatter.Title)
	if title == "" {
		title = utils.InferTitleFromHeading(body)
	}
	if title == "" {
		title = strings.TrimSuffix(strings.TrimSuffix(strings.TrimSpace(fileName), ".md"), ".markdown")
	}
	if title == "" {
		return ParsedMarkdown{}, fmt.Errorf("Markdown 缺少标题")
	}
	return ParsedMarkdown{
		Title:          title,
		Content:        body,
		Excerpt:        strings.TrimSpace(parsed.FrontMatter.Excerpt),
		Cover:          strings.TrimSpace(parsed.FrontMatter.Cover),
		FrontMatterTag: uniqueText(parsed.FrontMatter.Tags),
	}, nil
}

type CreateDraftInput struct {
	Title         string
	Content       string
	Excerpt       string
	Cover         string
	ManualTagIDs  []string
	SuggestedTags []string
	TagMode       string
	Visibility    string
	GroupID       int64
	AuthorID      int64
	ActorRole     string
}

type Draft struct {
	PostID string
	Title  string
	TagIDs []string
}

// CreateDraft writes a complete draft and its taxonomy updates in one
// transaction. This prevents a failed tag/group update from leaving a partial
// post behind.
func CreateDraft(db *gorm.DB, input CreateDraftInput) (Draft, error) {
	if db == nil {
		return Draft{}, fmt.Errorf("数据库未初始化")
	}
	if input.AuthorID <= 0 {
		return Draft{}, fmt.Errorf("工作流缺少运行用户")
	}
	if strings.TrimSpace(input.Title) == "" || strings.TrimSpace(input.Content) == "" {
		return Draft{}, fmt.Errorf("草稿标题和正文不能为空")
	}
	if input.TagMode != TagModeMerge && input.TagMode != TagModeManualOnly {
		return Draft{}, fmt.Errorf("tagMode 必须为 merge 或 manual_only")
	}
	var result Draft
	err := db.Transaction(func(tx *gorm.DB) error {
		manualIDs, err := parseTagIDs(input.ManualTagIDs)
		if err != nil {
			return err
		}
		if err := requireExistingTags(tx, manualIDs); err != nil {
			return err
		}
		tagIDs := append([]model.Int64String(nil), manualIDs...)
		if input.TagMode == TagModeMerge {
			autoIDs, err := matchOrCreateTagIDs(tx, input.SuggestedTags)
			if err != nil {
				return err
			}
			tagIDs = uniqueTagIDs(append(tagIDs, autoIDs...))
		}

		groupID := model.Int64String(input.GroupID)
		if groupID != 0 {
			if err := validateWritableBlogGroup(tx, groupID, input.AuthorID, input.ActorRole); err != nil {
				return err
			}
		}
		categoryID, err := fallbackCategoryID(tx)
		if err != nil {
			return err
		}
		nextSort, err := nextPostSortOrder(tx, "blog", 0)
		if err != nil {
			return err
		}
		nextGroupSort := 0
		if groupID != 0 {
			nextGroupSort, err = nextPostSortOrder(tx, "blog", groupID)
			if err != nil {
				return err
			}
		}
		postID := model.Int64String(utils.GenerateID())
		post := model.Post{
			ID:             postID,
			Title:          strings.TrimSpace(input.Title),
			Slug:           postID.String(),
			PostType:       "blog",
			Visibility:     normalizeVisibility(input.Visibility),
			Content:        strings.TrimSpace(input.Content),
			HTMLContent:    strings.TrimSpace(input.Content),
			Excerpt:        strings.TrimSpace(input.Excerpt),
			Cover:          strings.TrimSpace(input.Cover),
			AuthorID:       model.Int64String(input.AuthorID),
			GroupID:        groupID,
			CategoryID:     categoryID,
			Status:         "draft",
			ImageTextData:  "{}",
			TemplateData:   "{}",
			SortOrder:      nextSort,
			GroupSortOrder: nextGroupSort,
		}
		if err := tx.Create(&post).Error; err != nil {
			return err
		}
		for _, tagID := range tagIDs {
			if err := tx.Create(&model.PostTagRelation{PostID: post.ID, TagID: tagID}).Error; err != nil {
				return err
			}
		}
		if len(tagIDs) > 0 {
			if err := tx.Model(&model.PostTag{}).Where("id IN ?", tagIDs).UpdateColumn("post_count", gorm.Expr("post_count + 1")).Error; err != nil {
				return err
			}
		}
		if groupID != 0 {
			if err := tx.Model(&model.PostGroup{}).Where("id = ?", groupID).UpdateColumn("post_count", gorm.Expr("post_count + 1")).Error; err != nil {
				return err
			}
		}
		result = Draft{PostID: post.ID.String(), Title: post.Title, TagIDs: tagIDStrings(tagIDs)}
		return nil
	})
	if err != nil {
		return Draft{}, fmt.Errorf("创建博客草稿失败: %w", err)
	}
	return result, nil
}

func parseTagIDs(raw []string) ([]model.Int64String, error) {
	ids := make([]model.Int64String, 0, len(raw))
	seen := make(map[model.Int64String]struct{}, len(raw))
	for _, value := range raw {
		id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("标签 ID 无效")
		}
		cast := model.Int64String(id)
		if _, ok := seen[cast]; ok {
			continue
		}
		seen[cast] = struct{}{}
		ids = append(ids, cast)
	}
	return ids, nil
}

func requireExistingTags(tx *gorm.DB, ids []model.Int64String) error {
	if len(ids) == 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&model.PostTag{}).Where("id IN ?", ids).Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(ids)) {
		return fmt.Errorf("存在不可用的手选标签")
	}
	return nil
}

func matchOrCreateTagIDs(tx *gorm.DB, names []string) ([]model.Int64String, error) {
	result := make([]model.Int64String, 0, len(names))
	for _, name := range uniqueText(names) {
		var tag model.PostTag
		err := tx.Where("name = ? AND deleted_at IS NULL", name).First(&tag).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			return nil, err
		}
		if err == gorm.ErrRecordNotFound {
			tag = model.PostTag{ID: model.Int64String(utils.GenerateID()), Name: name, Slug: strconv.FormatInt(utils.GenerateID(), 10)}
			if err := tx.Create(&tag).Error; err != nil {
				return nil, err
			}
		}
		result = append(result, tag.ID)
	}
	return result, nil
}

func fallbackCategoryID(tx *gorm.DB) (model.Int64String, error) {
	var category model.PostCategory
	if err := tx.Where("deleted_at IS NULL").Order("sort_order ASC, created_at ASC").First(&category).Error; err == nil {
		return category.ID, nil
	} else if err != gorm.ErrRecordNotFound {
		return 0, err
	}
	category = model.PostCategory{ID: model.Int64String(utils.GenerateID()), Name: "默认分类", Slug: "default", Description: "系统默认分类", SortOrder: 999}
	if err := tx.Create(&category).Error; err != nil {
		return 0, err
	}
	return category.ID, nil
}

func validateWritableBlogGroup(tx *gorm.DB, groupID model.Int64String, userID int64, role string) error {
	var group model.PostGroup
	if err := tx.First(&group, groupID).Error; err != nil {
		return fmt.Errorf("分组不存在或无权限")
	}
	if role != "admin" && int64(group.AuthorID) != userID {
		return fmt.Errorf("分组不存在或无权限")
	}
	if strings.ToLower(strings.TrimSpace(group.GroupType)) != "blog" {
		return fmt.Errorf("分组类型不支持博客")
	}
	return nil
}

func nextPostSortOrder(tx *gorm.DB, postType string, groupID model.Int64String) (int, error) {
	var order int
	query := tx.Model(&model.Post{}).Where("post_type = ?", postType)
	column := "sort_order"
	if groupID != 0 {
		query = query.Where("group_id = ?", groupID)
		column = "group_sort_order"
	}
	if err := query.Select("COALESCE(MAX(" + column + "), 0)").Scan(&order).Error; err != nil {
		return 0, err
	}
	return order + 1, nil
}

func normalizeVisibility(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "public", "shared", "private":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "private"
	}
}

func uniqueText(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
	}
	return result
}

func uniqueTagIDs(values []model.Int64String) []model.Int64String {
	result := make([]model.Int64String, 0, len(values))
	seen := make(map[model.Int64String]struct{}, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func tagIDStrings(values []model.Int64String) []string {
	result := make([]string, len(values))
	for index, value := range values {
		result[index] = value.String()
	}
	return result
}
