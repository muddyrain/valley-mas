package handler

import (
	"fmt"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type creatorAlbumResourcePayload struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnailUrl"`
	Type         string `json:"type"`
	Visibility   string `json:"visibility,omitempty"`
}

type creatorAlbumPayload struct {
	ID              string                        `json:"id"`
	Name            string                        `json:"name"`
	Description     string                        `json:"description"`
	CoverURL        string                        `json:"coverUrl"`
	CoverResourceID string                        `json:"coverResourceId,omitempty"`
	ResourceCount   int                           `json:"resourceCount"`
	CreatorID       string                        `json:"creatorId"`
	Resources       []creatorAlbumResourcePayload `json:"resources,omitempty"`
}

func queryFirstValidAlbumResourceID(db *gorm.DB, albumID model.Int64String) (*model.Int64String, error) {
	var firstResourceID model.Int64String
	err := db.
		Table("creator_album_resources").
		Select("resources.id").
		Joins("JOIN resources ON resources.id = creator_album_resources.resource_id").
		Where("creator_album_resources.creator_album_id = ?", albumID).
		Where("resources.deleted_at IS NULL").
		Order("resources.created_at DESC").
		Limit(1).
		Scan(&firstResourceID).Error
	if err != nil {
		return nil, err
	}
	if firstResourceID == 0 {
		return nil, nil
	}
	value := firstResourceID
	return &value, nil
}

func isAlbumCoverResourceValid(db *gorm.DB, albumID model.Int64String, coverResourceID *model.Int64String) (bool, error) {
	if coverResourceID == nil || *coverResourceID == 0 {
		return false, nil
	}

	var count int64
	err := db.
		Table("creator_album_resources").
		Joins("JOIN resources ON resources.id = creator_album_resources.resource_id").
		Where("creator_album_resources.creator_album_id = ?", albumID).
		Where("creator_album_resources.resource_id = ?", *coverResourceID).
		Where("resources.deleted_at IS NULL").
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func reconcileAlbumCoverResourceByAlbumIDs(db *gorm.DB, albumIDs []model.Int64String) error {
	if len(albumIDs) == 0 {
		return nil
	}

	seen := make(map[int64]struct{}, len(albumIDs))
	for _, albumID := range albumIDs {
		if albumID == 0 {
			continue
		}
		if _, exists := seen[int64(albumID)]; exists {
			continue
		}
		seen[int64(albumID)] = struct{}{}

		var album model.CreatorAlbum
		if err := db.Select("id", "cover_resource_id").First(&album, "id = ? AND deleted_at IS NULL", albumID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				continue
			}
			return err
		}

		valid, err := isAlbumCoverResourceValid(db, album.ID, album.CoverResourceID)
		if err != nil {
			return err
		}
		if valid {
			continue
		}

		nextCoverID, err := queryFirstValidAlbumResourceID(db, album.ID)
		if err != nil {
			return err
		}

		if err := db.Model(&model.CreatorAlbum{}).
			Where("id = ?", album.ID).
			Update("cover_resource_id", nextCoverID).Error; err != nil {
			return err
		}
	}

	return nil
}

func collectAlbumIDsByResourceIDs(db *gorm.DB, resourceIDs []model.Int64String) ([]model.Int64String, error) {
	if len(resourceIDs) == 0 {
		return nil, nil
	}

	var albumIDs []model.Int64String
	if err := db.
		Table("creator_album_resources").
		Where("resource_id IN ?", resourceIDs).
		Distinct().
		Pluck("creator_album_id", &albumIDs).Error; err != nil {
		return nil, err
	}
	return albumIDs, nil
}

func loadCurrentCreator(c *gin.Context) (*model.Creator, error) {
	userID := model.Int64String(GetCurrentUserID(c))
	if userID == 0 {
		return nil, fmt.Errorf("unauthorized")
	}

	var creator model.Creator
	if err := database.GetDB().
		Where("user_id = ? AND deleted_at IS NULL", userID).
		First(&creator).Error; err != nil {
		return nil, err
	}

	return &creator, nil
}

func parseOwnedAlbumResources(
	db *gorm.DB,
	creator *model.Creator,
	resourceIDs []string,
) ([]model.Resource, map[string]model.Resource, error) {
	resources := make([]model.Resource, 0, len(resourceIDs))
	resourceMap := make(map[string]model.Resource, len(resourceIDs))

	for _, idStr := range resourceIDs {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}
		if _, exists := resourceMap[idStr]; exists {
			continue
		}

		var resourceID model.Int64String
		if err := resourceID.Scan(idStr); err != nil {
			return nil, nil, fmt.Errorf("invalid resource id")
		}

		var resource model.Resource
		if err := db.
			Where("id = ? AND user_id = ? AND deleted_at IS NULL", resourceID, creator.UserID).
			First(&resource).Error; err != nil {
			return nil, nil, fmt.Errorf("resource not found")
		}

		resources = append(resources, resource)
		resourceMap[idStr] = resource
	}

	return resources, resourceMap, nil
}

