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
