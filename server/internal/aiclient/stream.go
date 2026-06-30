package aiclient

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// SSEWriter 将 gin.Context 包装成 SSE 流写入器。
// 创建时设置 SSE 必需的 4 个 header 并验证底层 ResponseWriter 实现 http.Flusher。
type SSEWriter struct {
	ctx     *gin.Context
	flusher http.Flusher
}

// NewSSEWriter 创建一个 SSEWriter。
// 失败条件：底层 ResponseWriter 不实现 http.Flusher。
func NewSSEWriter(c *gin.Context) (*SSEWriter, error) {
	if c == nil || c.Writer == nil {
		return nil, errors.New("nil gin context or writer")
	}
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return nil, errors.New("streaming not supported")
	}
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	return &SSEWriter{ctx: c, flusher: flusher}, nil
}

// Send 序列化 payload 为 JSON 并以 "data: <json>\n\n" 形式写入。
// json.Marshal 失败时直接返回 error，不写出任何字节。
func (w *SSEWriter) Send(payload any) error {
	if w == nil || w.ctx == nil {
		return errors.New("nil SSEWriter")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := w.ctx.Writer.Write([]byte("data: ")); err != nil {
		return err
	}
	if _, err := w.ctx.Writer.Write(body); err != nil {
		return err
	}
	if _, err := w.ctx.Writer.Write([]byte("\n\n")); err != nil {
		return err
	}
	w.flusher.Flush()
	return nil
}
