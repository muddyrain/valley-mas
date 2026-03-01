package main

import (
	"log"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/router"
	"valley-server/internal/utils"

	_ "valley-server/docs" // Swagger 文档

	"github.com/joho/godotenv"
)

// @title           Valley MAS API
// @version         1.0
// @description     Valley MAS 创作者内容平台 API 文档
// @description     支持创作者注册、口令管理、资源上传下载等功能

// @contact.name   API Support
// @contact.email  support@valley-mas.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description JWT 认证，格式：Bearer {token}

func main() {
	// 加载 .env 文件（开发环境）
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment variables")
	}

	// 加载配置
	cfg := config.Load()

	// 初始化 Snowflake ID 生成器（节点ID可配置，默认为1）
	if err := utils.InitSnowflake(1); err != nil {
		log.Fatalf("Failed to init Snowflake: %v", err)
	}
	log.Println("✅ Snowflake ID generator initialized (Node ID: 1)")

	// 初始化火山引擎 TOS（对象存储）
	if cfg.TOS.AccessKey != "" && cfg.TOS.SecretKey != "" {
		if err := utils.InitTOS(&cfg.TOS); err != nil {
			log.Printf("⚠️  TOS initialization failed: %v", err)
		} else {
			log.Println("✅ TOS (Volcano Engine Object Storage) initialized")
		}
	} else {
		log.Println("⚠️  TOS credentials not configured, file upload disabled")
	}

	// 初始化数据库
	if err := database.Init(cfg); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}
	defer database.Close()

	// 初始化路由
	r := router.Setup(cfg)

	// 启动服务
	log.Printf("🚀 Server starting on port %s (env: %s)", cfg.Port, cfg.Env)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
