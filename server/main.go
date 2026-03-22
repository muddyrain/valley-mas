package main

import (
	"log"
	"os"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/handler"
	"valley-server/internal/logger"
	"valley-server/internal/router"
	"valley-server/internal/utils"

	_ "valley-server/docs"

	"github.com/joho/godotenv"
)

func main() {
	// 兼容不同启动目录：
	// - 在 server 目录启动：读取 .env
	// - 在项目根目录启动：读取 server/.env
	envCandidates := []string{".env", "server/.env", "./server/.env", "../server/.env"}
	loaded := false
	for _, p := range envCandidates {
		if _, err := os.Stat(p); err == nil {
			if err := godotenv.Load(p); err == nil {
				log.Printf("Loaded env file: %s", p)
				loaded = true
				break
			}
		}
	}
	if !loaded {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := config.Load()

	logger.InitLogger()
	logger.Log.Info("Valley MAS Server Starting...")

	if err := utils.InitSnowflake(1); err != nil {
		logger.Log.Fatalf("Failed to init Snowflake: %v", err)
	}

	if cfg.TOS.AccessKey != "" && cfg.TOS.SecretKey != "" {
		if err := utils.InitTOS(&cfg.TOS); err != nil {
			logger.Log.Warnf("TOS initialization failed: %v", err)
		}
	} else {
		logger.Log.Warn("TOS credentials not configured, file upload disabled")
	}

	if err := database.Init(cfg); err != nil {
		logger.Log.Fatalf("Failed to init database: %v", err)
	}
	defer database.Close()

	handler.InitTTSConfig(cfg)

	r := router.Setup(cfg)

	logger.Log.Infof("Server starting on port %s (env: %s)", cfg.Port, cfg.Env)
	if err := r.Run(":" + cfg.Port); err != nil {
		logger.Log.Fatalf("Failed to start server: %v", err)
	}
}
