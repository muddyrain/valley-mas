package main

import (
	"os"
	"strings"
	"valley-server/internal/bootstrap"
	"valley-server/internal/logger"
)

const localAutoMigrateFlagEnv = "VALLEY_LOCAL_DB_AUTO_MIGRATE"

func main() {
	applyLocalStartupArgs(os.Args[1:])

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

func applyLocalStartupArgs(args []string) {
	for _, arg := range args {
		if strings.EqualFold(strings.TrimSpace(arg), "db=true") {
			_ = os.Setenv(localAutoMigrateFlagEnv, "true")
			return
		}
	}
}
