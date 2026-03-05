package handler

import (
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// InitData 初始化测试数据（仅用于开发环境）
// 支持 ?force=true 参数强制重新初始化
func InitData(c *gin.Context) {
	// 获取 force 参数
	force := c.Query("force") == "true"

	// 检查是否已有用户
	var count int64
	var clearedCount int64
	database.DB.Model(&model.User{}).Count(&count)

	if count > 0 && !force {
		Success(c, gin.H{
			"message":   "数据已存在，无需初始化。如需强制重新初始化，请使用: /init-data?force=true",
			"userCount": count,
		})
		return
	}

	// 如果强制初始化，先清空现有数据
	if force && count > 0 {
		clearedCount = count

		// 🔄 备份真实资源（TOS 上传的资源）
		var realResources []model.Resource
		database.DB.Where("url NOT LIKE ?", "%placeholder%").Find(&realResources)

		backupResourceCount := len(realResources)
		if backupResourceCount > 0 {
			// 记录备份信息
			c.Header("X-Backup-Resources", string(rune(backupResourceCount)))
		}

		// 使用事务确保数据完全清空
		tx := database.DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		// 按照外键依赖顺序删除：先删除依赖表，再删除主表
		// 使用 Unscoped 彻底删除数据（包括软删除的记录）
		if err := tx.Unscoped().Where("1 = 1").Delete(&model.UploadRecord{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空上传记录失败："+err.Error())
			return
		}

		if err := tx.Unscoped().Where("1 = 1").Delete(&model.DownloadRecord{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空下载记录失败："+err.Error())
			return
		}

		// ⚠️ 清空所有资源（包括真实资源，稍后会恢复）
		if err := tx.Unscoped().Where("1 = 1").Delete(&model.Resource{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空资源失败："+err.Error())
			return
		}

		if err := tx.Unscoped().Where("1 = 1").Delete(&model.Creator{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空创作者失败："+err.Error())
			return
		}

		if err := tx.Unscoped().Where("1 = 1").Delete(&model.User{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空用户失败："+err.Error())
			return
		}

		if err := tx.Unscoped().Where("1 = 1").Delete(&model.CodeAccessLog{}).Error; err != nil {
			tx.Rollback()
			Error(c, 500, "清空访问日志失败："+err.Error())
			return
		}

		// 注意：我们使用 Snowflake ID，不需要重置 SQLite 的自增序列

		// 提交事务
		if err := tx.Commit().Error; err != nil {
			Error(c, 500, "提交事务失败："+err.Error())
			return
		}

		// 重新计数确认清空成功
		database.DB.Model(&model.User{}).Count(&count)
		if count > 0 {
			Error(c, 500, "清空数据失败，仍有残留数据")
			return
		}

		// 🔄 将备份的真实资源保存到临时变量，稍后恢复
		// 使用闭包将 realResources 传递到后续逻辑
		c.Set("backupResources", realResources)
	}

	// 再次确认清空（双重保险）
	// 删除可能存在的测试用户 username
	testUsernames := []string{"admin", "creator"}
	for _, username := range testUsernames {
		database.DB.Unscoped().Where("username = ?", username).Delete(&model.User{})
	}

	// 创建测试用户
	users := []model.User{
		{
			Username:     "admin",
			Password:     utils.HashPassword("admin123"), // 默认密码：admin123
			Nickname:     "管理员",
			Avatar:       "https://via.placeholder.com/150",
			Platform:     "wechat",
			OpenID:       "admin_openid_001",
			WechatOpenID: "admin_openid_001",
			Email:        "admin@valley.com",
			Role:         "admin",
			IsActive:     true,
		},
		{
			Username:     "admin1",
			Password:     utils.HashPassword("admin123"), // 默认密码：admin123
			Nickname:     "测试用户1",
			Avatar:       "https://via.placeholder.com/150",
			Platform:     "wechat",
			OpenID:       "user_wx_001",
			WechatOpenID: "user_wx_001",
			Role:         "user",
			IsActive:     true,
		},
		{
			Username:       "admin2",
			Password:       utils.HashPassword("admin123"), // 默认密码：admin123
			Nickname:       "抖音测试用户",
			Avatar:         "https://via.placeholder.com/150",
			Platform:       "douyin",
			OpenID:         "user_dy_001",
			DouyinOpenID:   "user_dy_001",
			DouyinNickname: "我是抖音用户",
			DouyinGender:   1,
			DouyinCity:     "北京",
			DouyinProvince: "北京",
			DouyinCountry:  "中国",
			Role:           "user",
			IsActive:       true,
		},
		{
			Username:     "creator",
			Password:     utils.HashPassword("creator123"), // 默认密码：creator123
			Nickname:     "创作者",
			Avatar:       "https://via.placeholder.com/150",
			Platform:     "wechat",
			OpenID:       "creator_001",
			WechatOpenID: "creator_001",
			Role:         "creator",
			IsActive:     true,
		},
		{
			Username:     "admin3",
			Password:     utils.HashPassword("admin123"), // 默认密码：admin123
			Nickname:     "禁用用户",
			Avatar:       "https://via.placeholder.com/150",
			Platform:     "wechat",
			OpenID:       "user_disabled_001",
			WechatOpenID: "user_disabled_001",
			Role:         "user",
			IsActive:     false,
		},
	}

	// 批量插入
	result := database.DB.Create(&users)
	if result.Error != nil {
		Error(c, 500, "初始化数据失败："+result.Error.Error())
		return
	}

	// 为创作者用户创建创作者记录
	creatorUser := users[3] // creator 用户
	creator := model.Creator{
		UserID:      creatorUser.ID,
		Name:        "测试创作者",
		Avatar:      "https://via.placeholder.com/150",
		Description: "这是一个测试创作者空间",
		IsActive:    true,
	}
	if err := database.DB.Create(&creator).Error; err != nil {
		Error(c, 500, "创建创作者失败："+err.Error())
		return
	}

	// 创建默认空间
	space := model.CreatorSpace{
		CreatorID:   creator.ID,
		Title:       "测试创作者的默认空间",
		Code:        "y2722",
		Description: "这是一个测试空间",
		IsActive:    true,
	}
	if err := database.DB.Create(&space).Error; err != nil {
		Error(c, 500, "创建空间失败："+err.Error())
		return
	}

	// 🔄 恢复备份的真实资源
	var resources []model.Resource
	var restoredCount int

	backupResourcesVal, hasBackup := c.Get("backupResources")
	if hasBackup {
		backupResources := backupResourcesVal.([]model.Resource)

		// 恢复真实资源并重新关联到新创建的创作者用户
		// 注意：Resource.CreatorID 字段存储的是上传者的用户 ID（User.ID），不是创作者 ID
		for i := range backupResources {
			// 保持原有的 ID 和其他信息
			backupResources[i].CreatorID = creatorUser.ID // 使用 User.ID，不是 Creator.ID
			// 重置时间戳（让 GORM 自动设置）
			backupResources[i].CreatedAt = time.Time{}
			backupResources[i].UpdatedAt = time.Time{}
		}

		if err := database.DB.Create(&backupResources).Error; err != nil {
			Error(c, 500, "恢复真实资源失败："+err.Error())
			return
		}

		resources = backupResources
		restoredCount = len(backupResources)
	}

	// 如果没有备份的真实资源，创建一些示例数据用于展示
	// 注意：Resource.CreatorID 字段存储的是上传者的用户 ID（User.ID），不是创作者 ID
	if restoredCount == 0 {
		resources = []model.Resource{
			{
				CreatorID:     creatorUser.ID, // 使用 User.ID
				Title:         "示例头像 001",
				Type:          "avatar",
				URL:           "https://via.placeholder.com/300/FF6B6B/FFFFFF?text=Avatar+1",
				ThumbnailURL:  "https://via.placeholder.com/150/FF6B6B/FFFFFF?text=Avatar+1",
				Description:   "这是示例数据，请上传真实资源",
				Size:          102400,
				Width:         300,
				Height:        300,
				DownloadCount: 0,
			},
			{
				CreatorID:     creatorUser.ID, // 使用 User.ID
				Title:         "示例壁纸 001",
				Type:          "wallpaper",
				URL:           "https://via.placeholder.com/1080x1920/1A1A2E/FFFFFF?text=Wallpaper",
				ThumbnailURL:  "https://via.placeholder.com/300x500/1A1A2E/FFFFFF?text=Wallpaper",
				Description:   "这是示例数据，请上传真实资源",
				Size:          2097152,
				Width:         1080,
				Height:        1920,
				DownloadCount: 0,
			},
		}

		if err := database.DB.Create(&resources).Error; err != nil {
			Error(c, 500, "创建示例资源失败："+err.Error())
			return
		}
	}

	// 创建下载记录（模拟最近 7 天的下载）
	now := time.Now()
	downloadRecords := []model.DownloadRecord{}

	// 为每个资源创建随机的下载记录
	for i := 0; i < 7; i++ {
		date := now.AddDate(0, 0, -i)
		// 每天随机 5-15 条下载记录
		dailyDownloads := 5 + i*2

		for j := 0; j < dailyDownloads; j++ {
			resourceIndex := j % len(resources)
			userIndex := j % len(users)

			record := model.DownloadRecord{
				UserID:     users[userIndex].ID,
				ResourceID: resources[resourceIndex].ID,
				CreatorID:  creator.ID,
				IP:         "127.0.0.1",
				UserAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			}
			// 设置创建时间为指定日期
			record.CreatedAt = date.Add(time.Hour * time.Duration(j))
			downloadRecords = append(downloadRecords, record)
		}
	}

	if err := database.DB.Create(&downloadRecords).Error; err != nil {
		Error(c, 500, "创建下载记录失败："+err.Error())
		return
	}

	// 创建访问记录（模拟最近 7 天的访问）
	accessLogs := []model.CodeAccessLog{}
	for i := 0; i < 7; i++ {
		date := now.AddDate(0, 0, -i)
		// 每天随机 3-10 条访问记录
		dailyAccess := 3 + i

		for j := 0; j < dailyAccess; j++ {
			log := model.CodeAccessLog{
				SpaceID:   space.ID,
				Code:      space.Code,
				IP:        "127.0.0.1",
				UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			}
			log.CreatedAt = date.Add(time.Hour * time.Duration(j*2))
			accessLogs = append(accessLogs, log)
		}
	}

	if err := database.DB.Create(&accessLogs).Error; err != nil {
		Error(c, 500, "创建访问记录失败："+err.Error())
		return
	}

	Success(c, gin.H{
		"message":           "初始化成功",
		"createdUsers":      len(users),
		"createdCreators":   1,
		"restoredResources": restoredCount,  // 🔄 恢复的真实资源数量
		"createdResources":  len(resources), // 总资源数量（恢复的 + 新建的）
		"createdDownloads":  len(downloadRecords),
		"createdAccessLogs": len(accessLogs),
		"clearedUsers":      clearedCount,
		"users":             users,
	})
}
