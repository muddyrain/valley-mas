package lifetrace

import "github.com/gin-gonic/gin"

func RegisterRoutes(api *gin.RouterGroup, handler *Handler, auth gin.HandlerFunc) {
	group := api.Group("/life-trace")
	{
		group.GET("/weather", handler.GetWeather)

		uploads := group.Group("/uploads")
		uploads.Use(auth)
		{
			uploads.POST("/image", handler.UploadImage)
		}

		feedbacks := group.Group("/feedbacks")
		feedbacks.Use(auth)
		{
			feedbacks.POST("", handler.CreateFeedback)
		}

		ai := group.Group("/ai")
		ai.Use(auth)
		{
			ai.POST("/today-advice", handler.GenerateTodayAdvice)
			ai.POST("/weekly-review", handler.GenerateWeeklyReview)
			ai.POST("/image-analysis", handler.AnalyzeImage)
			ai.POST("/pantry-photo-analysis", handler.AnalyzePantryPhoto)
			ai.POST("/transparent-cover", handler.GenerateTransparentCover)
			ai.POST("/pantry-thumbnail", handler.GeneratePantryThumbnail)
			ai.POST("/recipes", handler.GenerateRecipeSuggestions)
			ai.POST("/assistant/stream", handler.StreamAssistant)
			ai.GET("/conversation", handler.GetAssistantConversation)
			ai.POST("/conversation/messages", handler.CreateAssistantMessage)
			ai.DELETE("/conversation", handler.ClearAssistantConversation)
			ai.GET("/conversations", handler.ListAssistantConversations)
			ai.POST("/conversations", handler.CreateAssistantConversation)
			ai.GET("/conversations/:conversationId", handler.GetAssistantConversationByID)
			ai.POST("/conversations/:conversationId/messages", handler.CreateAssistantMessageInConversation)
			ai.DELETE("/conversations/:conversationId", handler.DeleteAssistantConversation)
		}

		achievements := group.Group("/achievements")
		achievements.Use(auth)
		{
			achievements.GET("", handler.ListAchievements)
		}

		plans := group.Group("/plans")
		plans.Use(auth)
		{
			plans.GET("", handler.ListPlans)
			plans.POST("", handler.CreatePlan)
			plans.PATCH("/:id", handler.UpdatePlan)
			plans.PATCH("/:id/status", handler.UpdatePlanStatus)
			plans.DELETE("/:id", handler.DeletePlan)
		}

		traces := group.Group("/traces")
		traces.Use(auth)
		{
			traces.GET("", handler.ListTraces)
			traces.POST("", handler.CreateTrace)
			traces.PATCH("/:id", handler.UpdateTrace)
			traces.DELETE("/:id", handler.DeleteTrace)
		}

		inbox := group.Group("/inbox")
		inbox.Use(auth)
		{
			inbox.GET("", handler.ListInboxItems)
			inbox.POST("", handler.CreateInboxItem)
			inbox.PATCH("/:id", handler.UpdateInboxItem)
			inbox.PATCH("/:id/status", handler.UpdateInboxItemStatus)
			inbox.PATCH("/:id/convert", handler.ConvertInboxItem)
			inbox.DELETE("/:id", handler.DeleteInboxItem)
		}
		pantry := group.Group("/pantry")
		pantry.Use(auth)
		{
			pantry.GET("", handler.ListPantryItems)
			pantry.POST("", handler.CreatePantryItem)
			pantry.GET("/barcode-match", handler.LookupPantryBarcodeMatch)
			pantry.GET("/photo-drafts", handler.ListPhotoItemDrafts)
			pantry.POST("/photo-drafts/sync", handler.SyncPhotoItemDrafts)
			pantry.PUT("/photo-drafts/:draftId", handler.UpsertPhotoItemDraft)
			pantry.DELETE("/photo-drafts/:draftId", handler.DeletePhotoItemDraft)
			pantry.POST("/transfer/preview", handler.PreviewPantryTransfer)
			pantry.POST("/transfer", handler.TransferPantryItems)
			pantry.GET("/:id/timeline", handler.ListPantryItemTimeline)
			pantry.GET("/:id", handler.GetPantryItem)
			pantry.PATCH("/:id/consume", handler.ConsumePantryItem)
			pantry.PATCH("/:id", handler.UpdatePantryItem)
			pantry.PATCH("/:id/status", handler.UpdatePantryItemStatus)
			pantry.DELETE("/:id", handler.DeletePantryItem)
		}

		households := group.Group("/households")
		households.Use(auth)
		{
			households.GET("", handler.ListHouseholds)
			households.POST("", handler.CreateHousehold)
			households.GET("/:householdId", handler.GetHousehold)
			households.GET("/:householdId/members", handler.ListHouseholdMembers)
			households.GET("/:householdId/invite", handler.GetHouseholdInvite)
			households.POST("/:householdId/invites", handler.CreateHouseholdInvite)
			households.DELETE("/:householdId/invite", handler.RevokeHouseholdInvite)
			households.POST("/join", handler.JoinHousehold)
			households.POST("/:householdId/transfer-owner", handler.TransferHouseholdOwner)
			households.POST("/:householdId/leave", handler.LeaveHousehold)
			households.POST("/:householdId/dissolve", handler.DissolveHousehold)
		}

		weeklyReviews := group.Group("/weekly-reviews")
		weeklyReviews.Use(auth)
		{
			weeklyReviews.GET("", handler.ListWeeklyReviews)
			weeklyReviews.DELETE("/:id", handler.DeleteWeeklyReview)
		}

		checkins := group.Group("/checkins")
		checkins.Use(auth)
		{
			checkins.GET("", handler.ListCheckins)
			checkins.PUT("", handler.ToggleCheckin)
		}

		settings := group.Group("/settings")
		settings.Use(auth)
		{
			settings.GET("", handler.GetSettings)
			settings.PUT("", handler.UpdateSettings)
		}

		push := group.Group("/push")
		push.POST("/scan", handler.ScanPushReminders)

		push.Use(auth)
		{
			push.GET("/config", handler.GetPushConfig)
			push.PUT("/subscription", handler.SavePushSubscription)
			push.DELETE("/subscription", handler.DeletePushSubscription)
			push.POST("/daily-brief-preview", handler.PreviewDailyBriefPush)
			push.POST("/test", handler.TestPush)
		}
	}
}
