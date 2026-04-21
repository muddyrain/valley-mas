package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
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
	visibilityPrivate = "private"
	visibilityShared  = "shared"
	visibilityPublic  = "public"
)

type PostListResponse struct {
	ID              model.Int64String `json:"id"`
	Title           string            `json:"title"`
	Slug            string            `json:"slug"`
	PostType        string            `json:"postType"`
	Visibility      string            `json:"visibility"`
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
	GroupType   string             `json:"groupType"`
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
	Visibility      string            `json:"visibility"`
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
	PrevPost        *PostListResponse `json:"prevPost,omitempty"`
	NextPost        *PostListResponse `json:"nextPost,omitempty"`
}

type AuthorInfo struct {
	ID       model.Int64String `json:"id"`
	Nickname string            `json:"nickname"`
	Avatar   string            `json:"avatar"`
}

type PostCommentAuthorInfo struct {
	ID       model.Int64String `json:"id"`
	Nickname string            `json:"nickname"`
	Avatar   string            `json:"avatar"`
}

type PostCommentResponse struct {
	ID        model.Int64String      `json:"id"`
	PostID    model.Int64String      `json:"postId"`
	UserID    model.Int64String      `json:"userId"`
	Content   string                 `json:"content"`
	CreatedAt time.Time              `json:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt"`
	Author    *PostCommentAuthorInfo `json:"author,omitempty"`
}

func GetPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	groupIDRaw := strings.TrimSpace(c.Query("groupId"))
	groupSlug := strings.TrimSpace(c.Query("group"))
	categorySlug := c.Query("category")
	tagSlug := c.Query("tag")
	keyword := c.Query("keyword")
	sort := strings.TrimSpace(c.Query("sort"))
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
		Where("status = ? AND visibility = ? AND deleted_at IS NULL", "published", visibilityPublic).
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

	orderExpr := "is_top DESC, COALESCE(published_at, created_at) DESC"
	if strings.EqualFold(sort, "oldest") {
		orderExpr = "is_top DESC, COALESCE(published_at, created_at) ASC"
	}

	var posts []model.Post
	query.Order(orderExpr).
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
	if post.Visibility != visibilityPublic && !canManagePost(c, post.AuthorID) {
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
	if post.Visibility != visibilityPublic && !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	go increasePostViewCount(post.ID)

	Success(c, convertToPostDetailResponse(&post))
}

func loadAdjacentPosts(current *model.Post) (*model.Post, *model.Post) {
	if current == nil {
		return nil, nil
	}

	loadTimeline := func(groupID model.Int64String) []model.Post {
		query := database.DB.
			Model(&model.Post{}).
			Where("status = ? AND visibility = ? AND deleted_at IS NULL AND post_type = ?", "published", visibilityPublic, normalizePostType(current.PostType))
		if groupID != 0 {
			query = query.Where("group_id = ?", groupID)
		}

		var posts []model.Post
		query.
			Select("id, title, slug, post_type, visibility, excerpt, cover, cover_storage_key, group_id, category_id, status, view_count, like_count, is_top, published_at, created_at").
			Order("is_top DESC, COALESCE(published_at, created_at) DESC").
			Find(&posts)
		return posts
	}

	resolve := func(posts []model.Post) (*model.Post, *model.Post, bool) {
		for index := range posts {
			if posts[index].ID != current.ID {
				continue
			}
			var prevPost *model.Post
			var nextPost *model.Post
			if index > 0 {
				prevPost = &posts[index-1]
			}
			if index+1 < len(posts) {
				nextPost = &posts[index+1]
			}
			return prevPost, nextPost, true
		}
		return nil, nil, false
	}

	if current.GroupID != 0 {
		if prevPost, nextPost, ok := resolve(loadTimeline(current.GroupID)); ok {
			return prevPost, nextPost
		}
	}

	prevPost, nextPost, _ := resolve(loadTimeline(0))
	return prevPost, nextPost
}

