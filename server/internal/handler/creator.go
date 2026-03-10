package handler

import (
	"errors"
	"fmt"
	"net/http"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterCreatorRequest 创作者注册请求
type RegisterCreatorRequest struct {
	Name             string `json:"name" binding:"required,min=2,max=50" example:"设计师小王"`
	Description      string `json:"description" binding:"max=255" example:"分享精美头像和壁纸"`
	Avatar           string `json:"avatar" example:"https://example.com/avatar.jpg"`
	SpaceTitle       string `json:"spaceTitle" binding:"max=100" example:"小王的创意空间"`
	SpaceBanner      string `json:"spaceBanner" example:"https://example.com/banner.jpg"`
	SpaceDescription string `json:"spaceDescription" example:"这里有最新的设计作品"`
}

// RegisterCreatorResponse 创作者注册响应
type RegisterCreatorResponse struct {
	ID          string `json:"id" example:"1234567890"`
	Name        string `json:"name" example:"设计师小王"`
	Code        string `json:"code" example:"y2722"`
	Description string `json:"description" example:"分享精美头像和壁纸"`
	IsActive    bool   `json:"isActive" example:"true"`
	CreatedAt   string `json:"createdAt" example:"2026-03-01T12:00:00Z"`
}

// generateCreatorCode 生成唯一的创作者口令
func generateCreatorCode(db *gorm.DB) (string, error) {
	maxAttempts := 10
	for i := 0; i < maxAttempts; i++ {
		code := utils.GenerateRandomCode(6)

		// 检查口令是否已存在
		var count int64
		if err := db.Model(&model.Creator{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return "", err
		}

		if count == 0 {
			return code, nil
		}
	}

	return "", fmt.Errorf("无法生成唯一口令")
}

// RegisterCreator 创作者注册
// @Summary      注册成为创作者
// @Description  普通用户注册成为创作者，自动创建一个默认空间
// @Tags         创作者
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request  body      RegisterCreatorRequest  true  "创作者信息"
// @Success      200  {object}  map[string]interface{}  "注册成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误或已注册"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /creator/register [post]
func RegisterCreator(c *gin.Context) {
	db := database.DB

	// 1. 获取当前登录用户
	userID, exists := c.Get("userID")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	// 2. 解析请求
	var req RegisterCreatorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 3. 检查用户是否已是创作者
	var existingCreator model.Creator
	err := db.Where("user_id = ?", userID).First(&existingCreator).Error
	if err == nil {
		// 已经是创作者
		Error(c, http.StatusBadRequest, "您已经注册过创作者，不能重复注册")
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 4. 获取用户信息（用于设置默认头像等）
	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 5. 生成创作者口令
	code, err := generateCreatorCode(db)
	if err != nil {
		Error(c, http.StatusInternalServerError, "生成口令失败: "+err.Error())
		return
	}

	// 6. 创建创作者记录
	// 注意：创作者名称使用用户的昵称,不单独存储
	creator := model.Creator{
		UserID:      model.Int64String(userID.(int64)),
		Description: req.Description,
		Avatar:      req.Avatar,
		Code:        code,
		IsActive:    true, // 默认启用
	}

	// 如果没有传头像，使用用户头像
	if creator.Avatar == "" {
		creator.Avatar = user.Avatar
	}

	// 7. 创建默认空间（空间使用创作者描述，不需要单独的 title）
	space := model.CreatorSpace{
		CreatorID:   creator.ID,
		Banner:      req.SpaceBanner,
		Description: req.SpaceDescription,
		IsActive:    true,
	}

	// 8. 使用事务保存
	err = db.Transaction(func(tx *gorm.DB) error {
		// 保存创作者
		if err := tx.Create(&creator).Error; err != nil {
			return err
		}

		// 更新空间的 CreatorID
		space.CreatorID = creator.ID

		// 保存默认空间
		if err := tx.Create(&space).Error; err != nil {
			return err
		}

		// 更新用户角色为 creator
		if err := tx.Model(&user).Update("role", "creator").Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		Error(c, http.StatusInternalServerError, "注册失败: "+err.Error())
		return
	}

	// 9. 返回创作者信息
	Success(c, gin.H{
		"id":          creator.ID,
		"userId":      creator.UserID,
		"name":        user.Nickname, // 使用用户昵称
		"avatar":      creator.Avatar,
		"description": creator.Description,
		"code":        creator.Code,
		"isActive":    creator.IsActive,
		"createdAt":   creator.CreatedAt,
		"space": gin.H{
			"id": space.ID,
		},
		"message": "🎉 恭喜！您已成为创作者",
		"tip":     "您的专属口令是：" + creator.Code + "（永久有效）",
	})
}

// GetMyCreatorSpace 获取我的创作者空间信息
// GET /api/v1/creator/my-space
func GetMyCreatorSpace(c *gin.Context) {
	db := database.DB

	// 1. 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	// 2. 查询创作者信息，预加载空间和用户信息
	var creator model.Creator
	err := db.Where("user_id = ?", userID).
		Preload("User"). // 预加载用户信息
		Preload("Space").
		First(&creator).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "您还不是创作者，请先注册")
			return
		}
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 3. 统计资源数量
	var resourceCount int64
	db.Model(&model.Resource{}).Where("creator_id = ?", creator.ID).Count(&resourceCount)

	creatorName := ""
	if creator.User != nil {
		creatorName = creator.User.Nickname
	}

	// 4. 返回创作者空间信息
	Success(c, gin.H{
		"id":            creator.ID,
		"userId":        creator.UserID,
		"name":          creatorName,
		"avatar":        creator.Avatar,
		"description":   creator.Description,
		"code":          creator.Code,
		"isActive":      creator.IsActive,
		"space":         creator.Space,
		"resourceCount": resourceCount,
		"createdAt":     creator.CreatedAt,
		"updatedAt":     creator.UpdatedAt,
	})
}

// ToggleCreatorCode 开启/关闭创作者口令（已废弃，改为空间级别控制）
// PUT /api/v1/creator/code/toggle
func ToggleCreatorCode(c *gin.Context) {
	Error(c, http.StatusBadRequest, "该功能已废弃，请使用空间管理功能")
}

// RegenerateCreatorCode 重新生成创作者口令（已废弃，改为空间级别控制）
// POST /api/v1/creator/code/regenerate
func RegenerateCreatorCode(c *gin.Context) {
	Error(c, http.StatusBadRequest, "该功能已废弃，请使用空间管理功能")
}
