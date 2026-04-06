package handler

import (
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SpaceWithStats 带统计数据的空间
type SpaceWithStats struct {
	model.CreatorSpace
	ResourceCount int `json:"resourceCount"` // 关联的资源数量
	DownloadCount int `json:"downloadCount"` // 下载次数
}

// ListCreatorSpaces 获取创作者的空间（一个创作者只有一个空间）
// @Summary      获取创作者的空间
// @Description  查看指定创作者的空间
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path   string  true   "创作者ID"
// @Success      200  {object}  map[string]interface{}  "空间信息"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [get]
func ListCreatorSpaces(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("ListCreatorSpaces query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权访问其他创作者的空间")
		return
	}

	var space model.CreatorSpace
	err := db.Where("creator_id = ?", creatorID).Preload("Resources").First(&space).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			Success(c, gin.H{"space": nil})
			return
		}
		logger.Log.WithField("error", err).Error("ListCreatorSpaces query space failed")
		Error(c, 500, "查询空间失败："+err.Error())
		return
	}

	var resourceCount int64
	db.Model(&space).Association("Resources").Count()

	var downloadCount int64
	db.Table("download_records").
		Joins("JOIN space_resources ON download_records.resource_id = space_resources.resource_id").
		Where("space_resources.creator_space_id = ?", space.ID).
		Count(&downloadCount)

	result := SpaceWithStats{
		CreatorSpace:  space,
		ResourceCount: int(resourceCount),
		DownloadCount: int(downloadCount),
	}

	Success(c, gin.H{"space": result})
}

// CreateCreatorSpace 创建或更新创作者空间（一个创作者只有一个空间）
// @Summary      更新创作者空间信息
// @Description  更新创作者空间的描述、横幅等信息（空间标题使用创作者名称）
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        space      body  object  true  "空间信息"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [post]
func CreateCreatorSpace(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("CreateCreatorSpace query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权为其他创作者创建空间")
		return
	}

	type CreateSpaceRequest struct {
		// Title 字段已移除，空间标题使用创作者名称
		Description string   `json:"description"`
		Banner      string   `json:"banner"`
		IsActive    *bool    `json:"isActive"`
		ResourceIDs []string `json:"resourceIds"`
	}

	var req CreateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// 检查是否已存在空间
	var existingSpace model.CreatorSpace
	err := db.Where("creator_id = ?", creatorID).First(&existingSpace).Error

	var space model.CreatorSpace
	if err == nil {
		// 更新现有空间（不更新标题，标题永远使用创作者名称）
		existingSpace.Description = req.Description
		existingSpace.Banner = req.Banner
		existingSpace.IsActive = isActive
		space = existingSpace
		if err := db.Save(&space).Error; err != nil {
			logger.Log.WithField("error", err).Error("CreateCreatorSpace save space failed")
			Error(c, 500, "更新空间失败："+err.Error())
			return
		}
	} else {
		// 创建新空间（不需要标题，使用创作者名称作为标识）
		space = model.CreatorSpace{
			CreatorID:   creatorID,
			Description: req.Description,
			Banner:      req.Banner,
			IsActive:    isActive,
		}
		if err := db.Create(&space).Error; err != nil {
			logger.Log.WithField("error", err).Error("CreateCreatorSpace create space failed")
			Error(c, 500, "创建空间失败："+err.Error())
			return
		}
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
			if err := db.First(&resource, "id = ? AND creator_id = ?", resourceID, creator.UserID).Error; err == nil {
				resources = append(resources, resource)
			}
		}
		if len(resources) > 0 {
			db.Model(&space).Association("Resources").Replace(&resources)
		}
	}

	db.Preload("Resources").First(&space, space.ID)

	var resourceCount int64
	db.Model(&space).Association("Resources").Count()

	var downloadCount int64
	db.Table("download_records").
		Joins("JOIN space_resources ON download_records.resource_id = space_resources.resource_id").
		Where("space_resources.creator_space_id = ?", space.ID).
		Count(&downloadCount)

	result := SpaceWithStats{
		CreatorSpace:  space,
		ResourceCount: int(resourceCount),
		DownloadCount: int(downloadCount),
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
// @Success      200  {object}  map[string]interface{}  "空间详情"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Failure      404  {object}  map[string]interface{}  "空间不存在"
// @Router       /admin/creators/{creatorId}/spaces/detail [get]
func GetCreatorSpaceDetail(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("GetCreatorSpaceDetail query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权访问其他创作者的空间")
		return
	}

	var space model.CreatorSpace
	if err := db.Where("creator_id = ?", creatorID).Preload("Resources").First(&space).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			logger.Log.WithField("error", err).Error("GetCreatorSpaceDetail query space failed")
			Error(c, 500, "查询空间失败："+err.Error())
		}
		return
	}

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

