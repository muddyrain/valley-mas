package handler

import (
	"strconv"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ========== 资源收藏（喜欢）==========

// FavoriteResource 收藏资源（喜欢）
// POST /api/v1/user/resources/:id/favorite
func FavoriteResource(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	resourceID := c.Param("id")
	db := database.GetDB()

	// 检查资源是否存在
	var resource model.Resource
	if err := db.First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	uid := model.Int64String(userID.(int64))
	rid := resource.ID

	// 检查是否已收藏（含软删除）
	var existing model.UserFavorite
	err := db.Unscoped().Where("user_id = ? AND resource_id = ?", uid, rid).First(&existing).Error
	if err == nil {
		// 已存在记录
		if existing.DeletedAt.Valid {
			// 已软删除，恢复
			if err := db.Unscoped().Model(&existing).Update("deleted_at", nil).Error; err != nil {
				logger.Log.WithField("error", err).Error("FavoriteResource restore failed")
				Error(c, 500, "收藏失败："+err.Error())
				return
			}
			// 收藏数 +1
			db.Model(&model.Resource{}).Where("id = ?", rid).UpdateColumn("favorite_count", gorm.Expr("favorite_count + 1"))
		} else {
			// 已收藏，直接返回成功
			Success(c, gin.H{"favorited": true})
			return
		}
	} else if err == gorm.ErrRecordNotFound {
		// 新建收藏记录
		fav := model.UserFavorite{
			ID:         model.Int64String(utils.GenerateID()),
			UserID:     uid,
			ResourceID: rid,
		}
		if err := db.Create(&fav).Error; err != nil {
			logger.Log.WithField("error", err).Error("FavoriteResource create failed")
			Error(c, 500, "收藏失败："+err.Error())
			return
		}
		// 收藏数 +1
		db.Model(&model.Resource{}).Where("id = ?", rid).UpdateColumn("favorite_count", gorm.Expr("favorite_count + 1"))
	} else {
		logger.Log.WithField("error", err).Error("FavoriteResource check existing failed")
		Error(c, 500, "操作失败："+err.Error())
		return
	}

	Success(c, gin.H{"favorited": true})
}

// UnfavoriteResource 取消收藏资源
// DELETE /api/v1/user/resources/:id/favorite
func UnfavoriteResource(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	resourceID := c.Param("id")
	db := database.GetDB()

	uid := model.Int64String(userID.(int64))

	result := db.Where("user_id = ? AND resource_id = ?", uid, resourceID).
		Delete(&model.UserFavorite{})
	if result.Error != nil {
		logger.Log.WithField("error", result.Error).Error("UnfavoriteResource delete failed")
		Error(c, 500, "取消收藏失败："+result.Error.Error())
		return
	}
	// 若确实删除了记录，收藏数 -1（不低于 0）
	if result.RowsAffected > 0 {
		db.Model(&model.Resource{}).Where("id = ? AND favorite_count > 0", resourceID).
			UpdateColumn("favorite_count", gorm.Expr("favorite_count - 1"))
	}

	Success(c, gin.H{"favorited": false})
}

// GetMyFavorites 获取我的收藏列表
// GET /api/v1/user/favorites
func GetMyFavorites(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	var favorites []model.UserFavorite
	var total int64

	query := db.Model(&model.UserFavorite{}).Where("user_id = ?", uid)
	query.Count(&total)
	query.Preload("Resource").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&favorites)

	// 填充缩略图 URL（Resource.ThumbnailURL 不存储在数据库中，需要动态生成）
	for i := range favorites {
		if favorites[i].Resource != nil {
			favorites[i].Resource.FillThumbnailURL()
		}
	}

	Success(c, gin.H{
		"list":     favorites,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetResourceFavoriteStatus 查询当前用户对某资源的收藏状态
// GET /api/v1/user/resources/:id/favorite/status
func GetResourceFavoriteStatus(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	resourceID := c.Param("id")
	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	var count int64
	db.Model(&model.UserFavorite{}).
		Where("user_id = ? AND resource_id = ?", uid, resourceID).
		Count(&count)

	Success(c, gin.H{"favorited": count > 0})
}

// BatchGetFavoriteStatus 批量查询当前用户对多个资源的收藏状态
// POST /api/v1/user/resources/favorite/batch-status
func BatchGetFavoriteStatus(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	var req struct {
		IDs []string `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		Error(c, 400, "参数错误，ids 不能为空")
		return
	}
	if len(req.IDs) > 100 {
		Error(c, 400, "单次最多查询 100 个")
		return
	}

	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	var favorites []model.UserFavorite
	db.Select("resource_id").
		Where("user_id = ? AND resource_id IN ?", uid, req.IDs).
		Find(&favorites)

	result := make(map[string]bool, len(req.IDs))
	for _, id := range req.IDs {
		result[id] = false
	}
	for _, fav := range favorites {
		result[strconv.FormatInt(int64(fav.ResourceID), 10)] = true
	}

	Success(c, gin.H{"favorited": result})
}

// ========== 关注创作者 ==========

// FollowCreator 关注创作者
// POST /api/v1/user/creators/:id/follow
func FollowCreator(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	creatorID := c.Param("id")
	db := database.GetDB()

	// 检查创作者是否存在
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		Error(c, 404, "创作者不存在")
		return
	}

	uid := model.Int64String(userID.(int64))

	// 不能关注自己
	if creator.UserID == uid {
		Error(c, 400, "不能关注自己")
		return
	}

	cid := creator.ID

	// 检查是否已关注（含软删除）
	var existing model.UserFollow
	err := db.Unscoped().Where("user_id = ? AND creator_id = ?", uid, cid).First(&existing).Error
	if err == nil {
		if existing.DeletedAt.Valid {
			// 恢复关注
			if err := db.Unscoped().Model(&existing).Update("deleted_at", nil).Error; err != nil {
				logger.Log.WithField("error", err).Error("FollowCreator restore failed")
				Error(c, 500, "关注失败："+err.Error())
				return
			}
		} else {
			Success(c, gin.H{"following": true})
			return
		}
	} else if err == gorm.ErrRecordNotFound {
		follow := model.UserFollow{
			ID:        model.Int64String(utils.GenerateID()),
			UserID:    uid,
			CreatorID: cid,
		}
		if err := db.Create(&follow).Error; err != nil {
			logger.Log.WithField("error", err).Error("FollowCreator create failed")
			Error(c, 500, "关注失败："+err.Error())
			return
		}
	} else {
		logger.Log.WithField("error", err).Error("FollowCreator check existing failed")
		Error(c, 500, "操作失败："+err.Error())
		return
	}

	// 更新创作者粉丝数缓存（followerCount 字段如存在可直接+1，这里实时统计即可）
	Success(c, gin.H{"following": true})
}

// UnfollowCreator 取消关注创作者
// DELETE /api/v1/user/creators/:id/follow
func UnfollowCreator(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	creatorID := c.Param("id")
	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	result := db.Where("user_id = ? AND creator_id = ?", uid, creatorID).
		Delete(&model.UserFollow{})
	if result.Error != nil {
		logger.Log.WithField("error", result.Error).Error("UnfollowCreator delete failed")
		Error(c, 500, "取消关注失败："+result.Error.Error())
		return
	}

	Success(c, gin.H{"following": false})
}

// GetMyFollows 获取我关注的创作者列表
// GET /api/v1/user/follows
func GetMyFollows(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	var follows []model.UserFollow
	var total int64

	query := db.Model(&model.UserFollow{}).Where("user_id = ?", uid)
	query.Count(&total)
	query.Preload("Creator").
		Preload("Creator.User").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&follows)

	Success(c, gin.H{
		"list":     follows,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetCreatorFollowStatus 查询当前用户对某创作者的关注状态
// GET /api/v1/user/creators/:id/follow/status
func GetCreatorFollowStatus(c *gin.Context) {
	userID, exists := c.Get("userId")
	if !exists {
		Error(c, 401, "未登录")
		return
	}

	creatorID := c.Param("id")
	db := database.GetDB()
	uid := model.Int64String(userID.(int64))

	// 查询该创作者信息，判断是否是自己
	var creator model.Creator
	if err := db.First(&creator, "id = ?", creatorID).Error; err != nil {
		Error(c, 404, "创作者不存在")
		return
	}

	isSelf := creator.UserID == uid

	var count int64
	db.Model(&model.UserFollow{}).
		Where("user_id = ? AND creator_id = ?", uid, creatorID).
		Count(&count)

	// 同时返回粉丝总数
	var followerCount int64
	db.Model(&model.UserFollow{}).
		Where("creator_id = ?", creatorID).
		Count(&followerCount)

	Success(c, gin.H{
		"following":     count > 0,
		"followerCount": followerCount,
		"isSelf":        isSelf,
	})
}
