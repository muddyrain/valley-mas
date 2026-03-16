package handler

import (
	"net/http"
	"strconv"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PostListResponse 文章列表响应
type PostListResponse struct {
	ID          model.Int64String `json:"id"`
	Title       string            `json:"title"`
	Slug        string            `json:"slug"`
	Excerpt     string            `json:"excerpt"`
	Cover       string            `json:"cover"`
	CategoryID  model.Int64String `json:"categoryId"`
	Category    *PostCategoryInfo `json:"category,omitempty"`
	Tags        []PostTagInfo     `json:"tags,omitempty"`
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

// GetPosts 获取文章列表（公开接口）
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

	// 构建查询
	query := database.DB.Model(&model.Post{}).
		Where("status = ? AND deleted_at IS NULL", "published").
		Preload("Category").
		Preload("Tags")

	// 分类筛选
	if categorySlug != "" {
		var category model.PostCategory
		if err := database.DB.Where("slug = ?", categorySlug).First(&category).Error; err == nil {
			query = query.Where("category_id = ?", category.ID)
		}
	}

	// 标签筛选
	if tagSlug != "" {
		var tag model.PostTag
		if err := database.DB.Where("slug = ?", tagSlug).First(&tag).Error; err == nil {
			query = query.Joins("JOIN post_tag_relations ptr ON ptr.post_id = posts.id").
				Where("ptr.tag_id = ?", tag.ID)
		}
	}

	// 关键词搜索
	if keyword != "" {
		query = query.Where("title LIKE ? OR excerpt LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 获取列表
	var posts []model.Post
	query.Order("is_top DESC, published_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&posts)

	// 转换响应
	response := make([]PostListResponse, len(posts))
	for i, post := range posts {
		response[i] = convertToPostListResponse(&post)
	}

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"message":  "success",
		"data":     response,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetPostDetail 获取文章详情（公开接口）
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
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文章不存在"})
		return
	}

	// 增加浏览量（异步）
	go func() {
		database.DB.Model(&post).UpdateColumn("view_count", gorm.Expr("view_count + 1"))
	}()

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    convertToPostDetailResponse(&post),
	})
}

// GetCategories 获取所有分类（公开接口）
func GetCategories(c *gin.Context) {
	var categories []model.PostCategory
	database.DB.Where("deleted_at IS NULL").
		Order("sort_order ASC, created_at DESC").
		Find(&categories)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    categories,
	})
}

// GetTags 获取所有标签（公开接口）
func GetTags(c *gin.Context) {
	var tags []model.PostTag
	database.DB.Where("deleted_at IS NULL").
		Order("post_count DESC, created_at DESC").
		Find(&tags)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    tags,
	})
}

// AdminGetPostDetail 获取文章详情（管理员接口，通过ID）
func AdminGetPostDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文章不存在"})
		return
	}

	// 加载关联数据
	database.DB.Model(&post).Association("Category").Find(&post.Category)
	database.DB.Model(&post).Association("Tags").Find(&post.Tags)

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "success",
		"data":    convertToPostDetailResponse(&post),
	})
}

