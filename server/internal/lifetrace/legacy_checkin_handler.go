package lifetrace

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type legacyToggleCheckinRequest struct {
	Date      string `json:"date"`
	Name      string `json:"name"`
	Completed bool   `json:"completed"`
}

func normalizeLegacyCheckinDate(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now().Format("2006-01-02"), true
	}
	if _, err := time.Parse("2006-01-02", raw); err != nil {
		return "", false
	}
	return raw, true
}

func normalizeLegacyCheckinName(raw string) string {
	name := strings.TrimSpace(raw)
	if len([]rune(name)) > 40 {
		return string([]rune(name)[:40])
	}
	return name
}

func (h *Handler) ListLegacyCheckins(c *gin.Context) {
	if _, ok := currentUserID(c); !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	date, ok := normalizeLegacyCheckinDate(c.Query("date"))
	if !ok {
		fail(c, http.StatusBadRequest, "打卡日期格式错误")
		return
	}

	success(c, gin.H{"date": date, "list": []gin.H{}})
}

func (h *Handler) ToggleLegacyCheckin(c *gin.Context) {
	if _, ok := currentUserID(c); !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req legacyToggleCheckinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	date, ok := normalizeLegacyCheckinDate(req.Date)
	if !ok {
		fail(c, http.StatusBadRequest, "打卡日期格式错误")
		return
	}

	name := normalizeLegacyCheckinName(req.Name)
	success(c, gin.H{
		"id":          "legacy-checkin",
		"date":        date,
		"name":        name,
		"completed":   req.Completed,
		"completedAt": nil,
	})
}
