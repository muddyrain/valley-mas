package handler

import (
	"net/http"
	"strconv"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Response 统一响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	LogID   string      `json:"logId,omitempty"` // Log ID，方便追踪问题
}

// Success 成功响应
func Success(c *gin.Context, data interface{}) {
	logID := logger.GetLogID(c)
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
		LogID:   logID,
	})
}

// Error 错误响应
func Error(c *gin.Context, code int, message string) {
	logID := logger.GetLogID(c)

	// 记录错误日志
	logger.Warn(c, "Request failed", logrus.Fields{
		"status_code": code,
		"message":     message,
		"path":        c.Request.URL.Path,
		"method":      c.Request.Method,
	})

	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
		LogID:   logID,
	})
}

// ErrorWithDetail 错误响应（带详细错误信息）
func ErrorWithDetail(c *gin.Context, code int, message string, err error, fields ...logrus.Fields) {
	logID := logger.GetLogID(c)

	// 记录错误日志
	mergedFields := logrus.Fields{
		"status_code": code,
		"message":     message,
		"path":        c.Request.URL.Path,
		"method":      c.Request.Method,
	}

	// 合并额外字段
	if len(fields) > 0 {
		for k, v := range fields[0] {
			mergedFields[k] = v
		}
	}

	logger.Error(c, "Request failed with error", err, mergedFields)

	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
		LogID:   logID,
	})
}

// GetIntQuery 获取 query 参数（int 类型）
func GetIntQuery(c *gin.Context, key string, defaultValue int) int {
	valueStr := c.Query(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

// ========== 权限相关辅助函数 ==========

// GetCurrentUserID 获取当前登录用户的ID (User.ID)
func GetCurrentUserID(c *gin.Context) int64 {
	userId, exists := c.Get("userId")
	if !exists {
		return 0
	}
	return userId.(int64)
}

// GetCurrentUserRole 获取当前登录用户的角色
func GetCurrentUserRole(c *gin.Context) string {
	userRole, exists := c.Get("userRole")
	if !exists {
		return ""
	}
	return userRole.(string)
}

// IsCreatorOwner 判断创作者是否属于当前登录用户
// creator: 创作者对象
// userID: 当前登录用户的ID (User.ID)
func IsCreatorOwner(creator *model.Creator, userID int64) bool {
	return int64(creator.UserID) == userID
}

// CheckCreatorPermission 检查创作者权限
// 如果是创作者角色，只能访问自己的内容；管理员可以访问所有内容
// 返回 true 表示有权限，false 表示无权限
func CheckCreatorPermission(c *gin.Context, creator *model.Creator) bool {
	userRole := GetCurrentUserRole(c)

	// 管理员有全部权限
	if userRole == "admin" {
		return true
	}

	// 创作者只能访问自己的内容
	if userRole == "creator" {
		userID := GetCurrentUserID(c)
		return IsCreatorOwner(creator, userID)
	}

	// 其他角色无权限
	return false
}
