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
