package handler

import (
	"net/http"
	"strconv"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PostListResponse struct {
	ID          model.Int64String `json:"id"`
	Title       string            `json:"title"`
	Slug        string            `json:"slug"`
	Excerpt     string            `json:"excerpt"`
	Cover       string            `json:"cover"`
	CategoryID  model.Int64String `json:"categoryId"`
	Category    *PostCategoryInfo `json:"category,omitempty"`
	Tags        []PostTagInfo     `json:"tags,omitempty"`
	Status      string            `json:"status,omitempty"`
	ViewCount   int               `json:"viewCount"`
	LikeCount   int               `json:"likeCount"`
	IsTop       bool              `json:"isTop"`
	PublishedAt *time.Time        `json:"publishedAt,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
}

type PostCategoryInfo struct {
	ID   model.Int64String `json:"id"`
	Name string            `json:"name"`
	Slug string            `json:"slug"`
}

type PostTagInfo struct {
	ID   model.Int64String `json:"id"`
	Name string            `json:"name"`
	Slug string            `json:"slug"`
}

type PostDetailResponse struct {
	ID          model.Int64String `json:"id"`
	Title       string            `json:"title"`
	Slug        string            `json:"slug"`
	Content     string            `json:"content"`
	HTMLContent string            `json:"htmlContent"`
	Excerpt     string            `json:"excerpt"`
	Cover       string            `json:"cover"`
	CategoryID  model.Int64String `json:"categoryId"`
	Status      string            `json:"status"`
	Author      *AuthorInfo       `json:"author,omitempty"`
	Category    *PostCategoryInfo `json:"category,omitempty"`
	Tags        []PostTagInfo     `json:"tags,omitempty"`
	ViewCount   int               `json:"viewCount"`
	LikeCount   int               `json:"likeCount"`
	IsTop       bool              `json:"isTop"`
	PublishedAt *time.Time        `json:"publishedAt,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
}

type AuthorInfo struct {
	ID       model.Int64String `json:"id"`
	Nickname string            `json:"nickname"`
	Avatar   string            `json:"avatar"`
}

func GetPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	categorySlug := c.Query("category")
	tagSlug := c.Query("tag")
	keyword := c.Query("keyword")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	query := database.DB.Model(&model.Post{}).
		Where("status = ? AND deleted_at IS NULL", "published").
		Preload("Category").
		Preload("Tags")

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

func GetTags(c *gin.Context) {
	var tags []model.PostTag
	database.DB.Where("deleted_at IS NULL").
		Order("post_count DESC, created_at DESC").
		Find(&tags)

	Success(c, tags)
}

func AdminGetPostDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.
		Preload("Category").
		Preload("Tags").
		Preload("Author", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nickname, avatar")
		}).
		First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
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

	var req struct {
		Title      string              `json:"title" binding:"required"`
		Slug       string              `json:"slug"`
		Content    string              `json:"content" binding:"required"`
		Excerpt    string              `json:"excerpt"`
		Cover      string              `json:"cover"`
		CategoryID model.Int64String   `json:"categoryId" binding:"required"`
		TagIDs     []model.Int64String `json:"tagIds"`
		Status     string              `json:"status"`
		IsTop      bool                `json:"isTop"`
		PublishNow bool                `json:"publishNow"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if req.Slug != "" {
		var existingPost model.Post
		if err := database.DB.Where("slug = ?", req.Slug).First(&existingPost).Error; err == nil {
			Error(c, http.StatusBadRequest, "duplicate slug")
			return
		}
	}

	postID := model.Int64String(utils.GenerateID())
	slug := req.Slug
	if slug == "" {
		slug = postID.String()
	}

	post := model.Post{
		ID:          postID,
		Title:       req.Title,
		Slug:        slug,
		Content:     req.Content,
		HTMLContent: renderMarkdown(req.Content),
		Excerpt:     req.Excerpt,
		Cover:       req.Cover,
		AuthorID:    model.Int64String(userID),
		CategoryID:  req.CategoryID,
		Status:      req.Status,
		IsTop:       req.IsTop,
	}

	if post.Status == "" {
		post.Status = "draft"
	}

	if req.PublishNow && post.Status == "published" {
		now := time.Now()
		post.PublishedAt = &now
	}

	if err := database.DB.Create(&post).Error; err != nil {
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

	database.DB.Model(&model.PostCategory{}).
		Where("id = ?", int64(req.CategoryID)).
		UpdateColumn("post_count", gorm.Expr("post_count + 1"))

	Success(c, post)
}

func AdminUpdatePost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		Error(c, http.StatusNotFound, "post not found")
		return
	}

	var req struct {
		Title      string              `json:"title"`
		Slug       string              `json:"slug"`
		Content    string              `json:"content"`
		Excerpt    string              `json:"excerpt"`
		Cover      string              `json:"cover"`
		CategoryID model.Int64String   `json:"categoryId"`
		TagIDs     []model.Int64String `json:"tagIds"`
		Status     string              `json:"status"`
		IsTop      bool                `json:"isTop"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Slug != "" && req.Slug != post.Slug {
		var existingPost model.Post
		if err := database.DB.Where("slug = ? AND id != ?", req.Slug, id).First(&existingPost).Error; err == nil {
			Error(c, http.StatusBadRequest, "duplicate slug")
			return
		}
	}

	updates := make(map[string]interface{})
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Slug != "" {
		updates["slug"] = req.Slug
	}
	if req.Content != "" {
		updates["content"] = req.Content
		updates["html_content"] = renderMarkdown(req.Content)
	}
	if req.Excerpt != "" {
		updates["excerpt"] = req.Excerpt
	}
	if req.Cover != "" {
		updates["cover"] = req.Cover
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

	database.DB.Model(&post).Updates(updates)

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

	database.DB.Delete(&post)

	database.DB.Model(&model.PostCategory{}).
		Where("id = ?", post.CategoryID).
		UpdateColumn("post_count", gorm.Expr("post_count - 1"))

	Success(c, nil)
}

func AdminGetPosts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	query := database.DB.Model(&model.Post{}).
		Preload("Category").
		Preload("Tags")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var posts []model.Post
	query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&posts)

	Success(c, gin.H{
		"list":     posts,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func convertToPostListResponse(post *model.Post) PostListResponse {
	resp := PostListResponse{
		ID:          post.ID,
		Title:       post.Title,
		Slug:        post.Slug,
		Excerpt:     post.Excerpt,
		Cover:       post.Cover,
		CategoryID:  post.CategoryID,
		Status:      post.Status,
		ViewCount:   post.ViewCount,
		LikeCount:   post.LikeCount,
		IsTop:       post.IsTop,
		PublishedAt: post.PublishedAt,
		CreatedAt:   post.CreatedAt,
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
		ID:          post.ID,
		Title:       post.Title,
		Slug:        post.Slug,
		Content:     post.Content,
		HTMLContent: post.HTMLContent,
		Excerpt:     post.Excerpt,
		Cover:       post.Cover,
		CategoryID:  post.CategoryID,
		Status:      post.Status,
		ViewCount:   post.ViewCount,
		LikeCount:   post.LikeCount,
		IsTop:       post.IsTop,
		PublishedAt: post.PublishedAt,
		CreatedAt:   post.CreatedAt,
	}

	if post.Author != nil {
		resp.Author = &AuthorInfo{
			ID:       post.Author.ID,
			Nickname: post.Author.Nickname,
			Avatar:   post.Author.Avatar,
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
