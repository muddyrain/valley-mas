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

	r.Use(logger.RequestLogger())
	r.Use(middleware.Cors())

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	r.GET("/init-data", handler.InitData)
	r.GET("/", handler.HomePage)

	api := r.Group("/api/v1")
	{
		public := api.Group("/public")
		{
			registerTTSRoutes(public)

			public.GET("/space/:code", handler.GetCreatorSpace)
			public.POST("/resource/:id/download", middleware.OptionalAuth(cfg), handler.DownloadResource)
			public.GET("/hot-creators", handler.GetHotCreators)
			public.GET("/creators", handler.SearchCreators)

			public.GET("/blog/posts", middleware.OptionalAuth(cfg), handler.GetPosts)
			public.GET("/blog/posts/id/:id", middleware.OptionalAuth(cfg), handler.GetPostDetailByID)
			public.GET("/blog/posts/:slug", middleware.OptionalAuth(cfg), handler.GetPostDetail)
			public.GET("/blog/posts/id/:id/comments", middleware.OptionalAuth(cfg), handler.GetPostComments)
			public.GET("/blog/groups", handler.GetGroups)
			public.GET("/blog/categories", handler.GetCategories)
			public.GET("/blog/tags", handler.GetTags)

			public.GET("/hot-resources", middleware.OptionalAuth(cfg), handler.GetHotResources)
			public.GET("/resources", middleware.OptionalAuth(cfg), handler.GetAllResources)
			public.GET("/creator/:id/albums", handler.ListCreatorAlbums)
			public.GET(
				"/creators/:id/resources",
				middleware.OptionalAuth(cfg),
				handler.GetCreatorResourcesList,
			)
			public.GET("/resources/:id", middleware.OptionalAuth(cfg), handler.GetResourceDetail)
		}

		api.POST("/login", handler.Login(cfg))
		api.POST("/register", handler.Register(cfg))
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", middleware.OptionalAuth(cfg), handler.GetCreatorResources)

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

			user.POST("/resources/favorite/batch-status", handler.BatchGetFavoriteStatus)
			user.POST("/resources/:id/favorite", handler.FavoriteResource)
			user.DELETE("/resources/:id/favorite", handler.UnfavoriteResource)
			user.GET("/resources/:id/favorite/status", handler.GetResourceFavoriteStatus)
			user.GET("/favorites", handler.GetMyFavorites)

			user.POST("/creators/:id/follow", handler.FollowCreator)
			user.DELETE("/creators/:id/follow", handler.UnfollowCreator)
			user.GET("/creators/:id/follow/status", handler.GetCreatorFollowStatus)
			user.GET("/follows", handler.GetMyFollows)

			user.GET("/notifications", handler.ListMyNotifications)
			user.GET("/notifications/unread-count", handler.GetUnreadNotificationCount)
			user.POST("/notifications/:id/read", handler.MarkNotificationRead)
			user.POST("/notifications/read-all", handler.MarkAllNotificationsRead)
		}

		auth := api.Group("")
		auth.Use(middleware.Auth(cfg))
		{
			auth.POST("/logout", handler.Logout())
			auth.GET("/user/current", handler.GetCurrentUser())

			auth.POST("/resource/download", handler.RecordDownload)

			auth.POST("/creator/register", handler.RegisterCreator)
			auth.GET("/creator/my-space", handler.GetMyCreatorSpace)
			auth.PUT("/creator/code/toggle", handler.ToggleCreatorCode)
			auth.POST("/creator/code/regenerate", handler.RegenerateCreatorCode)

			auth.POST("/creator/application", handler.SubmitCreatorApplication)
			auth.GET("/creator/application/my", handler.GetMyApplication)
			auth.POST("/ai/chat", handler.ChatWithAI)
			auth.POST("/blog/posts/:id/comments", handler.CreatePostComment)
			auth.DELETE("/blog/comments/:commentId", handler.DeletePostComment)
		}

		creator := api.Group("/creator")
		creator.Use(middleware.Auth(cfg))
		creator.Use(middleware.CreatorOrAdmin())
		{
			creator.GET("/resources", handler.ListResources)
			creator.POST("/resources/upload", handler.UploadResource)
			creator.PATCH("/resources/:id", handler.UpdateResource)
			creator.DELETE("/resources/:id", handler.DeleteResource)
			creator.GET("/albums", handler.ListMyCreatorAlbums)
			creator.POST("/albums", handler.CreateCreatorAlbum)
			creator.PUT("/albums/:id", handler.UpdateCreatorAlbum)
			creator.DELETE("/albums/:id", handler.DeleteCreatorAlbum)
			creator.POST("/ai/suggest-title", handler.SuggestResourceTitle)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.Auth(cfg))
		{
			adminOnly := admin.Group("")
			adminOnly.Use(middleware.AdminOnly())
			{
				adminOnly.GET("/users", handler.ListUsers)
				adminOnly.POST("/users", handler.CreateUser)
				adminOnly.GET("/users/:id", handler.GetUserDetail)
				adminOnly.PUT("/users/:id", handler.UpdateUser)
				adminOnly.PUT("/users/:id/status", handler.UpdateUserStatus)
				adminOnly.DELETE("/users/:id", handler.DeleteUser)

				adminOnly.POST("/creators", handler.CreateCreator)
				adminOnly.PUT("/creators/:id", handler.UpdateCreator)
				adminOnly.POST("/creators/:id/toggle-status", handler.ToggleCreatorStatus)
				adminOnly.DELETE("/creators/:id", handler.DeleteCreator)

				adminOnly.GET("/creator-applications", handler.ListCreatorApplications)
				adminOnly.GET("/creator-applications/:id", handler.GetCreatorApplicationDetail)
				adminOnly.POST("/creator-applications/:id/review", handler.ReviewCreatorApplication)

				adminOnly.GET("/stats", handler.GetStats)
				adminOnly.GET("/trends", handler.GetTrends)

				adminOnly.GET("/records/downloads", handler.ListDownloadRecords)
				adminOnly.GET("/records/downloads/export", handler.ExportDownloadRecords)
			}

			content := admin.Group("")
			content.Use(middleware.CreatorOrAdmin())
			{
				content.GET("/creator/stats", handler.GetCreatorStats)

				content.GET("/blog/posts", handler.AdminGetPosts)
				content.GET("/blog/posts/:id", handler.AdminGetPostDetail)
				content.POST("/blog/cover/upload", handler.AdminUploadBlogCover)
				content.POST("/blog/image-text/assets/upload", handler.AdminUploadImageTextAsset)
				content.POST("/blog/posts", handler.AdminCreatePost)
				content.PUT("/blog/posts/:id", handler.AdminUpdatePost)
				content.DELETE("/blog/posts/:id", handler.AdminDeletePost)
				content.GET("/blog/groups", handler.AdminListGroups)
				content.POST("/blog/groups", handler.AdminCreateGroup)
				content.PUT("/blog/groups/:id", handler.AdminUpdateGroup)
				content.DELETE("/blog/groups/:id", handler.AdminDeleteGroup)

				content.GET("/creators", handler.ListCreators)
				content.GET("/creators/:id", handler.GetCreatorDetail)

				content.GET("/creators/:id/spaces", handler.ListCreatorSpaces)
				content.GET("/creators/:id/spaces/detail", handler.GetCreatorSpaceDetail)
				content.POST("/creators/:id/spaces", handler.CreateCreatorSpace)
				content.PUT("/creators/:id/spaces", handler.UpdateCreatorSpace)
				content.DELETE("/creators/:id/spaces", handler.DeleteCreatorSpace)
				content.POST("/creators/:id/spaces/resources", handler.AddResourcesToSpace)
				content.DELETE("/creators/:id/spaces/resources", handler.RemoveResourcesFromSpace)

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
