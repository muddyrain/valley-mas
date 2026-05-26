package lifetrace

import "github.com/gin-gonic/gin"

func RegisterRoutes(api *gin.RouterGroup, handler *Handler) {
	group := api.Group("/life-trace")
	{
		group.GET("/weather", handler.GetWeather)
	}
}
