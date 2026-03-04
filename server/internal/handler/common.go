package handler

import (
	"net/http"
	"strconv"
	"valley-server/internal/logger"

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
