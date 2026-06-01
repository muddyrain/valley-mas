package lifetrace

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/database"
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

func TestGenerateWeeklyReviewRequiresAIConfig(t *testing.T) {
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")

	router := setupTraceTestRouter(t, 101)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/weekly-review", bytes.NewBufferString(`{}`))
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

func TestAnalyzeImageRequiresAIConfig(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_TEXT_MODEL", "")
	t.Setenv("ARK_VISION_MODEL", "")

	router := setupTraceTestRouter(t, 101)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/image-analysis", bytes.NewBufferString(`{"imageUrl":"https://example.com/dinner.jpg","kind":"美食照片"}`))
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

func TestStreamAssistantOpenAIUsesLifeContext(t *testing.T) {
	var captured lifeTraceOpenAIRequest
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode OpenAI stream request: %v", err)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"model\":\"gpt-test\",\"choices\":[{\"delta\":{\"content\":\"已记下，\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: {\"model\":\"gpt-test\",\"choices\":[{\"delta\":{\"content\":\"建议 18:30 提醒你预约取车。\"},\"finish_reason\":\"stop\"}]}\n\n"))
	}))
	defer openAIServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", openAIServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-test")

	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:        101,
		City:          "上海",
		CommuteMethod: "开车",
		Habits:        model.StringList{"喝水", "休息"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:        101,
		Title:         "晚上跑步",
		Type:          "运动",
		TimeLabel:     "今天 20:00",
		ScheduledDate: "2026-05-29",
		ScheduledTime: "20:00",
		Timezone:      "Asia/Shanghai",
		Reminder:      true,
		Source:        "manual",
	}).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", bytes.NewBufferString(`{
		"message": "晚上记得提醒我预约取车",
		"history": [{"role":"assistant","content":"可以，我会帮你安排到计划里。"}]
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Header().Get("Content-Type"), "text/event-stream") {
		t.Fatalf("expected SSE content type, got %s", resp.Header().Get("Content-Type"))
	}
	if !strings.Contains(resp.Body.String(), "建议 18:30 提醒你预约取车") {
		t.Fatalf("expected streamed assistant content, got %s", resp.Body.String())
	}
	if len(captured.Messages) != 2 {
		t.Fatalf("expected system and user prompt, got %+v", captured.Messages)
	}
	userPrompt := captured.Messages[1].Content
	for _, want := range []string{"晚上记得提醒我预约取车", "晚上跑步", "提醒：true", "生活助理：可以，我会帮你安排到计划里。"} {
		if !strings.Contains(userPrompt, want) {
			t.Fatalf("expected assistant prompt to contain %q, got %s", want, userPrompt)
		}
	}
}

func TestParseImageAnalysisAIResponseNormalizesFields(t *testing.T) {
	parsed, err := parseImageAnalysisAIResponse(`结果如下：
{"title":"  周五晚餐  ","summary":"这是一张适合安排一次放松晚餐的照片，画面重点是食物和聚餐氛围。","planType":"旅行","mood":"","tags":["美食","","美食","晚餐","朋友","夜晚"],"schedule":{"dateOption":"周一","time":"25:00"}}
`, "美食照片")
	if err != nil {
		t.Fatalf("parse image analysis: %v", err)
	}

	if parsed.Title != "周五晚餐" {
		t.Fatalf("unexpected title: %s", parsed.Title)
	}
	if parsed.PlanType != "吃饭" {
		t.Fatalf("expected fallback plan type, got %s", parsed.PlanType)
	}
	if parsed.Mood == "" {
		t.Fatalf("expected fallback mood")
	}
	if len(parsed.Tags) != 4 || parsed.Tags[0] != "美食" || parsed.Tags[1] != "晚餐" {
		t.Fatalf("unexpected normalized tags: %+v", parsed.Tags)
	}
	if parsed.Schedule.DateOption != "周五" || parsed.Schedule.Time != "19:30" {
		t.Fatalf("unexpected fallback schedule: %+v", parsed.Schedule)
	}
}

