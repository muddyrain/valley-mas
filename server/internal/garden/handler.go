package garden

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Health 是 M1 的占位；后续任务逐个加 handler 方法。
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true, "module": "garden"})
}
