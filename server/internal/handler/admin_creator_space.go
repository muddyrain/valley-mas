package handler

import (
	"fmt"
	"strconv"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SpaceWithStats 带统计数据的空间
type SpaceWithStats struct {
	model.CreatorSpace
	ResourceCount int `json:"resourceCount"` // 关联的资源数量
	DownloadCount int `json:"downloadCount"` // 下载次数
}

// generateSpaceCode 生成唯一的 4 位空间口令
func generateSpaceCode(db *gorm.DB) (string, error) {
	maxAttempts := 10
	for i := 0; i < maxAttempts; i++ {
		code := utils.GenerateRandomCode(6)

		// 检查口令是否已存在
		var count int64
		if err := db.Model(&model.CreatorSpace{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return "", err
		}

		if count == 0 {
			return code, nil
		}
	}

	// 如果 10 次都重复（极小概率），返回错误
	return "", fmt.Errorf("无法生成唯一口令")
}

// ListCreatorSpaces 获取创作者的空间列表
// @Summary      获取创作者的空间列表
// @Description  查看指定创作者的所有空间
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path   string  true   "创作者ID"
// @Param        page       query  int     false  "页码"  default(1)
// @Param        pageSize   query  int     false  "每页数量"  default(20)
// @Success      200  {object}  map[string]interface{}  "空间列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [get]
func ListCreatorSpaces(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	// 转换创作者ID
	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 验证创作者是否存在
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			Error(c, 500, "查询创作者失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能查看自己的空间
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" && creator.UserID != userId {
		Error(c, 403, "无权访问其他创作者的空间")
		return
	}

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

	// 查询总数
	var total int64
	query := db.Model(&model.CreatorSpace{}).Where("creator_id = ?", creatorID)
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询空间总数失败")
		return
	}

	// 查询列表
	var spaces []model.CreatorSpace
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&spaces).Error; err != nil {
		Error(c, 500, "查询空间列表失败")
		return
	}

	// 为每个空间添加统计数据
	spacesWithStats := make([]SpaceWithStats, len(spaces))
	for i, space := range spaces {
		spacesWithStats[i] = SpaceWithStats{
			CreatorSpace: space,
		}

		// 统计关联的资源数量
		var resourceCount int64
		db.Model(&space).Association("Resources").Count()
		spacesWithStats[i].ResourceCount = int(resourceCount)

		// 统计下载量（通过空间的资源）
		var downloadCount int64
		db.Table("download_records").
			Joins("JOIN space_resources ON download_records.resource_id = space_resources.resource_id").
			Where("space_resources.creator_space_id = ?", space.ID).
			Count(&downloadCount)
		spacesWithStats[i].DownloadCount = int(downloadCount)
	}

	Success(c, gin.H{
		"list":  spacesWithStats,
		"total": total,
	})
}

// CreateCreatorSpace 创建创作者空间
// @Summary      创建创作者空间
// @Description  为创作者创建新的空间和口令
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        space      body  object  true  "空间信息"
// @Success      200  {object}  map[string]interface{}  "创建成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [post]
func CreateCreatorSpace(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	// 转换创作者ID
	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 验证创作者是否存在
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			Error(c, 500, "查询创作者失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能为自己创建空间
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" && creator.UserID != userId {
		Error(c, 403, "无权为其他创作者创建空间")
		return
	}

	// 请求参数
	type CreateSpaceRequest struct {
		Title       string   `json:"title" binding:"required"`
		Description string   `json:"description"`
		Banner      string   `json:"banner"`
		Code        string   `json:"code"`
		IsActive    *bool    `json:"isActive"`
		ResourceIDs []string `json:"resourceIds"` // 关联的资源ID列表
	}

	var req CreateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 生成口令（如果未提供）
	code := strings.TrimSpace(req.Code)
	if code == "" {
		var err error
		code, err = generateSpaceCode(db)
		if err != nil {
			Error(c, 500, "生成口令失败")
			return
		}
	} else {
		// 验证口令唯一性
		var count int64
		if err := db.Model(&model.CreatorSpace{}).Where("code = ?", code).Count(&count).Error; err != nil {
			Error(c, 500, "验证口令失败")
			return
		}
		if count > 0 {
			Error(c, 400, "口令已被使用")
			return
		}
	}

	// 设置默认状态
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// 创建空间
	space := model.CreatorSpace{
		CreatorID:   creatorID,
		Title:       req.Title,
		Description: req.Description,
		Banner:      req.Banner,
		Code:        code,
		IsActive:    isActive,
	}

	if err := db.Create(&space).Error; err != nil {
		Error(c, 500, "创建空间失败")
		return
	}

	// 关联资源
	if len(req.ResourceIDs) > 0 {
		var resources []model.Resource
		for _, idStr := range req.ResourceIDs {
			var resourceID model.Int64String
			if err := resourceID.Scan(idStr); err != nil {
				continue
			}

			var resource model.Resource
			if err := db.First(&resource, "id = ? AND creator_id = ?", resourceID, creatorID).Error; err == nil {
				resources = append(resources, resource)
			}
		}

		if len(resources) > 0 {
			if err := db.Model(&space).Association("Resources").Append(&resources); err != nil {
				// 关联失败不影响空间创建
				Error(c, 500, "空间创建成功，但关联资源失败")
				return
			}
		}
	}

	// 返回创建的空间
	result := SpaceWithStats{
		CreatorSpace:  space,
		ResourceCount: len(req.ResourceIDs),
		DownloadCount: 0,
	}

	Success(c, result)
}

