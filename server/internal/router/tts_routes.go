package router

import (
	"valley-server/internal/handler"

	"github.com/gin-gonic/gin"
)

func registerTTSRoutes(public *gin.RouterGroup) {
	tts := public.Group("/tts")
	{
		tts.POST("/synthesize", handler.SynthesizeTTS)
		tts.POST("/synthesize-async", handler.SynthesizeTTSAsync)
		tts.GET("/progress/:taskId", handler.GetTTSTaskProgress)
		tts.GET("/progress/stream/:taskId", handler.StreamTTSTaskProgressSSE)
		tts.GET("/audio/:filename", handler.GetTTSAudio)
	}
}
