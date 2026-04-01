package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/service"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	postTypeBlog      = "blog"
	postTypeImageText = "image_text"
)

type PostListResponse struct {
	ID              model.Int64String `json:"id"`
	Title           string            `json:"title"`
	Slug            string            `json:"slug"`
	PostType        string            `json:"postType"`
	TemplateKey     string            `json:"templateKey,omitempty"`
	TemplateData    string            `json:"templateData,omitempty"`
	ImageTextData   string            `json:"imageTextData,omitempty"`
	Excerpt         string            `json:"excerpt"`
	Cover           string            `json:"cover"`
	CoverStorageKey string            `json:"coverStorageKey,omitempty"`
	GroupID         model.Int64String `json:"groupId"`
	Group           *PostGroupInfo    `json:"group,omitempty"`
	CategoryID      model.Int64String `json:"categoryId"`
	Category        *PostCategoryInfo `json:"category,omitempty"`
	Tags            []PostTagInfo     `json:"tags,omitempty"`
	Status          string            `json:"status,omitempty"`
	Author          *AuthorInfo       `json:"author,omitempty"`
	ViewCount       int               `json:"viewCount"`
	LikeCount       int               `json:"likeCount"`
	IsTop           bool              `json:"isTop"`
	PublishedAt     *time.Time        `json:"publishedAt,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
}

type PostCategoryInfo struct {
	ID   model.Int64String `json:"id"`
	Name string            `json:"name"`
	Slug string            `json:"slug"`
}

type PostGroupInfo struct {
	ID          model.Int64String  `json:"id"`
	Name        string             `json:"name"`
	Slug        string             `json:"slug"`
	Description string             `json:"description,omitempty"`
	AuthorID    model.Int64String  `json:"authorId"`
	ParentID    *model.Int64String `json:"parentId,omitempty"`
}

type PostTagInfo struct {
	ID   model.Int64String `json:"id"`
	Name string            `json:"name"`
	Slug string            `json:"slug"`
}

type PostDetailResponse struct {
	ID              model.Int64String `json:"id"`
	Title           string            `json:"title"`
	Slug            string            `json:"slug"`
	PostType        string            `json:"postType"`
	TemplateKey     string            `json:"templateKey,omitempty"`
	TemplateData    string            `json:"templateData,omitempty"`
	ImageTextData   string            `json:"imageTextData,omitempty"`
	Content         string            `json:"content"`
	HTMLContent     string            `json:"htmlContent"`
	Excerpt         string            `json:"excerpt"`
	Cover           string            `json:"cover"`
	CoverStorageKey string            `json:"coverStorageKey,omitempty"`
	GroupID         model.Int64String `json:"groupId"`
	CategoryID      model.Int64String `json:"categoryId"`
	Status          string            `json:"status"`
	Author          *AuthorInfo       `json:"author,omitempty"`
	Group           *PostGroupInfo    `json:"group,omitempty"`
	Category        *PostCategoryInfo `json:"category,omitempty"`
	Tags            []PostTagInfo     `json:"tags,omitempty"`
	ViewCount       int               `json:"viewCount"`
	LikeCount       int               `json:"likeCount"`
	IsTop           bool              `json:"isTop"`
	PublishedAt     *time.Time        `json:"publishedAt,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
}

type AuthorInfo struct {
	ID       model.Int64String `json:"id"`
	Nickname string            `json:"nickname"`
	Avatar   string            `json:"avatar"`
}

func GetPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	groupIDRaw := strings.TrimSpace(c.Query("groupId"))
	groupSlug := strings.TrimSpace(c.Query("group"))
	categorySlug := c.Query("category")
	tagSlug := c.Query("tag")
	keyword := c.Query("keyword")
	postType := ""
	if raw := strings.TrimSpace(c.Query("postType")); raw != "" {
		postType = normalizePostType(raw)
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	query := database.DB.Model(&model.Post{}).
		Where("status = ? AND deleted_at IS NULL", "published").
		Preload("Group").
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		})

	if groupIDRaw != "" {
		if groupID, err := strconv.ParseInt(groupIDRaw, 10, 64); err == nil {
			query = query.Where("group_id = ?", groupID)
		}
	} else if groupSlug != "" {
		var group model.PostGroup
		if err := database.DB.Where("slug = ?", groupSlug).First(&group).Error; err == nil {
			query = query.Where("group_id = ?", group.ID)
		}
	}

	if categorySlug != "" {
		var category model.PostCategory
		if err := database.DB.Where("slug = ?", categorySlug).First(&category).Error; err == nil {
			query = query.Where("category_id = ?", category.ID)
		}
	}

	if tagSlug != "" {
		var tag model.PostTag
		if err := database.DB.Where("slug = ?", tagSlug).First(&tag).Error; err == nil {
			query = query.Joins("JOIN post_tag_relations ptr ON ptr.post_id = posts.id").
				Where("ptr.tag_id = ?", tag.ID)
		}
	}

	if keyword != "" {
		query = query.Where("title LIKE ? OR excerpt LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if postType != "" {
		query = query.Where("post_type = ?", postType)
	}

	var total int64
	query.Count(&total)

	var posts []model.Post
	query.Order("is_top DESC, published_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&posts)

	response := make([]PostListResponse, len(posts))
	for i := range posts {
		response[i] = convertToPostListResponse(&posts[i])
	}

	Success(c, gin.H{
		"list":     response,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func GetPostDetail(c *gin.Context) {
	slug := c.Param("slug")

	var post model.Post
	if err := database.DB.Where("slug = ? AND status = ? AND deleted_at IS NULL", slug, "published").
		Preload("Group").
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&post).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	go increasePostViewCount(post.ID)

	Success(c, convertToPostDetailResponse(&post))
}

func GetPostDetailByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid post id")
		return
	}

	var post model.Post
	if err := database.DB.Where("id = ? AND status = ? AND deleted_at IS NULL", id, "published").
		Preload("Group").
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&post).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	go increasePostViewCount(post.ID)

	Success(c, convertToPostDetailResponse(&post))
}

func GetCategories(c *gin.Context) {
	var categories []model.PostCategory
	database.DB.Where("deleted_at IS NULL").
		Order("sort_order ASC, created_at DESC").
		Find(&categories)

	Success(c, categories)
}

func GetGroups(c *gin.Context) {
	authorIDRaw := strings.TrimSpace(c.Query("authorId"))
	query := database.DB.Model(&model.PostGroup{}).Where("deleted_at IS NULL")
	if authorIDRaw != "" {
		if authorID, err := strconv.ParseInt(authorIDRaw, 10, 64); err == nil {
			query = query.Where("author_id = ?", authorID)
		}
	}

	var groups []model.PostGroup
	query.Order("sort_order ASC, created_at DESC").Find(&groups)
	Success(c, groups)
}

func GetTags(c *gin.Context) {
	var tags []model.PostTag
	database.DB.Where("deleted_at IS NULL").
		Order("post_count DESC, created_at DESC").
		Find(&tags)

	Success(c, tags)
}

func AdminListGroups(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	query := database.DB.Model(&model.PostGroup{}).Where("deleted_at IS NULL")
	if role == "creator" {
		query = query.Where("author_id = ?", userID)
	}

	var groups []model.PostGroup
	query.Order("sort_order ASC, created_at DESC").Find(&groups)
	Success(c, groups)
}

