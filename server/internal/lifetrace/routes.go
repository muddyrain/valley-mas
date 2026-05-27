package lifetrace

import "github.com/gin-gonic/gin"

func RegisterRoutes(api *gin.RouterGroup, handler *Handler, auth gin.HandlerFunc) {
	group := api.Group("/life-trace")
	{
		group.GET("/weather", handler.GetWeather)

		plans := group.Group("/plans")
		plans.Use(auth)
		{
			plans.GET("", handler.ListPlans)
			plans.POST("", handler.CreatePlan)
			plans.PATCH("/:id/status", handler.UpdatePlanStatus)
			plans.DELETE("/:id", handler.DeletePlan)
		}
	}
}
