package garden

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Health 是 /garden/health 的占位入口，供运维探活使用。
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"ok": true, "module": "garden"})
}

// GetGarden 返回当前用户的花园视图（花园元数据 + 活跃植物列表）。
func (h *Handler) GetGarden(c *gin.Context) {
	view, err := h.svc.GetGardenView(c.Request.Context(), h.userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, view)
}

// PlantSeed 处理 POST /garden/plant：种下一颗种子。
func (h *Handler) PlantSeed(c *gin.Context) {
	var req PlantSeedReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	plant, err := h.svc.PlantSeed(c.Request.Context(), h.userID(c), req)
	if err != nil {
		if errors.Is(err, ErrSlotsFull) {
			c.JSON(http.StatusConflict, gin.H{"error": "slots_full"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plant)
}

// userID 从 gin.Context 中读取认证中间件写入的 user_id。
func (h *Handler) userID(c *gin.Context) uint64 {
	v, ok := c.Get("user_id")
	if !ok {
		return 0
	}
	id, ok := v.(uint64)
	if !ok {
		return 0
	}
	return id
}
