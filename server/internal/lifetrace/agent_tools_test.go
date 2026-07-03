package lifetrace

import (
	"context"
	"encoding/json"
	"testing"

	"valley-server/internal/ai/tools"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupAgentToolsDB(t *testing.T) {
	t.Helper()
	if logger.Log == nil {
		logger.InitLogger()
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&model.Household{},
		&model.HouseholdMember{},
		&model.LifeTracePlan{},
		&model.LifeTraceTrace{},
		&model.LifeTracePantryItem{},
		&model.LifeTraceLedgerEntry{},
		&model.LifeTraceAchievement{},
		&model.LifeTraceAIAction{},
		&model.LifeTraceAIMessage{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	previous := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = previous })
}

func newAgentToolsHandler() *Handler {
	return &Handler{}
}

func TestAgentToolQueryRecentTraces(t *testing.T) {
	setupAgentToolsDB(t)
	if err := database.GetDB().Create(&model.LifeTraceTrace{
		UserID:    101,
		Title:     "晚饭散步",
		Summary:   "饭后走了二十分钟",
		TimeLabel: "今天 20:10",
		Mood:      "放松",
		Tags:      model.StringList{"生活迹"},
		Source:    "手动",
	}).Error; err != nil {
		t.Fatalf("seed trace: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTraceTrace{
		UserID:    202,
		Title:     "别人的踪迹",
		Summary:   "不应该出现",
		TimeLabel: "今天 12:00",
		Mood:      "放松",
		Tags:      model.StringList{"生活迹"},
		Source:    "手动",
	}).Error; err != nil {
		t.Fatalf("seed other trace: %v", err)
	}

	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)
	raw, err := h.runQueryRecentTraces(ctx, json.RawMessage(`{"days":7}`))
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK     bool `json:"ok"`
		Days   int  `json:"days"`
		Traces []struct {
			Title string `json:"title"`
			Mood  string `json:"mood"`
		} `json:"traces"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !out.OK || out.Days != 7 {
		t.Fatalf("unexpected result: %s", raw)
	}
	if len(out.Traces) != 1 || out.Traces[0].Title != "晚饭散步" {
		t.Fatalf("expected only current user trace, got %+v", out.Traces)
	}
}

func TestAgentToolQueryPendingPlans(t *testing.T) {
	setupAgentToolsDB(t)
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:    101,
		Title:     "看电影",
		Type:      "电影",
		TimeLabel: "今晚 19:30",
		Reminder:  true,
		Source:    "manual",
	}).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePlan{
		UserID:    101,
		Title:     "已完成的",
		Type:      "普通事项",
		TimeLabel: "昨天 20:00",
		Completed: true,
		Source:    "manual",
	}).Error; err != nil {
		t.Fatalf("seed done plan: %v", err)
	}

	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)
	raw, err := h.runQueryPendingPlans(ctx, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK    bool `json:"ok"`
		Limit int  `json:"limit"`
		Plans []struct {
			Title string `json:"title"`
		} `json:"plans"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !out.OK || out.Limit != 8 {
		t.Fatalf("unexpected result: %s", raw)
	}
	if len(out.Plans) != 1 || out.Plans[0].Title != "看电影" {
		t.Fatalf("expected one pending plan, got %+v", out.Plans)
	}
}

func TestAgentToolCreatePlan(t *testing.T) {
	setupAgentToolsDB(t)
	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)

	args := json.RawMessage(`{"title":"看电影","type":"电影","scheduledDate":"2026-07-05","scheduledTime":"19:30","timezone":"Asia/Shanghai","notePrefix":"来自生活助理计划"}`)
	raw, err := h.runCreatePlan(ctx, args)
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK      bool   `json:"ok"`
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !out.OK || out.Status != "created" {
		t.Fatalf("expected created, got %+v", out)
	}
	var count int64
	if err := database.GetDB().Model(&model.LifeTracePlan{}).Where("user_id = ?", 101).Count(&count).Error; err != nil {
		t.Fatalf("count plans: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 plan, got %d", count)
	}
}

func TestAgentToolCreatePlanNeedMoreInfo(t *testing.T) {
	setupAgentToolsDB(t)
	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)

	raw, err := h.runCreatePlan(ctx, json.RawMessage(`{"title":"看电影"}`))
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK                 bool     `json:"ok"`
		Status             string   `json:"status"`
		NeedMoreInfoFields []string `json:"needMoreInfoFields"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.OK || out.Status != "need_more_info" {
		t.Fatalf("expected need_more_info, got %s", raw)
	}
	if len(out.NeedMoreInfoFields) == 0 {
		t.Fatalf("expected NeedMoreInfoFields, got %+v", out)
	}
}

func TestAgentToolCreateLedgerEntry(t *testing.T) {
	setupAgentToolsDB(t)
	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)

	raw, err := h.runCreateLedgerEntry(ctx, json.RawMessage(`{"amount":30,"currency":"CNY","direction":"支出","category":"吃饭","merchant":"咖啡店"}`))
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK     bool   `json:"ok"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !out.OK || out.Status != "created" {
		t.Fatalf("expected created, got %s", raw)
	}
}

func TestAgentToolCreatePantryItemMissingContext(t *testing.T) {
	setupAgentToolsDB(t)
	h := newAgentToolsHandler()
	ctx := WithAgentToolContext(context.Background(), 101, nil)

	raw, err := h.runCreatePantryItem(ctx, json.RawMessage(`{"name":"牛奶"}`))
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	var out struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.OK || out.Error == "" {
		t.Fatalf("expected error when gin.Context missing, got %s", raw)
	}
}

func TestAgentToolMissingUserID(t *testing.T) {
	setupAgentToolsDB(t)
	h := newAgentToolsHandler()
	if _, err := h.runQueryRecentTraces(context.Background(), nil); err == nil {
		t.Fatalf("expected error when user id missing")
	}
}

func TestHandlerRegisterAgentTools(t *testing.T) {
	handler := newAgentToolsHandler()
	reg := tools.NewRegistry()
	handler.RegisterAgentTools(reg)
	got := reg.Filter(agentToolScope, nil)
	expected := map[string]bool{
		"query_recent_traces": false,
		"query_pending_plans": false,
		"create_plan":         false,
		"create_pantry_item":  false,
		"create_ledger_entry": false,
	}
	for _, tool := range got {
		if _, ok := expected[tool.Name()]; !ok {
			t.Fatalf("unexpected tool registered: %s", tool.Name())
		}
		if tool.Scope() != agentToolScope {
			t.Fatalf("tool %s has wrong scope %s", tool.Name(), tool.Scope())
		}
		expected[tool.Name()] = true
	}
	for name, seen := range expected {
		if !seen {
			t.Fatalf("missing tool %s", name)
		}
	}
}
