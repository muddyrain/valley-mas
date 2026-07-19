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
			public.POST("/ai/apps/:appId/chat", handler.PublicAIAppChat)
			public.POST("/resource/:id/download", middleware.OptionalAuth(cfg), handler.DownloadResource)
			public.GET("/active-users", handler.GetActiveUsers)
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
			public.GET("/users/:id/resources", middleware.OptionalAuth(cfg), handler.GetUserResourcesList)
			public.GET("/users/:id/albums", handler.ListUserAlbums)
			public.GET("/resources/:id", middleware.OptionalAuth(cfg), handler.GetResourceDetail)

			public.GET("/guestbook/messages", handler.ListGuestbookMessages)
			public.POST("/guestbook/messages", middleware.OptionalAuth(cfg), handler.CreateGuestbookMessage)
		}

		api.POST("/login", handler.Login(cfg))
		api.POST("/register", handler.Register(cfg))
		api.POST("/email-code/send", handler.SendEmailVerificationCode(cfg))
		api.GET("/user/mail/accounts/gmail/callback", handler.GmailOAuthCallback(cfg))

		user := api.Group("/user")
		user.Use(middleware.Auth(cfg))
		{
			user.GET("/stats", handler.GetMyStats)
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

			user.POST("/users/:id/follow", handler.FollowUser)
			user.DELETE("/users/:id/follow", handler.UnfollowUser)
			user.GET("/users/:id/follow/status", handler.GetUserFollowStatus)
			user.GET("/follows", handler.GetMyFollows)

			// 用户相册
			user.GET("/albums", handler.ListMyUserAlbums)
			user.POST("/albums", handler.CreateUserAlbum)
			user.PUT("/albums/:id", handler.UpdateUserAlbum)
			user.DELETE("/albums/:id", handler.DeleteUserAlbum)

			user.GET("/notifications", handler.ListMyNotifications)
			user.GET("/notifications/unread-count", handler.GetUnreadNotificationCount)
			user.POST("/notifications/:id/read", handler.MarkNotificationRead)
			user.POST("/notifications/read-all", handler.MarkAllNotificationsRead)
		}

		auth := api.Group("")
		auth.Use(middleware.Auth(cfg))
		{
			handler.RegisterNotionOAuthRoutes(auth, api, cfg)
			auth.POST("/logout", handler.Logout())
			auth.GET("/user/current", handler.GetCurrentUser())
			auth.DELETE("/guestbook/messages/:id", handler.DeleteGuestbookMessage)
			auth.PATCH("/guestbook/messages/:id/pin", handler.UpdateGuestbookMessagePin)

			auth.POST("/resource/download", handler.RecordDownload)

			auth.POST("/ai/chat", handler.ChatWithAI)
			// AI Workbench platform assets. Legacy /ai/agents and /workflows remain supported.
			auth.GET("/ai/apps", handler.ListAIApps)
			auth.POST("/ai/apps", handler.CreateAIApp)
			auth.POST("/ai/app-assistant/proposals", handler.CreateAIAppProposal)
			auth.POST("/ai/prompt-assistant/suggestions", handler.CreatePromptAssistantSuggestion)
			auth.GET("/ai/workbench/copilot/session", handler.GetWorkbenchCopilotSession)
			auth.GET("/ai/workbench/copilot/sessions", handler.ListWorkbenchCopilotSessions)
			auth.POST("/ai/workbench/copilot/sessions", handler.CreateWorkbenchCopilotSession)
			auth.POST("/ai/workbench/copilot/messages/stream", handler.StreamWorkbenchCopilotMessage)
			auth.GET("/ai/workbench/copilot/runs/:runId/events", handler.StreamWorkbenchCopilotRunEvents)
			auth.POST("/ai/workbench/copilot/runs/:runId/cancel", handler.CancelWorkbenchCopilotRun)
			auth.PATCH("/ai/workbench/copilot/proposals/:proposalId", handler.UpdateWorkbenchCopilotProposal)
			auth.GET("/ai/apps/tools", handler.ListAIAppTools)
			auth.GET("/ai/apps/:appId", handler.GetAIApp)
			auth.POST("/ai/apps/:appId/versions", handler.SaveAIAppVersion)
			auth.POST("/ai/apps/:appId/restore", handler.RestoreAIAppVersion)
			auth.POST("/ai/apps/:appId/publish", handler.PublishAIApp)
			auth.POST("/ai/apps/:appId/debug", handler.DebugAIApp)
			auth.POST("/ai/apps/:appId/avatar/generate", handler.GenerateAIAppAvatar)
			auth.POST("/ai/apps/:appId/avatar", handler.UploadAIAppAvatar)
			auth.GET("/ai/apps/:appId/runs", handler.ListAIAppRuns)
			auth.GET("/ai/apps/:appId/conversations", handler.ListAIAppConversations)
			auth.POST("/ai/apps/:appId/conversations", handler.CreateAIAppConversation)
			auth.GET("/ai/apps/:appId/conversations/:conversationId", handler.GetAIAppConversation)
			auth.DELETE("/ai/apps/:appId/conversations/:conversationId", handler.DeleteAIAppConversation)
			auth.POST("/ai/apps/:appId/conversations/:conversationId/chat", handler.ChatWithAIAppConversation)
			auth.GET("/ai/apps/:appId/tools", handler.ListAIAppToolBindings)
			auth.PUT("/ai/apps/:appId/tools", handler.ReplaceAIAppTools)
			auth.GET("/ai/apps/:appId/knowledge-bases", handler.ListAIAppKnowledgeBases)
			auth.PUT("/ai/apps/:appId/knowledge-bases", handler.ReplaceAIAppKnowledgeBases)
			auth.GET("/ai/apps/:appId/retrieval-config", handler.GetAIAppRetrievalConfig)
			auth.PUT("/ai/apps/:appId/retrieval-config", handler.UpdateAIAppRetrievalConfig)
			auth.GET("/ai/knowledge-bases", handler.ListAIKnowledgeBases)
			auth.GET("/ai/prompts", handler.ListAIPrompts)
			auth.POST("/ai/prompts", handler.CreateAIPrompt)
			auth.GET("/ai/prompts/:promptId", handler.GetAIPrompt)
			auth.PATCH("/ai/prompts/:promptId", handler.UpdateAIPrompt)
			auth.DELETE("/ai/prompts/:promptId", handler.ArchiveAIPrompt)
			auth.POST("/ai/knowledge-bases", handler.CreateAIKnowledgeBase)
			auth.PUT("/ai/knowledge-bases/:knowledgeBaseId", handler.UpdateAIKnowledgeBase)
			auth.DELETE("/ai/knowledge-bases/:knowledgeBaseId", handler.DeleteAIKnowledgeBase)
			auth.GET("/ai/knowledge-bases/:knowledgeBaseId/documents", handler.ListAIKnowledgeDocuments)
			auth.POST("/ai/knowledge-bases/:knowledgeBaseId/documents", handler.UploadAIKnowledgeDocument)
			auth.POST("/ai/knowledge-bases/:knowledgeBaseId/documents/:documentId/retry", handler.RetryAIKnowledgeDocument)
			auth.DELETE("/ai/knowledge-bases/:knowledgeBaseId/documents/:documentId", handler.DeleteAIKnowledgeDocument)
			auth.GET("/ai/api-keys", handler.ListAIAPIKeys)
			auth.POST("/ai/api-keys", handler.CreateAIAPIKey)
			auth.DELETE("/ai/api-keys/:keyId", handler.RevokeAIAPIKey)
			auth.GET("/ai/api-keys/:keyId/apps", handler.ListAIAPIKeyAppBindings)
			auth.PUT("/ai/api-keys/:keyId/apps", handler.ReplaceAIAPIKeyAppBindings)
			auth.GET("/ai/api-keys/:keyId/usage", handler.GetAIAPIKeyDailyUsage)
			auth.GET("/ai/apps/:appId/public-invocations", handler.ListAIAppPublicInvocations)
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

			auth.GET("/content/resources", handler.ListResources)
			auth.POST("/content/resources/upload", handler.UploadResource)
			auth.GET("/content/resources/upload-status", handler.GetUploadResourceStatus)
			auth.PATCH("/content/resources/:id", handler.UpdateResource)
			auth.PUT("/content/resources/:id/uploader", handler.UpdateResourceUploader)
			auth.DELETE("/content/resources/:id", handler.DeleteResource)
			auth.DELETE("/content/resources/batch", handler.BatchDeleteResources)
			auth.POST("/content/resources/batch-visibility", handler.BatchUpdateVisibility)
			auth.POST("/content/ai/suggest-title", handler.SuggestResourceTitle)
			auth.POST("/content/ai/resource-tags/suggest", handler.SuggestResourceTags)

			// Workflow 工作流（用户侧）
			auth.GET("/workflows", handler.AdminListWorkflows)
			auth.POST("/workflows", handler.AdminCreateWorkflow)
			auth.POST("/workflows/ai-draft", handler.CreateAIWorkflowDraft)
			auth.GET("/workflows/capabilities", handler.ListWorkflowCapabilities)
			auth.GET("/workflows/:id", handler.AdminGetWorkflow)
			auth.PUT("/workflows/:id", handler.AdminUpdateWorkflow)
			auth.GET("/workflows/:id/platform", handler.GetWorkflowPlatform)
			auth.POST("/workflows/:id/restore", handler.RestoreWorkflowVersion)
			auth.POST("/workflows/:id/publish", handler.PublishWorkflowVersion)
			auth.DELETE("/workflows/:id", handler.AdminDeleteWorkflow)
			auth.POST("/workflows/:id/run", handler.AdminRunWorkflow)
			auth.GET("/workflows/:id/runs", handler.AdminListWorkflowRuns)
			auth.GET("/workflows/:id/test-cases", handler.ListWorkflowTestCases)
			auth.POST("/workflows/:id/test-cases", handler.CreateWorkflowTestCase)
			auth.DELETE("/workflows/:id/test-cases/:testCaseId", handler.DeleteWorkflowTestCase)
			auth.POST("/workflows/:id/test-cases/:testCaseId/run", handler.RunWorkflowTestCase)
			auth.GET("/workflows/:id/runs/:runId", handler.AdminGetWorkflowRun)
			auth.GET("/workflows/:id/runs/:runId/events", handler.StreamWorkflowRunEvents)
			auth.POST("/workflows/:id/runs/:runId/cancel", handler.CancelWorkflowRun)
			auth.POST("/workflows/:id/runs/:runId/retry", handler.RetryWorkflowRun)
			auth.POST("/workflows/:id/runs/:runId/explain", handler.ExplainWorkflowRun)
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
				adminOnly.GET("/audit/storage-assets", handler.AdminListStorageAssets)
				adminOnly.GET("/ai/usage-logs", handler.AdminListAIUsageLogs)
				adminOnly.GET("/ai/usage-summary", handler.AdminGetAIUsageSummary)
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
			{
				content.GET("/blog/posts", handler.AdminGetPosts)
				content.GET("/blog/posts/sort-items", handler.AdminListPostSortItems)
				content.PUT("/blog/posts/sort", handler.AdminSortPosts)
				content.GET("/blog/posts/:id", handler.AdminGetPostDetail)
				content.POST("/blog/cover/upload", handler.AdminUploadBlogCover)
				content.POST("/blog/cover/upload-by-url", handler.AdminUploadBlogCoverByURL)
				content.POST("/blog/ai/excerpt", handler.AdminAIGenerateBlogExcerpt)
				content.POST("/blog/ai/cover", handler.AdminAIGenerateBlogCover)
				content.POST("/blog/ai/cover/pick", handler.AdminAIPickBlogCoverFromResources)
				content.POST("/blog/workflow/import", handler.AdminBlogWorkflowImport)
				content.POST("/blog/workflow/:id/publish", handler.AdminBlogWorkflowPublish)
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
			}
		}
	}

	return r
}
