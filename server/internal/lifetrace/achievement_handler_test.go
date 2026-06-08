package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestListAchievementsReturnsLockedStateForNewUser(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	summary := data["summary"].(map[string]interface{})
	if summary["unlocked"].(float64) != 0 || summary["total"].(float64) != 72 {
		t.Fatalf("expected locked achievement set, got %+v", summary)
	}
	list := data["list"].([]interface{})
	if len(list) != 72 {
		t.Fatalf("expected 72 definitions, got %d", len(list))
	}
	first := findAchievementCard(t, list, "first_plan")
	if first["unlocked"].(bool) {
		t.Fatalf("expected first_plan to be locked, got %+v", first)
	}
}

func TestAchievementExpansionDefinitions(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	for _, code := range []string{
		"plan_triple",
		"plan_ten_done",
		"morning_plan",
		"trace_seven_total",
		"photo_memory_three",
		"mood_keeper",
		"pantry_five_items",
		"waste_saver_three",
		"fresh_start",
		"ai_action_three",
		"review_to_plan",
		"ai_conversation_three",
		"plan_thirty_done",
		"plan_type_collector",
		"daily_planner_week",
		"trace_fourteen_total",
		"trace_thirty_day_streak",
		"tag_collector",
		"pantry_twenty_items",
		"expiry_rescue_three",
		"pantry_photo_memory",
		"ai_action_ten",
		"weekly_review_four",
		"recipe_plan_three",
		"reading_plan_done",
		"sport_plan_done",
		"social_plan_done",
		"late_night_trace",
		"place_keeper",
		"manual_trace_three",
		"pantry_category_three",
		"pantry_location_three",
		"pantry_reminder_keeper",
		"ai_image_plan_three",
		"ai_conversation_ten",
		"review_to_plan_three",
		"family_three_members",
		"shared_pantry_first",
		"shared_pantry_ten",
		"shared_pantry_category_three",
		"shared_pantry_used_food",
		"shared_pantry_expiry_rescue",
		"shared_pantry_photo_memory",
		"shared_pantry_location_three",
		"spring_trace",
		"summer_night_trace",
		"autumn_pantry",
		"winter_meal_plan",
		"plan_three_day_streak",
		"checkin_seven_day_streak",
		"trace_fourteen_day_streak",
		"weekly_review_to_plan_five",
	} {
		card := findAchievementCard(t, list, code)
		if card["hidden"].(bool) {
			t.Fatalf("expected %s to be visible, got %+v", code, card)
		}
	}
}