func AdminCreateGroup(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req struct {
		Name        string             `json:"name" binding:"required"`
		Description string             `json:"description"`
		ParentID    *model.Int64String `json:"parentId"`
		SortOrder   int                `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		Error(c, http.StatusBadRequest, "name is required")
		return
	}
	if req.ParentID != nil {
		var parent model.PostGroup
		if err := database.DB.First(&parent, *req.ParentID).Error; err != nil {
			Error(c, http.StatusBadRequest, "parent group not found")
			return
		}
		if role == "creator" && int64(parent.AuthorID) != userID {
			Error(c, http.StatusForbidden, "parent group no permission")
			return
		}
	}

	slug := strconv.FormatInt(utils.GenerateID(), 10)

	group := model.PostGroup{
		ID:          model.Int64String(utils.GenerateID()),
		Name:        name,
		Slug:        slug,
		Description: strings.TrimSpace(req.Description),
		AuthorID:    model.Int64String(userID),
		ParentID:    req.ParentID,
		SortOrder:   req.SortOrder,
	}
	if err := database.DB.Create(&group).Error; err != nil {
		Error(c, http.StatusInternalServerError, "create group failed")
		return
	}
	Success(c, group)
}

func AdminUpdateGroup(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid group id")
		return
	}
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var group model.PostGroup
	if err := database.DB.First(&group, id).Error; err != nil {
		Error(c, http.StatusNotFound, "group not found")
		return
	}
	if role != "admin" && int64(group.AuthorID) != userID {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	var req struct {
		Name        string             `json:"name"`
		Description string             `json:"description"`
		ParentID    *model.Int64String `json:"parentId"`
		SortOrder   *int               `json:"sortOrder"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	updates := map[string]any{}
	if name := strings.TrimSpace(req.Name); name != "" {
		updates["name"] = name
	}
	if req.Description != "" {
		updates["description"] = strings.TrimSpace(req.Description)
	}
	if req.ParentID != nil {
		if int64(*req.ParentID) == id {
			Error(c, http.StatusBadRequest, "parentId can not be itself")
			return
		}
		var parent model.PostGroup
		if err := database.DB.First(&parent, *req.ParentID).Error; err != nil {
			Error(c, http.StatusBadRequest, "parent group not found")
			return
		}
		if role != "admin" && int64(parent.AuthorID) != userID {
			Error(c, http.StatusForbidden, "parent group no permission")
			return
		}
		updates["parent_id"] = int64(*req.ParentID)
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	if len(updates) > 0 {
		if err := database.DB.Model(&group).Updates(updates).Error; err != nil {
			Error(c, http.StatusInternalServerError, "update group failed")
			return
		}
	}
	Success(c, nil)
}

func AdminDeleteGroup(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid group id")
		return
	}
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var group model.PostGroup
	if err := database.DB.First(&group, id).Error; err != nil {
		Error(c, http.StatusNotFound, "group not found")
		return
	}
	if role != "admin" && int64(group.AuthorID) != userID {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	if err := database.DB.Model(&model.Post{}).
		Where("group_id = ?", id).
		Update("group_id", 0).Error; err != nil {
		Error(c, http.StatusInternalServerError, "unlink posts failed")
		return
	}
	if err := database.DB.Delete(&group).Error; err != nil {
		Error(c, http.StatusInternalServerError, "delete group failed")
		return
	}
	Success(c, nil)
}

func AdminGetPostDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.
		Preload("Group").
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	if !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	Success(c, convertToPostDetailResponse(&post))
}

func AdminCreatePost(c *gin.Context) {
	userIDAny, exists := c.Get("userId")
	if !exists {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	userID, ok := userIDAny.(int64)
	if !ok {
		Error(c, http.StatusUnauthorized, "invalid user")
		return
	}
	roleAny, _ := c.Get("userRole")
	role, _ := roleAny.(string)
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req struct {
		Title           string              `json:"title" binding:"required"`
		PostType        string              `json:"postType"`
		TemplateKey     string              `json:"templateKey"`
		TemplateData    string              `json:"templateData"`
		ImageTextData   json.RawMessage     `json:"imageTextData"`
		Content         string              `json:"content"`
		Excerpt         string              `json:"excerpt"`
		Cover           string              `json:"cover"`
		CoverStorageKey string              `json:"coverStorageKey"`
		GroupID         model.Int64String   `json:"groupId"`
		CategoryID      model.Int64String   `json:"categoryId"`
		TagIDs          []model.Int64String `json:"tagIds"`
		Status          string              `json:"status"`
		IsTop           bool                `json:"isTop"`
		PublishNow      bool                `json:"publishNow"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	imageTextData := normalizeImageTextData(strings.TrimSpace(string(req.ImageTextData)), req.TemplateData)
	if imageTextData != "" && !json.Valid([]byte(imageTextData)) {
		Error(c, http.StatusBadRequest, "imageTextData must be valid json")
		return
	}
	imageTextData = normalizeJSONColumnValue(imageTextData)

	postType := normalizePostType(req.PostType)
	if postType == "" {
		postType = postTypeBlog
	}
	content := strings.TrimSpace(req.Content)
	if postType == postTypeImageText && content == "" {
		content = buildImageTextContent(req.TemplateKey, imageTextData)
	}
	if content == "" {
		Error(c, http.StatusBadRequest, "content is required")
		return
	}

	categoryID := req.CategoryID
	if categoryID == 0 {
		fallback, err := getOrCreateFallbackCategoryID()
		if err != nil {
			ErrorWithDetail(c, http.StatusInternalServerError, "create failed", err, logrus.Fields{
				"stage": "resolve_fallback_category",
			})
			return
		}
		categoryID = fallback
	}

	postID := model.Int64String(utils.GenerateID())
	slug := postID.String()

	post := model.Post{
		ID:              postID,
		Title:           req.Title,
		Slug:            slug,
		PostType:        postType,
		TemplateKey:     strings.TrimSpace(req.TemplateKey),
		TemplateData:    imageTextData,
		ImageTextData:   imageTextData,
		Content:         content,
		HTMLContent:     renderMarkdown(content),
		Excerpt:         req.Excerpt,
		Cover:           req.Cover,
		CoverStorageKey: strings.TrimSpace(req.CoverStorageKey),
		AuthorID:        model.Int64String(userID),
		GroupID:         req.GroupID,
		CategoryID:      categoryID,
		Status:          req.Status,
		IsTop:           req.IsTop,
	}

	if req.GroupID != 0 {
		var group model.PostGroup
		if err := database.DB.First(&group, req.GroupID).Error; err != nil {
			Error(c, http.StatusBadRequest, "group not found")
			return
		}
		if role != "admin" && int64(group.AuthorID) != userID {
			Error(c, http.StatusForbidden, "group no permission")
			return
		}
	}

	if post.Status == "" {
		post.Status = "draft"
	}

	if req.PublishNow && post.Status == "published" {
		now := time.Now()
		post.PublishedAt = &now
	}

	if err := database.DB.Create(&post).Error; err != nil {
		if key := strings.TrimSpace(req.CoverStorageKey); key != "" {
			_ = service.NewUploadService().DeleteByKey(key)
		}
		logger.Error(c, "Create post failed", err, logrus.Fields{
			"title":       post.Title,
			"slug":        post.Slug,
			"author_id":   post.AuthorID,
			"group_id":    post.GroupID,
			"category_id": post.CategoryID,
		})
		Error(c, http.StatusInternalServerError, "create failed")
		return
	}

	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			relation := model.PostTagRelation{PostID: post.ID, TagID: tagID}
			database.DB.Create(&relation)
		}

		database.DB.Model(&model.PostTag{}).
			Where("id IN ?", req.TagIDs).
			UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	}

	if req.GroupID != 0 {
		database.DB.Model(&model.PostGroup{}).
			Where("id = ?", int64(req.GroupID)).
			UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	}

	Success(c, post)
}

func AdminUpdatePost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}
	if !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	var req struct {
		Title           string              `json:"title"`
		PostType        string              `json:"postType"`
		TemplateKey     string              `json:"templateKey"`
		TemplateData    string              `json:"templateData"`
		ImageTextData   json.RawMessage     `json:"imageTextData"`
		Content         string              `json:"content"`
		Excerpt         string              `json:"excerpt"`
		Cover           string              `json:"cover"`
		CoverStorageKey string              `json:"coverStorageKey"`
		GroupID         *model.Int64String  `json:"groupId"`
		CategoryID      model.Int64String   `json:"categoryId"`
		TagIDs          []model.Int64String `json:"tagIds"`
		Status          string              `json:"status"`
		IsTop           bool                `json:"isTop"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	hasImageTextData := len(req.ImageTextData) > 0
	imageTextData := normalizeImageTextData(strings.TrimSpace(string(req.ImageTextData)), req.TemplateData)
	if (hasImageTextData || strings.TrimSpace(req.TemplateData) != "") && imageTextData != "" && !json.Valid([]byte(imageTextData)) {
		Error(c, http.StatusBadRequest, "imageTextData must be valid json")
		return
	}

	updates := make(map[string]interface{})
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if normalizedType := normalizePostType(req.PostType); normalizedType != "" {
		updates["post_type"] = normalizedType
	}
	if req.TemplateKey != "" {
		updates["template_key"] = strings.TrimSpace(req.TemplateKey)
	}
	if req.TemplateData != "" {
		updates["template_data"] = strings.TrimSpace(req.TemplateData)
	}
	if hasImageTextData || strings.TrimSpace(req.TemplateData) != "" {
		updates["image_text_data"] = normalizeJSONColumnValue(imageTextData)
		updates["template_data"] = imageTextData
	}
	if req.Content != "" {
		updates["content"] = req.Content
		updates["html_content"] = renderMarkdown(req.Content)
	} else {
		finalType := post.PostType
		if req.PostType != "" {
			finalType = normalizePostType(req.PostType)
		}
		if finalType == postTypeImageText {
			templateKey := post.TemplateKey
			if req.TemplateKey != "" {
				templateKey = strings.TrimSpace(req.TemplateKey)
			}
			templateData := post.TemplateData
			if post.ImageTextData != "" {
				templateData = post.ImageTextData
			}
			if hasImageTextData || strings.TrimSpace(req.TemplateData) != "" {
				templateData = imageTextData
			} else if req.TemplateData != "" {
				templateData = strings.TrimSpace(req.TemplateData)
			}
			autoContent := buildImageTextContent(templateKey, templateData)
			if autoContent != "" {
				updates["content"] = autoContent
				updates["html_content"] = renderMarkdown(autoContent)
			}
		}
	}
	if req.Excerpt != "" {
		updates["excerpt"] = req.Excerpt
	}
	newCoverURL := strings.TrimSpace(req.Cover)
	newCoverKey := strings.TrimSpace(req.CoverStorageKey)
	coverChanged := false
	if newCoverURL != "" && newCoverURL != strings.TrimSpace(post.Cover) {
		updates["cover"] = newCoverURL
		updates["cover_storage_key"] = newCoverKey
		coverChanged = true
	} else if req.CoverStorageKey != "" && strings.TrimSpace(post.CoverStorageKey) != newCoverKey {
		updates["cover_storage_key"] = newCoverKey
	}
	if req.GroupID != nil {
		if *req.GroupID == 0 {
			updates["group_id"] = 0
		} else {
			var group model.PostGroup
			if err := database.DB.First(&group, *req.GroupID).Error; err != nil {
				Error(c, http.StatusBadRequest, "group not found")
				return
			}
			userID, role, ok := currentUser(c)
			if !ok {
				Error(c, http.StatusUnauthorized, "unauthorized")
				return
			}
			if role != "admin" && int64(group.AuthorID) != userID {
				Error(c, http.StatusForbidden, "group no permission")
				return
			}
			updates["group_id"] = int64(*req.GroupID)
		}
	}
	if req.CategoryID != 0 {
		updates["category_id"] = int64(req.CategoryID)
	}
	if req.Status != "" {
		updates["status"] = req.Status
		if req.Status == "published" && post.Status != "published" {
			now := time.Now()
			updates["published_at"] = &now
		}
	}
	updates["is_top"] = req.IsTop

	oldCoverStorageKey := strings.TrimSpace(post.CoverStorageKey)
	oldCoverURL := strings.TrimSpace(post.Cover)
	oldGroupID := post.GroupID
	newGroupID := oldGroupID
	if req.GroupID != nil {
		newGroupID = *req.GroupID
	}
	database.DB.Model(&post).Updates(updates)
	if coverChanged {
		deletePostCoverAsync(oldCoverStorageKey, oldCoverURL)
	}
	if req.GroupID != nil && oldGroupID != newGroupID {
		if oldGroupID != 0 {
			database.DB.Model(&model.PostGroup{}).
				Where("id = ?", oldGroupID).
				UpdateColumn("post_count", gorm.Expr("GREATEST(post_count - 1, 0)"))
		}
		if newGroupID != 0 {
			database.DB.Model(&model.PostGroup{}).
				Where("id = ?", int64(newGroupID)).
				UpdateColumn("post_count", gorm.Expr("post_count + 1"))
		}
	}

	if req.TagIDs != nil {
		database.DB.Where("post_id = ?", post.ID).Delete(&model.PostTagRelation{})
		for _, tagID := range req.TagIDs {
			relation := model.PostTagRelation{PostID: post.ID, TagID: tagID}
			database.DB.Create(&relation)
		}
	}

	Success(c, nil)
}

func AdminDeletePost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}
	if !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusForbidden, "no permission")
		return
	}

	coverKey := strings.TrimSpace(post.CoverStorageKey)
	coverURL := strings.TrimSpace(post.Cover)
	database.DB.Delete(&post)
	deletePostCoverAsync(coverKey, coverURL)

	if post.GroupID != 0 {
		database.DB.Model(&model.PostGroup{}).
			Where("id = ?", post.GroupID).
			UpdateColumn("post_count", gorm.Expr("GREATEST(post_count - 1, 0)"))
	}

	Success(c, nil)
}

func AdminGetPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	status := c.Query("status")
	postType := ""
	if raw := strings.TrimSpace(c.Query("postType")); raw != "" {
		postType = normalizePostType(raw)
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	offset := (page - 1) * pageSize

	query := database.DB.Model(&model.Post{}).
		Preload("Group").
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		})

	if role == "creator" {
		query = query.Where("author_id = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if postType != "" {
		query = query.Where("post_type = ?", postType)
	}

	var total int64
	query.Count(&total)

	var posts []model.Post
	query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&posts)

	response := make([]PostListResponse, len(posts))
	for i := range posts {
		response[i] = convertToPostListResponse(&posts[i])
	}

	Success(c, gin.H{
		"list":     response,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func convertToPostListResponse(post *model.Post) PostListResponse {
	resp := PostListResponse{
		ID:              post.ID,
		Title:           post.Title,
		Slug:            post.Slug,
		PostType:        normalizePostType(post.PostType),
		TemplateKey:     post.TemplateKey,
		TemplateData:    post.TemplateData,
		ImageTextData:   normalizeImageTextData(post.ImageTextData, post.TemplateData),
		Excerpt:         post.Excerpt,
		Cover:           post.Cover,
		CoverStorageKey: post.CoverStorageKey,
		GroupID:         post.GroupID,
		CategoryID:      post.CategoryID,
		Status:          post.Status,
		ViewCount:       post.ViewCount,
		LikeCount:       post.LikeCount,
		IsTop:           post.IsTop,
		PublishedAt:     post.PublishedAt,
		CreatedAt:       post.CreatedAt,
	}

	if post.Author != nil {
		resp.Author = &AuthorInfo{
			ID:       post.Author.ID,
			Nickname: post.Author.Nickname,
			Avatar:   post.Author.Avatar,
		}
	}

	if post.Group != nil {
		resp.Group = &PostGroupInfo{
			ID:          post.Group.ID,
			Name:        post.Group.Name,
			Slug:        post.Group.Slug,
			Description: post.Group.Description,
			AuthorID:    post.Group.AuthorID,
			ParentID:    post.Group.ParentID,
		}
	}

	if post.Category != nil {
		resp.Category = &PostCategoryInfo{
			ID:   post.Category.ID,
			Name: post.Category.Name,
			Slug: post.Category.Slug,
		}
	}

	if len(post.Tags) > 0 {
		resp.Tags = make([]PostTagInfo, len(post.Tags))
		for i, tag := range post.Tags {
			resp.Tags[i] = PostTagInfo{
				ID:   tag.ID,
				Name: tag.Name,
				Slug: tag.Slug,
			}
		}
	}

	return resp
}

func convertToPostDetailResponse(post *model.Post) PostDetailResponse {
	resp := PostDetailResponse{
		ID:              post.ID,
		Title:           post.Title,
		Slug:            post.Slug,
		PostType:        normalizePostType(post.PostType),
		TemplateKey:     post.TemplateKey,
		TemplateData:    post.TemplateData,
		ImageTextData:   normalizeImageTextData(post.ImageTextData, post.TemplateData),
		Content:         post.Content,
		HTMLContent:     post.HTMLContent,
		Excerpt:         post.Excerpt,
		Cover:           post.Cover,
		CoverStorageKey: post.CoverStorageKey,
		GroupID:         post.GroupID,
		CategoryID:      post.CategoryID,
		Status:          post.Status,
		ViewCount:       post.ViewCount,
		LikeCount:       post.LikeCount,
		IsTop:           post.IsTop,
		PublishedAt:     post.PublishedAt,
		CreatedAt:       post.CreatedAt,
	}

	if post.Author != nil {
		resp.Author = &AuthorInfo{
			ID:       post.Author.ID,
			Nickname: post.Author.Nickname,
			Avatar:   post.Author.Avatar,
		}
	}

	if post.Group != nil {
		resp.Group = &PostGroupInfo{
			ID:          post.Group.ID,
			Name:        post.Group.Name,
			Slug:        post.Group.Slug,
			Description: post.Group.Description,
			AuthorID:    post.Group.AuthorID,
			ParentID:    post.Group.ParentID,
		}
	}

	if post.Category != nil {
		resp.Category = &PostCategoryInfo{
			ID:   post.Category.ID,
			Name: post.Category.Name,
			Slug: post.Category.Slug,
		}
	}

	if len(post.Tags) > 0 {
		resp.Tags = make([]PostTagInfo, len(post.Tags))
		for i, tag := range post.Tags {
			resp.Tags[i] = PostTagInfo{
				ID:   tag.ID,
				Name: tag.Name,
				Slug: tag.Slug,
			}
		}
	}

	return resp
}

func renderMarkdown(content string) string {
	return content
}

func increasePostViewCount(postID model.Int64String) {
	database.DB.Model(&model.Post{}).
		Where("id = ?", postID).
		UpdateColumn("view_count", gorm.Expr("view_count + 1"))
}

func normalizePostType(value string) string {
	v := strings.TrimSpace(strings.ToLower(value))
	switch v {
	case postTypeBlog:
		return postTypeBlog
	case postTypeImageText:
		return postTypeImageText
	default:
		return ""
	}
}

func currentUser(c *gin.Context) (int64, string, bool) {
	userIDAny, exists := c.Get("userId")
	if !exists {
		return 0, "", false
	}
	userID, ok := userIDAny.(int64)
	if !ok {
		return 0, "", false
	}
	roleAny, _ := c.Get("userRole")
	role, _ := roleAny.(string)
	return userID, role, true
}

func canManagePost(c *gin.Context, authorID model.Int64String) bool {
	userID, role, ok := currentUser(c)
	if !ok {
		return false
	}
	if role == "admin" {
		return true
	}
	return int64(authorID) == userID
}

func getOrCreateFallbackCategoryID() (model.Int64String, error) {
	var category model.PostCategory
	if err := database.DB.
		Where("deleted_at IS NULL").
		Order("sort_order ASC, created_at ASC").
		First(&category).Error; err == nil {
		return category.ID, nil
	}

	if err := database.DB.Where("slug = ?", "default").First(&category).Error; err == nil {
		return category.ID, nil
	}

	category = model.PostCategory{
		ID:          model.Int64String(utils.GenerateID()),
		Name:        "默认分类",
		Slug:        "default",
		Description: "系统默认分类",
		SortOrder:   999,
	}
	if err := database.DB.Create(&category).Error; err != nil {
		return 0, err
	}
	return category.ID, nil
}

func normalizeImageTextData(imageTextData, legacyTemplateData string) string {
	data := strings.TrimSpace(imageTextData)
	if data != "" {
		return data
	}
	legacy := strings.TrimSpace(legacyTemplateData)
	if legacy != "" {
		return legacy
	}
	return ""
}

func normalizeJSONColumnValue(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}"
	}
	if json.Valid([]byte(trimmed)) {
		return trimmed
	}
	return "{}"
}

