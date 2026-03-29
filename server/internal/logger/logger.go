package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log *logrus.Logger

// InitLogger 初始化日志系统
func InitLogger() {
	Log = logrus.New()

	// 设置日志格式
	Log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
		PrettyPrint:     false,
	})

	// 设置日志级别
	Log.SetLevel(logrus.InfoLevel)

	// Vercel/Serverless 环境建议只输出 stdout，避免文件系统写入问题。
	if os.Getenv("VERCEL") != "" || os.Getenv("DISABLE_FILE_LOG") == "1" {
		if gin.Mode() == gin.DebugMode {
			Log.SetOutput(os.Stdout)
		} else {
			Log.SetOutput(os.Stdout)
		}
		Log.Info("logger initialized in stdout-only mode")
		return
	}

	// 创建日志目录
	logDir := "logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		fmt.Printf("创建日志目录失败: %v\n", err)
	}

	// 配置日志文件切割
	fileWriter := &lumberjack.Logger{
		Filename:   filepath.Join(logDir, "app.log"),
		MaxSize:    100, // MB
		MaxBackups: 7,   // 保留最近7个文件
		MaxAge:     30,  // 保留30天
		Compress:   true,
	}

	// 错误日志单独文件
	errorWriter := &lumberjack.Logger{
		Filename:   filepath.Join(logDir, "error.log"),
		MaxSize:    100,
		MaxBackups: 7,
		MaxAge:     30,
		Compress:   true,
	}

	// 开发环境：同时输出到控制台和文件
	// 生产环境：只输出到文件
	if gin.Mode() == gin.DebugMode {
		Log.SetOutput(io.MultiWriter(os.Stdout, fileWriter))
	} else {
		Log.SetOutput(fileWriter)
	}

	// 添加 Hook，错误级别单独写入 error.log
	Log.AddHook(&ErrorLogHook{
		Writer: errorWriter,
	})

	Log.Info("日志系统初始化完成")
}

// ErrorLogHook 错误日志钩子
type ErrorLogHook struct {
	Writer io.Writer
}

func (hook *ErrorLogHook) Levels() []logrus.Level {
	return []logrus.Level{
		logrus.ErrorLevel,
		logrus.FatalLevel,
		logrus.PanicLevel,
	}
}

func (hook *ErrorLogHook) Fire(entry *logrus.Entry) error {
	line, err := entry.String()
	if err != nil {
		return err
	}
	_, err = hook.Writer.Write([]byte(line))
	return err
}

// RequestLogger 请求日志中间件
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 生成唯一的 Log ID（时间戳格式：20260304223321 + 8位随机字符）
		logID := generateLogID()
		c.Set("log_id", logID)

		// 设置响应头，让客户端可以获取 Log ID
		c.Header("X-Log-ID", logID)

		// 记录请求开始时间
		startTime := time.Now()

		// 记录请求信息
		fields := logrus.Fields{
			"log_id":     logID,
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"query":      c.Request.URL.RawQuery,
			"ip":         c.ClientIP(),
			"user_agent": c.Request.UserAgent(),
		}

		// 如果有用户信息，添加到日志
		if userID, exists := c.Get("userID"); exists {
			fields["user_id"] = userID
		} else if userID, exists := c.Get("userId"); exists {
			fields["user_id"] = userID
		}

		Log.WithFields(fields).Info("请求开始")

		// 处理请求
		c.Next()

		// 计算请求耗时
		latency := time.Since(startTime)
		statusCode := c.Writer.Status()

		// 记录响应信息
		responseFields := logrus.Fields{
			"log_id":  logID,
			"method":  c.Request.Method,
			"path":    c.Request.URL.Path,
			"status":  statusCode,
			"latency": latency.String(),
			"ip":      c.ClientIP(),
		}

		level := "info"
		message := "请求完成"

		// 根据状态码选择日志级别
		if statusCode >= 500 {
			level = "error"
			message = "请求完成（服务器错误）"
			Log.WithFields(responseFields).Error(message)
		} else if statusCode >= 400 {
			level = "warn"
			message = "请求完成（客户端错误）"
			Log.WithFields(responseFields).Warn(message)
		} else {
			Log.WithFields(responseFields).Info(message)
		}

		saveOperationLog(c, logID, statusCode, latency, level, message)
	}
}