func resolveCoverResourceID(
	coverResourceID string,
	resourceMap map[string]model.Resource,
) (*model.Int64String, error) {
	coverResourceID = strings.TrimSpace(coverResourceID)
	if coverResourceID == "" {
		return nil, nil
	}

	resource, exists := resourceMap[coverResourceID]
	if !exists {
		return nil, fmt.Errorf("cover resource must be included in album resources")
	}

	value := resource.ID
	return &value, nil
}

func serializeCreatorAlbum(
	album model.CreatorAlbum,
	resourceCount int,
	coverURL string,
	coverResourceID string,
	resources []creatorAlbumResourcePayload,
) creatorAlbumPayload {
	payload := creatorAlbumPayload{
		ID:            album.ID.String(),
		Name:          album.Name,
		Description:   album.Description,
		CoverURL:      coverURL,
		ResourceCount: resourceCount,
		CreatorID:     album.CreatorID.String(),
		Resources:     resources,
	}

	if strings.TrimSpace(coverResourceID) != "" {
		payload.CoverResourceID = strings.TrimSpace(coverResourceID)
	}

	return payload
}

func buildAlbumResourcePayloads(resources []model.Resource) []creatorAlbumResourcePayload {
	list := make([]creatorAlbumResourcePayload, 0, len(resources))
	for i := range resources {
		resources[i].FillThumbnailURL()
		r := resources[i]
		list = append(list, creatorAlbumResourcePayload{
			ID:           r.ID.String(),
			Title:        r.Title,
			URL:          r.URL,
			ThumbnailURL: r.ThumbnailURL,
			Type:         r.Type,
			Visibility:   r.Visibility,
		})
	}
	return list
}

func ListMyCreatorAlbums(c *gin.Context) {
	creator, err := loadCurrentCreator(c)
	if err != nil {
		Error(c, 403, "当前账号还不是创作者")
		return
	}

	db := database.GetDB()
	var albums []model.CreatorAlbum
	if err := db.
		Where("creator_id = ? AND deleted_at IS NULL", creator.ID).
		Preload("CoverResource").
		Preload("Resources", func(tx *gorm.DB) *gorm.DB {
			return tx.Where("deleted_at IS NULL").Order("created_at DESC")
		}).
		Order("updated_at DESC").
		Find(&albums).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListMyCreatorAlbums query failed")
		Error(c, 500, "加载资源专辑失败："+err.Error())
		return
	}

	list := make([]creatorAlbumPayload, 0, len(albums))
	for _, album := range albums {
		resources := buildAlbumResourcePayloads(album.Resources)
		coverURL := ""
		coverResourceID := ""
		if album.CoverResource != nil {
			coverURL = album.CoverResource.URL
			coverResourceID = album.CoverResource.ID.String()
		} else if len(resources) > 0 {
			coverURL = resources[0].URL
			coverResourceID = resources[0].ID
		}

		list = append(list, serializeCreatorAlbum(album, len(resources), coverURL, coverResourceID, resources))
	}

	Success(c, gin.H{
		"list":  list,
		"total": len(list),
	})
}

