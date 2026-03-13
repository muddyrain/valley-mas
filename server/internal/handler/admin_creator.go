package handler

import (
	"strconv"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CreatorWithStats 带统计数据的创作者
type CreatorWithStats struct {
	model.Creator
	ResourceCount int    `json:"resourceCount"` // 资源数量
	DownloadCount int    `json:"downloadCount"` // 下载量
	Username      string `json:"username"`      // 用户名
	UserNickname  string `json:"userNickname"`  // 用户昵称
}

// ListCreators 获取创作者列表（管理员）
// @Summary      获取创作者列表
// @Description  管理员查看所有创作者，支持搜索和筛选
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int     false  "页码"        default(1)
// @Param        pageSize  query  int     false  "每页数量"     default(20)
// @Param        keyword   query  string  false  "搜索关键词"
// @Param        isActive  query  string  false  "状态筛选"
// @Success      200  {object}  map[string]interface{}  "创作者列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators [get]
func ListCreators(c *gin.Context) {
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

	// 解析搜索和筛选参数
	keyword := strings.TrimSpace(c.Query("keyword"))
	isActiveStr := c.Query("isActive")

	// 获取当前用户信息
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")

	// 构建查询
	query := db.Model(&model.Creator{})

	// 🔒 如果是创作者，只能查看自己的信息
	if userRole == "creator" {
		query = query.Where("user_id = ?", userId)
	}

	// 关键词搜索（仅搜索名称）
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	// 状态筛选
	if isActiveStr != "" {
		isActive := isActiveStr == "true"
		query = query.Where("is_active = ?", isActive)
	}

	// 查询总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询创作者总数失败")
		return
	}

	// 查询列表
	var creators []model.Creator
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&creators).Error; err != nil {
		Error(c, 500, "查询创作者列表失败")
		return
	}

	// 为每个创作者添加统计数据
	creatorsWithStats := make([]CreatorWithStats, len(creators))
	for i, creator := range creators {
		creatorsWithStats[i] = CreatorWithStats{
			Creator: creator,
		}

		// 查询用户信息
		var user model.User
		if err := db.Where("id = ?", creator.UserID).First(&user).Error; err == nil {
			creatorsWithStats[i].Username = user.Username
			creatorsWithStats[i].UserNickname = user.Nickname
		}

		// 统计资源数量（Resource.CreatorID 存储的是 User.ID，不是 Creator.ID）
		var resourceCount int64
		db.Model(&model.Resource{}).Where("creator_id = ?", creator.UserID).Count(&resourceCount)
		creatorsWithStats[i].ResourceCount = int(resourceCount)

		// 统计下载量
		var downloadCount int64
		db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&downloadCount)
		creatorsWithStats[i].DownloadCount = int(downloadCount)
	}

	Success(c, gin.H{
		"list":  creatorsWithStats,
		"total": total,
	})
}

// CreateCreator 创建创作者
// @Summary      创建创作者（管理员）
// @Description  管理员为用户创建创作者身份
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creator  body  object  true  "创作者信息"
// @Success      200  {object}  map[string]interface{}  "创建成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators [post]
func CreateCreator(c *gin.Context) {
	db := database.DB

	// 请求参数结构
	type CreateCreatorRequest struct {
		UserID      string `json:"userId" binding:"required"`
		Description string `json:"description"`
		IsActive    *bool  `json:"isActive"`
	}

	var req CreateCreatorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 验证用户是否存在
	var userID model.Int64String
	if err := userID.Scan(req.UserID); err != nil {
		Error(c, 400, "用户ID格式错误")
		return
	}

	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		Error(c, 404, "用户不存在")
		return
	}

	// 检查该用户是否已经是创作者
	var existingCreator model.Creator
	if err := db.Where("user_id = ?", userID).First(&existingCreator).Error; err == nil {
		Error(c, 400, "该用户已经是创作者")
		return
	}

	// 设置默认状态
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// 生成唯一的创作者口令（最多尝试10次）
	var code string
	for i := range 10 {
		code = utils.GenerateCode()

		// 检查口令是否已存在
		var existingCreatorByCode model.Creator
		if err := db.Where("code = ?", code).First(&existingCreatorByCode).Error; err == gorm.ErrRecordNotFound {
			// 口令不存在，可以使用
			break
		}

		// 如果是最后一次尝试仍然重复，返回错误
		if i == 9 {
			Error(c, 500, "生成唯一口令失败，请重试")
			return
		}
	}

	// 使用事务创建创作者和默认空间
	var creator model.Creator
	err := db.Transaction(func(tx *gorm.DB) error {
		// 创建创作者（名称使用用户昵称,不单独存储）
		creator = model.Creator{
			UserID:      userID,
			Description: req.Description,
			IsActive:    isActive,
			Code:        code,
		}

		if err := tx.Create(&creator).Error; err != nil {
			return err
		}

		// 自动创建默认空间
		space := model.CreatorSpace{
			CreatorID:   creator.ID,
			Description: req.Description,
			IsActive:    true,
			ViewCount:   0,
		}

		if err := tx.Create(&space).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		Error(c, 500, "创建创作者失败: "+err.Error())
		return
	}

	// 返回创建的创作者（带统计数据）
	result := CreatorWithStats{
		Creator:       creator,
		ResourceCount: 0,
		DownloadCount: 0,
	}

	Success(c, result)
}

