package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/model"
)

func TestGenerateTodayAdviceRequiresAIConfig(t *testing.T) {
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/today-advice", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), "ARK_API_KEY") {
		t.Fatalf("expected config message, got %s", resp.Body.String())
	}
}

func TestParseTodayAdviceAIResponseNormalizesItems(t *testing.T) {
	raw := `{
		"summary": "今天先处理通勤和一件轻量计划。",
		"items": [
			{"id": "commute", "title": "随便", "detail": "地铁通勤提前十分钟", "tone": "bad"},
			{"id": "plan", "title": "今日计划", "detail": "先做最轻的一件", "tone": "alert"}
		]
	}`

	parsed, err := parseTodayAdviceAIResponse(raw)
	if err != nil {
		t.Fatalf("parse response: %v", err)
	}

	if parsed.Summary == "" {
		t.Fatalf("expected summary")
	}
	if len(parsed.Items) != 6 {
		t.Fatalf("expected 6 normalized items, got %+v", parsed.Items)
	}
	if parsed.Items[3].ID != "commute" || parsed.Items[3].Title != "通勤" {
		t.Fatalf("expected commute item in fixed order, got %+v", parsed.Items[3])
	}
	if parsed.Items[3].Tone != "ai" {
		t.Fatalf("expected invalid tone to fall back, got %+v", parsed.Items[3])
	}
	if parsed.Items[5].Detail != "先做最轻的一件" {
		t.Fatalf("expected generated plan detail, got %+v", parsed.Items[5])
	}
}

func TestParseTodayAdviceAIResponseAcceptsSlimItems(t *testing.T) {
	raw := `{
		"summary": "今天先安排通勤和补水。",
		"items": [
			{"id": "wear", "detail": "外套轻薄即可"},
			{"id": "skin", "detail": "午间注意补水"}
		]
	}`

	parsed, err := parseTodayAdviceAIResponse(raw)
	if err != nil {
		t.Fatalf("parse response: %v", err)
	}

	if len(parsed.Items) != 6 {
		t.Fatalf("expected 6 normalized items, got %+v", parsed.Items)
	}
	if parsed.Items[0].Title != "穿衣" || parsed.Items[0].Tone != "plan" {
		t.Fatalf("expected server-filled title and tone, got %+v", parsed.Items[0])
	}
	if parsed.Items[1].Detail != "午间注意补水" {
		t.Fatalf("expected slim detail to be kept, got %+v", parsed.Items[1])
	}
}

func TestReadLifeTraceArkTextConfigValidatesModel(t *testing.T) {
	t.Setenv("ARK_API_KEY", "test-key")
	t.Setenv("ARK_TEXT_MODEL", "not-endpoint")

	_, _, _, errMsg := readLifeTraceArkTextConfig()

	if !strings.Contains(errMsg, "ARK_TEXT_MODEL") {
		t.Fatalf("expected model validation error, got %q", errMsg)
	}
}

func TestBuildTodayAdvicePromptAsksForSlimItems(t *testing.T) {
	prompt := buildTodayAdvicePrompt(model.LifeTraceSettings{
		City:          "上海",
		WorkStart:     "09:30",
		WorkEnd:       "18:30",
		CommuteMethod: "地铁",
		Habits:        []string{"喝水"},
	}, WeatherResponse{}, nil, nil)

	if !strings.Contains(prompt, `"items":[{"id":"wear","detail"`) {
		t.Fatalf("expected slim item schema, got %s", prompt)
	}
	if !strings.Contains(prompt, "不要输出 title 和 tone") {
		t.Fatalf("expected prompt to keep title and tone server-side, got %s", prompt)
	}
}

func TestBuildTodayAdvicePromptIncludesCheckins(t *testing.T) {
	prompt := buildTodayAdvicePrompt(model.LifeTraceSettings{
		City:          "上海",
		WorkStart:     "09:30",
		WorkEnd:       "18:30",
		CommuteMethod: "开车",
		Habits:        []string{"喝水", "运动"},
	}, WeatherResponse{}, nil, []model.LifeTraceCheckin{
		{Name: "喝水", Completed: true},
	})

	if !strings.Contains(prompt, "今日打卡") {
		t.Fatalf("expected checkin section, got %s", prompt)
	}
	if !strings.Contains(prompt, "喝水：已完成") || !strings.Contains(prompt, "运动：未完成") {
		t.Fatalf("expected checkin status lines, got %s", prompt)
	}
}

func TestBuildLifeTraceAssistantPromptKeepsLifeContext(t *testing.T) {
	prompt := buildLifeTraceAssistantPrompt(
		model.LifeTraceSettings{
			City:          "上海",
			WorkStart:     "09:30",
			WorkEnd:       "18:30",
			CommuteMethod: "开车",
			Habits:        []string{"喝水", "休息"},
		},
		WeatherResponse{
			Now: WeatherNow{Text: "多云", High: "28", Low: "21", FeelsLike: "26"},
		},
		[]model.LifeTracePlan{{Title: "看电影", Type: "电影", TimeLabel: "周六 晚上", Reminder: true}},
		[]model.LifeTraceCheckin{{Name: "喝水", Completed: true}},
		[]model.LifeTraceTrace{{Title: "吃了牛肉饭", Mood: "满足", TimeLabel: "昨天"}},
		lifeTraceAssistantRequest{
			Message: "帮我安排今天下班后",
			History: []lifeTraceAssistantMessage{
				{Role: "user", Content: "我今天有点累"},
				{Role: "assistant", Content: "晚上安排轻一点"},
			},
		},
	)

	for _, want := range []string{"Life Trace 生活上下文", "今日天气", "未完成计划", "最近生活踪迹", "用户当前请求", "帮我安排今天下班后"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got %s", want, prompt)
		}
	}
	if !strings.Contains(prompt, "喝水：已完成") {
		t.Fatalf("expected checkin status in prompt, got %s", prompt)
	}
}