func CreateCreatorAlbum(c *gin.Context) {
	creator, err := loadCurrentCreator(c)
	if err != nil {
		Error(c, 403, "当前账号还不是创作者")
		return
	}

	var req struct {
		Name            string   `json:"name"`
		Description     string   `json:"description"`
		CoverResourceID string   `json:"coverResourceId"`
		ResourceIDs     []string `json:"resourceIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		Error(c, 400, "请输入专辑名称")
		return
	}

	db := database.GetDB()
	resources, resourceMap, err := parseOwnedAlbumResources(db, creator, req.ResourceIDs)
	if err != nil {
		Error(c, 400, "专辑资源无效")
		return
	}

	coverResourceID, err := resolveCoverResourceID(req.CoverResourceID, resourceMap)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}

	album := model.CreatorAlbum{
		CreatorID:       creator.ID,
		Name:            name,
		Description:     strings.TrimSpace(req.Description),
		CoverResourceID: coverResourceID,
	}

	if err := db.Create(&album).Error; err != nil {
		logger.Log.WithField("error", err).Error("CreateCreatorAlbum insert failed")
		Error(c, 500, "创建资源专辑失败："+err.Error())
		return
	}

	if len(resources) > 0 {
		if err := db.Model(&album).Association("Resources").Replace(&resources); err != nil {
			logger.Log.WithField("error", err).Error("CreateCreatorAlbum associate resources failed")
			Error(c, 500, "保存专辑资源失败："+err.Error())
			return
		}
	}
	if err := reconcileAlbumCoverResourceByAlbumIDs(db, []model.Int64String{album.ID}); err != nil {
		logger.Log.WithField("error", err).Error("CreateCreatorAlbum reconcile cover failed")
		Error(c, 500, "创建资源专辑失败："+err.Error())
		return
	}

	db.Preload("CoverResource").
		Preload("Resources", func(tx *gorm.DB) *gorm.DB {
			return tx.Where("deleted_at IS NULL").Order("created_at DESC")
		}).
		First(&album, album.ID)

	resourcePayloads := buildAlbumResourcePayloads(album.Resources)
	coverURL := ""
	coverResourceIDText := ""
	if album.CoverResource != nil {
		coverURL = album.CoverResource.URL
		coverResourceIDText = album.CoverResource.ID.String()
	} else if len(resourcePayloads) > 0 {
		coverURL = resourcePayloads[0].URL
		coverResourceIDText = resourcePayloads[0].ID
	}

	Success(c, serializeCreatorAlbum(album, len(resourcePayloads), coverURL, coverResourceIDText, resourcePayloads))
}

func UpdateCreatorAlbum(c *gin.Context) {
	creator, err := loadCurrentCreator(c)
	if err != nil {
		Error(c, 403, "当前账号还不是创作者")
		return
	}

	albumID := c.Param("id")
	db := database.GetDB()

	var album model.CreatorAlbum
	if err := db.
		Where("id = ? AND creator_id = ? AND deleted_at IS NULL", albumID, creator.ID).
		First(&album).Error; err != nil {
		Error(c, 404, "资源专辑不存在")
		return
	}

	var req struct {
		Name            string   `json:"name"`
		Description     string   `json:"description"`
		CoverResourceID string   `json:"coverResourceId"`
		ResourceIDs     []string `json:"resourceIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		Error(c, 400, "请输入专辑名称")
		return
	}

	resources, resourceMap, err := parseOwnedAlbumResources(db, creator, req.ResourceIDs)
	if err != nil {
		Error(c, 400, "专辑资源无效")
		return
	}

	coverResourceID, err := resolveCoverResourceID(req.CoverResourceID, resourceMap)
	if err != nil {
		Error(c, 400, err.Error())
		return
	}

	if err := db.Model(&album).Updates(map[string]interface{}{
		"name":              name,
		"description":       strings.TrimSpace(req.Description),
		"cover_resource_id": coverResourceID,
	}).Error; err != nil {
		logger.Log.WithField("error", err).Error("UpdateCreatorAlbum update fields failed")
		Error(c, 500, "更新资源专辑失败："+err.Error())
		return
	}

	if len(resources) > 0 {
		if err := db.Model(&album).Association("Resources").Replace(&resources); err != nil {
			logger.Log.WithField("error", err).Error("UpdateCreatorAlbum replace resources failed")
			Error(c, 500, "更新专辑资源失败："+err.Error())
			return
		}
	} else {
		if err := db.Model(&album).Association("Resources").Clear(); err != nil {
			logger.Log.WithField("error", err).Error("UpdateCreatorAlbum clear resources failed")
			Error(c, 500, "更新专辑资源失败："+err.Error())
			return
		}
	}
	if err := reconcileAlbumCoverResourceByAlbumIDs(db, []model.Int64String{album.ID}); err != nil {
		logger.Log.WithField("error", err).Error("UpdateCreatorAlbum reconcile cover failed")
		Error(c, 500, "更新资源专辑失败："+err.Error())
		return
	}

	db.Preload("CoverResource").
		Preload("Resources", func(tx *gorm.DB) *gorm.DB {
			return tx.Where("deleted_at IS NULL").Order("created_at DESC")
		}).
		First(&album, album.ID)

	resourcePayloads := buildAlbumResourcePayloads(album.Resources)
	coverURL := ""
	coverResourceIDText := ""
	if album.CoverResource != nil {
		coverURL = album.CoverResource.URL
		coverResourceIDText = album.CoverResource.ID.String()
	} else if len(resourcePayloads) > 0 {
		coverURL = resourcePayloads[0].URL
		coverResourceIDText = resourcePayloads[0].ID
	}

	Success(c, serializeCreatorAlbum(album, len(resourcePayloads), coverURL, coverResourceIDText, resourcePayloads))
}

func DeleteCreatorAlbum(c *gin.Context) {
	creator, err := loadCurrentCreator(c)
	if err != nil {
		Error(c, 403, "当前账号还不是创作者")
		return
	}

	albumID := c.Param("id")
	db := database.GetDB()

	var album model.CreatorAlbum
	if err := db.
		Where("id = ? AND creator_id = ? AND deleted_at IS NULL", albumID, creator.ID).
		First(&album).Error; err != nil {
		Error(c, 404, "资源专辑不存在")
		return
	}

	if err := db.Select("Resources").Delete(&album).Error; err != nil {
		logger.Log.WithField("error", err).Error("DeleteCreatorAlbum delete failed")
		Error(c, 500, "删除资源专辑失败："+err.Error())
		return
	}

	Success(c, gin.H{"ok": true})
}

