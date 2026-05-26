package lifetrace

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	weather *WeatherService
}

func NewHandler(weather *WeatherService) *Handler {
	return &Handler{weather: weather}
}

func (h *Handler) GetWeather(c *gin.Context) {
	city := c.DefaultQuery("city", "上海")
	resp := h.weather.Fetch(c.Request.Context(), city)
	c.JSON(http.StatusOK, resp)
}