func GetPostComments(c *gin.Context) {
	postID, post, ok := loadReadablePostByID(c)
	if !ok {
		return
	}

	var comments []model.PostComment
	if err := database.DB.
		Where("post_id = ? AND deleted_at IS NULL", postID).
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		Order("created_at ASC").
		Find(&comments).Error; err != nil {
		Error(c, http.StatusInternalServerError, "failed to load comments")
		return
	}

	response := make([]PostCommentResponse, len(comments))
	for i := range comments {
		response[i] = convertToPostCommentResponse(&comments[i])
	}

	Success(c, gin.H{
		"list":     response,
		"total":    len(response),
		"postType": normalizePostType(post.PostType),
	})
}

func CreatePostComment(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	postID, _, readable := loadReadablePostByID(c)
	if !readable {
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		Error(c, http.StatusBadRequest, "comment content required")
		return
	}
	if len([]rune(content)) > 500 {
		Error(c, http.StatusBadRequest, "comment too long")
		return
	}

	comment := model.PostComment{
		PostID:  postID,
		UserID:  model.Int64String(userID),
		Content: content,
	}
	if err := database.DB.Create(&comment).Error; err != nil {
		Error(c, http.StatusInternalServerError, "failed to create comment")
		return
	}
	if err := database.DB.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&comment, "id = ?", comment.ID).Error; err != nil {
		Error(c, http.StatusInternalServerError, "failed to load comment")
		return
	}

	Success(c, convertToPostCommentResponse(&comment))
}

