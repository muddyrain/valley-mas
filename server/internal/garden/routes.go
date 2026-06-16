package garden

import "github.com/gin-gonic/gin"

// RegisterGardenRoutes 注册 /garden 路由组。
// auth 由调用方传入（middleware.Auth(cfg)），后续业务路由会挂在 auth 之下；
// /garden/health 公开供运维使用，不走 auth。
func RegisterGardenRoutes(api *gin.RouterGroup, h *Handler, auth gin.HandlerFunc) {
	g := api.Group("/garden")
	g.GET("/health", h.Health)
	// 后续任务在此追加业务路由（带 auth）：
	//   secured := g.Group("", auth)
	//   secured.POST("/plant", h.PlantSeed)
	_ = auth
}
