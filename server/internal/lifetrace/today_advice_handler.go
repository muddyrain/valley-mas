package lifetrace

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const lifeTraceTodayAdviceDefaultTimeout = 30 * time.Second
const lifeTraceTodayAdviceCacheTTL = 10 * time.Minute

type todayAdviceCacheEntry struct {
	Response  todayAdviceAIResponse
	Source    string
	Model     string
	ExpiresAt time.Time
}

type todayAdviceRequest struct {
	ModelID string `json:"modelId" binding:"required"`
}

var lifeTraceTodayAdviceCache = struct {
	sync.RWMutex
	items map[string]todayAdviceCacheEntry
}{
	items: make(map[string]todayAdviceCacheEntry),
}

func (h *Handler) GenerateTodayAdvice(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req todayAdviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "请选择用于生成建议的模型")
		return
	}
	invocation, ok := resolveLifeTraceCatalogInvocation(c, req.ModelID, "text", lifeTraceTodayAdviceDefaultTimeout)
	if !ok {
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取偏好失败"})
		return
	}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(8).
		Find(&plans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取计划失败"})
		return
	}

	weather := h.weather.Fetch(c.Request.Context(), settings.City, false)
	prompt := buildTodayAdvicePrompt(settings, weather, plans)
	cacheKey := buildTodayAdviceCacheKey(userID, invocation.Provider.Provider, invocation.Model.ModelID, prompt)
	if cached, ok := getCachedTodayAdvice(cacheKey, time.Now()); ok {
		success(c, gin.H{
			"summary": cached.Response.Summary,
			"list":    cached.Response.Items,
			"source":  cached.Source,
			"model":   cached.Model,
			"cached":  true,
		})
		return
	}

	aiCtx, cancel := context.WithTimeout(c.Request.Context(), lifeTraceTodayAdviceDefaultTimeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-today-advice", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceCatalogJSON(aiCtx, invocation, prompt, 260)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
		return
	}

	parsed, err := parseTodayAdviceAIResponse(raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 建议解析失败：" + err.Error()})
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	setCachedTodayAdvice(cacheKey, todayAdviceCacheEntry{
		Response:  parsed,
		Source:    invocation.Provider.Provider,
		Model:     modelName,
		ExpiresAt: time.Now().Add(lifeTraceTodayAdviceCacheTTL),
	})

	success(c, gin.H{
		"summary": parsed.Summary,
		"list":    parsed.Items,
		"source":  invocation.Provider.Provider,
		"model":   modelName,
		"cached":  false,
	})
}

func buildTodayAdviceCacheKey(userID model.Int64String, provider, modelName, prompt string) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		fmt.Sprint(userID),
		provider,
		modelName,
		prompt,
	}, "\x00")))
	return fmt.Sprintf("%x", sum)
}

func getCachedTodayAdvice(key string, now time.Time) (todayAdviceCacheEntry, bool) {
	lifeTraceTodayAdviceCache.RLock()
	entry, ok := lifeTraceTodayAdviceCache.items[key]
	lifeTraceTodayAdviceCache.RUnlock()
	if !ok {
		return todayAdviceCacheEntry{}, false
	}
	if now.After(entry.ExpiresAt) {
		lifeTraceTodayAdviceCache.Lock()
		delete(lifeTraceTodayAdviceCache.items, key)
		lifeTraceTodayAdviceCache.Unlock()
		return todayAdviceCacheEntry{}, false
	}
	return entry, true
}

func setCachedTodayAdvice(key string, entry todayAdviceCacheEntry) {
	lifeTraceTodayAdviceCache.Lock()
	lifeTraceTodayAdviceCache.items[key] = entry
	lifeTraceTodayAdviceCache.Unlock()
}

func clearCachedTodayAdvice() {
	lifeTraceTodayAdviceCache.Lock()
	lifeTraceTodayAdviceCache.items = make(map[string]todayAdviceCacheEntry)
	lifeTraceTodayAdviceCache.Unlock()
}

func buildTodayAdvicePrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
) string {
	planLines := make([]prompts.TodayAdvicePlanLine, 0, len(plans))
	for _, plan := range plans {
		planLines = append(planLines, prompts.TodayAdvicePlanLine{
			Title:     plan.Title,
			Type:      plan.Type,
			TimeLabel: plan.TimeLabel,
		})
	}
	return prompts.BuildTodayAdvicePrompt(prompts.TodayAdviceInput{
		City:          settings.City,
		WorkStart:     settings.WorkStart,
		WorkEnd:       settings.WorkEnd,
		CommuteMethod: settings.CommuteMethod,
		Weather: prompts.TodayAdviceWeather{
			Text:       weather.Now.Text,
			High:       weather.Now.High,
			Low:        weather.Now.Low,
			FeelsLike:  weather.Now.FeelsLike,
			Humidity:   weather.Now.Humidity,
			WindScale:  weather.Now.WindScale,
			Precip:     weather.Now.Precip,
			UVIndex:    weather.Now.UVIndex,
			AirQuality: weather.Now.AirQuality,
		},
		Plans: planLines,
	})
}

func parseTodayAdviceAIResponse(raw string) (todayAdviceAIResponse, error) {
	return prompts.ParseTodayAdviceOutput(raw)
}
