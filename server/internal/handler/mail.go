package handler

import (
	"errors"
	"net/http"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/database"
	mailservice "valley-server/internal/mail"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterUserMailRoutes(user *gin.RouterGroup, cfg *config.Config) {
	user.GET("/mail/accounts", listMailAccounts(cfg))
	user.POST("/mail/accounts/gmail/start", startGmailBinding(cfg))
	user.POST("/mail/accounts/qq-imap", bindQQIMAPAccount(cfg))
	user.DELETE("/mail/accounts/:id", deleteMailAccount(cfg))
	user.POST("/mail/accounts/:id/sync", syncMailAccount(cfg))
	user.GET("/mail/messages", listMailMessages(cfg))
	user.GET("/mail/messages/:id", getMailMessage(cfg))
}

func GmailOAuthCallback(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		account, err := service.CompleteGmail(c.Request.Context(), c.Query("state"), c.Query("code"))
		if err != nil {
			redirectMailCallback(c, cfg, "error", err.Error())
			return
		}
		redirectMailCallback(c, cfg, "connected", account.Email)
	}
}

func listMailAccounts(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		accounts, err := service.ListAccounts(GetCurrentUserID(c))
		if err != nil {
			Error(c, 500, "获取邮箱账号失败")
			return
		}
		Success(c, gin.H{"list": accounts})
	}
}

func startGmailBinding(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		authURL, err := service.StartGmail(GetCurrentUserID(c))
		if err != nil {
			Error(c, 400, err.Error())
			return
		}
		Success(c, gin.H{"authUrl": authURL})
	}
}

func bindQQIMAPAccount(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		var req struct {
			Email             string `json:"email"`
			AuthorizationCode string `json:"authorizationCode"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			Error(c, 400, "参数错误")
			return
		}
		account, err := service.BindQQIMAP(c.Request.Context(), GetCurrentUserID(c), req.Email, req.AuthorizationCode)
		if err != nil {
			Error(c, 400, err.Error())
			return
		}
		Success(c, account)
	}
}

func deleteMailAccount(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		if err := service.DeleteAccount(c.Request.Context(), GetCurrentUserID(c), c.Param("id")); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				Error(c, 404, "邮箱账号不存在")
				return
			}
			Error(c, 500, "解绑邮箱失败")
			return
		}
		Success(c, gin.H{"id": c.Param("id")})
	}
}

func syncMailAccount(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		account, err := service.SyncAccount(c.Request.Context(), GetCurrentUserID(c), c.Param("id"))
		if err != nil {
			Error(c, 400, err.Error())
			return
		}
		Success(c, account)
	}
}

func listMailMessages(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		result, err := service.ListMessages(GetCurrentUserID(c), mailservice.MessageListOptions{
			AccountID: c.Query("accountId"),
			Query:     c.Query("q"),
			Page:      GetIntQuery(c, "page", 1),
			PageSize:  GetIntQuery(c, "pageSize", 20),
		})
		if err != nil {
			Error(c, 500, "获取邮件失败")
			return
		}
		Success(c, result)
	}
}

func getMailMessage(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		service, ok := newMailService(c, cfg)
		if !ok {
			return
		}
		message, err := service.GetMessage(GetCurrentUserID(c), c.Param("id"))
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				Error(c, 404, "邮件不存在")
				return
			}
			Error(c, 400, err.Error())
			return
		}
		Success(c, message)
	}
}

func newMailService(c *gin.Context, cfg *config.Config) (*mailservice.Service, bool) {
	service, err := mailservice.NewService(database.GetDB(), cfg.Mail)
	if err != nil {
		Error(c, 500, "邮件服务未配置："+err.Error())
		return nil, false
	}
	return service, true
}

func redirectMailCallback(c *gin.Context, cfg *config.Config, status string, message string) {
	target := strings.TrimSpace(cfg.Mail.FrontendRedirectURL)
	if target == "" {
		target = "/"
	}
	separator := "?"
	if strings.Contains(target, "?") {
		separator = "&"
	}
	c.Redirect(http.StatusFound, target+separator+"mailBindingStatus="+status+"&mailBindingMessage="+message)
}
