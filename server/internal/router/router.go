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
		// 公开接口（无需认证）
		public := api.Group("/public")
		{
			registerTTSRoutes(public)

			public.GET("/space/:code", handler.GetCreatorSpace)             // 新增：获取创作者空间
			public.POST("/resource/:id/download", handler.DownloadResource) // 新增：下载资源
			public.GET("/hot-creators", handler.GetHotCreators)             // 新增：获取热门创作者

			// 博客相关接口
			public.GET("/blog/posts", handler.GetPosts)                 // 获取文章列表
			public.GET("/blog/posts/id/:id", handler.GetPostDetailByID) // 通过 ID 获取文章详情
			public.GET("/blog/posts/:slug", handler.GetPostDetail)      // 通过 slug 获取文章详情
			public.GET("/blog/groups", handler.GetGroups)               // 获取博客分组列表
			public.GET("/blog/categories", handler.GetCategories)       // 获取博客分类列表
			public.GET("/blog/tags", handler.GetTags)                   // 获取博客标签列表

			// 以下接口支持可选认证，登录用户响应中会带 isFavorited 字段
			public.GET("/hot-resources", middleware.OptionalAuth(cfg), handler.GetHotResources)                  // 热门资源
			public.GET("/resources", middleware.OptionalAuth(cfg), handler.GetAllResources)                      // 资源广场（全量列表）
			public.GET("/creators/:id/resources", middleware.OptionalAuth(cfg), handler.GetCreatorResourcesList) // 创作者资源列表
			public.GET("/resources/:id", middleware.OptionalAuth(cfg), handler.GetResourceDetail)                // 资源详情
		}

		// 旧的公开接口（保留兼容）
		api.POST("/login", handler.Login(cfg))
		api.POST("/register", handler.Register(cfg))
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", handler.GetCreatorResources)

		// 需要认证的用户端接口
		user := api.Group("/user")
		user.Use(middleware.Auth(cfg))
		{
			user.GET("/downloads", handler.GetMyDownloads)
			user.GET("/info", handler.GetUserInfo)
			user.PUT("/profile", handler.UpdateMyProfile)
			user.PUT("/password", handler.ChangePassword)
			user.POST("/avatar", handler.UploadAvatar)
			user.GET("/avatar/history", handler.ListAvatarHistory)
			user.POST("/avatar/history/:id/use", handler.UseAvatarHistory)

			// 收藏
			user.POST("/resources/favorite/batch-status", handler.BatchGetFavoriteStatus)
			user.POST("/resources/:id/favorite", handler.FavoriteResource)
			user.DELETE("/resources/:id/favorite", handler.UnfavoriteResource)
			user.GET("/resources/:id/favorite/status", handler.GetResourceFavoriteStatus)
			user.GET("/favorites", handler.GetMyFavorites)

			// 关注创作者
			user.POST("/creators/:id/follow", handler.FollowCreator)
			user.DELETE("/creators/:id/follow", handler.UnfollowCreator)
			user.GET("/creators/:id/follow/status", handler.GetCreatorFollowStatus)
			user.GET("/follows", handler.GetMyFollows)

			// 通知中心
			user.GET("/notifications", handler.ListMyNotifications)
			user.GET("/notifications/unread-count", handler.GetUnreadNotificationCount)
			user.POST("/notifications/:id/read", handler.MarkNotificationRead)
			user.POST("/notifications/read-all", handler.MarkAllNotificationsRead)
		}

		// 需要认证的通用接口
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

			// 创作者申请相关
			auth.POST("/creator/application", handler.SubmitCreatorApplication)
			auth.GET("/creator/application/my", handler.GetMyApplication)
			auth.POST("/ai/chat", handler.ChatWithAI)
		}

		// 创作者内容接口（语义化路径，供 web 端使用）
		creator := api.Group("/creator")
		creator.Use(middleware.Auth(cfg))
		creator.Use(middleware.CreatorOrAdmin())
		{
			creator.GET("/resources", handler.ListResources)
			creator.POST("/resources/upload", handler.UploadResource)
			creator.PATCH("/resources/:id", handler.UpdateResource)
			creator.DELETE("/resources/:id", handler.DeleteResource)
		}

		// 管理后台接口
		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg)) // 启用认证
		{
			// 管理员专属接口
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

				// 创作者管理（仅管理员可执行）
				adminOnly.POST("/creators", handler.CreateCreator)
				adminOnly.PUT("/creators/:id", handler.UpdateCreator)
				adminOnly.POST("/creators/:id/toggle-status", handler.ToggleCreatorStatus)
				adminOnly.DELETE("/creators/:id", handler.DeleteCreator)

				// 创作者申请审核管理
				adminOnly.GET("/creator-applications", handler.ListCreatorApplications)
				adminOnly.GET("/creator-applications/:id", handler.GetCreatorApplicationDetail)
				adminOnly.POST("/creator-applications/:id/review", handler.ReviewCreatorApplication)

				// 全局统计（仅管理员）
				adminOnly.GET("/stats", handler.GetStats)
				adminOnly.GET("/trends", handler.GetTrends)

				// 全局记录管理（仅管理员）
				adminOnly.GET("/records/downloads", handler.ListDownloadRecords)
			}

			// 创作者和管理员共用接口
			content := admin.Group("")
			content.Use(middleware.CreatorOrAdmin())
			{
				// 创作者数据概览（创作者专用）
				content.GET("/creator/stats", handler.GetCreatorStats)

				// 博客与图文管理
				content.GET("/blog/posts", handler.AdminGetPosts)
				content.GET("/blog/posts/:id", handler.AdminGetPostDetail)
				content.POST("/blog/cover/upload", handler.AdminUploadBlogCover)
				content.POST("/blog/posts", handler.AdminCreatePost)
				content.PUT("/blog/posts/:id", handler.AdminUpdatePost)
				content.DELETE("/blog/posts/:id", handler.AdminDeletePost)
				content.GET("/blog/groups", handler.AdminListGroups)
				content.POST("/blog/groups", handler.AdminCreateGroup)
				content.PUT("/blog/groups/:id", handler.AdminUpdateGroup)
				content.DELETE("/blog/groups/:id", handler.AdminDeleteGroup)

				// 创作者列表和详情（创作者可查看自己，管理员可查看全部）
				content.GET("/creators", handler.ListCreators)
				content.GET("/creators/:id", handler.GetCreatorDetail)

				// 创作者空间管理（创作者只能管理自己的空间）
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
