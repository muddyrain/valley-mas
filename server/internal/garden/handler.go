package garden

import (
	"errors"
	"net/http"
	"strconv"

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

// userID 从 gin.Context 中读取认证中间件写入的 userId。
// 项目通用中间件写入 key=userId、类型 int64；测试中也兼容 uint64。
func (h *Handler) userID(c *gin.Context) uint64 {
	v, ok := c.Get("userId")
	if !ok {
		return 0
	}
	switch id := v.(type) {
	case int64:
		if id < 0 {
			return 0
		}
		return uint64(id)
	case uint64:
		return id
	default:
		return 0
	}
}

// GetPlantDetail 处理 GET /garden/plant/:id：返回植物详情 + 成长日志。
func (h *Handler) GetPlantDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	view, err := h.svc.GetPlantDetail(c.Request.Context(), h.userID(c), id)
	if err != nil {
		switch {
		case errors.Is(err, ErrPlantNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		case errors.Is(err, ErrPlantNotOwned):
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, view)
}

// Water 处理 POST /garden/plant/:id/water：每日每株最多 5 次，返回 AI 回应文本。
func (h *Handler) Water(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	reply, err := h.svc.Water(c.Request.Context(), h.userID(c), id)
	if err != nil {
		switch {
		case errors.Is(err, ErrPlantNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		case errors.Is(err, ErrPlantNotOwned):
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		case errors.Is(err, ErrInteractionLimited):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "interaction_limited"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"reply": reply})
}

// Chat 处理 POST /garden/plant/:id/chat：仅成熟植物可聊，每日每株最多 3 次。
func (h *Handler) Chat(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req ChatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty_message"})
		return
	}
	reply, err := h.svc.Chat(c.Request.Context(), h.userID(c), id, req.Message)
	if err != nil {
		switch {
		case errors.Is(err, ErrPlantNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		case errors.Is(err, ErrPlantNotOwned):
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		case errors.Is(err, ErrNotMature):
			c.JSON(http.StatusBadRequest, gin.H{"error": "not_mature"})
		case errors.Is(err, ErrInteractionLimited):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "interaction_limited"})
		case err.Error() == "empty_message":
			c.JSON(http.StatusBadRequest, gin.H{"error": "empty_message"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, gin.H{"reply": reply})
}

// Harvest 处理 POST /garden/plant/:id/harvest：仅成熟植物可收获，写入 Harvest 并释放 slot。
func (h *Handler) Harvest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	harvest, err := h.svc.Harvest(c.Request.Context(), h.userID(c), id)
	if err != nil {
		switch {
		case errors.Is(err, ErrPlantNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		case errors.Is(err, ErrPlantNotOwned):
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		case errors.Is(err, ErrNotMature):
			c.JSON(http.StatusBadRequest, gin.H{"error": "not_mature"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, harvest)
}

// GetEncyclopedia 处理 GET /garden/encyclopedia：返回当前用户已收获植物 + harvest 列表。
func (h *Handler) GetEncyclopedia(c *gin.Context) {
	items, err := h.svc.ListEncyclopedia(c.Request.Context(), h.userID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}
