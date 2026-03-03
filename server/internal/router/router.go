package router

import (
	"valley-server/internal/config"
	"valley-server/internal/handler"
	"valley-server/internal/middleware"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// 中间件
	r.Use(middleware.Cors())

	// Swagger 文档路由
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// 开发环境：初始化测试数据
	r.GET("/init-data", handler.InitData)

	// 入口页（方便在浏览器中直接访问）
	r.GET("/", handler.HomePage)

	// API 路由
	api := r.Group("/api/v1")
	{
		// 公开接口（无需认证）- 用户端
		public := api.Group("/public")
		{
			public.GET("/space/:code", handler.GetCreatorSpace)             // 新增：获取创作者空间
			public.POST("/resource/:id/download", handler.DownloadResource) // 新增：下载资源
		}

		// 旧的公开接口（保留兼容）
		api.POST("/login", handler.Login(cfg))
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", handler.GetCreatorResources)

		// 需要认证的接口 - 用户端
		user := api.Group("/user")
		user.Use(middleware.Auth(cfg))
		{
			user.GET("/downloads", handler.GetMyDownloads) // 新增：获取我的下载记录
			user.GET("/info", handler.GetUserInfo)
		}

		// 需要认证的接口
		auth := api.Group("")
		auth.Use(middleware.Auth(cfg))
		{
			// 认证相关
			auth.POST("/logout", handler.Logout())
			auth.GET("/user/current", handler.GetCurrentUser())

			// 资源相关
			auth.POST("/resource/download", handler.RecordDownload)

			// 创作者相关
			auth.POST("/creator/register", handler.RegisterCreator)
			auth.GET("/creator/my-space", handler.GetMyCreatorSpace)
			auth.PUT("/creator/code/toggle", handler.ToggleCreatorCode)
			auth.POST("/creator/code/regenerate", handler.RegenerateCreatorCode)
		}

		// 管理后台接口
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg), middleware.AdminOnly()) // 启用认证和管理员权限
		{
			// 统计
			admin.GET("/stats", handler.GetStats)
			admin.GET("/trends", handler.GetTrends) // 新增：趋势数据

			// 用户管理（CRUD）
			admin.GET("/users", handler.ListUsers)
			admin.POST("/users", handler.CreateUser)       // 新增：创建用户
			admin.GET("/users/:id", handler.GetUserDetail) // 新增：用户详情
			admin.PUT("/users/:id", handler.UpdateUser)    // 新增：更新用户
			admin.PUT("/users/:id/status", handler.UpdateUserStatus)
			admin.DELETE("/users/:id", handler.DeleteUser) // 新增：删除用户

			// 创作者管理
			admin.GET("/creators", handler.ListCreators)
			admin.GET("/creators/:id", handler.GetCreatorDetail)
			admin.POST("/creators", handler.CreateCreator)
			admin.PUT("/creators/:id", handler.UpdateCreator)
			admin.POST("/creators/:id/toggle-status", handler.ToggleCreatorStatus)
			admin.DELETE("/creators/:id", handler.DeleteCreator)

			// 创作者空间管理（一个创作者可以有多个空间）
			admin.GET("/creators/:id/spaces", handler.ListCreatorSpaces)
			admin.GET("/creators/:id/spaces/:spaceId", handler.GetCreatorSpaceDetail)
			admin.POST("/creators/:id/spaces", handler.CreateCreatorSpace)
			admin.PUT("/creators/:id/spaces/:spaceId", handler.UpdateCreatorSpace)
			admin.DELETE("/creators/:id/spaces/:spaceId", handler.DeleteCreatorSpace)
			admin.POST("/creators/:id/spaces/:spaceId/resources", handler.AddResourcesToSpace)
			admin.DELETE("/creators/:id/spaces/:spaceId/resources", handler.RemoveResourcesFromSpace) // 资源管理
			admin.GET("/resources", handler.ListResources)
			admin.POST("/resources/upload", handler.UploadResource)
			admin.PUT("/resources/:id/creator", handler.UpdateResourceCreator) // 新增：更新资源上传者
			admin.DELETE("/resources/:id", handler.DeleteResource)

			// 记录管理
			admin.GET("/records/downloads", handler.ListDownloadRecords)
			admin.GET("/records/uploads", handler.ListUploadRecords)
		}
	}

	return r
}
