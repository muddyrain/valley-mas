package lifetrace

import (
	"context"
	"strings"
	"testing"
	"valley-server/internal/config"
)

func TestWeatherServiceFallsBackToMockWithoutAPIKey(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{})

	resp := service.Fetch(context.Background(), "上海", false)

	if resp.Source != "mock" {
		t.Fatalf("expected mock response, got %s", resp.Source)
	}
	if resp.City != "上海" {
		t.Fatalf("expected city 上海, got %s", resp.City)
	}
	if len(resp.Metrics) == 0 || len(resp.Hourly) == 0 {
		t.Fatalf("expected mock metrics and hourly data, got %+v", resp)
	}
	if resp.Warning == "" {
		t.Fatalf("expected warning explaining fallback, got empty")
	}
}

func TestWeatherServiceFallsBackWhenAPIHostMissing(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{APIKey: "test-key"})

	resp := service.Fetch(context.Background(), "上海", false)

	if resp.Source != "mock" {
		t.Fatalf("expected mock response, got %s", resp.Source)
	}
	if !strings.Contains(resp.Warning, "QWEATHER_API_HOST 未配置") {
		t.Fatalf("expected API host warning, got %q", resp.Warning)
	}
}

func TestWeatherServiceRejectsLegacyQWeatherHost(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{
		APIKey:  "test-key",
		APIHost: "https://devapi.qweather.com",
		GeoHost: "https://geoapi.qweather.com",
	})

	resp := service.Fetch(context.Background(), "上海", false)

	if resp.Source != "mock" {
		t.Fatalf("expected mock response, got %s", resp.Source)
	}
	if !strings.Contains(resp.Warning, "旧公共域名") {
		t.Fatalf("expected legacy host warning, got %q", resp.Warning)
	}
}

func TestFormatHourParsesQWeatherOffsetTime(t *testing.T) {
	got := formatHour("2026-05-26T22:00+08:00")

	if got != "22时" {
		t.Fatalf("expected 22时, got %q", got)
	}
}

func TestWeatherServiceReturnsSharedCacheWithoutUpstreamConfig(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{APIKey: "test-key"})
	service.setCached("杭州", WeatherResponse{
		Source: "qweather",
		City:   "杭州",
		Now:    WeatherNow{Temp: "25", Text: "多云"},
	})

	resp := service.Fetch(context.Background(), "杭州", false)

	if resp.Source != "qweather" || resp.City != "杭州" {
		t.Fatalf("expected cached qweather response, got %+v", resp)
	}
	if !resp.Cached {
		t.Fatalf("expected response to be marked cached")
	}
}

func TestWeatherServiceLimitsForcedRefreshWithinCooldown(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{
		APIKey:                 "test-key",
		RefreshCooldownSeconds: 300,
	})
	service.setCached("杭州", WeatherResponse{
		Source: "qweather",
		City:   "杭州",
		Now:    WeatherNow{Temp: "25", Text: "多云"},
	})

	resp := service.Fetch(context.Background(), "杭州", true)

	if resp.Source != "qweather" || resp.City != "杭州" {
		t.Fatalf("expected cached response during refresh cooldown, got %+v", resp)
	}
	if !resp.Cached || !resp.RefreshLimited {
		t.Fatalf("expected cached refresh-limited response, got %+v", resp)
	}
}
