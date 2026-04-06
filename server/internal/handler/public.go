package handler

import (
	"errors"
	"net/http"
	"strconv"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// VerifyCodeRequest 验证口令请求
type VerifyCodeRequest struct {
	Code string `json:"code" binding:"required" example:"y2722"`
}

// VerifyCodeResponse 验证口令响应
type VerifyCodeResponse struct {
	Valid   bool                   `json:"valid" example:"true"`
	Creator map[string]interface{} `json:"creator"`
}

// VerifyCode 验证口令（公开接口）
// @Summary      验证创作者口令
// @Description  输入口令验证并获取创作者空间信息
// @Tags         公开接口
// @Accept       json
// @Produce      json
// @Param        request  body      VerifyCodeRequest  true  "口令"
// @Success      200  {object}  VerifyCodeResponse  "验证成功"
// @Failure      400  {object}  map[string]interface{}  "口令格式错误"
// @Failure      404  {object}  map[string]interface{}  "口令不存在或已关闭"
// @Router       /code/verify [post]
func VerifyCode(c *gin.Context) {
	db := database.DB

	// 1. 解析请求参数
	var req VerifyCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	// 2. 标准化口令（转小写，去空格）
	normalizedCode := utils.NormalizeCode(req.Code)

	// 3. 验证口令格式
	if !utils.ValidateCodeFormat(normalizedCode) {
		Error(c, http.StatusBadRequest, "口令格式错误")
		return
	}

	// 4. 查询创作者（只查询已激活的），预加载空间信息
	var creator model.Creator
	err := db.Where("code = ? AND is_active = ?", normalizedCode, true).
		Preload("User").                                                                                                          // 预加载用户信息（用于获取昵称）
		Preload("Space").                                                                                                         // 预加载空间信息
		Preload("Space.Resources", "(visibility = ? OR visibility IS NULL OR visibility = '') AND deleted_at IS NULL", "public"). // 预加载空间资源
		First(&creator).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "口令不存在或已关闭")
			return
		}
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 5. 统计资源数量
	resourceCount := 0
	if creator.Space != nil {
		resourceCount = len(creator.Space.Resources)
	}

	// 6. 记录访问
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	accessLog := model.CodeAccessLog{
		CreatorID: creator.ID,
		Code:      normalizedCode,
		IP:        ip,
		UserAgent: userAgent,
	}
	db.Create(&accessLog)

	// 7. 返回创作者和空间信息
	creatorName := ""
	if creator.User != nil {
		creatorName = creator.User.Nickname
	}

	response := gin.H{
		"valid": true,
		"creator": gin.H{
			"id":          creator.ID,
			"name":        creatorName,
			"avatar":      creator.User.Avatar,
			"description": creator.Description,
			"code":        creator.Code,
		},
	}

	if creator.Space != nil {
		response["space"] = gin.H{
			"id":            creator.Space.ID,
			"description":   creator.Space.Description,
			"banner":        creator.Space.Banner,
			"resourceCount": resourceCount,
			"createdAt":     creator.Space.CreatedAt,
		}
	}

	Success(c, response)
}

// GetCreatorResources 获取创作者资源列表
func GetCreatorResources(c *gin.Context) {
	code := utils.NormalizeCode(c.Param("code"))
	resourceType := c.Query("type") // avatar, wallpaper, 空则全部
	keyword := c.Query("keyword")
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()

	// 兼容旧接口：通过创作者口令查找创作者，再返回公开资源列表。
	var creator model.Creator
	if err := db.Where("code = ? AND is_active = ? AND deleted_at IS NULL", code, true).
		First(&creator).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "创作者不存在或未激活")
			return
		}
		Error(c, http.StatusInternalServerError, "查询创作者失败")
		return
	}

	query := db.Model(&model.Resource{}).
		Where("user_id = ? AND deleted_at IS NULL", creator.UserID).
		Where("(visibility = ? OR visibility IS NULL OR visibility = '')", "public")

	if resourceType != "" {
		query = query.Where("type = ?", resourceType)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR description LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询资源总数失败")
		return
	}

	var resources []model.Resource
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&resources).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询资源列表失败")
		return
	}
	fillResourceThumbnails(resources)

	var creatorName, creatorAvatar string
	var user model.User
	if err := db.Where("id = ? AND deleted_at IS NULL", creator.UserID).First(&user).Error; err == nil {
		creatorName = user.Nickname
		creatorAvatar = user.Avatar
	}

	favoritedSet := map[string]bool{}
	if uid, exists := c.Get("userId"); exists {
		if userID, ok := uid.(int64); ok {
			var favs []model.UserFavorite
			db.Where("user_id = ? AND deleted_at IS NULL", userID).Find(&favs)
			for _, fav := range favs {
				favoritedSet[strconv.FormatInt(int64(fav.ResourceID), 10)] = true
			}
		}
	}

	resourceList := make([]gin.H, 0, len(resources))
	for _, resource := range resources {
		rid := strconv.FormatInt(int64(resource.ID), 10)
		resourceList = append(resourceList, gin.H{
			"id":            resource.ID,
			"title":         resource.Title,
			"type":          resource.Type,
			"url":           resource.URL,
			"size":          resource.Size,
			"width":         resource.Width,
			"height":        resource.Height,
			"extension":     resource.Extension,
			"downloadCount": resource.DownloadCount,
			"favoriteCount": resource.FavoriteCount,
			"userId":        resource.UserID,
			"creatorName":   creatorName,
			"creatorAvatar": creatorAvatar,
			"createdAt":     resource.CreatedAt.Format("2006-01-02T15:04:05Z"),
			"isFavorited":   favoritedSet[rid],
		})
	}

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}

	Success(c, gin.H{
		"list":       resourceList,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": totalPages,
	})
}
