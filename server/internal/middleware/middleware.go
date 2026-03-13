package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// Cors 跨域中间件
func Cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 允许特定源（开发环境）
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		// 允许携带 Cookie
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Auth 认证中间件
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// 优先从 Cookie 获取 token
		token, err := c.Cookie("token")
		if err != nil || token == "" {
			// 如果 Cookie 中没有，尝试从 Authorization header 获取（兼容旧方式）
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权"})
			c.Abort()
			return
		}

		// 验证 JWT token
		claims, err := utils.ParseToken(token, cfg.JWT.Secret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token已过期或无效"})
			c.Abort()
			return
		}

		// 将字符串ID转换回int64
		userID, err := strconv.ParseInt(claims.UserID, 10, 64)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "无效的用户ID"})
			c.Abort()
			return
		}

		// 将用户信息存入上下文
		c.Set("userId", userID)            // int64 类型（从字符串转换）
		c.Set("username", claims.Username) // string 类型
		c.Set("userRole", claims.Role)     // string 类型

		c.Next()
	}
}

// OptionalAuth 可选认证中间件 - token 有效则写入 userId，无 token 或无效 token 则跳过（不 Abort）
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		token, err := c.Cookie("token")
		if err != nil || token == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				token = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if token != "" {
			if claims, err := utils.ParseToken(token, cfg.JWT.Secret); err == nil {
				if userID, err := strconv.ParseInt(claims.UserID, 10, 64); err == nil {
					c.Set("userId", userID)
					c.Set("username", claims.Username)
					c.Set("userRole", claims.Role)
				}
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