func DeletePostComment(c *gin.Context) {
	commentID, err := strconv.ParseInt(c.Param("commentId"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid comment id")
		return
	}

	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	var comment model.PostComment
	if err := database.DB.First(&comment, "id = ? AND deleted_at IS NULL", commentID).Error; err != nil {
		Error(c, http.StatusNotFound, "comment not found")
		return
	}

	var post model.Post
	if err := database.DB.Select("id, author_id").First(&post, "id = ? AND deleted_at IS NULL", comment.PostID).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	canDelete := role == "admin" || int64(comment.UserID) == userID || int64(post.AuthorID) == userID
	if !canDelete {
		Error(c, http.StatusForbidden, "forbidden")
		return
	}

	if err := database.DB.Delete(&comment).Error; err != nil {
		Error(c, http.StatusInternalServerError, "failed to delete comment")
		return
	}

	Success(c, gin.H{"deleted": true})
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
	groupType := normalizeGroupType(c.Query("groupType"))
	query := database.DB.Model(&model.PostGroup{}).Where("deleted_at IS NULL")
	if authorIDRaw != "" {
		if authorID, err := strconv.ParseInt(authorIDRaw, 10, 64); err == nil {
			query = query.Where("author_id = ?", authorID)
		}
	}
	if groupType != "" {
		query = query.Where("group_type = ?", groupType)
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

	groupType := normalizeGroupType(c.Query("groupType"))
	query := database.DB.Model(&model.PostGroup{}).Where("deleted_at IS NULL")
	if role == "creator" {
		query = query.Where("author_id = ?", userID)
	}
	if groupType != "" {
		query = query.Where("group_type = ?", groupType)
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
		GroupType   string             `json:"groupType"`
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
	groupType := normalizeGroupType(req.GroupType)
	if groupType == "" {
		groupType = postTypeBlog
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
		if normalizeGroupType(parent.GroupType) != groupType {
			Error(c, http.StatusBadRequest, "parent group type mismatch")
			return
		}
	}

	slug := strconv.FormatInt(utils.GenerateID(), 10)

	group := model.PostGroup{
		ID:          model.Int64String(utils.GenerateID()),
		Name:        name,
		Slug:        slug,
		GroupType:   groupType,
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
		if normalizeGroupType(parent.GroupType) != normalizeGroupType(group.GroupType) {
			Error(c, http.StatusBadRequest, "parent group type mismatch")
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
		Where("group_id = ? AND post_type = ?", id, normalizeGroupType(group.GroupType)).
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
		Visibility      string              `json:"visibility"`
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
		Visibility:      normalizeVisibility(req.Visibility),
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
		if _, err := loadWritableGroupForPostType(c, req.GroupID, postType, userID, role); err != nil {
			Error(c, http.StatusBadRequest, "group not found")
			return
		}
	}

	if post.Status == "" {
		post.Status = "draft"
	}
	if post.Visibility == "" {
		post.Visibility = visibilityPrivate
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
		Visibility      string              `json:"visibility"`
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
	imageTextData = normalizeJSONColumnValue(imageTextData)

	updates := make(map[string]interface{})
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if normalizedType := normalizePostType(req.PostType); normalizedType != "" {
		updates["post_type"] = normalizedType
	}
	if normalizedVisibility := normalizeVisibility(req.Visibility); normalizedVisibility != "" {
		updates["visibility"] = normalizedVisibility
	}
	if req.TemplateKey != "" {
		updates["template_key"] = strings.TrimSpace(req.TemplateKey)
	}
	if req.TemplateData != "" {
		updates["template_data"] = normalizeJSONColumnValue(strings.TrimSpace(req.TemplateData))
	}
	if hasImageTextData || strings.TrimSpace(req.TemplateData) != "" {
		updates["image_text_data"] = imageTextData
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
			finalType := post.PostType
			if normalizedType := normalizePostType(req.PostType); normalizedType != "" {
				finalType = normalizedType
			}
			if _, err := loadWritableGroupForPostType(c, *req.GroupID, finalType, currentUserIDForPost(c, post.AuthorID), currentUserRole(c)); err != nil {
				Error(c, http.StatusBadRequest, "group not found")
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
	oldImageTextKeys := extractImageTextStorageKeys(normalizeImageTextData(post.ImageTextData, post.TemplateData))
	oldGroupID := post.GroupID
	newGroupID := oldGroupID
	if req.GroupID != nil {
		newGroupID = *req.GroupID
	}
	database.DB.Model(&post).Updates(updates)
	if coverChanged {
		deletePostCoverAsync(oldCoverStorageKey, oldCoverURL)
	}
	if hasImageTextData || strings.TrimSpace(req.TemplateData) != "" {
		newImageTextKeys := extractImageTextStorageKeys(imageTextData)
		deleteObsoleteImageTextAssets(oldImageTextKeys, newImageTextKeys)
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
	imageTextKeys := extractImageTextStorageKeys(normalizeImageTextData(post.ImageTextData, post.TemplateData))
	database.DB.Delete(&post)
	deletePostCoverAsync(coverKey, coverURL)
	deleteImageTextAssetsAsync(imageTextKeys)

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
	groupIDRaw := strings.TrimSpace(c.Query("groupId"))
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
	if groupIDRaw != "" {
		if groupID, err := strconv.ParseInt(groupIDRaw, 10, 64); err == nil {
			query = query.Where("group_id = ?", groupID)
		}
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
		Visibility:      normalizeVisibility(post.Visibility),
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
			GroupType:   normalizeGroupType(post.Group.GroupType),
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
		Visibility:      normalizeVisibility(post.Visibility),
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

	prevPost, nextPost := loadAdjacentPosts(post)
	if prevPost != nil {
		prevResp := convertToPostListResponse(prevPost)
		resp.PrevPost = &prevResp
	}
	if nextPost != nil {
		nextResp := convertToPostListResponse(nextPost)
		resp.NextPost = &nextResp
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
			GroupType:   normalizeGroupType(post.Group.GroupType),
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

func convertToPostCommentResponse(comment *model.PostComment) PostCommentResponse {
	resp := PostCommentResponse{
		ID:        comment.ID,
		PostID:    comment.PostID,
		UserID:    comment.UserID,
		Content:   comment.Content,
		CreatedAt: comment.CreatedAt,
		UpdatedAt: comment.UpdatedAt,
	}

	if comment.User != nil {
		resp.Author = &PostCommentAuthorInfo{
			ID:       comment.User.ID,
			Nickname: comment.User.Nickname,
			Avatar:   comment.User.Avatar,
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

func normalizeGroupType(value string) string {
	return normalizePostType(value)
}

func normalizeVisibility(value string) string {
	v := strings.TrimSpace(strings.ToLower(value))
	switch v {
	case visibilityPrivate:
		return visibilityPrivate
	case visibilityShared:
		return visibilityShared
	case visibilityPublic:
		return visibilityPublic
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

func currentUserRole(c *gin.Context) string {
	_, role, _ := currentUser(c)
	return role
}

func currentUserIDForPost(c *gin.Context, fallbackAuthorID model.Int64String) int64 {
	userID, _, ok := currentUser(c)
	if ok {
		return userID
	}
	return int64(fallbackAuthorID)
}

func loadWritableGroupForPostType(
	c *gin.Context,
	groupID model.Int64String,
	postType string,
	userID int64,
	role string,
) (*model.PostGroup, error) {
	var group model.PostGroup
	if err := database.DB.First(&group, groupID).Error; err != nil {
		return nil, err
	}
	if role != "admin" && int64(group.AuthorID) != userID {
		return nil, fmt.Errorf("group no permission")
	}
	if normalizeGroupType(group.GroupType) != normalizePostType(postType) {
		return nil, fmt.Errorf("group type mismatch")
	}
	return &group, nil
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

func loadReadablePostByID(c *gin.Context) (model.Int64String, *model.Post, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		Error(c, http.StatusBadRequest, "invalid post id")
		return 0, nil, false
	}

	var post model.Post
	if err := database.DB.
		Where("id = ? AND status = ? AND deleted_at IS NULL", id, "published").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&post).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return 0, nil, false
	}

	if post.Visibility != visibilityPublic && !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusNotFound, "post not found")
		return 0, nil, false
	}

	return model.Int64String(id), &post, true
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
	if !json.Valid([]byte(trimmed)) {
		return "{}"
	}
	var payload any
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return "{}"
	}
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(payload); err != nil {
		return "{}"
	}
	return encodeJSONStringASCII(strings.TrimSpace(buf.String()))
}

func encodeJSONStringASCII(value string) string {
	var b strings.Builder
	for _, r := range value {
		switch {
		case r < 0x80:
			b.WriteRune(r)
		case r <= 0xFFFF:
			b.WriteString(fmt.Sprintf("\\u%04x", r))
		default:
			r1, r2 := utf16.EncodeRune(r)
			b.WriteString(fmt.Sprintf("\\u%04x\\u%04x", r1, r2))
		}
	}
	return b.String()
}

func AdminUploadImageTextAsset(c *gin.Context) {
	userID, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		Error(c, http.StatusBadRequest, "file is required")
		return
	}

	uploadService := service.NewUploadService()
	config := service.GetDefaultConfig(service.UploadTypeImageText)
	config.UserID = userID
	config.CustomFolder = buildImageTextAssetFolder(userID)

	result, err := uploadService.Upload(file, config)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}

	Success(c, gin.H{
		"url":      result.URL,
		"key":      result.Key,
		"fileName": result.FileName,
		"size":     result.Size,
		"width":    result.Width,
		"height":   result.Height,
	})
}

func buildImageTextAssetFolder(userID int64) string {
	return "image-text/" + strconv.FormatInt(userID, 10) + "/" + time.Now().Format("20060102")
}

func extractImageTextStorageKeys(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var payload struct {
		Images []string `json:"images"`
		Pages  []struct {
			ImageKey string `json:"imageKey"`
		} `json:"pages"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return nil
	}

	keys := make([]string, 0, len(payload.Images)+len(payload.Pages))
	seen := map[string]struct{}{}
	for _, item := range payload.Pages {
		key := strings.TrimSpace(item.ImageKey)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}
	return keys
}

func deleteObsoleteImageTextAssets(oldKeys, newKeys []string) {
	if len(oldKeys) == 0 {
		return
	}
	keep := map[string]struct{}{}
	for _, key := range newKeys {
		if key = strings.TrimSpace(key); key != "" {
			keep[key] = struct{}{}
		}
	}
	var obsolete []string
	for _, key := range oldKeys {
		if key = strings.TrimSpace(key); key == "" {
			continue
		}
		if _, ok := keep[key]; ok {
			continue
		}
		obsolete = append(obsolete, key)
	}
	deleteImageTextAssetsAsync(obsolete)
}

func deleteImageTextAssetsAsync(keys []string) {
	if len(keys) == 0 {
		return
	}
	go func() {
		uploader := service.NewUploadService()
		for _, key := range keys {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			if err := uploader.DeleteByKey(key); err != nil {
				logger.Log.WithField("storage_key", key).WithError(err).Warn("delete image-text asset failed")
			}
		}
	}()
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