// GetCreatorSpaceDetail 获取空间详情
// @Summary      获取空间详情
// @Description  查看空间的详细信息和关联的资源
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        spaceId    path  string  true  "空间ID"
// @Success      200  {object}  map[string]interface{}  "空间详情"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "空间不存在"
// @Router       /admin/creators/{creatorId}/spaces/{spaceId} [get]
func GetCreatorSpaceDetail(c *gin.Context) {
	db := database.DB
	spaceIDStr := c.Param("spaceId")

	// 转换空间ID
	var spaceID model.Int64String
	if err := spaceID.Scan(spaceIDStr); err != nil {
		Error(c, 400, "空间ID格式错误")
		return
	}

	// 查询空间（预加载关联的资源）
	var space model.CreatorSpace
	if err := db.Preload("Resources").First(&space, "id = ?", spaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			Error(c, 500, "查询空间失败")
		}
		return
	}

	// 统计数据
	result := SpaceWithStats{
		CreatorSpace:  space,
		ResourceCount: len(space.Resources),
	}

	// 统计下载量
	var downloadCount int64
	db.Table("download_records").
		Joins("JOIN space_resources ON download_records.resource_id = space_resources.resource_id").
		Where("space_resources.creator_space_id = ?", space.ID).
		Count(&downloadCount)
	result.DownloadCount = int(downloadCount)

	Success(c, result)
}

