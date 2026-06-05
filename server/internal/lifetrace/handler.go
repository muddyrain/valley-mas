package lifetrace

import (
	"net/http"
	"valley-server/internal/config"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	weather    *WeatherService
	push       *PushService
	pushConfig config.WebPushConfig
}

func NewHandler(weather *WeatherService, webPush ...config.WebPushConfig) *Handler {
	var pushConfig config.WebPushConfig
	if len(webPush) > 0 {
		pushConfig = webPush[0]
	}
	return &Handler{weather: weather, push: NewPushService(pushConfig), pushConfig: pushConfig}
}

func (h *Handler) GetWeather(c *gin.Context) {
	city := c.DefaultQuery("city", "上海")
	refresh := c.Query("refresh") == "true"
	resp := h.weather.Fetch(c.Request.Context(), city, refresh)
	c.JSON(http.StatusOK, resp)
}
