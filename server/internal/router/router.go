package router

import (
	"valley-server/internal/ai"
	"valley-server/internal/ai/tools"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/handler"
	"valley-server/internal/lifetrace"
	"valley-server/internal/logger"
	"valley-server/internal/middleware"
	"valley-server/internal/mindarena"

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
		mindArenaStore := mindarena.Store(mindarena.NewMemoryStore())
		if db := database.GetDB(); db != nil {
			mindArenaStore = mindarena.NewGormStore(db)
		}
		mindArenaService := mindarena.NewService(mindArenaStore, ai.NewServiceFromEnv())
		mindarena.RegisterMindArenaRoutes(api, mindarena.NewHandler(mindArenaService))

		lifeTraceWeatherService := lifetrace.NewWeatherService(cfg.QWeather)
		lifeTraceHandler := lifetrace.NewHandler(lifeTraceWeatherService, cfg.WebPush)
		lifeTraceHandler.RegisterAgentTools(tools.DefaultRegistry)
		lifetrace.RegisterRoutes(
			api,
			lifeTraceHandler,
			middleware.Auth(cfg),
		)

		public := api.Group("/public")
		{
			public.GET("/space/:code", handler.GetCreatorSpace)
			public.POST("/resource/:id/download", middleware.OptionalAuth(cfg), handler.DownloadResource)
			public.GET("/hot-creators", handler.GetHotCreators)
			public.GET("/creators", handler.SearchCreators)
			public.GET("/holiday-calendars/china/:year", handler.GetChinaHolidayCalendar)

			public.GET("/blog/posts", middleware.OptionalAuth(cfg), handler.GetPosts)
			public.GET("/blog/posts/id/:id", middleware.OptionalAuth(cfg), handler.GetPostDetailByID)
			public.GET("/blog/posts/:slug", middleware.OptionalAuth(cfg), handler.GetPostDetail)
			public.GET("/blog/posts/id/:id/comments", middleware.OptionalAuth(cfg), handler.GetPostComments)
			public.POST("/blog/ai/recommend", middleware.OptionalAuth(cfg), handler.RecommendBlogPosts)
			public.POST("/blog/posts/id/:id/ai/guide", middleware.OptionalAuth(cfg), handler.GenerateBlogReaderGuide)
			public.POST("/blog/posts/id/:id/ai/ask", middleware.OptionalAuth(cfg), handler.AskBlogPost)
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

			public.GET("/guestbook/messages", handler.ListGuestbookMessages)
			public.POST("/guestbook/messages", middleware.OptionalAuth(cfg), handler.CreateGuestbookMessage)
		}

		api.POST("/login", handler.Login(cfg))
		api.POST("/register", handler.Register(cfg))
		api.POST("/email-code/send", handler.SendEmailVerificationCode(cfg))
		api.GET("/user/mail/accounts/gmail/callback", handler.GmailOAuthCallback(cfg))
		api.POST("/code/verify", handler.VerifyCode)
		api.GET("/creator/:code/resources", middleware.OptionalAuth(cfg), handler.GetCreatorResources)

		user := api.Group("/user")
		user.Use(middleware.Auth(cfg))
		{
			user.GET("/downloads", handler.GetMyDownloads)
			user.GET("/info", handler.GetUserInfo)
			user.GET("/preferences/:namespace", handler.GetUserPreference)
			user.PUT("/preferences/:namespace", handler.UpsertUserPreference)
			handler.RegisterUserMailRoutes(user, cfg)
			user.POST("/refresh-token", handler.RefreshToken(cfg))
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
			auth.DELETE("/guestbook/messages/:id", handler.DeleteGuestbookMessage)
			auth.PATCH("/guestbook/messages/:id/pin", handler.UpdateGuestbookMessagePin)

			auth.POST("/resource/download", handler.RecordDownload)

			auth.POST("/creator/register", handler.RegisterCreator)
			auth.GET("/creator/my-space", handler.GetMyCreatorSpace)
			auth.PUT("/creator/code/toggle", handler.ToggleCreatorCode)
			auth.POST("/creator/code/regenerate", handler.RegenerateCreatorCode)

			auth.POST("/creator/application", handler.SubmitCreatorApplication)
			auth.GET("/creator/application/my", handler.GetMyApplication)
			auth.POST("/ai/chat", handler.ChatWithAI)
			auth.GET("/ai/agents", handler.ListAIAgents)
			auth.POST("/ai/agents", handler.CreateAIAgent)
			auth.GET("/ai/agents/:agentId", handler.GetAIAgent)
			auth.PATCH("/ai/agents/:agentId", handler.UpdateAIAgent)
			auth.DELETE("/ai/agents/:agentId", handler.DeleteAIAgent)
			auth.GET("/ai/agents/:agentId/conversations", handler.ListAIConversations)
			auth.POST("/ai/agents/:agentId/conversations", handler.CreateAIConversation)
			auth.GET("/ai/agents/:agentId/conversations/:conversationId", handler.GetAIConversation)
			auth.DELETE("/ai/agents/:agentId/conversations/:conversationId", handler.DeleteAIConversation)
			auth.POST("/ai/agents/:agentId/conversations/:conversationId/chat", handler.ChatWithAIAgent)
			auth.POST("/blog/posts/:id/comments", handler.CreatePostComment)
			auth.DELETE("/blog/comments/:commentId", handler.DeletePostComment)
		}

		creator := api.Group("/creator")
		creator.Use(middleware.Auth(cfg))
		creator.Use(middleware.CreatorOrAdmin())
		{
			creator.GET("/resources", handler.ListResources)
			creator.POST("/resources/upload", handler.UploadResource)
			creator.GET("/resources/upload-status", handler.GetUploadResourceStatus)
			creator.DELETE("/resources/batch", handler.BatchDeleteResources)
			creator.POST("/resources/batch-visibility", handler.BatchUpdateVisibility)
			creator.PATCH("/resources/:id", handler.UpdateResource)
			creator.DELETE("/resources/:id", handler.DeleteResource)

			creator.GET("/albums", handler.ListMyCreatorAlbums)
			creator.POST("/albums", handler.CreateCreatorAlbum)
			creator.PUT("/albums/:id", handler.UpdateCreatorAlbum)
			creator.DELETE("/albums/:id", handler.DeleteCreatorAlbum)
			creator.POST("/ai/suggest-title", handler.SuggestResourceTitle)
			creator.POST("/ai/resource-tags/suggest", handler.SuggestResourceTags)
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
				adminOnly.GET("/users/:id/operations", handler.AdminGetUserOperations)
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
				adminOnly.GET("/creator-application-audit-config", handler.GetCreatorApplicationAuditConfig)
				adminOnly.PUT("/creator-application-audit-config", handler.UpdateCreatorApplicationAuditConfig)

				adminOnly.GET("/stats", handler.GetStats)
				adminOnly.GET("/trends", handler.GetTrends)

				adminOnly.GET("/feedbacks", handler.ListFeedbacks)
				adminOnly.PATCH("/feedbacks/:id/status", handler.UpdateFeedbackStatus)

				adminOnly.GET("/life-trace/overview", handler.GetAdminLifeTraceOverview)
				adminOnly.GET("/life-trace/users", handler.ListAdminLifeTraceUsers)
				adminOnly.GET("/life-trace/records", handler.ListAdminLifeTraceRecords)

				adminOnly.GET("/records/downloads", handler.ListDownloadRecords)
				adminOnly.GET("/records/downloads/export", handler.ExportDownloadRecords)
				adminOnly.GET("/resources/:id/operations", handler.AdminGetResourceOperations)
				adminOnly.GET("/audit/operation-logs", handler.AdminListOperationLogs)
				adminOnly.GET("/audit/code-access-logs", handler.AdminListCodeAccessLogs)
				adminOnly.GET("/audit/storage-assets", handler.AdminListStorageAssets)
				adminOnly.GET("/ai/usage-logs", handler.AdminListAIUsageLogs)
				adminOnly.GET("/ai/usage-summary", handler.AdminGetAIUsageSummary)
				// 资源标签统计（只读）
				adminOnly.GET("/resource-tags/stats", handler.AdminGetResourceTagStats)
				adminOnly.GET("/blog/categories", handler.AdminListBlogCategories)
				adminOnly.POST("/blog/categories", handler.AdminCreateBlogCategory)
				adminOnly.PUT("/blog/categories/:id", handler.AdminUpdateBlogCategory)
				adminOnly.DELETE("/blog/categories/:id", handler.AdminDeleteBlogCategory)
				adminOnly.GET("/blog/tags", handler.AdminListBlogTags)
				adminOnly.POST("/blog/tags", handler.AdminCreateBlogTag)
				adminOnly.PUT("/blog/tags/:id", handler.AdminUpdateBlogTag)
				adminOnly.DELETE("/blog/tags/:id", handler.AdminDeleteBlogTag)
				adminOnly.GET("/blog/comments", handler.AdminListBlogComments)
				adminOnly.DELETE("/blog/comments/:id", handler.AdminDeleteBlogComment)
				adminOnly.GET("/guestbook/messages", handler.AdminListGuestbookMessages)
				adminOnly.DELETE("/guestbook/messages/:id", handler.DeleteGuestbookMessage)
				adminOnly.PATCH("/guestbook/messages/:id/pin", handler.UpdateGuestbookMessagePin)
				adminOnly.PATCH("/guestbook/messages/:id/status", handler.AdminUpdateGuestbookMessageStatus)
				adminOnly.GET("/creator-albums", handler.AdminListCreatorAlbums)
				adminOnly.GET("/creator-albums/:id", handler.AdminGetCreatorAlbumDetail)
				adminOnly.PUT("/creator-albums/:id", handler.AdminUpdateCreatorAlbum)
				adminOnly.DELETE("/creator-albums/:id", handler.AdminDeleteCreatorAlbum)
				adminOnly.GET("/relations/favorites", handler.AdminListFavorites)
				adminOnly.GET("/relations/follows", handler.AdminListFollows)
				adminOnly.GET("/notifications", handler.AdminListNotifications)
				adminOnly.POST("/notifications", handler.AdminCreateNotification)
				adminOnly.PATCH("/notifications/:id/read-state", handler.AdminUpdateNotificationReadState)
				adminOnly.GET("/life-trace/households", handler.ListAdminLifeTraceHouseholds)
				adminOnly.GET("/life-trace/push-subscriptions", handler.ListAdminLifeTracePushSubscriptions)
				adminOnly.GET("/life-trace/push-deliveries", handler.ListAdminLifeTracePushDeliveries)
				adminOnly.GET("/life-trace/ai-conversations", handler.ListAdminLifeTraceAIConversations)
				adminOnly.GET("/life-trace/holiday-calendars", handler.ListAdminLifeTraceHolidayCalendars)
				adminOnly.GET("/mind-arena/debates", handler.AdminListMindArenaDebates)
				adminOnly.GET("/mind-arena/debates/:id", handler.AdminGetMindArenaDebate)

			}

			content := admin.Group("")
			content.Use(middleware.CreatorOrAdmin())
			{
				content.GET("/creator/stats", handler.GetCreatorStats)

				content.GET("/blog/posts", handler.AdminGetPosts)
				content.GET("/blog/posts/sort-items", handler.AdminListPostSortItems)
				content.PUT("/blog/posts/sort", handler.AdminSortPosts)
				content.GET("/blog/posts/:id", handler.AdminGetPostDetail)
				content.POST("/blog/cover/upload", handler.AdminUploadBlogCover)
				content.POST("/blog/cover/upload-by-url", handler.AdminUploadBlogCoverByURL)
				content.POST("/blog/ai/excerpt", handler.AdminAIGenerateBlogExcerpt)
				content.POST("/blog/ai/cover", handler.AdminAIGenerateBlogCover)
				content.POST("/blog/ai/cover/pick", handler.AdminAIPickBlogCoverFromResources)
				content.GET("/blog/external-images/search", handler.AdminSearchExternalCoverImages)
				content.POST("/blog/external-images/unsplash/trigger-download", handler.AdminTriggerUnsplashDownload)
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
				content.GET("/resources/upload-status", handler.GetUploadResourceStatus)
				content.PATCH("/resources/:id", handler.UpdateResource)
				content.PUT("/resources/:id/creator", handler.UpdateResourceCreator)
				content.DELETE("/resources/:id", handler.DeleteResource)
			}
		}
	}

	return r
}
