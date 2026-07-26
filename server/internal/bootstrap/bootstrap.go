package bootstrap

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/dbmigration"
	"valley-server/internal/envfile"
	"valley-server/internal/lifetrace"
	"valley-server/internal/logger"
	"valley-server/internal/router"
	"valley-server/internal/utils"

	_ "valley-server/docs"

	"github.com/gin-gonic/gin"
)

var (
	initOnce   sync.Once
	initErr    error
	globalCfg  *config.Config
	globalHTTP http.Handler
)

// Init prepares app dependencies once and returns shared HTTP handler.
func Init() (*config.Config, http.Handler, error) {
	return initApp(false)
}

// InitLocal prepares the local development app and applies only pending,
// versioned migrations before workers and HTTP handlers can access the schema.
func InitLocal() (*config.Config, http.Handler, error) {
	return initApp(true)
}

func initApp(runMigrations bool) (*config.Config, http.Handler, error) {
	initOnce.Do(func() {
		envPath, err := envfile.Load()
		if err != nil {
			initErr = err
			return
		}
		if envPath == "" {
			log.Println("No .env file found, using system environment variables")
		} else {
			log.Printf("Loaded env file: %s", envPath)
		}
		globalCfg = config.Load()

		logger.InitLogger()
		logger.Log.Info("Valley MAS Server Starting...")

		if err := utils.InitSnowflake(1); err != nil {
			initErr = err
			return
		}

		if globalCfg.TOS.AccessKey != "" && globalCfg.TOS.SecretKey != "" {
			if err := utils.InitTOS(&globalCfg.TOS); err != nil {
				logger.Log.Warnf("TOS initialization failed: %v", err)
			}
		} else {
			logger.Log.Warn("TOS credentials not configured, file upload disabled")
		}

		if err := database.Init(globalCfg); err != nil {
			initErr = err
			return
		}
		if runMigrations {
			sqlDB, err := database.SQLDB()
			if err != nil {
				initErr = err
				return
			}
			migrationContext, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()
			summary, err := dbmigration.Up(migrationContext, sqlDB, globalCfg.Database.Driver)
			if err != nil {
				initErr = err
				return
			}
			logger.Log.Infof(
				"Database migrations ready (applied=%d, version=%d)",
				len(summary.Applied),
				summary.CurrentVersion,
			)
		}

		lifetraceWeatherService := lifetrace.NewWeatherService(globalCfg.QWeather)
		lifetrace.StartHolidayCalendarSyncWorker(context.Background(), globalCfg.Holiday)
		if globalCfg.WebPush.WorkerEnabled {
			lifetrace.StartPushReminderWorker(context.Background(), globalCfg.WebPush, lifetraceWeatherService)
		} else {
			logger.Log.Info("LifeTrace Web Push worker disabled by WEB_PUSH_WORKER_ENABLED")
		}

		globalHTTP = router.Setup(globalCfg)
	})

	return globalCfg, globalHTTP, initErr
}

func AsGin(handler http.Handler) *gin.Engine {
	if engine, ok := handler.(*gin.Engine); ok {
		return engine
	}
	return nil
}
