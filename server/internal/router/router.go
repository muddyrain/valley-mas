package router

import (
	"valley-server/internal/config"
	"valley-server/internal/handler"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// 中间件
	r.Use(logger.RequestLogger()) // 请求日志中间件（自动生成 Request ID）
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
			public.GET("/hot-creators", handler.GetHotCreators)             // 新增：获取热门创作者

			// 以下接口挂可选认证，登录用户响应中会带 isFavorited 字段
			public.GET("/hot-resources", middleware.OptionalAuth(cfg), handler.GetHotResources)                  // 热门资源
			public.GET("/resources", middleware.OptionalAuth(cfg), handler.GetAllResources)                      // 资源广场（全量列表）
			public.GET("/creators/:id/resources", middleware.OptionalAuth(cfg), handler.GetCreatorResourcesList) // 创作者资源列表
			public.GET("/resources/:id", middleware.OptionalAuth(cfg), handler.GetResourceDetail)                // 资源详情
		}

		// 旧的公开接口（保留兼容）
		api.POST("/login", handler.Login(cfg))
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", handler.GetCreatorResources)

		// 需要认证的接口 - 用户端
		user := api.Group("/user")
		user.Use(middleware.Auth(cfg))
		{
			user.GET("/downloads", handler.GetMyDownloads) // 获取我的下载记录
			user.GET("/info", handler.GetUserInfo)         // 获取个人信息
			user.PUT("/profile", handler.UpdateMyProfile)  // 更新个人信息
			user.PUT("/password", handler.ChangePassword)  // 修改密码
			user.POST("/avatar", handler.UploadAvatar)     // 上传头像

			// 资源收藏（喜欢）
			user.POST("/resources/favorite/batch-status", handler.BatchGetFavoriteStatus) // 批量查询收藏状态（静态路由须在动态路由前）
			user.POST("/resources/:id/favorite", handler.FavoriteResource)                // 收藏资源
			user.DELETE("/resources/:id/favorite", handler.UnfavoriteResource)            // 取消收藏
			user.GET("/resources/:id/favorite/status", handler.GetResourceFavoriteStatus) // 查询收藏状态
			user.GET("/favorites", handler.GetMyFavorites)                                // 我的收藏列表

			// 关注创作者
			user.POST("/creators/:id/follow", handler.FollowCreator)                // 关注创作者
			user.DELETE("/creators/:id/follow", handler.UnfollowCreator)            // 取消关注
			user.GET("/creators/:id/follow/status", handler.GetCreatorFollowStatus) // 查询关注状态
			user.GET("/follows", handler.GetMyFollows)                              // 我关注的创作者列表
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

			// 创作者申请相关（新增）
			auth.POST("/creator/application", handler.SubmitCreatorApplication)
			auth.GET("/creator/application/my", handler.GetMyApplication)
		}

		// 管理后台接口
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg)) // 启用认证
		{
			// ========== 管理员专属接口 ==========
			adminOnly := admin.Group("")
			adminOnly.Use(middleware.AdminOnly())
			{
				// 用户管理（仅管理员）
				adminOnly.GET("/users", handler.ListUsers)
				adminOnly.POST("/users", handler.CreateUser)
				adminOnly.GET("/users/:id", handler.GetUserDetail)
				adminOnly.PUT("/users/:id", handler.UpdateUser)
				adminOnly.PUT("/users/:id/status", handler.UpdateUserStatus)
				adminOnly.DELETE("/users/:id", handler.DeleteUser)

				// 创作者管理 - 仅管理员可以执行的操作
				adminOnly.POST("/creators", handler.CreateCreator)
				adminOnly.PUT("/creators/:id", handler.UpdateCreator)
				adminOnly.POST("/creators/:id/toggle-status", handler.ToggleCreatorStatus)
				adminOnly.DELETE("/creators/:id", handler.DeleteCreator)

				// 创作者申请审核管理（新增）
				adminOnly.GET("/creator-applications", handler.ListCreatorApplications)
				adminOnly.GET("/creator-applications/:id", handler.GetCreatorApplicationDetail)
				adminOnly.POST("/creator-applications/:id/review", handler.ReviewCreatorApplication)

				// 全局统计（仅管理员）
				adminOnly.GET("/stats", handler.GetStats)
				adminOnly.GET("/trends", handler.GetTrends)

				// 全局记录管理（仅管理员）
				// 注意：资源上传信息可以直接在资源管理页面查看，不需要单独的上传记录
				adminOnly.GET("/records/downloads", handler.ListDownloadRecords)
			} // ========== 创作者和管理员共享接口 ==========
			content := admin.Group("")
			content.Use(middleware.CreatorOrAdmin())
			{
				// 创作者数据概览（创作者专用）
				content.GET("/creator/stats", handler.GetCreatorStats)

				// 创作者列表和详情（创作者可以查看自己的信息，管理员可以查看所有）
				content.GET("/creators", handler.ListCreators)
				content.GET("/creators/:id", handler.GetCreatorDetail)

				// 创作者空间管理（创作者只能管理自己的空间，一个创作者只有一个空间）
				content.GET("/creators/:id/spaces", handler.ListCreatorSpaces)
				content.GET("/creators/:id/spaces/detail", handler.GetCreatorSpaceDetail)
				content.POST("/creators/:id/spaces", handler.CreateCreatorSpace)
				content.PUT("/creators/:id/spaces", handler.UpdateCreatorSpace)
				content.DELETE("/creators/:id/spaces", handler.DeleteCreatorSpace)
				content.POST("/creators/:id/spaces/resources", handler.AddResourcesToSpace)
				content.DELETE("/creators/:id/spaces/resources", handler.RemoveResourcesFromSpace)

				// 资源管理（创作者只能管理自己的资源）
				content.GET("/resources", handler.ListResources)
				content.POST("/resources/upload", handler.UploadResource)
				content.PATCH("/resources/:id", handler.UpdateResource)
				content.PUT("/resources/:id/creator", handler.UpdateResourceCreator)
				content.DELETE("/resources/:id", handler.DeleteResource)
			}
		}
	}

	return r
}
