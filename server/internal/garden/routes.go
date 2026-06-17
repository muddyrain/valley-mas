package garden

import "github.com/gin-gonic/gin"

// RegisterGardenRoutes 注册 /garden 路由组。
// /garden/health 公开供运维使用，不走 auth；
// 业务接口挂在 auth 之下，由调用方传入认证中间件。
func RegisterGardenRoutes(api *gin.RouterGroup, h *Handler, auth gin.HandlerFunc) {
	g := api.Group("/garden")
	g.GET("/health", h.Health)

	authed := g.Group("")
	authed.Use(auth)
	{
		authed.GET("", h.GetGarden)
		authed.POST("/plant", h.PlantSeed)
		authed.GET("/plant/:id", h.GetPlantDetail)
		authed.POST("/plant/:id/water", h.Water)
		authed.POST("/plant/:id/chat", h.Chat)
		authed.POST("/plant/:id/harvest", h.Harvest)
	}
}
