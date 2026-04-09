package bootstrap

import (
	"bytes"
	"log"
	"net/http"
	"os"
	"sync"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/router"
	"valley-server/internal/utils"

	_ "valley-server/docs"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var (
	initOnce   sync.Once
	initErr    error
	globalCfg  *config.Config
	globalHTTP http.Handler
)

// Init prepares app dependencies once and returns shared HTTP handler.
func Init() (*config.Config, http.Handler, error) {
	initOnce.Do(func() {
		loadEnv()

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

		globalHTTP = router.Setup(globalCfg)
	})

	return globalCfg, globalHTTP, initErr
}

func loadEnv() {
	envCandidates := []string{".env", "server/.env", "./server/.env", "../server/.env"}
	loaded := false
	for _, p := range envCandidates {
		if _, err := os.Stat(p); err == nil {
			if err := loadEnvFileCompat(p); err == nil {
				log.Printf("Loaded env file: %s", p)
				loaded = true
				break
			}
		}
	}
	if !loaded {
		log.Println("No .env file found, using system environment variables")
	}
}

func loadEnvFileCompat(path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	content = bytes.TrimPrefix(content, []byte{0xEF, 0xBB, 0xBF})

	values, err := godotenv.Unmarshal(string(content))
	if err != nil {
		return err
	}
	for key, value := range values {
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	return nil
}

func AsGin(handler http.Handler) *gin.Engine {
	if engine, ok := handler.(*gin.Engine); ok {
		return engine
	}
	return nil
}
