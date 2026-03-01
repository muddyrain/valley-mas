package handler

import (
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

		// 重置自增序列（SQLite 特有）
		if err := tx.Exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'creators', 'resources', 'download_records', 'upload_records')").Error; err != nil {
			tx.Rollback()
			Error(c, 500, "重置序列失败："+err.Error())
			return
		}

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

	Success(c, gin.H{
		"message":      "初始化成功",
		"createdUsers": len(users),
		"clearedUsers": clearedCount,
		"users":        users,
	})
}
