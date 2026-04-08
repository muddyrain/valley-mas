package config

import (
	"os"
	"strconv"
)

type Config struct {
	Env      string // development, production
	Port     string
	Database DatabaseConfig
	TOS      TOSConfig
	JWT      JWTConfig
	SMTP     SMTPConfig
	TTS      TTSConfig
}

type DatabaseConfig struct {
	Driver             string // mysql, postgres
	DSN                string
	SlowLogMs          int
	AutoMigrate        bool
	MaxOpenConns       int
	MaxIdleConns       int
	ConnMaxLifetimeMin int
	ConnMaxIdleTimeMin int
	Host               string
	Port               string
	User               string
	Password           string
	DBName             string
}

type TOSConfig struct {
	AccessKey string
	SecretKey string
	Bucket    string
	Endpoint  string
	Region    string
}

type JWTConfig struct {
	Secret string
	Expire int64 // hours
}

type SMTPConfig struct {
	Host        string
	Port        string
	User        string
	Pass        string
	FromName    string
	FromAddress string
}

type TTSConfig struct {
	BaseURL      string
	APIKey       string
	UpstreamPath string
	OutputDir    string
	TimeoutSec   int
}

func Load() *Config {
	env := getEnv("ENV", "development")

	return &Config{
		Env:  env,
		Port: getEnv("PORT", "8080"),
		Database: DatabaseConfig{
			Driver:             getEnv("DB_DRIVER", getDefaultDriver()),
			DSN:                getEnv("DB_DSN", ""),
			SlowLogMs:          getEnvInt("DB_SLOW_LOG_MS", 100),
			AutoMigrate:        getEnvBool("DB_AUTO_MIGRATE", getDefaultAutoMigrate(env)),
			MaxOpenConns:       getEnvInt("DB_MAX_OPEN_CONNS", 5),
			MaxIdleConns:       getEnvInt("DB_MAX_IDLE_CONNS", 2),
			ConnMaxLifetimeMin: getEnvInt("DB_CONN_MAX_LIFETIME_MIN", 30),
			ConnMaxIdleTimeMin: getEnvInt("DB_CONN_MAX_IDLE_TIME_MIN", 10),
			Host:               getEnv("DB_HOST", "localhost"),
			Port:               getEnv("DB_PORT", "3306"),
			User:               getEnv("DB_USER", "root"),
			Password:           getEnv("DB_PASSWORD", ""),
			DBName:             getEnv("DB_NAME", "valley"),
		},
		TOS: TOSConfig{
			AccessKey: getEnv("TOS_ACCESS_KEY", ""),
			SecretKey: getEnv("TOS_SECRET_KEY", ""),
			Bucket:    getEnv("TOS_BUCKET", ""),
			Endpoint:  getEnv("TOS_ENDPOINT", ""),
			Region:    getEnv("TOS_REGION", ""),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "valley-secret-key"),
			Expire: 24 * 7,
		},
		SMTP: SMTPConfig{
			Host:        getEnv("SMTP_HOST", ""),
			Port:        getEnv("SMTP_PORT", "587"),
			User:        getEnv("SMTP_USER", ""),
			Pass:        getEnv("SMTP_PASS", ""),
			FromName:    getEnv("SMTP_FROM_NAME", "Valley"),
			FromAddress: getEnv("SMTP_FROM_ADDRESS", ""),
		},
		TTS: TTSConfig{
			BaseURL:      getEnv("TTS_BASE_URL", ""),
			APIKey:       getEnv("TTS_API_KEY", ""),
			UpstreamPath: getEnv("TTS_UPSTREAM_PATH", "/synthesize"),
			OutputDir:    getEnv("TTS_OUTPUT_DIR", "./data/tts"),
			TimeoutSec:   getEnvInt("TTS_TIMEOUT_SEC", 120),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getDefaultDriver() string {
	return "postgres"
}

func getDefaultAutoMigrate(env string) bool {
	if env == "production" {
		return false
	}
	// 远程 PostgreSQL / Supabase 在开发环境下也不应默认跑自动迁移，
	// 否则启动时容易放大连接占用和 schema introspection 开销。
	return false
}

func getEnvInt(key string, defaultValue int) int {
	value := getEnv(key, "")
	if value == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return defaultValue
	}
	return parsed
}

func getEnvBool(key string, defaultValue bool) bool {
	value := getEnv(key, "")
	if value == "" {
		return defaultValue
	}
	switch value {
	case "1", "true", "TRUE", "True", "yes", "YES", "on", "ON":
		return true
	case "0", "false", "FALSE", "False", "no", "NO", "off", "OFF":
		return false
	default:
		return defaultValue
	}
}
