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

// RegisterCreator 创作者注册
// @Summary      注册成为创作者
// @Description  普通用户注册成为创作者，系统自动生成5位口令（如：y2722）
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

	// 4. 生成唯一口令（最多尝试10次）
	code, err := generateUniqueCode(db)
	if err != nil {
		Error(c, http.StatusInternalServerError, "生成口令失败: "+err.Error())
		return
	}

	// 5. 获取用户信息（用于设置默认头像等）
	var user model.User
	if err := db.First(&user, userID).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 6. 创建创作者记录
	creator := model.Creator{
		UserID:      model.Int64String(userID.(int64)),
		Name:        req.Name,
		Description: req.Description,
		Avatar:      req.Avatar,
		Code:        code,
		IsActive:    true, // 默认启用
		// SpaceTitle:       req.SpaceTitle,       // 等数据库字段添加后启用
		// SpaceBanner:      req.SpaceBanner,      // 等数据库字段添加后启用
		// SpaceDescription: req.SpaceDescription, // 等数据库字段添加后启用
	}

	// 如果没有传头像，使用用户头像
	if creator.Avatar == "" {
		creator.Avatar = user.Avatar
	}

	// 如果没有传空间标题，使用创作者名称
	// if creator.SpaceTitle == "" {
	// 	creator.SpaceTitle = creator.Name
	// }

	// 7. 使用事务保存
	err = db.Transaction(func(tx *gorm.DB) error {
		// 保存创作者
		if err := tx.Create(&creator).Error; err != nil {
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

	// 8. 返回创作者信息
	Success(c, gin.H{
		"id":          creator.ID,
		"userId":      creator.UserID,
		"name":        creator.Name,
		"code":        creator.Code,
		"avatar":      creator.Avatar,
		"description": creator.Description,
		"isActive":    creator.IsActive,
		"createdAt":   creator.CreatedAt,
		"message":     "🎉 恭喜！您已成为创作者",
		"tip":         "您的专属口令是：" + creator.Code + "（4位，永久有效）",
	})
}

// generateUniqueCode 生成唯一口令
// 确保口令在数据库中不存在（全局唯一）
func generateUniqueCode(db *gorm.DB) (string, error) {
	maxAttempts := 10 // 最多尝试10次

	for i := 0; i < maxAttempts; i++ {
		// 生成随机口令
		code := utils.GenerateCode()

		// 检查口令是否已存在（包括已删除的记录）
		var count int64
		err := db.Model(&model.Creator{}).
			Unscoped(). // 包括软删除的记录
			Where("code = ?", code).
			Count(&count).Error

		if err != nil {
			return "", err
		}

		// 如果口令不存在，返回
		if count == 0 {
			return code, nil
		}

		// 如果存在，记录日志并继续尝试
		// log.Printf("口令冲突：%s 已存在，尝试生成新口令（第%d次）", code, i+1)
	}

	// 10次都冲突的概率极低
	// 即使有10万个创作者，概率也接近0
	// 但为了保险，使用6位口令作为回退
	code := utils.GenerateCode() + utils.GenerateCode()[:1]

	// 再次检查6位口令是否存在
	var count int64
	err := db.Model(&model.Creator{}).
		Unscoped().
		Where("code = ?", code).
		Count(&count).Error

	if err != nil {
		return "", err
	}

	if count > 0 {
		return "", errors.New("生成口令失败，请重试")
	}

	return code, nil // 6位口令，组合数 29^6 = 594,823,321（约5.9亿）
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

	// 2. 查询创作者信息
	var creator model.Creator
	err := db.Where("user_id = ?", userID).First(&creator).Error
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

	// 4. 返回创作者空间信息
	Success(c, gin.H{
		"id":            creator.ID,
		"userId":        creator.UserID,
		"name":          creator.Name,
		"code":          creator.Code,
		"avatar":        creator.Avatar,
		"description":   creator.Description,
		"isActive":      creator.IsActive,
		"resourceCount": resourceCount,
		// "viewCount":     creator.ViewCount,     // 等字段添加后启用
		// "downloadCount": creator.DownloadCount, // 等字段添加后启用
		// "revenue":       creator.Revenue,       // 等字段添加后启用
		"createdAt": creator.CreatedAt,
		"updatedAt": creator.UpdatedAt,
	})
}

// ToggleCreatorCode 开启/关闭创作者口令
// PUT /api/v1/creator/code/toggle
func ToggleCreatorCode(c *gin.Context) {
	db := database.DB

	// 1. 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	// 2. 解析请求
	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	// 3. 查询创作者
	var creator model.Creator
	err := db.Where("user_id = ?", userID).First(&creator).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "您还不是创作者")
			return
		}
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 4. 更新状态
	if err := db.Model(&creator).Update("is_active", req.IsActive).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新失败")
		return
	}

	// 5. 返回结果
	message := "口令已开启"
	if !req.IsActive {
		message = "口令已关闭"
	}

	Success(c, gin.H{
		"isActive":  req.IsActive,
		"message":   message,
		"code":      creator.Code,
		"updatedAt": creator.UpdatedAt,
	})
}

// RegenerateCreatorCode 重新生成创作者口令
// POST /api/v1/creator/code/regenerate
func RegenerateCreatorCode(c *gin.Context) {
	db := database.DB

	// 1. 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	// 2. 查询创作者
	var creator model.Creator
	err := db.Where("user_id = ?", userID).First(&creator).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "您还不是创作者")
			return
		}
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 3. 生成新口令
	oldCode := creator.Code
	newCode, err := generateUniqueCode(db)
	if err != nil {
		Error(c, http.StatusInternalServerError, "生成口令失败")
		return
	}

	// 4. 更新口令
	if err := db.Model(&creator).Update("code", newCode).Error; err != nil {
		Error(c, http.StatusInternalServerError, "更新失败")
		return
	}

	// 5. 返回结果
	Success(c, gin.H{
		"oldCode":     oldCode,
		"newCode":     newCode,
		"message":     "口令已重新生成",
		"tip":         "旧口令已失效，请使用新口令：" + newCode,
		"generatedAt": creator.UpdatedAt,
	})
}