func TestGenerateWeeklyReviewUsesCloudLifeContext(t *testing.T) {
	var capturedPrompt string
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req lifeTraceOpenAIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode OpenAI request: %v", err)
		}
		if len(req.Messages) < 2 {
			t.Fatalf("expected system and user messages, got %+v", req.Messages)
		}
		capturedPrompt = req.Messages[1].Content
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"model": "gpt-test",
			"choices": [{
				"message": {
					"role": "assistant",
					"content": "{\"summary\":\"这周完成了电影和运动，节奏比上周稳定。\",\"wins\":[\"完成两项计划\"],\"delays\":[\"周末阅读还没开始\"],\"insights\":[\"晚上更适合轻量安排\"],\"nextActions\":[\"下周先安排一次阅读\"]}"
				}
			}]
		}`))
	}))
	defer openAIServer.Close()

	t.Setenv("OPENAI_API_KEY", "test-openai-key")
	t.Setenv("OPENAI_API_BASE_URL", openAIServer.URL)
	t.Setenv("OPENAI_API_MODEL", "gpt-test")

	router := setupTraceTestRouter(t, 101)
	now := time.Now()
	completedAt := now
	if err := database.GetDB().Create(&model.LifeTraceSettings{
		UserID:        101,
		City:          "上海",
		CommuteMethod: "地铁",
		Habits:        model.StringList{"喝水", "阅读"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:      101,
		Title:       "周五看电影",
		Type:        "电影",
		TimeLabel:   "周五 晚上",
		Completed:   true,
		CompletedAt: &completedAt,
	}).Error; err != nil {
		t.Fatalf("seed completed plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:    101,
		Title:     "周末阅读",
		Type:      "阅读",
		TimeLabel: "周日 下午",
	}).Error; err != nil {
		t.Fatalf("seed open plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceTrace{
		UserID:    101,
		Title:     "电影散场后散步",
		Summary:   "散步二十分钟，状态更放松。",
		TimeLabel: "昨天",
		Mood:      "放松",
		Source:    "计划",
		Tags:      model.StringList{"电影", "计划完成"},
	}).Error; err != nil {
		t.Fatalf("seed trace: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceCheckin{
		UserID:    101,
		Date:      now.Format("2006-01-02"),
		Name:      "喝水",
		Completed: true,
	}).Error; err != nil {
		t.Fatalf("seed checkin: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/weekly-review", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["summary"] != "这周完成了电影和运动，节奏比上周稳定。" {
		t.Fatalf("unexpected weekly review: %+v", data)
	}
	if data["source"] != "openai" || data["model"] != "gpt-test" {
		t.Fatalf("expected AI source and model, got %+v", data)
	}
	if data["id"] == "" || data["weekStart"] == "" || data["weekEnd"] == "" {
		t.Fatalf("expected persisted weekly review identity fields, got %+v", data)
	}
	for _, want := range []string{"周五看电影", "周末阅读", "电影散场后散步", "喝水：已完成"} {
		if !strings.Contains(capturedPrompt, want) {
			t.Fatalf("expected weekly prompt to contain %q, got %s", want, capturedPrompt)
		}
	}

	var count int64
	if err := database.GetDB().Model(&model.LifeTraceWeeklyReview{}).
		Where("user_id = ? AND summary = ?", model.Int64String(101), "这周完成了电影和运动，节奏比上周稳定。").
		Count(&count).Error; err != nil {
		t.Fatalf("count weekly reviews: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected weekly review to be persisted once, got %d", count)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/weekly-reviews", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	if listResp.Code != http.StatusOK {
		t.Fatalf("expected weekly review list 200, got %d: %s", listResp.Code, listResp.Body.String())
	}
	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected one persisted weekly review, got %+v", list)
	}
	if list[0].(map[string]interface{})["summary"] != "这周完成了电影和运动，节奏比上周稳定。" {
		t.Fatalf("unexpected persisted review list: %+v", list)
	}
}

func TestCurrentWeeklyReviewRangeUsesNaturalWeek(t *testing.T) {
	loc := time.FixedZone("test", 8*60*60)
	now := time.Date(2026, 5, 28, 21, 30, 0, 0, loc)

	weekStart, weekEnd := currentWeeklyReviewRange(now)

	if got := weekStart.Format("2006-01-02 15:04"); got != "2026-05-25 00:00" {
		t.Fatalf("expected Monday week start, got %s", got)
	}
	if !weekEnd.Equal(now) {
		t.Fatalf("expected week end to be current time, got %s", weekEnd)
	}
}

func TestSaveWeeklyReviewUpdatesExistingNaturalWeek(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	loc := time.FixedZone("test", 8*60*60)
	weekStart, firstEnd := currentWeeklyReviewRange(time.Date(2026, 5, 28, 21, 30, 0, 0, loc))
	_, secondEnd := currentWeeklyReviewRange(time.Date(2026, 5, 29, 8, 0, 0, 0, loc))

	first, err := saveWeeklyReview(101, weekStart, firstEnd, weeklyReviewAIResponse{
		Summary:     "第一次周报",
		Wins:        []string{"完成计划"},
		Delays:      []string{"暂无明显延迟事项"},
		Insights:    []string{"晚上节奏更稳"},
		NextActions: []string{"下周先安排阅读"},
	}, "openai", "gpt-test")
	if err != nil {
		t.Fatalf("save first weekly review: %v", err)
	}

	second, err := saveWeeklyReview(101, weekStart, secondEnd, weeklyReviewAIResponse{
		Summary:     "第二次周报",
		Wins:        []string{"完成运动"},
		Delays:      []string{"阅读还没开始"},
		Insights:    []string{"早上更适合整理"},
		NextActions: []string{"下周先安排运动"},
	}, "openai", "gpt-test")
	if err != nil {
		t.Fatalf("save second weekly review: %v", err)
	}

	if first.ID != second.ID {
		t.Fatalf("expected same weekly review to be updated, got %s and %s", first.ID, second.ID)
	}
	if second.Summary != "第二次周报" {
		t.Fatalf("expected review to be updated, got %+v", second)
	}

	var count int64
	if err := database.GetDB().Model(&model.LifeTraceWeeklyReview{}).
		Where("user_id = ? AND week_start = ?", model.Int64String(101), weekStart.Format("2006-01-02")).
		Count(&count).Error; err != nil {
		t.Fatalf("count weekly reviews: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one weekly review for natural week, got %d", count)
	}
}

func TestDeleteWeeklyReviewOnlyDeletesCurrentUserReview(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	weekStart := time.Date(2026, 5, 25, 0, 0, 0, 0, time.Local)
	weekEnd := time.Date(2026, 5, 28, 21, 30, 0, 0, time.Local)
	currentUserReview, err := saveWeeklyReview(101, weekStart, weekEnd, weeklyReviewAIResponse{
		Summary:     "当前用户周报",
		Wins:        []string{"完成计划"},
		Delays:      []string{"暂无明显延迟事项"},
		Insights:    []string{"节奏稳定"},
		NextActions: []string{"下周继续"},
	}, "openai", "gpt-test")
	if err != nil {
		t.Fatalf("seed current user weekly review: %v", err)
	}
	otherUserReview, err := saveWeeklyReview(202, weekStart, weekEnd, weeklyReviewAIResponse{
		Summary:     "其他用户周报",
		Wins:        []string{"完成计划"},
		Delays:      []string{"暂无明显延迟事项"},
		Insights:    []string{"节奏稳定"},
		NextActions: []string{"下周继续"},
	}, "openai", "gpt-test")
	if err != nil {
		t.Fatalf("seed other user weekly review: %v", err)
	}

	otherReq := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/weekly-reviews/"+otherUserReview.ID.String(), nil)
	otherResp := httptest.NewRecorder()
	router.ServeHTTP(otherResp, otherReq)
	if otherResp.Code != http.StatusOK || !strings.Contains(otherResp.Body.String(), "周报不存在") {
		t.Fatalf("expected current user not to delete other user review, got %d: %s", otherResp.Code, otherResp.Body.String())
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/life-trace/weekly-reviews/"+currentUserReview.ID.String(), nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["id"] != currentUserReview.ID.String() {
		t.Fatalf("unexpected delete payload: %+v", data)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/weekly-reviews", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	list := decodeTracePayload(t, listResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(list) != 0 {
		t.Fatalf("expected deleted weekly review to disappear from current user list, got %+v", list)
	}
}

func TestWeeklyReviewSaveErrorMessageExplainsMissingTable(t *testing.T) {
	message := weeklyReviewSaveErrorMessage(errors.New(`ERROR: relation "life_trace_weekly_reviews" does not exist (SQLSTATE 42P01)`))

	if !strings.Contains(message, "air db=true") || !strings.Contains(message, "029") {
		t.Fatalf("expected actionable missing table message, got %s", message)
	}
}

func TestParseWeeklyReviewAIResponseNormalizesSections(t *testing.T) {
	raw := `{
		"summary": "本周节奏稳定，完成了主要生活计划。",
		"wins": ["完成电影计划", "保持喝水打卡"],
		"delays": ["阅读计划还没开始"],
		"insights": ["晚上适合安排轻量任务"],
		"nextActions": ["下周先安排阅读", "保留一个空白晚上"]
	}`

	parsed, err := parseWeeklyReviewAIResponse(raw)
	if err != nil {
		t.Fatalf("parse weekly review: %v", err)
	}

	if parsed.Summary == "" {
		t.Fatalf("expected summary")
	}
	if len(parsed.Wins) != 2 || len(parsed.Delays) != 1 || len(parsed.Insights) != 1 || len(parsed.NextActions) != 2 {
		t.Fatalf("unexpected normalized review: %+v", parsed)
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

func TestBuildLifeTraceAssistantPlanDraftInfersSchedule(t *testing.T) {
	location, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 5, 29, 10, 0, 0, 0, location)

	meal := buildLifeTraceAssistantPlanDraft("明天中午吃饭", now)
	if meal == nil {
		t.Fatal("expected meal plan draft")
	}
	if meal.Title != "吃饭" || meal.Type != "吃饭" {
		t.Fatalf("expected meal title and type, got %+v", meal)
	}
	if meal.ScheduledDate != "2026-05-30" || meal.ScheduledTime != "12:00" {
		t.Fatalf("expected tomorrow noon schedule, got %+v", meal)
	}

	reminder := buildLifeTraceAssistantPlanDraft("晚上记得提醒我预约取车", now)
	if reminder == nil {
		t.Fatal("expected reminder plan draft")
	}
	if reminder.Title != "预约取车" || reminder.Type != "普通事项" {
		t.Fatalf("expected reminder title and type, got %+v", reminder)
	}
	if reminder.ScheduledDate != "2026-05-29" || reminder.ScheduledTime != "19:30" {
		t.Fatalf("expected tonight schedule, got %+v", reminder)
	}
	if reminder.NotePrefix != "来自生活助理提醒" {
		t.Fatalf("expected reminder note prefix, got %+v", reminder)
	}
}

func TestCreateAssistantPlanFromDraftCreatesAndDedupes(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	var handler Handler
	draft := lifeTraceAssistantPlanDraft{
		Title:         "预约取车",
		Type:          "普通事项",
		ScheduledDate: "2026-05-29",
		ScheduledTime: "19:30",
		Timezone:      "Asia/Shanghai",
		NotePrefix:    "来自生活助理提醒",
	}

	created := handler.createAssistantPlanFromDraft(101, draft)
	if created == nil || created.Status != "created" || created.Plan == nil {
		t.Fatalf("expected created plan payload, got %+v", created)
	}
	if created.Plan.Source != "ai_advice" || !created.Plan.Reminder {
		t.Fatalf("expected AI advice plan with reminder, got %+v", created.Plan)
	}
	if strings.Contains(created.Plan.Note, "#assistant-plan") {
		t.Fatalf("expected internal marker to be stripped, got %q", created.Plan.Note)
	}

	exists := handler.createAssistantPlanFromDraft(101, draft)
	if exists == nil || exists.Status != "exists" || exists.Plan == nil {
		t.Fatalf("expected duplicate detection, got %+v", exists)
	}

	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePlan{}).
		Where("user_id = ? AND title = ?", model.Int64String(101), "预约取车").
		Count(&count).Error; err != nil {
		t.Fatalf("count plans: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one plan after duplicate create, got %d", count)
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
