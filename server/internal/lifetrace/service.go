package lifetrace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"valley-server/internal/config"
)

type WeatherService struct {
	cfg    config.QWeatherConfig
	client *http.Client
	cache  map[string]cacheEntry
	mu     sync.RWMutex
}

type cacheEntry struct {
	data      WeatherResponse
	expiresAt time.Time
}

func NewWeatherService(cfg config.QWeatherConfig) *WeatherService {
	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	return &WeatherService{
		cfg:    cfg,
		client: &http.Client{Timeout: timeout},
		cache:  map[string]cacheEntry{},
	}
}

func (s *WeatherService) Fetch(ctx context.Context, city string) WeatherResponse {
	city = strings.TrimSpace(city)
	if city == "" {
		city = "上海"
	}

	cacheKey := strings.ToLower(city)
	if cached, ok := s.getCached(cacheKey); ok {
		return cached
	}

	resp, err := s.fetchQWeather(ctx, city)
	if err != nil {
		mock := mockWeather(city)
		mock.Warning = err.Error()
		s.setCached(cacheKey, mock)
		return mock
	}

	s.setCached(cacheKey, resp)
	return resp
}

func (s *WeatherService) getCached(key string) (WeatherResponse, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entry, ok := s.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return WeatherResponse{}, false
	}

	return entry.data, true
}

func (s *WeatherService) setCached(key string, data WeatherResponse) {
	ttl := time.Duration(s.cfg.CacheTTLMinutes) * time.Minute
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[key] = cacheEntry{data: data, expiresAt: time.Now().Add(ttl)}
}

func (s *WeatherService) fetchQWeather(ctx context.Context, city string) (WeatherResponse, error) {
	if strings.TrimSpace(s.cfg.APIKey) == "" {
		return WeatherResponse{}, fmt.Errorf("QWEATHER_API_KEY 未配置，已使用 mock 天气")
	}

	locationID, normalizedCity, err := s.lookupLocation(ctx, city)
	if err != nil {
		return WeatherResponse{}, err
	}

	now, err := s.getWeatherNow(ctx, locationID)
	if err != nil {
		return WeatherResponse{}, err
	}
	hourly, _ := s.getWeatherHourly(ctx, locationID)
	daily, _ := s.getWeatherDaily(ctx, locationID)
	indices, _ := s.getWeatherIndices(ctx, locationID)

	return normalizeQWeather(normalizedCity, now, hourly, daily, indices), nil
}

func (s *WeatherService) lookupLocation(ctx context.Context, city string) (string, string, error) {
	var resp qWeatherGeoResponse
	if err := s.getJSON(ctx, s.url(s.cfg.GeoHost, "/v2/city/lookup", map[string]string{
		"location": city,
		"lang":     "zh",
	}), &resp); err != nil {
		return "", "", err
	}

	if resp.Code != "200" || len(resp.Location) == 0 {
		return "", "", fmt.Errorf("没有找到城市：%s", city)
	}

	location := resp.Location[0]
	name := location.Name
	if location.Adm2 != "" && location.Adm2 != name {
		name = location.Adm2
	}
	return location.ID, name, nil
}

func (s *WeatherService) getWeatherNow(ctx context.Context, location string) (qWeatherNowResponse, error) {
	var resp qWeatherNowResponse
	err := s.getJSON(ctx, s.url(s.cfg.APIHost, "/v7/weather/now", baseWeatherQuery(location)), &resp)
	return resp, err
}

func (s *WeatherService) getWeatherHourly(ctx context.Context, location string) (qWeatherHourlyResponse, error) {
	var resp qWeatherHourlyResponse
	err := s.getJSON(ctx, s.url(s.cfg.APIHost, "/v7/weather/24h", baseWeatherQuery(location)), &resp)
	return resp, err
}

func (s *WeatherService) getWeatherDaily(ctx context.Context, location string) (qWeatherDailyResponse, error) {
	var resp qWeatherDailyResponse
	err := s.getJSON(ctx, s.url(s.cfg.APIHost, "/v7/weather/7d", baseWeatherQuery(location)), &resp)
	return resp, err
}

func (s *WeatherService) getWeatherIndices(ctx context.Context, location string) (qWeatherIndicesResponse, error) {
	query := baseWeatherQuery(location)
	query["type"] = "1,2,3,5,8,9"

	var resp qWeatherIndicesResponse
	err := s.getJSON(ctx, s.url(s.cfg.APIHost, "/v7/indices/1d", query), &resp)
	return resp, err
}

func baseWeatherQuery(location string) map[string]string {
	return map[string]string{
		"location": location,
		"lang":     "zh",
		"unit":     "m",
	}
}

func (s *WeatherService) url(host string, path string, query map[string]string) string {
	base := strings.TrimRight(host, "/") + path
	values := url.Values{}
	for key, value := range query {
		values.Set(key, value)
	}
	return base + "?" + values.Encode()
}

func (s *WeatherService) getJSON(ctx context.Context, url string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("X-QW-Api-Key", s.cfg.APIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("请求天气服务失败：%w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("天气服务返回异常状态：%d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("解析天气响应失败：%w", err)
	}

	return nil
}
