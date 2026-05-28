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

		settings := group.Group("/settings")
		settings.Use(auth)
		{
			settings.GET("", handler.GetSettings)
			settings.PUT("", handler.UpdateSettings)
		}
	}
}