// AdminCreatePost 创建文章（管理员接口）
func AdminCreatePost(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req struct {
		Title      string  `json:"title" binding:"required"`
		Slug       string  `json:"slug" binding:"required"`
		Content    string  `json:"content" binding:"required"`
		Excerpt    string  `json:"excerpt"`
		Cover      string  `json:"cover"`
		CategoryID int64   `json:"categoryId" binding:"required"`
		TagIDs     []int64 `json:"tagIds"`
		Status     string  `json:"status"`
		IsTop      bool    `json:"isTop"`
		PublishNow bool    `json:"publishNow"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误: " + err.Error()})
		return
	}

	// 检查 slug 是否已存在
	var existingPost model.Post
	if err := database.DB.Where("slug = ?", req.Slug).First(&existingPost).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "文章标识已存在"})
		return
	}

	// 生成 HTML 内容（简单处理，实际可以使用 marked 库）
	htmlContent := renderMarkdown(req.Content)

	post := model.Post{
		Title:       req.Title,
		Slug:        req.Slug,
		Content:     req.Content,
		HTMLContent: htmlContent,
		Excerpt:     req.Excerpt,
		Cover:       req.Cover,
		AuthorID:    model.Int64String(userID.(int64)),
		CategoryID:  model.Int64String(req.CategoryID),
		Status:      req.Status,
		IsTop:       req.IsTop,
	}

	if req.Status == "" {
		post.Status = "draft"
	}

	if req.PublishNow && post.Status == "published" {
		now := time.Now()
		post.PublishedAt = &now
	}

	if err := database.DB.Create(&post).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "创建失败"})
		return
	}

	// 关联标签
	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			relation := model.PostTagRelation{
				PostID: post.ID,
				TagID:  model.Int64String(tagID),
			}
			database.DB.Create(&relation)
		}
		// 更新标签文章数
		database.DB.Model(&model.PostTag{}).
			Where("id IN ?", req.TagIDs).
			UpdateColumn("post_count", gorm.Expr("post_count + 1"))
	}

	// 更新分类文章数
	database.DB.Model(&model.PostCategory{}).
		Where("id = ?", req.CategoryID).
		UpdateColumn("post_count", gorm.Expr("post_count + 1"))

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "创建成功",
		"data":    post,
	})
}

// AdminUpdatePost 更新文章（管理员接口）
func AdminUpdatePost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文章不存在"})
		return
	}

	var req struct {
		Title      string  `json:"title"`
		Slug       string  `json:"slug"`
		Content    string  `json:"content"`
		Excerpt    string  `json:"excerpt"`
		Cover      string  `json:"cover"`
		CategoryID int64   `json:"categoryId"`
		TagIDs     []int64 `json:"tagIds"`
		Status     string  `json:"status"`
		IsTop      bool    `json:"isTop"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "参数错误"})
		return
	}

	// 检查 slug 是否被其他文章使用
	if req.Slug != "" && req.Slug != post.Slug {
		var existingPost model.Post
		if err := database.DB.Where("slug = ? AND id != ?", req.Slug, id).First(&existingPost).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "文章标识已存在"})
			return
		}
	}

	// 更新字段
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
		updates["category_id"] = req.CategoryID
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

	// 更新标签关联
	if len(req.TagIDs) > 0 {
		// 删除旧关联
		database.DB.Where("post_id = ?", post.ID).Delete(&model.PostTagRelation{})
		// 创建新关联
		for _, tagID := range req.TagIDs {
			relation := model.PostTagRelation{
				PostID: post.ID,
				TagID:  model.Int64String(tagID),
			}
			database.DB.Create(&relation)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "更新成功",
	})
}

// AdminDeletePost 删除文章（管理员接口）
func AdminDeletePost(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	var post model.Post
	if err := database.DB.First(&post, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "message": "文章不存在"})
		return
	}

	// 软删除
	database.DB.Delete(&post)

	// 更新分类和标签的文章数
	database.DB.Model(&model.PostCategory{}).
		Where("id = ?", post.CategoryID).
		UpdateColumn("post_count", gorm.Expr("post_count - 1"))

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "删除成功",
	})
}

// AdminGetPosts 获取文章列表（管理员接口，包含草稿）
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

	c.JSON(http.StatusOK, gin.H{
		"code":     0,
		"message":  "success",
		"data":     posts,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// 辅助函数

func convertToPostListResponse(post *model.Post) PostListResponse {
	resp := PostListResponse{
		ID:          post.ID,
		Title:       post.Title,
		Slug:        post.Slug,
		Excerpt:     post.Excerpt,
		Cover:       post.Cover,
		CategoryID:  post.CategoryID,
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

type PostDetailResponse struct {
	ID          model.Int64String `json:"id"`
	Title       string            `json:"title"`
	Slug        string            `json:"slug"`
	Content     string            `json:"content"`
	HTMLContent string            `json:"htmlContent"`
	Excerpt     string            `json:"excerpt"`
	Cover       string            `json:"cover"`
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

func convertToPostDetailResponse(post *model.Post) PostDetailResponse {
	resp := PostDetailResponse{
		ID:          post.ID,
		Title:       post.Title,
		Slug:        post.Slug,
		Content:     post.Content,
		HTMLContent: post.HTMLContent,
		Excerpt:     post.Excerpt,
		Cover:       post.Cover,
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

// 简单的 Markdown 渲染（实际项目中可以使用更完善的库）
func renderMarkdown(content string) string {
	// 这里可以集成 marked 或其他 Markdown 解析库
	// 暂时返回原始内容，前端会处理渲染
	return content
}
