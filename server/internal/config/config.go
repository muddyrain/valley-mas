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
	TTS      TTSConfig
}

type DatabaseConfig struct {
	Driver    string // mysql, postgres
	DSN       string
	SlowLogMs int
	Host      string
	Port      string
	User      string
	Password  string
	DBName    string
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
			Driver:    getEnv("DB_DRIVER", getDefaultDriver()),
			DSN:       getEnv("DB_DSN", ""),
			SlowLogMs: getEnvInt("DB_SLOW_LOG_MS", 100),
			Host:      getEnv("DB_HOST", "localhost"),
			Port:      getEnv("DB_PORT", "3306"),
			User:      getEnv("DB_USER", "root"),
			Password:  getEnv("DB_PASSWORD", ""),
			DBName:    getEnv("DB_NAME", "valley"),
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
