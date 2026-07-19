package handler

import (
	"errors"
	"net/http"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/integration/notion"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterNotionOAuthRoutes(auth *gin.RouterGroup, api *gin.RouterGroup, cfg *config.Config) {
	auth.GET("/integrations/notion", getNotionConnection(cfg))
	auth.POST("/integrations/notion/authorization", startNotionAuthorization(cfg))
	auth.DELETE("/integrations/notion", disconnectNotion(cfg))
	api.GET("/integrations/notion/callback", NotionOAuthCallback(cfg))
}

func getNotionConnection(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newNotionService(c, cfg)
		if !ok {
			return
		}
		connection, err := service.Status(c.Request.Context(), GetCurrentUserID(c))
		if err != nil {
			Error(c, http.StatusInternalServerError, "读取 Notion 连接失败")
			return
		}
		Success(c, connection)
	}
}

func startNotionAuthorization(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newNotionService(c, cfg)
		if !ok {
			return
		}
		authURL, err := service.Start(c.Request.Context(), GetCurrentUserID(c))
		if err != nil {
			Error(c, http.StatusServiceUnavailable, err.Error())
			return
		}
		Success(c, gin.H{"authUrl": authURL})
	}
}

func disconnectNotion(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newNotionService(c, cfg)
		if !ok {
			return
		}
		if err := service.Disconnect(c.Request.Context(), GetCurrentUserID(c)); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				Error(c, http.StatusNotFound, "Notion 连接不存在")
				return
			}
			Error(c, http.StatusBadGateway, "断开 Notion 连接失败")
			return
		}
		Success(c, nil)
	}
}

func NotionOAuthCallback(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newNotionService(c, cfg)
		if !ok {
			return
		}
		if err := service.Complete(c.Request.Context(), c.Query("state"), c.Query("code")); err != nil {
			logger.Error(c, "Notion OAuth 回调处理失败", err)
			c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte(notionCallbackPage(false)))
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(notionCallbackPage(true)))
	}
}

func newNotionService(c *gin.Context, cfg *config.Config) (*notion.Service, bool) {
	service, err := notion.NewService(database.GetDB(), cfg.NotionOAuth)
	if err != nil {
		Error(c, http.StatusInternalServerError, "Notion 连接服务不可用")
		return nil, false
	}
	return service, true
}

func notionCallbackPage(connected bool) string {
	if connected {
		return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Notion 已连接</title><body><p>Notion 已连接，可关闭此窗口。</p><script>window.close()</script></body></html>`
	}
	return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Notion 连接失败</title><body><p>Notion 连接失败，请返回 Valley 后重试。</p></body></html>`
}