func TestAchievementExpansionUnlocksFromExistingData(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	now := time.Now()
	completedAt := now.Add(-2 * time.Hour)

	for i := 0; i < 30; i++ {
		plan := model.LifeTracePlan{
			UserID:        101,
			Title:         "生活计划",
			Type:          []string{"普通事项", "运动", "阅读", "聚会"}[i%4],
			TimeLabel:     "上午 09:00",
			ScheduledDate: now.AddDate(0, 0, -i).Format("2006-01-02"),
			ScheduledTime: "09:00",
			Source:        "manual",
			Completed:     true,
			CompletedAt:   &completedAt,
		}
		if i < 3 {
			plan.ScheduledDate = now.AddDate(0, 0, -i).Format("2006-01-02")
			plan.CompletedAt = &[]time.Time{now.AddDate(0, 0, -i)}[0]
		}
		if i == 0 {
			plan.Source = "weekly_review"
			plan.Note = "来自周回顾行动"
		}
		if i > 0 && i <= 3 {
			plan.Type = "吃饭"
			plan.Source = "ai_advice"
			plan.Note = "AI 智能菜谱，优先消耗库存。"
		}
		if i >= 4 && i <= 6 {
			plan.Source = "image_ai"
		}
		if i >= 7 && i <= 8 {
			plan.Source = "weekly_review"
			plan.Note = "来自周回顾行动"
		}
		if i == 9 {
			plan.Source = "weekly_review"
			plan.Note = "来自周回顾行动"
		}
		if i == 11 {
			plan.Source = "weekly_review"
			plan.Note = "来自周回顾行动"
		}
		if i == 10 {
			plan.Type = "吃饭"
			plan.ScheduledDate = "2026-12-12"
			plan.CompletedAt = &[]time.Time{time.Date(2026, time.December, 12, 12, 0, 0, 0, now.Location())}[0]
		}
		if err := database.GetDB().Create(&plan).Error; err != nil {
			t.Fatalf("seed plan: %v", err)
		}
	}

	for i := 0; i < 30; i++ {
		createdAt := now.AddDate(0, 0, -i)
		if i == 0 {
			createdAt = time.Date(createdAt.Year(), createdAt.Month(), createdAt.Day(), 23, 20, 0, 0, createdAt.Location())
		}
		trace := model.LifeTraceTrace{
			UserID:    101,
			Title:     "生活踪迹",
			Summary:   "今天留下了一点记录。",
			TimeLabel: "今天",
			Mood:      []string{"放松", "开心", "平静"}[i%3],
			Tags:      model.StringList{[]string{"生活", "运动", "阅读", "厨房", "复盘"}[i%5]},
			Location:  "",
			Source:    "手动",
			CreatedAt: createdAt,
		}
		if i == 0 {
			trace.Location = "小区花园"
		}
		if i < 3 {
			trace.ImageURL = "https://example.com/photo.jpg"
		}
		if err := database.GetDB().Create(&trace).Error; err != nil {
			t.Fatalf("seed trace: %v", err)
		}
	}
	for _, trace := range []model.LifeTraceTrace{
		{
			UserID:    101,
			Title:     "春天记录",
			Summary:   "春天也留下了一点生活记录。",
			TimeLabel: "春天",
			Mood:      "平静",
			Tags:      model.StringList{"生活"},
			Source:    "手动",
			CreatedAt: time.Date(2026, time.March, 12, 10, 0, 0, 0, now.Location()),
		},
		{
			UserID:    101,
			Title:     "夏夜记录",
			Summary:   "夏天夜里也留下了一点生活记录。",
			TimeLabel: "夏夜",
			Mood:      "放松",
			Tags:      model.StringList{"生活"},
			Source:    "手动",
			CreatedAt: time.Date(2026, time.July, 12, 23, 20, 0, 0, now.Location()),
		},
	} {
		if err := database.GetDB().Create(&trace).Error; err != nil {
			t.Fatalf("seed seasonal trace: %v", err)
		}
	}

	for i := 0; i < 20; i++ {
		item := model.LifeTracePantryItem{
			UserID:    101,
			Name:      "食物",
			Category:  []string{"食品", "日用品", "药品"}[i%3],
			Quantity:  1,
			Unit:      "件",
			Location:  []string{"冷藏", "厨房", "储物柜"}[i%3],
			ExpiresAt: now.AddDate(0, 0, 5).Format("2006-01-02"),
			Status:    "normal",
		}
		if i == 0 {
			item.ReminderEnabled = true
		}
		if i < 3 {
			item.Category = "食品"
			item.Status = "used-up"
		}
		if i == 3 {
			item.OpenedAt = now.Format("2006-01-02")
		}
		if i == 4 {
			item.ImageURL = "https://example.com/pantry.jpg"
		}
		if i == 5 {
			item.CreatedAt = time.Date(2026, time.October, 8, 10, 0, 0, 0, now.Location())
		}
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed pantry item: %v", err)
		}
	}

	for i := 0; i < 7; i++ {
		completedAt := now.AddDate(0, 0, -i)
		if err := database.GetDB().Create(&model.LifeTraceCheckin{
			UserID:      101,
			Date:        completedAt.Format("2006-01-02"),
			Name:        "喝水",
			Completed:   true,
			CompletedAt: &completedAt,
		}).Error; err != nil {
			t.Fatalf("seed checkin: %v", err)
		}
	}

	sharedHousehold := model.Household{
		Name:        "一起生活",
		Kind:        householdKindShared,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&sharedHousehold).Error; err != nil {
		t.Fatalf("seed shared household: %v", err)
	}
	for _, userID := range []model.Int64String{101, 202, 303} {
		if err := database.GetDB().Create(&model.HouseholdMember{
			HouseholdID: sharedHousehold.ID,
			UserID:      userID,
			Role:        householdRoleMember,
			Status:      householdMemberStatusActive,
		}).Error; err != nil {
			t.Fatalf("seed household member: %v", err)
		}
	}
	for i := 0; i < 10; i++ {
		item := model.LifeTracePantryItem{
			UserID:      101,
			HouseholdID: sharedHousehold.ID,
			Name:        "共享库存",
			Category:    []string{"食品", "日用品", "药品"}[i%3],
			Quantity:    1,
			Unit:        "件",
			Location:    []string{"冷藏", "厨房", "储物柜"}[i%3],
			ExpiresAt:   now.AddDate(0, 0, 5).Format("2006-01-02"),
			Status:      "normal",
		}
		if i == 0 {
			item.Category = "食品"
			item.Status = "used-up"
		}
		if i == 1 {
			item.ImageURL = "https://example.com/shared-pantry.jpg"
		}
		if err := database.GetDB().Create(&item).Error; err != nil {
			t.Fatalf("seed shared pantry item: %v", err)
		}
	}

	conversation := model.LifeTraceAIConversation{UserID: 101, Title: "生活助理对话"}
	if err := database.GetDB().Create(&conversation).Error; err != nil {
		t.Fatalf("seed ai conversation: %v", err)
	}
	for i := 0; i < 10; i++ {
		if err := database.GetDB().Create(&model.LifeTraceAIMessage{
			UserID:         101,
			ConversationID: conversation.ID,
			Role:           "user",
			Content:        "帮我看看今天怎么安排",
		}).Error; err != nil {
			t.Fatalf("seed ai message: %v", err)
		}
		if err := database.GetDB().Create(&model.LifeTraceAIAction{
			UserID:     101,
			Title:      "AI 生活动作",
			ActionType: "plan",
		}).Error; err != nil {
			t.Fatalf("seed ai action: %v", err)
		}
	}
	for i := 0; i < 4; i++ {
		if err := database.GetDB().Create(&model.LifeTraceWeeklyReview{
			UserID:    101,
			WeekStart: now.AddDate(0, 0, -7*i).Format("2006-01-02"),
			WeekEnd:   now.AddDate(0, 0, -7*i+6).Format("2006-01-02"),
			Summary:   "本周有复盘。",
			Wins:      model.StringList{"完成一次复盘"},
			Delays:    model.StringList{},
			Insights:  model.StringList{},
			Source:    "test",
			CreatedAt: now.AddDate(0, 0, -7*i),
		}).Error; err != nil {
			t.Fatalf("seed weekly review: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	for _, code := range []string{
		"plan_triple",
		"plan_ten_done",
		"morning_plan",
		"trace_seven_total",
		"photo_memory_three",
		"mood_keeper",
		"pantry_five_items",
		"waste_saver_three",
		"fresh_start",
		"ai_action_three",
		"review_to_plan",
		"ai_conversation_three",
		"plan_thirty_done",
		"plan_type_collector",
		"daily_planner_week",
		"trace_fourteen_total",
		"trace_thirty_day_streak",
		"tag_collector",
		"pantry_twenty_items",
		"expiry_rescue_three",
		"pantry_photo_memory",
		"ai_action_ten",
		"weekly_review_four",
		"recipe_plan_three",
		"reading_plan_done",
		"sport_plan_done",
		"social_plan_done",
		"late_night_trace",
		"place_keeper",
		"manual_trace_three",
		"pantry_category_three",
		"pantry_location_three",
		"pantry_reminder_keeper",
		"ai_image_plan_three",
		"ai_conversation_ten",
		"review_to_plan_three",
		"family_three_members",
		"shared_pantry_first",
		"shared_pantry_ten",
		"shared_pantry_category_three",
		"shared_pantry_used_food",
		"shared_pantry_expiry_rescue",
		"shared_pantry_photo_memory",
		"shared_pantry_location_three",
		"spring_trace",
		"summer_night_trace",
		"autumn_pantry",
		"winter_meal_plan",
		"plan_three_day_streak",
		"checkin_seven_day_streak",
		"trace_fourteen_day_streak",
		"weekly_review_to_plan_five",
	} {
		card := findAchievementCard(t, list, code)
		if !card["unlocked"].(bool) {
			t.Fatalf("expected %s to unlock, got %+v", code, card)
		}
	}
}

func TestAchievementsUnlockFromLifeTraceActions(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	planBody := bytes.NewBufferString(`{
		"title": "今天散步",
		"type": "运动",
		"timeLabel": "今天 19:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "19:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"source": "manual"
	}`)
	createPlanReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", planBody)
	createPlanReq.Header.Set("Content-Type", "application/json")
	createPlanResp := httptest.NewRecorder()
	router.ServeHTTP(createPlanResp, createPlanReq)
	createdPlan := decodeTracePayload(t, createPlanResp)["data"].(map[string]interface{})
	planID := createdPlan["id"].(string)

	completeReq := httptest.NewRequest(http.MethodPatch, "/api/v1/life-trace/plans/"+planID+"/status", bytes.NewBufferString(`{"completed":true}`))
	completeReq.Header.Set("Content-Type", "application/json")
	completeResp := httptest.NewRecorder()
	router.ServeHTTP(completeResp, completeReq)

	traceBody := bytes.NewBufferString(`{
		"title": "散步结束",
		"summary": "今天绕着小区走了一圈，风很舒服，整个人也慢慢安静下来。",
		"timeLabel": "今天 20:00",
		"mood": "放松",
		"source": "手动"
	}`)
	traceReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/traces", traceBody)
	traceReq.Header.Set("Content-Type", "application/json")
	traceResp := httptest.NewRecorder()
	router.ServeHTTP(traceResp, traceReq)

	pantryBody := bytes.NewBufferString(`{
		"name": "牛奶",
		"category": "食品",
		"quantity": 1,
		"unit": "盒",
		"location": "冷藏",
		"expiresAt": "2026-06-10",
		"reminder": {"enabled": true, "useDefault": true, "rules": ["7d"], "reminderTime": "09:00"}
	}`)
	pantryReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/pantry", pantryBody)
	pantryReq.Header.Set("Content-Type", "application/json")
	pantryResp := httptest.NewRecorder()
	router.ServeHTTP(pantryResp, pantryReq)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	for _, code := range []string{"first_plan", "first_plan_done", "first_trace", "first_pantry"} {
		card := findAchievementCard(t, list, code)
		if !card["unlocked"].(bool) {
			t.Fatalf("expected %s to unlock, got %+v", code, card)
		}
	}

	var count int64
	if err := database.GetDB().Model(&model.LifeTraceAchievement{}).
		Where("user_id = ? AND code = ?", model.Int64String(101), "first_plan").
		Count(&count).Error; err != nil {
		t.Fatalf("count achievements: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected first_plan to be stored once, got %d", count)
	}
}

func TestAchievementsStayScopedToCurrentUserAndWeeklyReview(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:    202,
		Title:     "其他用户计划",
		Type:      "运动",
		TimeLabel: "今天",
		Source:    "manual",
	}).Error; err != nil {
		t.Fatalf("seed other user plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceWeeklyReview{
		UserID:    101,
		WeekStart: "2026-06-01",
		WeekEnd:   "2026-06-07",
		Summary:   "本周有复盘。",
		Wins:      model.StringList{"完成一次复盘"},
		Delays:    model.StringList{},
		Insights:  model.StringList{},
		Source:    "test",
		CreatedAt: time.Now(),
	}).Error; err != nil {
		t.Fatalf("seed weekly review: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/achievements", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	list := decodeTracePayload(t, resp)["data"].(map[string]interface{})["list"].([]interface{})
	if findAchievementCard(t, list, "first_plan")["unlocked"].(bool) {
		t.Fatal("expected other user's plan not to unlock current user achievement")
	}
	weekly := findAchievementCard(t, list, "weekly_review")
	if !weekly["unlocked"].(bool) {
		t.Fatalf("expected weekly_review to unlock from current user review, got %+v", weekly)
	}
}

func TestAchievementUnlockQueuesAICommentBackfill(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	originalGenerate := generateAchievementAIComment
	originalAsync := runAchievementAICommentAsync
	t.Cleanup(func() {
		generateAchievementAIComment = originalGenerate
		runAchievementAICommentAsync = originalAsync
	})
	runAchievementAICommentAsync = func(job func()) {
		job()
	}
	generateAchievementAIComment = func(_ model.Int64String, card achievementCard) (string, error) {
		if card.Code != "first_plan" {
			return "", nil
		}
		return "  **你把今天的小念头安稳放进了生活里。**  ", nil
	}

	planBody := bytes.NewBufferString(`{
		"title": "今天散步",
		"type": "运动",
		"timeLabel": "今天 19:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "19:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"source": "manual"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", planBody)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	var record model.LifeTraceAchievement
	if err := database.GetDB().Where("user_id = ? AND code = ?", model.Int64String(101), "first_plan").
		First(&record).Error; err != nil {
		t.Fatalf("load unlocked achievement: %v", err)
	}
	if record.AIComment != "你把今天的小念头安稳放进了生活里。" {
		t.Fatalf("expected sanitized AI comment, got %q", record.AIComment)
	}
}

func TestAchievementAICommentFailureDoesNotBlockUnlock(t *testing.T) {
	router := setupTraceTestRouter(t, 101)
	originalGenerate := generateAchievementAIComment
	originalAsync := runAchievementAICommentAsync
	t.Cleanup(func() {
		generateAchievementAIComment = originalGenerate
		runAchievementAICommentAsync = originalAsync
	})
	runAchievementAICommentAsync = func(job func()) {
		job()
	}
	generateAchievementAIComment = func(_ model.Int64String, _ achievementCard) (string, error) {
		return "", errAchievementAICommentUnavailable
	}

	planBody := bytes.NewBufferString(`{
		"title": "今天散步",
		"type": "运动",
		"timeLabel": "今天 19:00",
		"scheduledDate": "2026-05-29",
		"scheduledTime": "19:00",
		"timezone": "Asia/Shanghai",
		"reminder": true,
		"source": "manual"
	}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/plans", planBody)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	var record model.LifeTraceAchievement
	if err := database.GetDB().Where("user_id = ? AND code = ?", model.Int64String(101), "first_plan").
		First(&record).Error; err != nil {
		t.Fatalf("load unlocked achievement: %v", err)
	}
	if record.AIComment != "" {
		t.Fatalf("expected empty AI comment after failed generation, got %q", record.AIComment)
	}
}

func TestSanitizeAchievementAIComment(t *testing.T) {
	comment, ok := sanitizeAchievementAIComment("```markdown\n1. 你把散步这件小事认真收好了。\n```")
	if !ok {
		t.Fatal("expected comment to be accepted")
	}
	if comment != "你把散步这件小事认真收好了。" {
		t.Fatalf("unexpected sanitized comment %q", comment)
	}

	longRaw := strings.Repeat("生活", 40)
	comment, ok = sanitizeAchievementAIComment(longRaw)
	if !ok {
		t.Fatal("expected long comment to be truncated, not rejected")
	}
	if len([]rune(comment)) > 60 {
		t.Fatalf("expected comment to be capped at 60 runes, got %d", len([]rune(comment)))
	}

	if _, ok := sanitizeAchievementAIComment("   "); ok {
		t.Fatal("expected blank comment to be rejected")
	}
}

func findAchievementCard(t *testing.T, list []interface{}, code string) map[string]interface{} {
	t.Helper()
	for _, item := range list {
		card := item.(map[string]interface{})
		if card["code"] == code {
			return card
		}
	}
	t.Fatalf("missing achievement card %s", code)
	return nil
}