// UpdateCreatorSpace 更新空间信息
// @Summary      更新空间信息
// @Description  更新空间的描述、横幅等信息（标题使用创作者名称，不可单独修改）
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        space      body  object  true  "空间信息"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [put]
func UpdateCreatorSpace(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("UpdateCreatorSpace query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权更新其他创作者的空间")
		return
	}

	var space model.CreatorSpace
	if err := db.Where("creator_id = ?", creatorID).First(&space).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			logger.Log.WithField("error", err).Error("UpdateCreatorSpace query space failed")
			Error(c, 500, "查询空间失败："+err.Error())
		}
		return
	}

	type UpdateSpaceRequest struct {
		// Title 字段已移除，空间标题永远使用创作者名称
		Description string `json:"description"`
		Banner      string `json:"banner"`
		IsActive    *bool  `json:"isActive"`
	}

	var req UpdateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	updates := make(map[string]interface{})
	// 不再更新标题，标题永远使用创作者名称
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Banner != "" {
		updates["banner"] = req.Banner
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) > 0 {
		if err := db.Model(&space).Updates(updates).Error; err != nil {
			logger.Log.WithField("error", err).Error("UpdateCreatorSpace db update failed")
			Error(c, 500, "更新空间失败："+err.Error())
			return
		}
	}

	db.Preload("Resources").First(&space, space.ID)

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

// DeleteCreatorSpace 删除空间（已禁用 - 空间与创作者绑定，不可单独删除）
// @Summary      删除空间（已禁用）
// @Description  空间与创作者是一对一绑定关系，不可单独删除
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces [delete]
func DeleteCreatorSpace(c *gin.Context) {
	// 空间与创作者是一对一绑定关系，不可单独删除
	// 如需删除空间，请删除对应的创作者
	Error(c, 400, "空间与创作者绑定，不可单独删除。如需删除，请删除对应的创作者。")
}

// AddResourcesToSpace 为空间添加资源
// @Summary      为空间添加资源
// @Description  将资源关联到创作者空间
// @Tags         管理后台 - 创作者空间管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creatorId  path  string  true  "创作者ID"
// @Param        resources  body  object  true  "资源ID列表"
// @Success      200  {object}  map[string]interface{}  "添加成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/resources [post]
func AddResourcesToSpace(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("AddResourcesToSpace query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权为其他创作者的空间添加资源")
		return
	}

	var space model.CreatorSpace
	if err := db.Where("creator_id = ?", creatorID).First(&space).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在，请先创建空间")
		} else {
			logger.Log.WithField("error", err).Error("AddResourcesToSpace query space failed")
			Error(c, 500, "查询空间失败："+err.Error())
		}
		return
	}

	type AddResourcesRequest struct {
		ResourceIDs []string `json:"resourceIds" binding:"required"`
	}

	var req AddResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

	var resources []model.Resource
	for _, idStr := range req.ResourceIDs {
		var resourceID model.Int64String
		if err := resourceID.Scan(idStr); err != nil {
			continue
		}
		var resource model.Resource
		// 管理员可以添加任何资源到空间,不限制为创作者自己上传的资源
		if err := db.First(&resource, "id = ?", resourceID).Error; err == nil {
			resources = append(resources, resource)
		}
	}

	if len(resources) == 0 {
		Error(c, 400, "没有找到有效的资源")
		return
	}

	if err := db.Model(&space).Association("Resources").Append(&resources); err != nil {
		logger.Log.WithField("error", err).Error("AddResourcesToSpace association append failed")
		Error(c, 500, "添加资源失败："+err.Error())
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
// @Param        resources  body  object  true  "资源ID列表"
// @Success      200  {object}  map[string]interface{}  "移除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{creatorId}/spaces/resources [delete]
func RemoveResourcesFromSpace(c *gin.Context) {
	db := database.DB
	creatorIDStr := c.Param("id")

	var creatorID model.Int64String
	if err := creatorID.Scan(creatorIDStr); err != nil {
		Error(c, 400, "创作者ID格式错误")
		return
	}

	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "创作者不存在")
		} else {
			logger.Log.WithField("error", err).Error("RemoveResourcesFromSpace query creator failed")
			Error(c, 500, "查询创作者失败："+err.Error())
		}
		return
	}

	if !CheckCreatorPermission(c, &creator) {
		Error(c, 403, "无权移除其他创作者空间的资源")
		return
	}

	var space model.CreatorSpace
	if err := db.Where("creator_id = ?", creatorID).First(&space).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, 404, "空间不存在")
		} else {
			logger.Log.WithField("error", err).Error("RemoveResourcesFromSpace query space failed")
			Error(c, 500, "查询空间失败："+err.Error())
		}
		return
	}

	type RemoveResourcesRequest struct {
		ResourceIDs []string `json:"resourceIds" binding:"required"`
	}

	var req RemoveResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误: "+err.Error())
		return
	}

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

	if err := db.Model(&space).Association("Resources").Delete(&resources); err != nil {
		logger.Log.WithField("error", err).Error("RemoveResourcesFromSpace association delete failed")
		Error(c, 500, "移除资源失败："+err.Error())
		return
	}

	Success(c, gin.H{
		"message": "移除成功",
		"count":   len(resources),
	})
}