func ListCreatorAlbums(c *gin.Context) {
	creatorID := c.Param("id")
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	keyword := strings.TrimSpace(c.Query("keyword"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()
	var creator model.Creator
	if err := db.Where("id = ? AND is_active = ? AND deleted_at IS NULL", creatorID, true).First(&creator).Error; err != nil {
		Error(c, 404, "创作者不存在或未激活")
		return
	}

	// 子查询：找出"含有公开资源"的专辑 ID 集合（去重交给子查询，外层直接排序）
	subQuery := db.
		Table("creator_album_resources").
		Select("creator_album_resources.creator_album_id").
		Joins("JOIN resources ON resources.id = creator_album_resources.resource_id").
		Where("resources.deleted_at IS NULL").
		Where("resources.visibility = ? OR resources.visibility IS NULL OR resources.visibility = ''", "public")

	// 外层：在专辑表上过滤 + 关键词 + 排序，不再需要 DISTINCT
	query := db.Model(&model.CreatorAlbum{}).
		Where("creator_id = ? AND deleted_at IS NULL", creator.ID).
		Where("id IN (?)", subQuery)

	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR description LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListCreatorAlbums count failed")
		Error(c, 500, "加载资源专辑失败："+err.Error())
		return
	}

	var albumIDs []model.Int64String
	if err := query.
		Order("updated_at DESC").
		Offset(offset).
		Limit(pageSize).
		Pluck("id", &albumIDs).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListCreatorAlbums pluck albumIDs failed")
		Error(c, 500, "加载资源专辑失败："+err.Error())
		return
	}

	if len(albumIDs) == 0 {
		Success(c, gin.H{
			"list":     []creatorAlbumPayload{},
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
		return
	}

	var albums []model.CreatorAlbum
	if err := db.
		Where("id IN ?", albumIDs).
		Preload("CoverResource").
		Find(&albums).Error; err != nil {
		logger.Log.WithField("error", err).Error("ListCreatorAlbums find albums failed")
		Error(c, 500, "加载资源专辑失败："+err.Error())
		return
	}

	albumMap := make(map[string]model.CreatorAlbum, len(albums))
	for _, album := range albums {
		albumMap[album.ID.String()] = album
	}

	type countRow struct {
		AlbumID model.Int64String
		Count   int64
	}
	var countRows []countRow
	db.Table("creator_album_resources").
		Select("creator_album_resources.creator_album_id AS album_id, COUNT(resources.id) AS count").
		Joins("JOIN resources ON resources.id = creator_album_resources.resource_id").
		Where("creator_album_resources.creator_album_id IN ?", albumIDs).
		Where("resources.deleted_at IS NULL").
		Where("(resources.visibility = ? OR resources.visibility IS NULL OR resources.visibility = '')", "public").
		Group("creator_album_resources.creator_album_id").
		Scan(&countRows)

	countMap := make(map[string]int, len(countRows))
	for _, row := range countRows {
		countMap[row.AlbumID.String()] = int(row.Count)
	}

	type coverRow struct {
		AlbumID model.Int64String
		URL     string
	}
	var coverRows []coverRow
	db.Table("creator_album_resources").
		Select("creator_album_resources.creator_album_id AS album_id, resources.url").
		Joins("JOIN resources ON resources.id = creator_album_resources.resource_id").
		Where("creator_album_resources.creator_album_id IN ?", albumIDs).
		Where("resources.deleted_at IS NULL").
		Where("(resources.visibility = ? OR resources.visibility IS NULL OR resources.visibility = '')", "public").
		Order("resources.created_at DESC").
		Scan(&coverRows)

	fallbackCoverMap := make(map[string]string, len(coverRows))
	for _, row := range coverRows {
		key := row.AlbumID.String()
		if fallbackCoverMap[key] == "" {
			fallbackCoverMap[key] = row.URL
		}
	}

	list := make([]creatorAlbumPayload, 0, len(albumIDs))
	for _, albumID := range albumIDs {
		album, exists := albumMap[albumID.String()]
		if !exists {
			continue
		}

		coverURL := ""
		if album.CoverResource != nil && album.CoverResource.URL != "" && (album.CoverResource.Visibility == "public" || album.CoverResource.Visibility == "") {
			coverURL = album.CoverResource.URL
		}
		if coverURL == "" {
			coverURL = fallbackCoverMap[albumID.String()]
		}

		list = append(list, serializeCreatorAlbum(album, countMap[albumID.String()], coverURL, "", nil))
	}

	Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}
