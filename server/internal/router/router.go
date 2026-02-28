package router

import (
	"valley-server/internal/config"
	"valley-server/internal/handler"
	"valley-server/internal/middleware"

	"github.com/gin-gonic/gin"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// 中间件
	r.Use(middleware.Cors())

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API 路由
	api := r.Group("/api/v1")
	{
		// 公开接口
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", handler.GetCreatorResources)

		// 需要认证的接口
		auth := api.Group("")
		auth.Use(middleware.Auth(cfg))
		{
			// 用户相关
			auth.GET("/user/info", handler.GetUserInfo)
			auth.GET("/user/downloads", handler.GetUserDownloads)

			// 资源相关
			auth.POST("/resource/download", handler.RecordDownload)
		}

		// 管理后台接口
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg), middleware.AdminOnly())
		{
			// 统计
			admin.GET("/stats", handler.GetStats)

			// 用户管理
			admin.GET("/users", handler.ListUsers)
			admin.PUT("/users/:id/status", handler.UpdateUserStatus)

			// 创作者管理
			admin.GET("/creators", handler.ListCreators)
			admin.POST("/creators", handler.CreateCreator)
			admin.PUT("/creators/:id", handler.UpdateCreator)
			admin.DELETE("/creators/:id", handler.DeleteCreator)

			// 资源管理
			admin.GET("/resources", handler.ListResources)
			admin.POST("/resources/upload", handler.UploadResource)
			admin.DELETE("/resources/:id", handler.DeleteResource)

			// 记录管理
			admin.GET("/records/downloads", handler.ListDownloadRecords)
			admin.GET("/records/uploads", handler.ListUploadRecords)
		}
	}

	return r
}
