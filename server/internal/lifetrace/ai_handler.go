package lifetrace

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type lifeTraceAIAdvice struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	Tone   string `json:"tone"`
}

type todayAdviceAIResponse struct {
	Summary string              `json:"summary"`
	Items   []lifeTraceAIAdvice `json:"items"`
}

type lifeTraceAIConfig struct {
	Source  string
	APIKey  string
	BaseURL string
	Model   string
	Timeout time.Duration
}

var (
	lifeTraceArkClientOnce sync.Once
	lifeTraceArkClient     *arkruntime.Client
)

const lifeTraceTodayAdviceDefaultTimeout = 30 * time.Second
const lifeTraceTodayAdviceCacheTTL = 10 * time.Minute

type todayAdviceCacheEntry struct {
	Response  todayAdviceAIResponse
	Source    string
	Model     string
	ExpiresAt time.Time
}

var lifeTraceTodayAdviceCache = struct {
	sync.RWMutex
	items map[string]todayAdviceCacheEntry
}{
	items: make(map[string]todayAdviceCacheEntry),
}

var adviceDefaults = map[string]lifeTraceAIAdvice{
	"wear":    {ID: "wear", Title: "穿衣", Detail: "根据温度和天气调整穿搭", Tone: "plan"},
	"skin":    {ID: "skin", Title: "护肤", Detail: "根据紫外线和湿度调整护肤", Tone: "health"},
	"out":     {ID: "out", Title: "出门", Detail: "出门前检查天气和随身物品", Tone: "weather"},
	"commute": {ID: "commute", Title: "通勤", Detail: "按通勤方式预留缓冲时间", Tone: "ai"},
	"health":  {ID: "health", Title: "健康", Detail: "结合天气安排轻运动和休息", Tone: "trace"},
	"plan":    {ID: "plan", Title: "今日计划", Detail: "优先完成一个轻量计划", Tone: "alert"},
}

var adviceOrder = []string{"wear", "skin", "out", "commute", "health", "plan"}

var validAdviceTones = map[string]bool{
	"weather": true,
	"ai":      true,
	"plan":    true,
	"trace":   true,
	"health":  true,
	"alert":   true,
}

func (h *Handler) GenerateTodayAdvice(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
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

	today := time.Now().Format("2006-01-02")
	var checkins []model.LifeTraceCheckin
	if err := database.GetDB().
		Where("user_id = ? AND date = ?", userID, today).
		Order("created_at ASC").
		Find(&checkins).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取打卡失败"})
		return
	}

	weather := h.weather.Fetch(c.Request.Context(), settings.City, false)
	prompt := buildTodayAdvicePrompt(settings, weather, plans, checkins)
	cacheKey := buildTodayAdviceCacheKey(userID, aiCfg, prompt)
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

	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	defer cancel()

	raw, modelName, err := callLifeTraceAI(aiCtx, aiCfg, prompt)
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
		modelName = aiCfg.Model
	}
	setCachedTodayAdvice(cacheKey, todayAdviceCacheEntry{
		Response:  parsed,
		Source:    aiCfg.Source,
		Model:     modelName,
		ExpiresAt: time.Now().Add(lifeTraceTodayAdviceCacheTTL),
	})

	success(c, gin.H{
		"summary": parsed.Summary,
		"list":    parsed.Items,
		"source":  aiCfg.Source,
		"model":   modelName,
		"cached":  false,
	})
}

func readLifeTraceAIConfig() (lifeTraceAIConfig, string) {
	if cfg, ok := readLifeTraceOpenAIConfig(); ok {
		return cfg, ""
	}

	apiKey, arkBaseURL, textModel, errMsg := readLifeTraceArkTextConfig()
	if errMsg != "" {
		return lifeTraceAIConfig{}, errMsg
	}
	return lifeTraceAIConfig{
		Source:  "ark",
		APIKey:  apiKey,
		BaseURL: arkBaseURL,
		Model:   textModel,
		Timeout: lifeTraceTodayAdviceDefaultTimeout,
	}, ""
}