// GetCreatorDetail 获取创作者详情
// @Summary      获取创作者详情
// @Description  管理员查看创作者详细信息
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "创作者ID"
// @Success      200  {object}  map[string]interface{}  "创作者详情"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "创作者不存在"
// @Router       /admin/creators/{id} [get]
func GetCreatorDetail(c *gin.Context) {
	db := database.DB

	// 获取创作者ID
	creatorIDStr := c.Param("id")
	logger.Info(c, "Fetching creator detail", logrus.Fields{
		"creator_id": creatorIDStr,
	})

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		ErrorWithDetail(c, 400, "创作者ID格式错误", err, logrus.Fields{
			"input": creatorIDStr,
		})
		return
	}

	// 查询创作者
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Warn(c, "Creator not found", logrus.Fields{
				"creator_id": creatorID,
			})
			Error(c, 404, "创作者不存在")
		} else {
			ErrorWithDetail(c, 500, "查询创作者失败", err, logrus.Fields{
				"creator_id": creatorID,
			})
		}
		return
	}

	// 🔒 如果是创作者角色，只能查看自己的详情
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" && int64(creator.UserID) != userId.(int64) {
		logger.Warn(c, "Creator attempted to access other creator's detail", logrus.Fields{
			"request_user_id": userId,
			"creator_user_id": creator.UserID,
		})
		Error(c, 403, "无权访问其他创作者的信息")
		return
	}

	logger.Debug(c, "Creator found", logrus.Fields{
		"creator_id": creator.ID,
		"user_id":    creator.UserID,
	})

	// 查询用户信息
	var user model.User
	if err := db.Where("id = ?", creator.UserID).First(&user).Error; err == nil {
		// 成功查到用户
	}

	// 统计资源数量（Resource.CreatorID 存储的是 User.ID，不是 Creator.ID）
	var resourceCount int64
	db.Model(&model.Resource{}).Where("creator_id = ?", creator.UserID).Count(&resourceCount)

	// 统计下载量
	var downloadCount int64
	db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&downloadCount)

	logger.Info(c, "Creator detail retrieved successfully", logrus.Fields{
		"creator_id":     creator.ID,
		"resource_count": resourceCount,
		"download_count": downloadCount,
	})

	// 返回详情
	result := CreatorWithStats{
		Creator:       creator,
		ResourceCount: int(resourceCount),
		DownloadCount: int(downloadCount),
		Username:      user.Username,
		UserNickname:  user.Nickname,
	}

	Success(c, result)
}

// UpdateCreator 更新创作者
// @Summary      更新创作者信息
// @Description  管理员更新创作者信息
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id       path  string  true  "创作者ID"
// @Param        creator  body  object  true  "创作者信息"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "创作者不存在"
// @Router       /admin/creators/{id} [put]
func UpdateCreator(c *gin.Context) {
	db := database.DB

	// 获取创作者ID
	creatorIDStr := c.Param("id")
	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 请求参数结构
	// 注意：创作者名称使用用户昵称，不能单独修改
	type UpdateCreatorRequest struct {
		Description string `json:"description"`
		IsActive    *bool  `json:"isActive"`
	}

	var req UpdateCreatorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 查询创作者
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			Error(c, 500, "查询创作者失败")
		}
		return
	}

	// 构建更新数据
	updates := make(map[string]interface{})

	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// 更新创作者
	if err := db.Model(&creator).Updates(updates).Error; err != nil {
		Error(c, 500, "更新创作者失败")
		return
	}

	// 重新查询以获取最新数据
	db.First(&creator, "id = ?", creatorID)

	// 统计资源数量
	var resourceCount int64
	db.Model(&model.Resource{}).Where("creator_id = ?", creator.ID).Count(&resourceCount)

	// 统计下载量
	var downloadCount int64
	db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&downloadCount)

	// 返回更新后的创作者
	result := CreatorWithStats{
		Creator:       creator,
		ResourceCount: int(resourceCount),
		DownloadCount: int(downloadCount),
	}

	Success(c, result)
}

// DeleteCreator 删除创作者
// @Summary      删除创作者
// @Description  管理员删除创作者（软删除）
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "创作者ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "创作者不存在"
// @Router       /admin/creators/{id} [delete]
func DeleteCreator(c *gin.Context) {
	db := database.DB

	// 获取创作者ID
	creatorIDStr := c.Param("id")
	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 查询创作者
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			Error(c, 500, "查询创作者失败")
		}
		return
	}

	// 软删除创作者
	if err := db.Delete(&creator).Error; err != nil {
		Error(c, 500, "删除创作者失败")
		return
	}

	Success(c, gin.H{
		"message": "删除成功",
	})
}

// ToggleCreatorStatus 切换创作者状态
// @Summary      切换创作者状态
// @Description  管理员启用或禁用创作者
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "创作者ID"
// @Success      200  {object}  map[string]interface{}  "切换成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "创作者不存在"
// @Router       /admin/creators/{id}/toggle-status [post]
func ToggleCreatorStatus(c *gin.Context) {
	db := database.DB

	// 获取创作者ID
	creatorIDStr := c.Param("id")
	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 查询创作者
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			Error(c, 500, "查询创作者失败")
		}
		return
	}

	// 切换状态
	creator.IsActive = !creator.IsActive
	if err := db.Save(&creator).Error; err != nil {
		Error(c, 500, "更新状态失败")
		return
	}

	// 统计资源数量
	var resourceCount int64
	db.Model(&model.Resource{}).Where("creator_id = ?", creator.ID).Count(&resourceCount)

	// 统计下载量
	var downloadCount int64
	db.Model(&model.DownloadRecord{}).Where("creator_id = ?", creator.ID).Count(&downloadCount)

	// 返回更新后的创作者
	result := CreatorWithStats{
		Creator:       creator,
		ResourceCount: int(resourceCount),
		DownloadCount: int(downloadCount),
	}

	Success(c, result)
}
