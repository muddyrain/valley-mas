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

	listener, port, err := bootstrap.ListenOnAvailablePort(cfg.Port)
	if err != nil {
		logger.Log.Fatalf("Failed to bind server port from %s: %v", cfg.Port, err)
	}
	if port != cfg.Port {
		logger.Log.Infof("Configured port %s is unavailable, using port %s", cfg.Port, port)
	}

	logger.Log.Infof("Server starting on port %s (env: %s)", port, cfg.Env)
	if err := engine.RunListener(listener); err != nil {
		logger.Log.Fatalf("Failed to start server: %v", err)
	}
}