func readLifeTraceOpenAIConfig() (lifeTraceAIConfig, bool) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return lifeTraceAIConfig{}, false
	}

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OPENAI_API_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	model := strings.TrimSpace(os.Getenv("OPENAI_API_MODEL"))
	if model == "" {
		model = "gpt-5.4"
	}

	return lifeTraceAIConfig{
		Source:  "openai",
		APIKey:  apiKey,
		BaseURL: baseURL,
		Model:   model,
		Timeout: parseLifeTraceOpenAITimeout(os.Getenv("OPENAI_API_TIMEOUT")),
	}, true
}

func readLifeTraceArkTextConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return "", "", "", "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return apiKey, arkBaseURL, textModel, ""
}

func parseLifeTraceOpenAITimeout(raw string) time.Duration {
	value := strings.TrimSpace(raw)
	if value == "" {
		return lifeTraceTodayAdviceDefaultTimeout
	}

	seconds, err := strconv.Atoi(value)
	if err != nil || seconds <= 0 {
		return lifeTraceTodayAdviceDefaultTimeout
	}
	return time.Duration(seconds) * time.Second
}

func buildTodayAdviceCacheKey(userID model.Int64String, cfg lifeTraceAIConfig, prompt string) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		fmt.Sprint(userID),
		cfg.Source,
		cfg.Model,
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

func ensureLifeTraceArkClient(apiKey, arkBaseURL string) *arkruntime.Client {
	lifeTraceArkClientOnce.Do(func() {
		lifeTraceArkClient = arkruntime.NewClientWithApiKey(
			apiKey,
			arkruntime.WithBaseUrl(arkBaseURL),
			arkruntime.WithTimeout(35*time.Second),
		)
	})
	return lifeTraceArkClient
}

func buildTodayAdvicePrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	checkins []model.LifeTraceCheckin,
) string {
	planLines := make([]string, 0, len(plans))
	for _, plan := range plans {
		planLines = append(planLines, fmt.Sprintf("- %s｜%s｜%s", plan.Title, plan.Type, plan.TimeLabel))
	}
	if len(planLines) == 0 {
		planLines = append(planLines, "- 暂无待完成计划")
	}

	checkinLines := buildTodayCheckinPromptLines(settings.Habits, checkins)

	return strings.Join([]string{
		"你是 Life Trace 的生活计划 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"summary\":\"一句今日总建议，32字以内\",\"items\":[{\"id\":\"wear\",\"detail\":\"16字以内建议\"}]}",
		"items 必须严格包含 6 项，id 顺序固定为 wear, skin, out, commute, health, plan。",
		"不要输出 title 和 tone，服务端会自动补齐。",
		"建议要结合天气、通勤、工作时间、习惯、今日打卡和未完成计划，使用简体中文，短促可执行。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s；习惯：%s。", settings.City, settings.WorkStart, settings.WorkEnd, settings.CommuteMethod, strings.Join(settings.Habits, "、")),
		"",
		"今日天气：",
		fmt.Sprintf("天气：%s；气温：%s/%s；体感：%s；湿度：%s；风力：%s；降水：%s；紫外线：%s；空气：%s。", weather.Now.Text, weather.Now.High, weather.Now.Low, weather.Now.FeelsLike, weather.Now.Humidity, weather.Now.WindScale, weather.Now.Precip, weather.Now.UVIndex, weather.Now.AirQuality),
		"",
		"今日打卡：",
		strings.Join(checkinLines, "\n"),
		"",
		"未完成计划：",
		strings.Join(planLines, "\n"),
	}, "\n")
}

func buildTodayCheckinPromptLines(habits []string, checkins []model.LifeTraceCheckin) []string {
	checkedByName := make(map[string]bool, len(checkins))
	for _, checkin := range checkins {
		name := strings.TrimSpace(checkin.Name)
		if name == "" {
			continue
		}
		checkedByName[name] = checkin.Completed
	}

	seen := map[string]bool{}
	lines := make([]string, 0, len(habits))
	for _, habit := range habits {
		habit = strings.TrimSpace(habit)
		if habit == "" || seen[habit] {
			continue
		}
		seen[habit] = true
		status := "未完成"
		if checkedByName[habit] {
			status = "已完成"
		}
		lines = append(lines, fmt.Sprintf("- %s：%s", habit, status))
	}

	if len(lines) == 0 {
		lines = append(lines, "- 暂无打卡项")
	}
	return lines
}

