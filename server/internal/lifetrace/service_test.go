package lifetrace

import (
	"context"
	"testing"
	"valley-server/internal/config"
)

func TestWeatherServiceFallsBackToMockWithoutAPIKey(t *testing.T) {
	service := NewWeatherService(config.QWeatherConfig{})

	resp := service.Fetch(context.Background(), "上海")

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
