package middleware

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var errInactiveUser = errors.New("inactive user")

// Cors 跨域中间件
func Cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func extractTokenFromRequest(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader != "" {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	cookieToken, _ := c.Cookie("token")
	return strings.TrimSpace(cookieToken)
}

func loadAuthUserFromToken(token string, cfg *config.Config) (int64, string, string, error) {
	claims, err := utils.ParseToken(token, cfg.JWT.Secret)
	if err != nil {
		return 0, "", "", err
	}

	userID, err := strconv.ParseInt(claims.UserID, 10, 64)
	if err != nil {
		return 0, "", "", err
	}

	var user model.User
	db := database.GetDB()
	if err := db.Select("id", "username", "role", "is_active").First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, "", "", errors.New("user not found")
		}
		return 0, "", "", err
	}

	if !user.IsActive {
		return 0, "", "", errInactiveUser
	}

	return userID, user.Username, user.Role, nil
}

// Auth 认证中间件
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractTokenFromRequest(c)
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
			c.Abort()
			return
		}

		userID, username, role, err := loadAuthUserFromToken(token, cfg)
		if err != nil {
			if errors.Is(err, errInactiveUser) {
				c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "账号已被禁用"})
				c.Abort()
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token已过期或无效"})
			c.Abort()
			return
		}

		c.Set("userId", userID)
		c.Set("username", username)
		c.Set("userRole", role)
		c.Next()
	}
}

// OptionalAuth 可选认证中间件：token 有效则写入 userId/username/userRole，失败则忽略
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractTokenFromRequest(c)
		if token != "" {
			if userID, username, role, err := loadAuthUserFromToken(token, cfg); err == nil {
				c.Set("userId", userID)
				c.Set("username", username)
				c.Set("userRole", role)
			}
		}
		c.Next()
	}
}

// AdminOnly 管理员权限中间件
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("userRole")
		if !exists || role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "无权限访问"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// CreatorOrAdmin 创作者或管理员权限中间件
func CreatorOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("userRole")
		if !exists || (role != "admin" && role != "creator") {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "需要创作者或管理员权限"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// CreatorOnly 创作者权限中间件
func CreatorOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("userRole")
		if !exists || role != "creator" {
			c.JSON(http.StatusForbidden, gin.H{"code": 403, "message": "需要创作者权限"})
			c.Abort()
			return
		}
		c.Next()
	}
}
