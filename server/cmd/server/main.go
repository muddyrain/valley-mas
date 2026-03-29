package main

import (
	"valley-server/internal/bootstrap"
	"valley-server/internal/logger"
)

func main() {
	cfg, app, err := bootstrap.Init()
	if err != nil {
		logger.Log.Fatalf("Failed to init app: %v", err)
	}

	engine := bootstrap.AsGin(app)
	if engine == nil {
		logger.Log.Fatal("app handler is not gin engine")
	}

	logger.Log.Infof("Server starting on port %s (env: %s)", cfg.Port, cfg.Env)
	if err := engine.Run(":" + cfg.Port); err != nil {
		logger.Log.Fatalf("Failed to start server: %v", err)
	}
}
