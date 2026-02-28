package main

import (
	"log"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/router"
)

func main() {
	// 加载配置
	cfg := config.Load()

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
