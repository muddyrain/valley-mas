package handler

import (
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Email            string `json:"email"`
	Username         string `json:"username"`
	Password         string `json:"password"`
	VerificationCode string `json:"verificationCode"`
	LoginType        string `json:"loginType"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token    string      `json:"token"`
	UserInfo interface{} `json:"userInfo"`
}

var usernameSanitizer = regexp.MustCompile(`[^a-z0-9_]+`)

func issueTokenForUser(c *gin.Context, cfg *config.Config, user model.User) (string, error) {
	token, err := utils.GenerateToken(
		strconv.FormatInt(int64(user.ID), 10),
		user.Username,
		user.Role,
		cfg.JWT.Secret,
		cfg.JWT.Expire,
	)
	if err != nil {
		return "", err
	}

	c.SetCookie(
		"token",
		token,
		int(cfg.JWT.Expire*3600),
		"/",
		"",
		false,
		true,
	)
	return token, nil
}

func userInfoPayload(user model.User) gin.H {
	return gin.H{
		"id":       user.ID,
		"username": user.Username,
		"nickname": user.Nickname,
		"avatar":   user.Avatar,
		"role":     user.Role,
		"email":    user.Email,
		"phone":    user.Phone,
	}
}

func buildUsernameBaseFromEmail(email string) string {
	parts := strings.SplitN(strings.ToLower(strings.TrimSpace(email)), "@", 2)
	base := ""
	if len(parts) > 0 {
		base = parts[0]
	}
	base = usernameSanitizer.ReplaceAllString(base, "_")
	base = strings.Trim(base, "_")
	base = strings.ReplaceAll(base, "__", "_")
	if base == "" {
		base = "user"
	}
	if len(base) < 3 {
		base += strings.Repeat("0", 3-len(base))
	}
	// Reserve room for suffix like _1234.
	if len(base) > 12 {
		base = base[:12]
	}
	return base
}

func resolveUniqueUsernameByEmail(email string) string {
	db := database.GetDB()
	base := buildUsernameBaseFromEmail(email)

	for i := 0; i < 10000; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s_%d", base, i)
		}
		var count int64
		db.Model(&model.User{}).Where("username = ?", candidate).Count(&count)
		if count == 0 {
			return candidate
		}
	}

	// Extremely unlikely fallback.
	return fmt.Sprintf("user_%d", utils.GenerateID())
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
		email := strings.ToLower(strings.TrimSpace(req.Email))
		username := strings.TrimSpace(req.Username)
		if email != "" {
			if err := db.Where("LOWER(email) = ?", email).First(&user).Error; err != nil {
				Error(c, http.StatusUnauthorized, "用户名或密码错误")
				return
			}
		} else {
			if username == "" {
				Error(c, http.StatusBadRequest, "参数错误")
				return
			}
			if err := db.Where("username = ?", username).First(&user).Error; err != nil {
				Error(c, http.StatusUnauthorized, "用户名或密码错误")
				return
			}
		}

		// 检查用户状态
		if !user.IsActive {
			Error(c, http.StatusForbidden, "账号已被禁用")
			return
		}

		loginType := strings.TrimSpace(req.LoginType)
		if loginType == "" {
			loginType = "code"
		}

		if loginType == "password" {
			if strings.TrimSpace(req.Password) == "" {
				Error(c, http.StatusBadRequest, "请输入密码")
				return
			}
			if !utils.CheckPassword(req.Password, user.Password) {
				Error(c, http.StatusUnauthorized, "用户名或密码错误")
				return
			}
		} else {
			verifyEmail := email
			if verifyEmail == "" {
				verifyEmail = strings.ToLower(strings.TrimSpace(user.Email))
			}
			if verifyEmail == "" {
				Error(c, http.StatusBadRequest, "该账号未绑定邮箱，无法验证码登录")
				return
			}
			if strings.TrimSpace(req.VerificationCode) == "" {
				Error(c, http.StatusBadRequest, "请输入邮箱验证码")
				return
			}
			if err := consumeEmailVerificationCode(verifyEmail, emailCodePurposeLogin, req.VerificationCode); err != nil {
				Error(c, http.StatusUnauthorized, err.Error())
				return
			}
		}

		// 生成 token (将ID转换为字符串以避免JavaScript精度丢失)
		token, err := issueTokenForUser(c, cfg, user)
		if err != nil {
			Error(c, http.StatusInternalServerError, "生成token失败")
			return
		}

		// 返回用户信息 + token（admin 端通过 header 携带 token，避免与 web Cookie 冲突）
		Success(c, gin.H{
			"token":    token,
			"userInfo": userInfoPayload(user),
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

// RefreshToken 刷新当前登录会话的 token（用于角色/昵称变更后快速同步）
func RefreshToken(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			Error(c, http.StatusUnauthorized, "未登录")
			return
		}

		var user model.User
		db := database.GetDB()
		if err := db.First(&user, userID).Error; err != nil {
			Error(c, http.StatusNotFound, "用户不存在")
			return
		}
		if !user.IsActive {
			Error(c, http.StatusForbidden, "账号已被禁用")
			return
		}

		token, err := issueTokenForUser(c, cfg, user)
		if err != nil {
			Error(c, http.StatusInternalServerError, "生成token失败")
			return
		}

		Success(c, gin.H{
			"token":    token,
			"userInfo": userInfoPayload(user),
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

// Register 用户注册
// @Summary      用户注册
// @Description  通过用户名、密码、昵称注册新账号，默认角色为 user
// @Tags         认证
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "注册信息"
// @Success      200   {object}  LoginResponse
// @Failure      400   {object}  map[string]interface{}  "参数错误 / 用户名已存在"
// @Router       /register [post]
func Register(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Username         string `json:"username" binding:"omitempty,min=3,max=20"`
			Email            string `json:"email" binding:"required,email,max=100"`
			Password         string `json:"password" binding:"required,min=6"`
			VerificationCode string `json:"verificationCode" binding:"required,len=6"`
			Nickname         string `json:"nickname"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			Error(c, http.StatusBadRequest, "参数错误："+err.Error())
			return
		}

		db := database.GetDB()
		username := strings.TrimSpace(req.Username)
		email := strings.ToLower(strings.TrimSpace(req.Email))
		if err := consumeEmailVerificationCode(email, emailCodePurposeRegister, req.VerificationCode); err != nil {
			Error(c, http.StatusUnauthorized, err.Error())
			return
		}
		if username == "" {
			username = resolveUniqueUsernameByEmail(email)
		}

		// 检查用户名是否已存在
		var count int64
		db.Model(&model.User{}).Where("username = ?", username).Count(&count)
		if count > 0 {
			Error(c, http.StatusBadRequest, "用户名已被占用")
			return
		}
		db.Model(&model.User{}).Where("LOWER(email) = ?", email).Count(&count)
		if count > 0 {
			Error(c, http.StatusBadRequest, "该邮箱已被使用")
			return
		}

		nickname := req.Nickname
		if nickname == "" {
			nickname = username
		}

		user := model.User{
			Username: username,
			Email:    email,
			Password: utils.HashPassword(req.Password),
			Nickname: nickname,
			Role:     "user",
			IsActive: true,
			Platform: "web",
		}

		if err := db.Create(&user).Error; err != nil {
			Error(c, http.StatusInternalServerError, "注册失败，请稍后重试")
			return
		}

		// 注册成功后自动登录，返回 token
		token, err := issueTokenForUser(c, cfg, user)
		if err != nil {
			Error(c, http.StatusInternalServerError, "生成token失败")
			return
		}

		Success(c, gin.H{
			"token":    token,
			"userInfo": userInfoPayload(user),
		})
	}
}
