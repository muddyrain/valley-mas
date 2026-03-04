package handler

import (
	"net/http"
	"strconv"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token    string      `json:"token"`
	UserInfo interface{} `json:"userInfo"`
}

// Login 管理员登录
func Login(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
			return
		}

		// 查询用户
		var user model.User
		db := database.GetDB()
		if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
			Error(c, http.StatusUnauthorized, "用户名或密码错误")
			return
		}

		// 验证密码
		if !utils.CheckPassword(req.Password, user.Password) {
			Error(c, http.StatusUnauthorized, "用户名或密码错误")
			return
		}

		// 检查用户状态
		if !user.IsActive {
			Error(c, http.StatusForbidden, "账号已被禁用")
			return
		}

		// 生成 token (将ID转换为字符串以避免JavaScript精度丢失)
		token, err := utils.GenerateToken(strconv.FormatInt(int64(user.ID), 10), user.Username, user.Role, cfg.JWT.Secret, cfg.JWT.Expire)
		if err != nil {
			Error(c, http.StatusInternalServerError, "生成token失败")
			return
		}

		// 将 token 设置到 HttpOnly Cookie 中（更安全）
		c.SetCookie(
			"token",                  // name
			token,                    // value
			int(cfg.JWT.Expire*3600), // maxAge (秒) = 小时数 * 3600
			"/",                      // path
			"",                       // domain (空字符串表示当前域)
			false,                    // secure (生产环境应设为 true，使用 HTTPS)
			true,                     // httpOnly (防止 JavaScript 访问)
		)

		// 返回用户信息（不包含密码，不返回 token）
		Success(c, gin.H{
			"userInfo": gin.H{
				"id":       user.ID,
				"username": user.Username,
				"nickname": user.Nickname,
				"avatar":   user.Avatar,
				"role":     user.Role,
				"email":    user.Email,
				"phone":    user.Phone,
			},
		})
	}
}

// GetCurrentUser 获取当前登录用户信息
func GetCurrentUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从中间件中获取用户ID
		userID, exists := c.Get("userId")
		if !exists {
			Error(c, http.StatusUnauthorized, "未登录")
			return
		}

		// 查询用户信息
		var user model.User
		db := database.GetDB()
		if err := db.First(&user, userID).Error; err != nil {
			Error(c, http.StatusNotFound, "用户不存在")
			return
		}

		Success(c, gin.H{
			"id":       user.ID,
			"username": user.Username,
			"nickname": user.Nickname,
			"avatar":   user.Avatar,
			"role":     user.Role,
			"email":    user.Email,
			"phone":    user.Phone,
		})
	}
}

// Logout 登出
func Logout() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 清除 Cookie
		c.SetCookie(
			"token",
			"",
			-1, // maxAge 设为 -1 表示立即删除
			"/",
			"",
			false,
			true,
		)

		Success(c, gin.H{
			"message": "登出成功",
		})
	}
}
