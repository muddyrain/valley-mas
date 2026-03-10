package handler

import (
	"errors"
	"net/http"
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
		Preload("User").            // 预加载用户信息（用于获取昵称）
		Preload("Space").           // 预加载空间信息
		Preload("Space.Resources"). // 预加载空间资源
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
			"avatar":      creator.Avatar,
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
	code := c.Param("code")
	resourceType := c.Query("type") // avatar, wallpaper, 空则全部
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "20")

	_ = code
	_ = resourceType
	_ = page
	_ = pageSize

	// TODO: 查询数据库

	Success(c, gin.H{
		"list": []gin.H{
			{
				"id":            "1",
				"title":         "可爱卡通头像",
				"type":          "avatar",
				"url":           "https://placeholder.co/400x400",
				"size":          102400,
				"downloadCount": 128,
			},
		},
		"total":      1,
		"page":       1,
		"pageSize":   20,
		"totalPages": 1,
	})
}
