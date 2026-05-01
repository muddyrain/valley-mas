package mindarena

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateDebate(c *gin.Context) {
	var req CreateDebateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请先写下你纠结的问题"})
		return
	}

	resp, err := h.service.CreateDebate(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetDebate(c *gin.Context) {
	session, err := h.service.GetDebate(c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrDebateNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "没有找到这场脑内会议"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *Handler) SubmitRoundSupport(c *gin.Context) {
	var req SubmitRoundSupportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请先选择你这一轮更支持谁"})
		return
	}

	session, err := h.service.SubmitRoundSupport(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		if errors.Is(err, ErrDebateNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "没有找到这场脑内会议"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *Handler) StreamDebate(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "当前服务不支持流式输出"})
		return
	}

	eventCh := h.service.StreamDebate(c.Request.Context(), c.Param("id"))
	// 每 15s 发一次 ping 事件，防止 AI 生成慢时客户端误判连接超时
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case event, ok := <-eventCh:
			if !ok {
				return
			}
			if err := writeSSE(c, event); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			if err := writeSSE(c, SSEEvent{Type: "ping"}); err != nil {
				return
			}
			flusher.Flush()
		case <-c.Request.Context().Done():
			return
		}
	}
}

func writeSSE(c *gin.Context, event SSEEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if _, err := c.Writer.Write([]byte("event: " + event.Type + "\n")); err != nil {
		return err
	}
	if _, err := c.Writer.Write([]byte("data: ")); err != nil {
		return err
	}
	if _, err := c.Writer.Write(payload); err != nil {
		return err
	}
	_, err = c.Writer.Write([]byte("\n\n"))
	return err
}
