package lifetrace

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
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

func TestGeneratePantryThumbnailRequiresAIConfig(t *testing.T) {
	t.Setenv("ARK_API_KEY", "")
	t.Setenv("ARK_IMAGE_MODEL", "")

	router := setupTraceTestRouter(t, 101)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/pantry-thumbnail", bytes.NewBufferString(`{"name":"鲜牛奶","category":"食品","location":"冷藏"}`))
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

func TestGeneratePantryThumbnailUsesARKImageModel(t *testing.T) {
	lifeTraceArkClient = nil
	lifeTraceArkClientOnce = sync.Once{}
	originalUpload := uploadGeneratedPantryThumbnailToTOS
	uploadGeneratedPantryThumbnailToTOS = func(
		_ context.Context,
		userID interface{ String() string },
		image generatedPantryThumbnail,
	) (pantryThumbnailUploadResult, error) {
		if userID.String() != "101" {
			t.Fatalf("expected upload userID 101, got %s", userID.String())
		}
		if string(image.Bytes) != "abc" {
			t.Fatalf("expected decoded AI image bytes, got %q", string(image.Bytes))
		}
		if image.MIMEType != "image/jpeg" {
			t.Fatalf("expected jpeg mime type, got %s", image.MIMEType)
		}
		return pantryThumbnailUploadResult{
			URL: "https://example.com/pantry-thumb.jpg",
			Key: "life-trace/101/20260602/pantry-thumb.jpg",
		}, nil
	}
	defer func() {
		uploadGeneratedPantryThumbnailToTOS = originalUpload
	}()

	var captured map[string]any
	imageServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
			t.Fatalf("decode image generation request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"created":1710000000,"data":[{"b64_json":"YWJj"}]}`))
	}))
	defer imageServer.Close()

	t.Setenv("ARK_API_KEY", "test-ark-key")
	t.Setenv("ARK_BASE_URL", imageServer.URL)
	t.Setenv("ARK_IMAGE_MODEL", "ep-image")

	router := setupTraceTestRouter(t, 101)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/pantry-thumbnail", bytes.NewBufferString(`{
		"name":"鲜牛奶",
		"category":"食品",
		"location":"冷藏",
		"note":"早餐优先喝掉"
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	if data["thumbnailUrl"] != "https://example.com/pantry-thumb.jpg" {
		t.Fatalf("expected generated thumbnail url, got %+v", data)
	}
	if data["storageKey"] != "life-trace/101/20260602/pantry-thumb.jpg" {
		t.Fatalf("expected storage key in response, got %+v", data)
	}
	if data["model"] != "ep-image" {
		t.Fatalf("expected image model to round-trip, got %+v", data)
	}
	if captured["model"] != "ep-image" {
		t.Fatalf("expected image generation request to use ep-image, got %+v", captured)
	}
	if captured["size"] != "1280x720" {
		t.Fatalf("expected fast thumbnail size 1280x720, got %+v", captured["size"])
	}
	if !strings.Contains(captured["prompt"].(string), "鲜牛奶") {
		t.Fatalf("expected prompt to mention pantry item, got %+v", captured["prompt"])
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

func TestParsePantryPhotoAnalysisAIResponseNormalizesFields(t *testing.T) {
	parsed, err := parsePantryPhotoAnalysisAIResponse(`商品结果：
{"name":"  鲜牛奶  ","category":"饮料","brand":"示例品牌","spec":"250ml","quantity":0,"unit":"","storageLocation":"冰箱","expiresAt":"not-date","productionDate":"2026-06-01","purchaseDate":"2026-06-04","shelfLifeDays":180,"tags":["冷藏","","冷藏","早餐","牛奶","家庭","补货"],"confidence":1.4,"warnings":["保质期不可见","保质期不可见","请确认规格"],"cropBox":{"x":0.9,"y":-0.2,"width":0.4,"height":1.2},"summary":"适合加入家庭库存。"}
`)
	if err != nil {
		t.Fatalf("parse pantry photo analysis: %v", err)
	}

	if parsed.Name != "鲜牛奶" {
		t.Fatalf("expected trimmed name, got %s", parsed.Name)
	}
	if parsed.Category != "食品" {
		t.Fatalf("expected fallback category, got %s", parsed.Category)
	}
	if parsed.Quantity != 1 || parsed.Unit != "件" {
		t.Fatalf("expected normalized quantity and unit, got %+v", parsed)
	}
	if parsed.StorageLocation != "冷藏" {
		t.Fatalf("expected fallback location, got %s", parsed.StorageLocation)
	}
	if parsed.ExpiresAt != "2026-11-28" || parsed.ProductionDate != "2026-06-01" || parsed.PurchaseDate != "2026-06-04" || parsed.ShelfLifeDays != 180 {
		t.Fatalf("expected normalized dates, got %+v", parsed)
	}
	if parsed.Confidence != 1 {
		t.Fatalf("expected capped confidence, got %v", parsed.Confidence)
	}
	if len(parsed.Tags) != 5 || parsed.Tags[0] != "冷藏" || parsed.Tags[1] != "早餐" {
		t.Fatalf("unexpected normalized tags: %+v", parsed.Tags)
	}
	if len(parsed.Warnings) != 2 {
		t.Fatalf("expected deduped warnings, got %+v", parsed.Warnings)
	}
	if parsed.CropBox.X != 0.6 || parsed.CropBox.Y != 0 || parsed.CropBox.Width != 0.4 || parsed.CropBox.Height != 1 {
		t.Fatalf("expected normalized crop box, got %+v", parsed.CropBox)
	}
}

func TestParsePantryPhotoAnalysisAIResponseWarnsWhenShelfLifeMissingProductionDate(t *testing.T) {
	parsed, err := parsePantryPhotoAnalysisAIResponse(`{
		"name":"饼干",
		"category":"食品",
		"quantity":1,
		"unit":"包",
		"storageLocation":"厨房",
		"shelfLifeDays":90,
		"warnings":[]
	}`)
	if err != nil {
		t.Fatalf("parse pantry photo analysis: %v", err)
	}

	if parsed.ExpiresAt != "" || parsed.ProductionDate != "" || parsed.ShelfLifeDays != 90 {
		t.Fatalf("expected shelf life without calculated expiry, got %+v", parsed)
	}
	if len(parsed.Warnings) != 1 || !strings.Contains(parsed.Warnings[0], "生产日期") {
		t.Fatalf("expected missing production date warning, got %+v", parsed.Warnings)
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

func TestBuildLifeTraceAssistantPantryDraftInfersInventoryFields(t *testing.T) {
	draft := buildLifeTraceAssistantPantryDraft("我这边有2盒酸奶，生产日期是2026-06-01，保质期是7天，放在冰箱里")
	if draft == nil {
		t.Fatal("expected pantry draft")
	}
	if draft.Name != "酸奶" {
		t.Fatalf("expected normalized pantry name, got %+v", draft)
	}
	if draft.Quantity != 2 || draft.Unit != "盒" {
		t.Fatalf("expected quantity and unit, got %+v", draft)
	}
	if draft.Location != "冷藏" || draft.Category != "食品" {
		t.Fatalf("expected refrigerated food defaults, got %+v", draft)
	}
	if draft.ExpiresAt != "2026-06-08" {
		t.Fatalf("expected derived expiry date, got %+v", draft)
	}

	reversed := buildLifeTraceAssistantPantryDraft("我有一包饼干，生产日期是2026-06-01，180天保质期")
	if reversed == nil || reversed.ExpiresAt != "2026-11-28" {
		t.Fatalf("expected reversed shelf life wording to derive expiry date, got %+v", reversed)
	}
}

func TestBuildLifeTraceAssistantPantryDraftKeepsNameWhenExpiryMissing(t *testing.T) {
	draft := buildLifeTraceAssistantPantryDraft("我有一盒牛奶，想加到库存里")
	if draft == nil {
		t.Fatal("expected pantry draft even when expiry is missing")
	}
	if draft.Name != "牛奶" || draft.ExpiresAt != "" {
		t.Fatalf("expected pantry draft to preserve name and missing expiry, got %+v", draft)
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

func TestCreateAssistantPlanFromDraftNeedsMoreInfoWhenScheduleMissing(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	var handler Handler

	payload := handler.createAssistantPlanFromDraft(101, lifeTraceAssistantPlanDraft{
		Title:         "预约取车",
		Type:          "普通事项",
		ScheduledDate: "2026-06-03",
		ScheduledTime: "",
		Timezone:      "Asia/Shanghai",
		NotePrefix:    "来自生活助理提醒",
	})
	if payload == nil || payload.Status != "need_more_info" {
		t.Fatalf("expected need_more_info payload, got %+v", payload)
	}
	if payload.Type != "create_plan" {
		t.Fatalf("expected create_plan action type, got %+v", payload)
	}
	if len(payload.NeedMoreInfoFields) != 1 || payload.NeedMoreInfoFields[0] != "scheduledTime" {
		t.Fatalf("expected scheduledTime missing field, got %+v", payload)
	}
	if !strings.Contains(payload.Message, "几点") {
		t.Fatalf("expected follow-up to ask for time, got %+v", payload)
	}
}

func TestCreateAssistantPantryItemFromDraftCreatesAndDedupes(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	var handler Handler
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", nil)
	draft := lifeTraceAssistantPantryDraft{
		Name:      "酸奶",
		Category:  "食品",
		Quantity:  2,
		Unit:      "盒",
		Location:  "冷藏",
		ExpiresAt: "2026-06-08",
		Note:      "我这边有2盒酸奶，生产日期是2026-06-01，保质期是7天。",
	}

	created := handler.createAssistantPantryItemFromDraft(ctx, 101, draft)
	if created == nil || created.Status != "created" || created.PantryItem == nil {
		t.Fatalf("expected created pantry payload, got %+v", created)
	}
	if created.PantryItem.Name != "酸奶" || created.PantryItem.Quantity != 2 {
		t.Fatalf("expected saved pantry item fields, got %+v", created.PantryItem)
	}

	exists := handler.createAssistantPantryItemFromDraft(ctx, 101, draft)
	if exists == nil || exists.Status != "exists" || exists.PantryItem == nil {
		t.Fatalf("expected duplicate pantry detection, got %+v", exists)
	}

	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("user_id = ? AND name = ?", model.Int64String(101), "酸奶").
		Count(&count).Error; err != nil {
		t.Fatalf("count pantry items: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected one pantry item after duplicate create, got %d", count)
	}
}

func TestCreateAssistantPantryItemFromDraftAllowsInventoryWithoutExpiry(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	var handler Handler
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", nil)
	draft := lifeTraceAssistantPantryDraft{
		Name:     "牛奶",
		Category: "食品",
		Quantity: 1,
		Unit:     "盒",
		Location: "冷藏",
		Note:     "我有一盒牛奶，想加到库存里。",
	}

	payload := handler.createAssistantPantryItemFromDraft(ctx, 101, draft)
	if payload == nil || payload.Status != "created" || payload.PantryItem == nil {
		t.Fatalf("expected created payload, got %+v", payload)
	}
	if payload.PantryItem.ExpiresAt != "" {
		t.Fatalf("expected empty expiry, got %+v", payload.PantryItem)
	}
	if payload.PantryItem.ReminderEnabled {
		t.Fatalf("expected reminder disabled without expiry, got %+v", payload.PantryItem)
	}
	if strings.Contains(payload.Message, "保质期到") {
		t.Fatalf("expected created message without expiry suffix, got %+v", payload.Message)
	}
}

func TestCreateAssistantPantryItemFromDraftAsksProductionDateWhenOnlyShelfLifeProvided(t *testing.T) {
	_ = setupTraceTestRouter(t, 101)
	var handler Handler
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", nil)
	draft := lifeTraceAssistantPantryDraft{
		Name:     "牛奶",
		Category: "食品",
		Quantity: 1,
		Unit:     "盒",
		Location: "冷藏",
		Note:     "我有一盒牛奶，保质期180天。",
	}

	payload := handler.createAssistantPantryItemFromDraft(ctx, 101, draft)
	if payload == nil || payload.Status != "need_more_info" {
		t.Fatalf("expected need_more_info payload, got %+v", payload)
	}
	if len(payload.NeedMoreInfoFields) != 1 || payload.NeedMoreInfoFields[0] != "expiresAt" {
		t.Fatalf("expected expiresAt missing field, got %+v", payload)
	}
	if !strings.Contains(payload.Message, "生产日期") {
		t.Fatalf("expected production date follow-up message, got %+v", payload)
	}
}

func TestParseLifeTraceAssistantStructuredResponseSupportsNeedMoreInfo(t *testing.T) {
	raw := `{
		"reply":"要把牛奶收进库存，我还差一个保质期。",
		"action":{
			"type":"create_pantry_item",
			"message":"要把牛奶收进库存，我还差一个保质期。",
			"needMoreInfoFields":["expiresAt"],
			"pantry":{"name":"牛奶","category":"食品","quantity":1,"unit":"盒","location":"冷藏"}
		}
	}`

	parsed, err := parseLifeTraceAssistantStructuredResponse(raw)
	if err != nil {
		t.Fatalf("parse structured response: %v", err)
	}
	if parsed.Reply == "" || parsed.Action == nil {
		t.Fatalf("expected structured action, got %+v", parsed)
	}
	if parsed.Action.Type != "create_pantry_item" {
		t.Fatalf("expected pantry action, got %+v", parsed.Action)
	}
	if len(parsed.Action.NeedMoreInfoFields) != 1 || parsed.Action.NeedMoreInfoFields[0] != "expiresAt" {
		t.Fatalf("expected need-more-info fields, got %+v", parsed.Action)
	}
	if parsed.Action.Pantry == nil || parsed.Action.Pantry.Name != "牛奶" {
		t.Fatalf("expected pantry draft payload, got %+v", parsed.Action.Pantry)
	}
}

func TestBuildLifeTraceAssistantPantryFollowUpDraftUsesRecentDraft(t *testing.T) {
	base := &lifeTraceAssistantPantryDraft{
		Name:     "牛奶",
		Category: "食品",
		Quantity: 1,
		Unit:     "盒",
		Location: "冷藏",
		Note:     "我有一盒牛奶，保质期7天，想加到库存里",
	}

	draft := buildLifeTraceAssistantPantryFollowUpDraft("生产日期是2026-06-01", base)
	if draft == nil {
		t.Fatal("expected pantry follow-up draft")
	}
	if draft.Name != "牛奶" {
		t.Fatalf("expected pantry name to be preserved, got %+v", draft)
	}
	if draft.ExpiresAt != "2026-06-08" {
		t.Fatalf("expected follow-up production date to derive expiry, got %+v", draft)
	}
}

func TestBuildLifeTraceAssistantPlanFollowUpDraftUsesRecentDraft(t *testing.T) {
	now := time.Date(2026, time.June, 3, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
	base := &lifeTraceAssistantPlanDraft{
		Title:         "预约取车",
		Type:          "普通事项",
		ScheduledDate: "2026-06-03",
		ScheduledTime: "20:00",
		Timezone:      "Asia/Shanghai",
		NotePrefix:    "来自生活助理提醒",
	}

	draft := buildLifeTraceAssistantPlanFollowUpDraft("明天下午三点", base, now)
	if draft == nil {
		t.Fatal("expected plan follow-up draft")
	}
	if draft.Title != "预约取车" {
		t.Fatalf("expected title to stay the same, got %+v", draft)
	}
	if draft.ScheduledDate != "2026-06-04" || draft.ScheduledTime != "15:00" {
		t.Fatalf("expected date/time to be updated from follow-up, got %+v", draft)
	}
}

func TestStreamAssistantStructuredResponseCreatesPantryItem(t *testing.T) {
	var captured []lifeTraceOpenAIRequest
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req lifeTraceOpenAIRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode OpenAI request: %v", err)
		}
		captured = append(captured, req)
		w.Header().Set("Content-Type", "application/json")
		toolArgs := `{"reply":"已经帮你收进库存了。","action":{"type":"create_pantry_item","message":"已经帮你收进库存了。","pantry":{"name":"饼干","category":"食品","quantity":1,"unit":"包","location":"厨房","expiresAt":"2026-06-10","note":"我有一包饼干，保质期7天"}}}`
		_, _ = fmt.Fprintf(w, `{"model":"gpt-test","choices":[{"message":{"role":"assistant","tool_calls":[{"id":"call_1","type":"function","function":{"name":"%s","arguments":%q}}]}}]}`, lifeTraceAssistantToolName, toolArgs)
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
		Habits:        model.StringList{"喝水"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", bytes.NewBufferString(`{
		"message":"我有一包饼干，保质期7天",
		"history":[]
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if len(captured) != 1 {
		t.Fatalf("expected one structured OpenAI request, got %d", len(captured))
	}
	if len(captured[0].Tools) != 1 || captured[0].Tools[0].Function == nil || captured[0].Tools[0].Function.Name != lifeTraceAssistantToolName {
		t.Fatalf("expected native tool definition in request, got %+v", captured[0].Tools)
	}
	toolChoice, ok := captured[0].ToolChoice.(map[string]interface{})
	if !ok || toolChoice["type"] != "function" {
		t.Fatalf("expected function tool_choice, got %+v", captured[0].ToolChoice)
	}
	if !strings.Contains(resp.Body.String(), `"action":{"type":"create_pantry_item"`) {
		t.Fatalf("expected SSE action payload, got %s", resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `"name":"饼干"`) {
		t.Fatalf("expected pantry item payload in SSE body, got %s", resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `"householdName":"我的空间"`) {
		t.Fatalf("expected pantry payload to include household name, got %s", resp.Body.String())
	}

	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("user_id = ? AND name = ?", model.Int64String(101), "饼干").
		Count(&count).Error; err != nil {
		t.Fatalf("count pantry items: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected structured stream to create pantry item, got %d", count)
	}
}

func TestStreamAssistantStructuredResponseFallsBackToPantryDraftWhenActionMissing(t *testing.T) {
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		content := `{"reply":"好的，已帮你将辣条加入厨房库存，保质期30天。","action":null}`
		_, _ = fmt.Fprintf(w, `{"model":"gpt-test","choices":[{"message":{"role":"assistant","content":%q}}]}`, content)
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
		Habits:        model.StringList{"喝水"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", bytes.NewBufferString(`{
		"message":"我这边有一包辣条它是我昨天买的但是它的保质期只有30天",
		"history":[]
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `"status":"need_more_info"`) {
		t.Fatalf("expected missing-expiry fallback action, got %s", resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `生产日期`) {
		t.Fatalf("expected follow-up question in SSE body, got %s", resp.Body.String())
	}

	var count int64
	if err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("user_id = ? AND name = ?", model.Int64String(101), "辣条").
		Count(&count).Error; err != nil {
		t.Fatalf("count pantry items: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no pantry item saved without absolute expiry, got %d", count)
	}
}

func TestStreamAssistantStructuredResponseFallsBackWhenToolsUnsupported(t *testing.T) {
	requestCount := 0
	var captured []map[string]interface{}
	openAIServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount += 1
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode OpenAI request: %v", err)
		}
		captured = append(captured, payload)

		w.Header().Set("Content-Type", "application/json")
		if requestCount == 1 {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"error":{"message":"tools is not supported by this model","param":"tools"}}`))
			return
		}

		content := `{"reply":"要把牛奶收进库存，我还差一个保质期。","action":{"type":"create_pantry_item","message":"要把牛奶收进库存，我还差一个保质期。","needMoreInfoFields":["expiresAt"],"pantry":{"name":"牛奶","category":"食品","quantity":1,"unit":"盒","location":"冷藏"}}}`
		_, _ = fmt.Fprintf(w, `{"model":"gpt-test","choices":[{"message":{"role":"assistant","content":%q}}]}`, content)
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
		Habits:        model.StringList{"喝水"},
	}).Error; err != nil {
		t.Fatalf("seed settings: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/ai/assistant/stream", bytes.NewBufferString(`{
		"message":"我有一盒牛奶，想加到库存里",
		"history":[]
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if requestCount != 2 {
		t.Fatalf("expected tool attempt + json fallback, got %d requests", requestCount)
	}
	if _, ok := captured[0]["tools"]; !ok {
		t.Fatalf("expected first request to carry tools, got %+v", captured[0])
	}
	if _, ok := captured[1]["response_format"]; !ok {
		t.Fatalf("expected second request to fall back to response_format json, got %+v", captured[1])
	}
	if !strings.Contains(resp.Body.String(), `"status":"created"`) {
		t.Fatalf("expected fallback SSE to create ordinary pantry item, got %s", resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `"reminderEnabled":false`) {
		t.Fatalf("expected ordinary pantry item without expiry to disable reminder, got %s", resp.Body.String())
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