// UpdateCreatorSpace 更新空间信息
// @Summary      更新空间信息
// @Description  更新空间的标题、描述等信息
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        spaceId    path  string  true  "空间ID"
// @Param        space      body  object  true  "空间信息"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/{spaceId} [put]
func UpdateCreatorSpace(c *gin.Context) {
	db := database.DB
	spaceIDStr := c.Param("spaceId")

	// 转换空间ID
	var spaceID model.Int64String
	if err := spaceID.Scan(spaceIDStr); err != nil {
		Error(c, 400, "空间ID格式错误")
		return
	}

	// 查询空间
	var space model.CreatorSpace
	if err := db.First(&space, "id = ?", spaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			Error(c, 500, "查询空间失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能更新自己的空间
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" {
		// 查询空间所属的创作者
		var creator model.Creator
		if err := db.First(&creator, "id = ?", space.CreatorID).Error; err != nil {
			Error(c, 500, "查询创作者失败")
			return
		}
		if creator.UserID != userId {
			Error(c, 403, "无权更新其他创作者的空间")
			return
		}
	}

	// 请求参数
	type UpdateSpaceRequest struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Banner      string `json:"banner"`
		Code        string `json:"code"`
		IsActive    *bool  `json:"isActive"`
	}

	var req UpdateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 更新字段
	updates := make(map[string]interface{})

	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Banner != "" {
		updates["banner"] = req.Banner
	}
	if req.Code != "" && req.Code != space.Code {
		// 验证新口令唯一性
		var count int64
		if err := db.Model(&model.CreatorSpace{}).Where("code = ? AND id != ?", req.Code, spaceID).Count(&count).Error; err != nil {
			Error(c, 500, "验证口令失败")
			return
		}
		if count > 0 {
			Error(c, 400, "口令已被使用")
			return
		}
		updates["code"] = req.Code
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// 执行更新
	if len(updates) > 0 {
		if err := db.Model(&space).Updates(updates).Error; err != nil {
			Error(c, 500, "更新空间失败")
			return
		}
	}

	// 重新查询更新后的数据
	db.Preload("Resources").First(&space, "id = ?", spaceID)

	// 返回带统计数据
	result := SpaceWithStats{
		CreatorSpace:  space,
		ResourceCount: len(space.Resources),
	}

	var downloadCount int64
	db.Table("download_records").
		Joins("JOIN space_resources ON download_records.resource_id = space_resources.resource_id").
		Where("space_resources.creator_space_id = ?", space.ID).
		Count(&downloadCount)
	result.DownloadCount = int(downloadCount)

	Success(c, result)
}

// DeleteCreatorSpace 删除空间
// @Summary      删除空间
// @Description  删除创作者空间（软删除）
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        spaceId    path  string  true  "空间ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/{spaceId} [delete]
func DeleteCreatorSpace(c *gin.Context) {
	db := database.DB
	spaceIDStr := c.Param("spaceId")

	// 转换空间ID
	var spaceID model.Int64String
	if err := spaceID.Scan(spaceIDStr); err != nil {
		Error(c, 400, "空间ID格式错误")
		return
	}

	// 查询空间
	var space model.CreatorSpace
	if err := db.First(&space, "id = ?", spaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			Error(c, 500, "查询空间失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能删除自己的空间
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" {
		// 查询空间所属的创作者
		var creator model.Creator
		if err := db.First(&creator, "id = ?", space.CreatorID).Error; err != nil {
			Error(c, 500, "查询创作者失败")
			return
		}
		if creator.UserID != userId {
			Error(c, 403, "无权删除其他创作者的空间")
			return
		}
	}

	// 软删除（关联的资源不会被删除，只是解除关联）
	if err := db.Delete(&space).Error; err != nil {
		Error(c, 500, "删除空间失败")
		return
	}

	Success(c, gin.H{"message": "删除成功"})
}

// AddResourcesToSpace 为空间添加资源
// @Summary      为空间添加资源
// @Description  将资源关联到指定空间
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        spaceId    path  string  true  "空间ID"
// @Param        resources  body  object  true  "资源ID列表"
// @Success      200  {object}  map[string]interface{}  "添加成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/{spaceId}/resources [post]
func AddResourcesToSpace(c *gin.Context) {
	db := database.DB
	spaceIDStr := c.Param("spaceId")
	creatorIDStr := c.Param("id")

	// 转换ID
	var spaceID, creatorID model.Int64String
	if err := spaceID.Scan(spaceIDStr); err != nil {
		Error(c, 400, "空间ID格式错误")
		return
	}
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	// 查询空间
	var space model.CreatorSpace
	if err := db.First(&space, "id = ? AND creator_id = ?", spaceID, creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			Error(c, 500, "查询空间失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能为自己的空间添加资源
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" {
		// 查询空间所属的创作者
		var creator model.Creator
		if err := db.First(&creator, "id = ?", space.CreatorID).Error; err != nil {
			Error(c, 500, "查询创作者失败")
			return
		}
		if creator.UserID != userId {
			Error(c, 403, "无权为其他创作者的空间添加资源")
			return
		}
	}

	// 请求参数
	type AddResourcesRequest struct {
		ResourceIDs []string `json:"resourceIds" binding:"required"`
	}

	var req AddResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 查询资源
	var resources []model.Resource
	for _, idStr := range req.ResourceIDs {
		var resourceID model.Int64String
		if err := resourceID.Scan(idStr); err != nil {
			continue
		}

		var resource model.Resource
		// 只能添加该创作者自己的资源
		if err := db.First(&resource, "id = ? AND creator_id = ?", resourceID, creatorID).Error; err == nil {
			resources = append(resources, resource)
		}
	}

	if len(resources) == 0 {
		Error(c, 400, "没有找到有效的资源")
		return
	}

	// 添加关联（Append 会自动处理已存在的关联）
	if err := db.Model(&space).Association("Resources").Append(&resources); err != nil {
		Error(c, 500, "添加资源失败")
		return
	}

	Success(c, gin.H{
		"message": "添加成功",
		"count":   len(resources),
	})
}

// RemoveResourcesFromSpace 从空间移除资源
// @Summary      从空间移除资源
// @Description  解除资源与空间的关联
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        spaceId    path  string  true  "空间ID"
// @Param        resources  body  object  true  "资源ID列表"
// @Success      200  {object}  map[string]interface{}  "移除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/{spaceId}/resources [delete]
func RemoveResourcesFromSpace(c *gin.Context) {
	db := database.DB
	spaceIDStr := c.Param("spaceId")

	// 转换空间ID
	var spaceID model.Int64String
	if err := spaceID.Scan(spaceIDStr); err != nil {
		Error(c, 400, "空间ID格式错误")
		return
	}

	// 查询空间
	var space model.CreatorSpace
	if err := db.First(&space, "id = ?", spaceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			Error(c, 500, "查询空间失败")
		}
		return
	}

	// 🔒 如果是创作者角色，只能移除自己空间的资源
	userRole, _ := c.Get("userRole")
	userId, _ := c.Get("userId")
	if userRole == "creator" {
		// 查询空间所属的创作者
		var creator model.Creator
		if err := db.First(&creator, "id = ?", space.CreatorID).Error; err != nil {
			Error(c, 500, "查询创作者失败")
			return
		}
		if creator.UserID != userId {
			Error(c, 403, "无权移除其他创作者空间的资源")
			return
		}
	}

	// 请求参数
	type RemoveResourcesRequest struct {
		ResourceIDs []string `json:"resourceIds" binding:"required"`
	}

	var req RemoveResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	// 查询资源
	var resources []model.Resource
	for _, idStr := range req.ResourceIDs {
		var resourceID model.Int64String
		if err := resourceID.Scan(idStr); err != nil {
			continue
		}

		var resource model.Resource
		if err := db.First(&resource, "id = ?", resourceID).Error; err == nil {
			resources = append(resources, resource)
		}
	}

	if len(resources) == 0 {
		Error(c, 400, "没有找到有效的资源")
		return
	}

	// 删除关联
	if err := db.Model(&space).Association("Resources").Delete(&resources); err != nil {
		Error(c, 500, "移除资源失败")
		return
	}

	Success(c, gin.H{
		"message": "移除成功",
		"count":   len(resources),
	})
}
