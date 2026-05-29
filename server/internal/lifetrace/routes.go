package lifetrace

import "github.com/gin-gonic/gin"

func RegisterRoutes(api *gin.RouterGroup, handler *Handler, auth gin.HandlerFunc) {
	group := api.Group("/life-trace")
	{
		group.GET("/weather", handler.GetWeather)

		ai := group.Group("/ai")
		ai.Use(auth)
		{
			ai.POST("/today-advice", handler.GenerateTodayAdvice)
			ai.POST("/weekly-review", handler.GenerateWeeklyReview)
			ai.POST("/image-analysis", handler.AnalyzeImage)
			ai.POST("/assistant/stream", handler.StreamAssistant)
			ai.GET("/conversation", handler.GetAssistantConversation)
			ai.POST("/conversation/messages", handler.CreateAssistantMessage)
			ai.DELETE("/conversation", handler.ClearAssistantConversation)
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
			traces.DELETE("/:id", handler.DeleteTrace)
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
	}
}
