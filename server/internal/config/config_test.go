package config

import "testing"

func TestQWeatherGeoHostDefaultsToAPIHost(t *testing.T) {
	t.Setenv("QWEATHER_API_HOST", "https://example.qweatherapi.com/")
	t.Setenv("QWEATHER_GEO_HOST", "")

	cfg := Load()

	if cfg.QWeather.APIHost != "https://example.qweatherapi.com" {
		t.Fatalf("expected trimmed API host, got %q", cfg.QWeather.APIHost)
	}
	if cfg.QWeather.GeoHost != cfg.QWeather.APIHost {
		t.Fatalf("expected Geo host to reuse API host, got %q", cfg.QWeather.GeoHost)
	}
}

func TestQWeatherHostAlias(t *testing.T) {
	t.Setenv("QWEATHER_HOST", "https://alias.qweatherapi.com/")
	t.Setenv("QWEATHER_API_HOST", "")
	t.Setenv("QWEATHER_GEO_HOST", "")

	cfg := Load()

	if cfg.QWeather.APIHost != "https://alias.qweatherapi.com" {
		t.Fatalf("expected QWEATHER_HOST alias, got %q", cfg.QWeather.APIHost)
	}
	if cfg.QWeather.GeoHost != cfg.QWeather.APIHost {
		t.Fatalf("expected Geo host to reuse API host, got %q", cfg.QWeather.GeoHost)
	}
}

func TestQWeatherHostAddsHTTPSScheme(t *testing.T) {
	t.Setenv("QWEATHER_API_HOST", "example.qweatherapi.com")
	t.Setenv("QWEATHER_GEO_HOST", "")

	cfg := Load()

	if cfg.QWeather.APIHost != "https://example.qweatherapi.com" {
		t.Fatalf("expected HTTPS API host, got %q", cfg.QWeather.APIHost)
	}
	if cfg.QWeather.GeoHost != cfg.QWeather.APIHost {
		t.Fatalf("expected Geo host to reuse HTTPS API host, got %q", cfg.QWeather.GeoHost)
	}
}

func TestJWTExpireDefaultsToLongLogin(t *testing.T) {
	t.Setenv("JWT_EXPIRE_HOURS", "")

	cfg := Load()

	if cfg.JWT.Expire != defaultJWTExpireHours {
		t.Fatalf("expected default JWT expiry %d hours, got %d", defaultJWTExpireHours, cfg.JWT.Expire)
	}
}

func TestJWTExpireCanBeOverridden(t *testing.T) {
	t.Setenv("JWT_EXPIRE_HOURS", "720")

	cfg := Load()

	if cfg.JWT.Expire != 720 {
		t.Fatalf("expected overridden JWT expiry 720 hours, got %d", cfg.JWT.Expire)
	}
}

func TestWebPushConfigLoadsFromEnv(t *testing.T) {
	t.Setenv("WEB_PUSH_ENABLED", "true")
	t.Setenv("WEB_PUSH_PUBLIC_KEY", " public-key ")
	t.Setenv("WEB_PUSH_PRIVATE_KEY", " private-key ")
	t.Setenv("WEB_PUSH_SUBJECT", "mailto:life@example.com")
	t.Setenv("WEB_PUSH_SCAN_INTERVAL_SECONDS", "45")
	t.Setenv("WEB_PUSH_REMINDER_WINDOW_MINUTES", "7")

	cfg := Load()

	if !cfg.WebPush.Enabled {
		t.Fatal("expected Web Push to be enabled")
	}
	if cfg.WebPush.PublicKey != "public-key" || cfg.WebPush.PrivateKey != "private-key" {
		t.Fatalf("expected trimmed VAPID keys, got %+v", cfg.WebPush)
	}
	if cfg.WebPush.Subject != "mailto:life@example.com" {
		t.Fatalf("expected configured subject, got %q", cfg.WebPush.Subject)
	}
	if cfg.WebPush.ScanIntervalSeconds != 45 || cfg.WebPush.ReminderWindowMin != 7 {
		t.Fatalf("expected configured scan timing, got %+v", cfg.WebPush)
	}
}

func TestHolidaySyncConfigLoadsFromEnv(t *testing.T) {
	t.Setenv("HOLIDAY_SYNC_ENABLED", "false")
	t.Setenv("HOLIDAY_SYNC_API_URL_TEMPLATE", " https://example.com/holiday/{year} ")
	t.Setenv("HOLIDAY_SYNC_INTERVAL_HOURS", "24")
	t.Setenv("HOLIDAY_SYNC_FUTURE_YEARS", "2")
	t.Setenv("HOLIDAY_SYNC_TIMEOUT_SECONDS", "3")

	cfg := Load()

	if cfg.Holiday.Enabled {
		t.Fatal("expected holiday sync to be disabled")
	}
	if cfg.Holiday.APIURLTemplate != "https://example.com/holiday/{year}" {
		t.Fatalf("expected trimmed API URL template, got %q", cfg.Holiday.APIURLTemplate)
	}
	if cfg.Holiday.SyncIntervalHours != 24 || cfg.Holiday.FutureYears != 2 || cfg.Holiday.TimeoutSeconds != 3 {
		t.Fatalf("expected configured holiday sync timing, got %+v", cfg.Holiday)
	}
}
