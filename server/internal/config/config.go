package config

import (
	"os"
)

type Config struct {
	Env      string // development, production
	Port     string
	Database DatabaseConfig
	TOS      TOSConfig
	JWT      JWTConfig
}

type DatabaseConfig struct {
	Driver   string // sqlite, mysql
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SQLite   string // SQLite 文件路径
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

func Load() *Config {
	env := getEnv("ENV", "development")

	return &Config{
		Env:  env,
		Port: getEnv("PORT", "8080"),
		Database: DatabaseConfig{
			Driver:   getEnv("DB_DRIVER", getDefaultDriver(env)),
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "3306"),
			User:     getEnv("DB_USER", "root"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "valley"),
			SQLite:   getEnv("DB_SQLITE_PATH", "./data/valley.db"),
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
			Expire: 24 * 7, // 7 days
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getDefaultDriver 根据环境返回默认数据库驱动
func getDefaultDriver(env string) string {
	if env == "production" {
		return "mysql"
	}
	return "sqlite" // 开发环境默认用 SQLite
}