func saveOperationLog(
	c *gin.Context,
	logID string,
	statusCode int,
	latency time.Duration,
	level string,
	message string,
) {
	db := database.GetDB()
	if db == nil {
		return
	}

	userID := ""
	if uid, exists := c.Get("userId"); exists {
		switch v := uid.(type) {
		case int64:
			userID = strconv.FormatInt(v, 10)
		case model.Int64String:
			userID = v.String()
		case string:
			userID = v
		default:
			userID = fmt.Sprintf("%v", v)
		}
	}

	userRole := ""
	if role, exists := c.Get("userRole"); exists {
		if r, ok := role.(string); ok {
			userRole = r
		}
	}

	op := model.OperationLog{
		ID:        model.Int64String(utils.GenerateID()),
		LogID:     logID,
		Method:    c.Request.Method,
		Path:      c.Request.URL.Path,
		Query:     c.Request.URL.RawQuery,
		Status:    statusCode,
		LatencyMs: latency.Milliseconds(),
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		UserID:    userID,
		UserRole:  userRole,
		Level:     level,
		Message:   message,
	}

	if err := db.Create(&op).Error; err != nil {
		Log.WithError(err).WithField("log_id", logID).Warn("写入操作日志表失败")
	}
}

// generateLogID 生成带时间戳的 Log ID
// 格式: 20260304223321XXXXXXXX (14位时间戳 + 8位随机字符)
func generateLogID() string {
	// 时间戳部分：YYYYMMDDHHmmss
	timestamp := time.Now().Format("20060102150405")

	// 随机部分：8位大写字母+数字（使用纳秒时间戳保证随机性）
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	nanos := time.Now().UnixNano()
	randomPart := make([]byte, 8)
	for i := range randomPart {
		nanos = nanos*1103515245 + 12345 // 简单的线性同余生成器
		// 使用绝对值避免负数索引
		index := nanos % int64(len(charset))
		if index < 0 {
			index = -index
		}
		randomPart[i] = charset[index]
	}

	return timestamp + string(randomPart)
}

// GetLogID 从上下文获取 Log ID
func GetLogID(c *gin.Context) string {
	if logID, exists := c.Get("log_id"); exists {
		return logID.(string)
	}
	return ""
}

// WithLogID 返回带有 Log ID 的日志对象
func WithLogID(c *gin.Context) *logrus.Entry {
	return Log.WithField("log_id", GetLogID(c))
}

// Info 信息日志
func Info(c *gin.Context, msg string, fields ...logrus.Fields) {
	entry := WithLogID(c)
	if len(fields) > 0 {
		entry = entry.WithFields(fields[0])
	}
	entry.Info(msg)
}

// Warn 警告日志
func Warn(c *gin.Context, msg string, fields ...logrus.Fields) {
	entry := WithLogID(c)
	if len(fields) > 0 {
		entry = entry.WithFields(fields[0])
	}
	entry.Warn(msg)
}

// Error 错误日志
func Error(c *gin.Context, msg string, err error, fields ...logrus.Fields) {
	entry := WithLogID(c)
	if err != nil {
		entry = entry.WithField("error", err.Error())
	}
	if len(fields) > 0 {
		entry = entry.WithFields(fields[0])
	}
	entry.Error(msg)
}

// Debug 调试日志
func Debug(c *gin.Context, msg string, fields ...logrus.Fields) {
	entry := WithLogID(c)
	if len(fields) > 0 {
		entry = entry.WithFields(fields[0])
	}
	entry.Debug(msg)
}

// Fatal 致命错误日志
func Fatal(c *gin.Context, msg string, err error, fields ...logrus.Fields) {
	entry := WithLogID(c)
	if err != nil {
		entry = entry.WithField("error", err.Error())
	}
	if len(fields) > 0 {
		entry = entry.WithFields(fields[0])
	}
	entry.Fatal(msg)
}
