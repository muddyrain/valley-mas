package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Env      string // development, production
	Port     string
	Database DatabaseConfig
	TOS      TOSConfig
	JWT      JWTConfig
	SMTP     SMTPConfig
	QWeather QWeatherConfig
	WebPush  WebPushConfig
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

type QWeatherConfig struct {
	APIKey                 string
	APIHost                string
	GeoHost                string
	CacheTTLMinutes        int
	TimeoutSeconds         int
	RefreshCooldownSeconds int
}

type WebPushConfig struct {
	PublicKey           string
	PrivateKey          string
	Subject             string
	Enabled             bool
	ScanIntervalSeconds int
	ReminderWindowMin   int
}

const defaultJWTExpireHours int64 = 24 * 365 * 10

func Load() *Config {
	env := getEnv("ENV", "development")
	qWeatherAPIHost := normalizeURL(getEnv("QWEATHER_API_HOST", getEnv("QWEATHER_HOST", "")))
	qWeatherGeoHost := normalizeURL(getEnv("QWEATHER_GEO_HOST", qWeatherAPIHost))

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
			Expire: int64(getEnvInt("JWT_EXPIRE_HOURS", int(defaultJWTExpireHours))),
		},
		SMTP: SMTPConfig{
			Host:        getEnv("SMTP_HOST", ""),
			Port:        getEnv("SMTP_PORT", "587"),
			User:        getEnv("SMTP_USER", ""),
			Pass:        getEnv("SMTP_PASS", ""),
			FromName:    getEnv("SMTP_FROM_NAME", "Valley"),
			FromAddress: getEnv("SMTP_FROM_ADDRESS", ""),
		},
		QWeather: QWeatherConfig{
			APIKey:                 getEnv("QWEATHER_API_KEY", ""),
			APIHost:                qWeatherAPIHost,
			GeoHost:                qWeatherGeoHost,
			CacheTTLMinutes:        getEnvInt("QWEATHER_CACHE_TTL_MINUTES", 30),
			TimeoutSeconds:         getEnvInt("QWEATHER_TIMEOUT_SECONDS", 5),
			RefreshCooldownSeconds: getEnvInt("QWEATHER_REFRESH_COOLDOWN_SECONDS", 300),
		},
		WebPush: WebPushConfig{
			PublicKey:           strings.TrimSpace(getEnv("WEB_PUSH_PUBLIC_KEY", "")),
			PrivateKey:          strings.TrimSpace(getEnv("WEB_PUSH_PRIVATE_KEY", "")),
			Subject:             strings.TrimSpace(getEnv("WEB_PUSH_SUBJECT", "mailto:admin@example.com")),
			Enabled:             getEnvBool("WEB_PUSH_ENABLED", true),
			ScanIntervalSeconds: getEnvInt("WEB_PUSH_SCAN_INTERVAL_SECONDS", 60),
			ReminderWindowMin:   getEnvInt("WEB_PUSH_REMINDER_WINDOW_MINUTES", 10),
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

func normalizeURL(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		value = "https://" + value
	}
	return strings.TrimRight(value, "/")
}
