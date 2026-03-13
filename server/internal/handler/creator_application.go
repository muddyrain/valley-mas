package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// generateCreatorCode 生成唯一的创作者口令
func generateCreatorCodeForApplication(db *gorm.DB) (string, error) {
	maxAttempts := 10
	for i := 0; i < maxAttempts; i++ {
		code := utils.GenerateRandomCode(6)

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

// SubmitCreatorApplication 提交创作者申请
// @Summary      提交创作者申请
// @Description  普通用户提交成为创作者的申请，等待管理员审核
// @Tags         创作者申请
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        request  body  object  true  "申请信息"
// @Success      200  {object}  map[string]interface{}  "申请提交成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误或已申请"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      500  {object}  map[string]interface{}  "服务器错误"
// @Router       /creator/application [post]
func SubmitCreatorApplication(c *gin.Context) {
	db := database.DB

	// 获取当前登录用户
	userId, exists := c.Get("userId")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	userIDInt64 := userId.(int64)

	// 解析请求
	type SubmitRequest struct {
		Name        string `json:"name" binding:"required,min=2,max=50"`
		Description string `json:"description" binding:"max=500"`
		Avatar      string `json:"avatar"`
		Reason      string `json:"reason" binding:"required,min=10,max=500"`
		Phone       string `json:"phone"`
		Email       string `json:"email"`
	}

	var req SubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 检查用户是否已经是创作者
	var existingCreator model.Creator
	err := db.Where("user_id = ?", userIDInt64).First(&existingCreator).Error
	if err == nil {
		Error(c, http.StatusBadRequest, "您已经是创作者，无需再次申请")
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		logger.Log.WithFields(logrus.Fields{
			"userId": userIDInt64,
			"error":  err.Error(),
		}).Error("查询创作者失败")
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 检查是否有待审核的申请
	var pendingApp model.CreatorApplication
	err = db.Where("user_id = ? AND status = ?", userIDInt64, "pending").First(&pendingApp).Error
	if err == nil {
		Error(c, http.StatusBadRequest, "您有待审核的申请，请耐心等待")
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		logger.Log.WithFields(logrus.Fields{
			"userId": userIDInt64,
			"error":  err.Error(),
		}).Error("查询申请记录失败")
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 获取用户信息（用于设置默认头像）
	var user model.User
	if err := db.First(&user, userIDInt64).Error; err != nil {
		Error(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 创建申请记录
	application := model.CreatorApplication{
		UserID:      model.Int64String(userIDInt64),
		Name:        req.Name,
		Description: req.Description,
		Avatar:      req.Avatar,
		Reason:      req.Reason,
		Phone:       req.Phone,
		Email:       req.Email,
		Status:      "pending",
	}

	// 如果没有传头像，使用用户头像
	if application.Avatar == "" {
		application.Avatar = user.Avatar
	}

	if err := db.Create(&application).Error; err != nil {
		logger.Log.WithFields(logrus.Fields{
			"userId": userIDInt64,
			"error":  err.Error(),
		}).Error("创建申请记录失败")
		Error(c, http.StatusInternalServerError, "提交申请失败")
		return
	}

	logger.Log.WithFields(logrus.Fields{
		"userId":        userIDInt64,
		"applicationId": application.ID,
	}).Info("用户提交创作者申请")

	Success(c, gin.H{
		"id":        application.ID,
		"status":    application.Status,
		"createdAt": application.CreatedAt,
	})
}

// GetMyApplication 获取我的申请状态
// @Summary      获取我的申请状态
// @Description  查看当前用户的创作者申请状态，如果没有申请记录则返回null
// @Tags         创作者申请
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "申请信息，无记录时data为null"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Router       /creator/application/my [get]
func GetMyApplication(c *gin.Context) {
	db := database.DB

	userId, exists := c.Get("userId")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}

	var application model.CreatorApplication
	err := db.Preload("Reviewer").Where("user_id = ?", userId).
		Order("created_at DESC").First(&application).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 没有申请记录是正常情况，返回200和null
		Success(c, nil)
		return
	}
	if err != nil {
		logger.Log.WithFields(logrus.Fields{
			"userId": userId,
			"error":  err.Error(),
		}).Error("查询申请记录失败")
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	Success(c, application)
}

// ListCreatorApplications 获取创作者申请列表（管理员）
// @Summary      获取创作者申请列表
// @Description  管理员查看所有创作者申请，支持筛选
// @Tags         管理后台 - 创作者申请
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int     false  "页码"        default(1)
// @Param        pageSize  query  int     false  "每页数量"     default(20)
// @Param        status    query  string  false  "状态筛选"     Enums(pending, approved, rejected)
// @Param        keyword   query  string  false  "搜索关键词"
// @Success      200  {object}  map[string]interface{}  "申请列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creator-applications [get]
func ListCreatorApplications(c *gin.Context) {
	db := database.DB

	// 解析分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// 解析筛选参数
	status := strings.TrimSpace(c.Query("status"))
	keyword := strings.TrimSpace(c.Query("keyword"))

	// 构建查询
	query := db.Model(&model.CreatorApplication{})

	// 状态筛选
	if status != "" {
		query = query.Where("status = ?", status)
	}

	// 关键词搜索
	if keyword != "" {
		query = query.Where("name LIKE ? OR reason LIKE ? OR phone LIKE ? OR email LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// 查询总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询总数失败")
		return
	}

	// 查询列表
	var applications []model.CreatorApplication
	if err := query.Preload("User").Preload("Reviewer").
		Order("CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC").
		Offset(offset).Limit(pageSize).Find(&applications).Error; err != nil {
		Error(c, http.StatusInternalServerError, "查询列表失败")
		return
	}

	Success(c, gin.H{
		"list":     applications,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// ReviewCreatorApplication 审核创作者申请（管理员）
// @Summary      审核创作者申请
// @Description  管理员审核创作者申请，通过后自动创建创作者和默认空间
// @Tags         管理后台 - 创作者申请
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id    path  string  true  "申请ID"
// @Param        request  body  object  true  "审核信息"
// @Success      200  {object}  map[string]interface{}  "审核成功"
// @Failure      400  {object}  map[string]interface{}  "参数错误"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creator-applications/:id/review [post]
func ReviewCreatorApplication(c *gin.Context) {
	db := database.DB

	// 获取当前管理员信息
	userId, exists := c.Get("userId")
	if !exists {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	reviewerID := model.Int64String(userId.(int64))

	// 获取申请ID
	applicationID := c.Param("id")
	if applicationID == "" {
		Error(c, http.StatusBadRequest, "申请ID不能为空")
		return
	}

	// 解析请求
	type ReviewRequest struct {
		Status     string `json:"status" binding:"required,oneof=approved rejected"`
		ReviewNote string `json:"reviewNote" binding:"max=500"`
	}

	var req ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 查询申请记录
	var application model.CreatorApplication
	if err := db.Preload("User").First(&application, "id = ?", applicationID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "申请记录不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "查询申请记录失败")
		return
	}

	// 检查申请状态
	if application.Status != "pending" {
		Error(c, http.StatusBadRequest, "该申请已被审核")
		return
	}

	// 开启事务
	err := db.Transaction(func(tx *gorm.DB) error {
		// 更新申请状态
		now := time.Now()
		application.Status = req.Status
		application.ReviewerID = &reviewerID
		application.ReviewNote = req.ReviewNote
		application.ReviewedAt = &now

		if err := tx.Save(&application).Error; err != nil {
			return err
		}

		// 如果审核通过，创建创作者和默认空间
		if req.Status == "approved" {
			// 检查用户是否已经是创作者（二次检查）
			var existingCreator model.Creator
			err := tx.Where("user_id = ?", application.UserID).First(&existingCreator).Error
			if err == nil {
				return errors.New("该用户已经是创作者")
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			// 生成创作者口令
			code, err := generateCreatorCodeForApplication(tx)
			if err != nil {
				return err
			}

			// 创建创作者（名称使用用户昵称，不单独存储）
			creator := model.Creator{
				UserID:      application.UserID,
				Description: application.Description,
				Code:        code,
				IsActive:    true,
			}

			if err := tx.Create(&creator).Error; err != nil {
				return err
			}

			// 创建默认空间
			space := model.CreatorSpace{
				CreatorID:   creator.ID,
				Description: application.Description,
				IsActive:    true,
			}

			if err := tx.Create(&space).Error; err != nil {
				return err
			}

			// 更新用户角色为 creator
			if err := tx.Model(&application.User).Update("role", "creator").Error; err != nil {
				return err
			}

			logger.Log.WithFields(logrus.Fields{
				"applicationId": application.ID,
				"userId":        application.UserID,
				"creatorId":     creator.ID,
				"spaceId":       space.ID,
				"reviewerId":    reviewerID,
			}).Info("创作者申请审核通过，已自动创建创作者和空间")
		} else {
			logger.Log.WithFields(logrus.Fields{
				"applicationId": application.ID,
				"userId":        application.UserID,
				"reviewerId":    reviewerID,
				"reason":        req.ReviewNote,
			}).Info("创作者申请被拒绝")
		}

		return nil
	})

	if err != nil {
		logger.Log.WithFields(logrus.Fields{
			"applicationId": applicationID,
			"error":         err.Error(),
		}).Error("审核申请失败")
		Error(c, http.StatusInternalServerError, "审核失败: "+err.Error())
		return
	}

	Success(c, gin.H{
		"status":     application.Status,
		"reviewedAt": application.ReviewedAt,
	})
}

// GetCreatorApplicationDetail 获取申请详情（管理员）
// @Summary      获取申请详情
// @Description  管理员查看创作者申请详情
// @Tags         管理后台 - 创作者申请
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "申请ID"
// @Success      200  {object}  map[string]interface{}  "申请详情"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      404  {object}  map[string]interface{}  "未找到"
// @Router       /admin/creator-applications/:id [get]
func GetCreatorApplicationDetail(c *gin.Context) {
	db := database.DB

	applicationID := c.Param("id")
	if applicationID == "" {
		Error(c, http.StatusBadRequest, "申请ID不能为空")
		return
	}

	var application model.CreatorApplication
	if err := db.Preload("User").Preload("Reviewer").
		First(&application, "id = ?", applicationID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "申请记录不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "查询失败")
		return
	}

	Success(c, application)
}
