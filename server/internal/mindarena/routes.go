package mindarena

import "github.com/gin-gonic/gin"

func RegisterMindArenaRoutes(v1 *gin.RouterGroup, handler *Handler) {
	mindArena := v1.Group("/mind-arena")
	{
		debates := mindArena.Group("/debates")
		{
			debates.POST("", handler.CreateDebate)
			debates.GET("/:id", handler.GetDebate)
			debates.POST("/:id/support", handler.SubmitRoundSupport)
			debates.GET("/:id/stream", handler.StreamDebate)
		}
	}
}
