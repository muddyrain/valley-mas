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

	// 开发环境：初始化测试数据
	r.GET("/init-data", handler.InitData)

	// 入口页（方便在浏览器中直接访问）
	r.GET("/", handler.HomePage)

	// API 路由
	api := r.Group("/api/v1")
	{
		// 公开接口（无需认证）
		api.POST("/login", handler.Login(cfg)) // 新增：登录接口
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", handler.GetCreatorResources)

		// 需要认证的接口
		auth := api.Group("")
		auth.Use(middleware.Auth(cfg))
		{
			// 认证相关
			auth.POST("/logout", handler.Logout())              // 新增：登出接口
			auth.GET("/user/current", handler.GetCurrentUser()) // 新增：获取当前用户信息

			// 用户相关
			auth.GET("/user/info", handler.GetUserInfo)
			auth.GET("/user/downloads", handler.GetUserDownloads)

			// 资源相关
			auth.POST("/resource/download", handler.RecordDownload)
		}

		// 管理后台接口
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg), middleware.AdminOnly()) // 启用认证和管理员权限
		{
			// 统计
			admin.GET("/stats", handler.GetStats)

			// 用户管理（CRUD）
			admin.GET("/users", handler.ListUsers)
			admin.POST("/users", handler.CreateUser)       // 新增：创建用户
			admin.GET("/users/:id", handler.GetUserDetail) // 新增：用户详情
			admin.PUT("/users/:id", handler.UpdateUser)    // 新增：更新用户
			admin.PUT("/users/:id/status", handler.UpdateUserStatus)
			admin.DELETE("/users/:id", handler.DeleteUser) // 新增：删除用户

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