func buildImageTextContent(templateKey, templateData string) string {
	templateKey = strings.TrimSpace(templateKey)
	templateData = strings.TrimSpace(templateData)
	if templateData == "" {
		if templateKey == "" {
			return ""
		}
		return "# 图文卡片\n\n模板：" + templateKey
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(templateData), &payload); err != nil {
		if templateKey == "" {
			return ""
		}
		return "# 图文卡片\n\n模板：" + templateKey
	}

	pick := func(keys ...string) string {
		for _, key := range keys {
			if value, ok := payload[key]; ok {
				if text, ok := value.(string); ok {
					trimmed := strings.TrimSpace(text)
					if trimmed != "" {
						return trimmed
					}
				}
			}
		}
		return ""
	}

	title := pick("title", "headline", "mainText")
	subtitle := pick("subtitle", "subTitle", "slogan")
	body := pick("content", "body", "description", "text")
	imageURL := pick("imageUrl", "image", "cover")

	if pagesAny, ok := payload["pages"]; ok {
		if pages, ok := pagesAny.([]any); ok {
			for _, item := range pages {
				pageMap, ok := item.(map[string]any)
				if !ok {
					continue
				}
				if imageURL == "" {
					if candidate, ok := pageMap["imageUrl"].(string); ok && strings.TrimSpace(candidate) != "" {
						imageURL = strings.TrimSpace(candidate)
					}
				}
				if body == "" {
					if candidate, ok := pageMap["text"].(string); ok && strings.TrimSpace(candidate) != "" {
						body = strings.TrimSpace(candidate)
					}
				}
			}
		}
	}

	var imageURLs []string
	if imagesAny, ok := payload["images"]; ok {
		if images, ok := imagesAny.([]any); ok {
			for _, item := range images {
				if raw, ok := item.(string); ok {
					raw = strings.TrimSpace(raw)
					if raw != "" {
						imageURLs = append(imageURLs, raw)
					}
				}
			}
		}
	}

	var b strings.Builder
	if title != "" {
		b.WriteString("# ")
		b.WriteString(title)
		b.WriteString("\n\n")
	}
	if subtitle != "" {
		b.WriteString("> ")
		b.WriteString(subtitle)
		b.WriteString("\n\n")
	}
	if len(imageURLs) > 0 {
		for i, url := range imageURLs {
			b.WriteString("![图文配图-")
			b.WriteString(strconv.Itoa(i + 1))
			b.WriteString("](")
			b.WriteString(url)
			b.WriteString(")\n\n")
		}
	} else if imageURL != "" {
		b.WriteString("![图文配图](")
		b.WriteString(imageURL)
		b.WriteString(")\n\n")
	}
	if body != "" {
		b.WriteString(body)
		b.WriteString("\n")
	}
	if b.Len() == 0 {
		if templateKey == "" {
			return ""
		}
		return "# 图文卡片\n\n模板：" + templateKey
	}

	return strings.TrimSpace(b.String())
}

func deletePostCoverAsync(storageKey, coverURL string) {
	if storageKey == "" && coverURL == "" {
		return
	}

	go func() {
		uploader := service.NewUploadService()
		if storageKey != "" {
			if err := uploader.DeleteByKey(storageKey); err != nil {
				logger.Log.WithField("storage_key", storageKey).WithError(err).Warn("delete blog cover by key failed")
			}
			return
		}
		if err := uploader.Delete(coverURL); err != nil {
			logger.Log.WithField("cover_url", coverURL).WithError(err).Warn("delete blog cover by url failed")
		}
	}()
}