func callLifeTraceTextAI(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
) (string, string, error) {
	maxTokens := 260
	temperature := float32(0.35)
	content := strings.TrimSpace(prompt)
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &content,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", resp.Model, errors.New("empty AI response")
	}

	raw := ""
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw = *contentValue.StringValue
	} else {
		parts := make([]string, 0, len(contentValue.ListValue))
		for _, part := range contentValue.ListValue {
			if part != nil && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		raw = strings.Join(parts, "\n")
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", resp.Model, errors.New("empty AI content")
	}
	return raw, resp.Model, nil
}

func callLifeTraceAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	if cfg.Source == "openai" {
		return callLifeTraceOpenAI(ctx, cfg, prompt)
	}

	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	return callLifeTraceTextAI(ctx, client, cfg.Model, prompt)
}

type lifeTraceOpenAIRequest struct {
	Model          string                   `json:"model"`
	Messages       []lifeTraceOpenAIMessage `json:"messages"`
	Temperature    float64                  `json:"temperature,omitempty"`
	MaxTokens      int                      `json:"max_tokens,omitempty"`
	ResponseFormat *lifeTraceResponseFormat `json:"response_format,omitempty"`
}

type lifeTraceOpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type lifeTraceResponseFormat struct {
	Type string `json:"type"`
}

type lifeTraceOpenAIResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message lifeTraceOpenAIMessage `json:"message"`
	} `json:"choices"`
}

func callLifeTraceOpenAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{
				Role:    "system",
				Content: "你是 Life Trace 的生活计划 AI。只输出 JSON 对象，不要 Markdown，不要解释。",
			},
			{Role: "user", Content: prompt},
		},
		Temperature: 0.35,
		MaxTokens:   260,
		ResponseFormat: &lifeTraceResponseFormat{
			Type: "json_object",
		},
	})
	if err != nil {
		return "", "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", "", fmt.Errorf("decode OpenAI response failed: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", parsed.Model, errors.New("OpenAI upstream returned no choices")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return "", parsed.Model, errors.New("OpenAI upstream returned empty content")
	}
	return content, parsed.Model, nil
}

func parseTodayAdviceAIResponse(raw string) (todayAdviceAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return todayAdviceAIResponse{}, errors.New("missing JSON object")
	}

	var parsed todayAdviceAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return todayAdviceAIResponse{}, err
	}

	parsed.Summary = trimRunes(parsed.Summary, 40)
	if parsed.Summary == "" {
		parsed.Summary = "今天优先完成一件轻量计划。"
	}

	normalized, err := normalizeTodayAdviceItems(parsed.Items)
	if err != nil {
		return todayAdviceAIResponse{}, err
	}
	parsed.Items = normalized
	return parsed, nil
}

func normalizeTodayAdviceItems(items []lifeTraceAIAdvice) ([]lifeTraceAIAdvice, error) {
	byID := make(map[string]lifeTraceAIAdvice, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.ID)
		if _, ok := adviceDefaults[id]; !ok {
			continue
		}

		def := adviceDefaults[id]
		item.ID = id
		item.Title = def.Title
		item.Detail = trimRunes(item.Detail, 24)
		if item.Detail == "" {
			item.Detail = def.Detail
		}
		item.Tone = strings.TrimSpace(item.Tone)
		if !validAdviceTones[item.Tone] {
			item.Tone = def.Tone
		}
		byID[id] = item
	}

	if len(byID) == 0 {
		return nil, errors.New("empty advice items")
	}

	result := make([]lifeTraceAIAdvice, 0, len(adviceOrder))
	for _, id := range adviceOrder {
		item, ok := byID[id]
		if !ok {
			item = adviceDefaults[id]
		}
		result = append(result, item)
	}
	return result, nil
}

func trimRunes(text string, max int) string {
	text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
	if max <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max])
}