func TestBuildLifeTraceAssistantPromptHandlesReminderBriefly(t *testing.T) {
	prompt := buildLifeTraceAssistantPrompt(
		model.LifeTraceSettings{City: "杭州", CommuteMethod: "开车"},
		WeatherResponse{},
		nil,
		nil,
		nil,
		lifeTraceAssistantRequest{Message: "晚上提醒我记得预约取车"},
	)

	for _, want := range []string{"提醒/记事", "60 字以内", "晚上提醒我记得预约取车"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to contain %q, got %s", want, prompt)
		}
	}
}

func TestLifeTraceAssistantSystemPromptIsNotGenericChat(t *testing.T) {
	prompt := lifeTraceAssistantSystemPrompt()

	if !strings.Contains(prompt, "生活助理") || !strings.Contains(prompt, "不是通用聊天 AI") {
		t.Fatalf("expected assistant identity guard, got %s", prompt)
	}
	if !strings.Contains(prompt, "提醒我") || !strings.Contains(prompt, "不要把所有天气、打卡、习惯都复述") {
		t.Fatalf("expected reminder and brevity guard, got %s", prompt)
	}
}

func TestReadLifeTraceAIConfigPrefersOpenAIEnv(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", "https://api.openai.com/v1/")
	t.Setenv("OPENAI_API_TIMEOUT", "5")
	t.Setenv("OPENAI_API_MODEL", "")
	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_TEXT_MODEL", "ep-test")

	cfg, errMsg := readLifeTraceAIConfig()

	if errMsg != "" {
		t.Fatalf("expected valid config, got %q", errMsg)
	}
	if cfg.Source != "openai" {
		t.Fatalf("expected openai provider, got %+v", cfg)
	}
	if cfg.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("expected normalized base url, got %q", cfg.BaseURL)
	}
	if cfg.Model != "gpt-5.4" {
		t.Fatalf("expected default OpenAI model, got %q", cfg.Model)
	}
	if cfg.Timeout != 5_000_000_000 {
		t.Fatalf("expected OPENAI_API_TIMEOUT to be used, got %v", cfg.Timeout)
	}
}

func TestTodayAdviceDefaultTimeoutAllowsSlowModels(t *testing.T) {
	if lifeTraceTodayAdviceDefaultTimeout < 30_000_000_000 {
		t.Fatalf("today advice timeout should allow slow models, got %v", lifeTraceTodayAdviceDefaultTimeout)
	}
}

func TestTodayAdviceCacheReturnsFreshEntry(t *testing.T) {
	clearCachedTodayAdvice()
	t.Cleanup(clearCachedTodayAdvice)

	key := "cache-key"
	setCachedTodayAdvice(key, todayAdviceCacheEntry{
		Response: todayAdviceAIResponse{
			Summary: "今天先处理一个轻量计划。",
			Items: []lifeTraceAIAdvice{
				{ID: "plan", Title: "今日计划", Detail: "先做最轻的一件", Tone: "alert"},
			},
		},
		Source:    "openai",
		Model:     "gpt-5.4",
		ExpiresAt: time.Now().Add(time.Minute),
	})

	cached, ok := getCachedTodayAdvice(key, time.Now())
	if !ok {
		t.Fatalf("expected fresh cache entry")
	}
	if cached.Response.Summary == "" || cached.Model != "gpt-5.4" {
		t.Fatalf("unexpected cached response: %+v", cached)
	}
}

func TestTodayAdviceCacheDropsExpiredEntry(t *testing.T) {
	clearCachedTodayAdvice()
	t.Cleanup(clearCachedTodayAdvice)

	key := "expired-key"
	setCachedTodayAdvice(key, todayAdviceCacheEntry{
		Response:  todayAdviceAIResponse{Summary: "过期建议"},
		Source:    "openai",
		Model:     "gpt-5.4",
		ExpiresAt: time.Now().Add(-time.Minute),
	})

	if _, ok := getCachedTodayAdvice(key, time.Now()); ok {
		t.Fatalf("expected expired cache entry to be ignored")
	}
}

func TestTodayAdviceCacheKeyChangesWithPrompt(t *testing.T) {
	cfg := lifeTraceAIConfig{Source: "openai", Model: "gpt-5.4"}
	first := buildTodayAdviceCacheKey(1, cfg, "城市：上海")
	second := buildTodayAdviceCacheKey(1, cfg, "城市：北京")

	if first == second {
		t.Fatalf("expected different prompts to produce different cache keys")
	}
}
