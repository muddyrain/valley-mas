package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"valley-server/internal/ai/tools"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// agentToolScope 是 Life Trace 助理相关 tool 的作用域标识。
const agentToolScope = "life-trace"

type agentToolCtxKey int

const (
	agentToolCtxUserID agentToolCtxKey = iota
	agentToolCtxGin
)

// WithAgentToolContext 把当前用户和 gin.Context 塞进 ctx,供 tool.Run 内部读取。
// gin.Context 允许为 nil(离线场景);userID 必须提供,否则 tool 会拒绝执行。
func WithAgentToolContext(ctx context.Context, userID model.Int64String, c *gin.Context) context.Context {
	ctx = context.WithValue(ctx, agentToolCtxUserID, userID)
	if c != nil {
		ctx = context.WithValue(ctx, agentToolCtxGin, c)
	}
	return ctx
}

func agentToolUserID(ctx context.Context) (model.Int64String, error) {
	v, ok := ctx.Value(agentToolCtxUserID).(model.Int64String)
	if !ok || v == 0 {
		return 0, errors.New("agent tool: user id missing from context")
	}
	return v, nil
}

func agentToolGinContext(ctx context.Context) *gin.Context {
	c, _ := ctx.Value(agentToolCtxGin).(*gin.Context)
	return c
}

// RegisterAgentTools 把 Life Trace 首批 5 个 tool 注册到 registry。
// 通过闭包捕获 Handler,tool 不持有单例引用,便于测试替换。
func (h *Handler) RegisterAgentTools(reg *tools.Registry) {
	reg.MustRegister(newAgentTool(
		"query_recent_traces",
		"查询当前用户最近 N 天的生活踪迹(标题/心情/时间标签),用于生活助理需要参考近期状态时。",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"days": map[string]any{
					"type":        "integer",
					"minimum":     1,
					"maximum":     30,
					"description": "查询天数,默认 7,上限 30。",
				},
			},
		},
		h.runQueryRecentTraces,
	))

	reg.MustRegister(newAgentTool(
		"query_pending_plans",
		"查询当前用户未完成的生活计划(标题/类型/时间/是否提醒),用于助理决定是否新增计划或提醒用户。",
		map[string]any{
			"type": "object",
			"properties": map[string]any{
				"limit": map[string]any{
					"type":        "integer",
					"minimum":     1,
					"maximum":     20,
					"description": "返回条数,默认 8,上限 20。",
				},
			},
		},
		h.runQueryPendingPlans,
	))

	reg.MustRegister(newAgentTool(
		"create_plan",
		"根据结构化字段为当前用户创建生活计划或提醒。若日期/时间缺失,返回 need_more_info 状态,请追问用户后再重试。",
		map[string]any{
			"type": "object",
			"required": []string{"title", "scheduledDate", "scheduledTime"},
			"properties": map[string]any{
				"title":         map[string]any{"type": "string", "description": "计划标题"},
				"type":          map[string]any{"type": "string", "description": "计划分类,如 电影/吃饭/运动/普通事项"},
				"scheduledDate": map[string]any{"type": "string", "description": "计划日期,格式 YYYY-MM-DD"},
				"scheduledTime": map[string]any{"type": "string", "description": "计划时间,格式 HH:mm"},
				"timezone":      map[string]any{"type": "string", "description": "时区,默认 Asia/Shanghai"},
				"notePrefix":    map[string]any{"type": "string", "description": "备注前缀,默认 来自生活助理计划"},
			},
		},
		h.runCreatePlan,
	))

	reg.MustRegister(newAgentTool(
		"create_pantry_item",
		"根据结构化字段把物品加入当前用户的库存空间。缺少到期日/生产日期时返回 need_more_info。",
		map[string]any{
			"type":     "object",
			"required": []string{"name"},
			"properties": map[string]any{
				"name":      map[string]any{"type": "string", "description": "商品名"},
				"category":  map[string]any{"type": "string"},
				"quantity":  map[string]any{"type": "integer", "minimum": 0},
				"unit":      map[string]any{"type": "string"},
				"location":  map[string]any{"type": "string"},
				"expiresAt": map[string]any{"type": "string", "description": "到期日,YYYY-MM-DD"},
				"openedAt":  map[string]any{"type": "string", "description": "开封日,YYYY-MM-DD"},
				"note":      map[string]any{"type": "string"},
			},
		},
		h.runCreatePantryItem,
	))

	reg.MustRegister(newAgentTool(
		"create_ledger_entry",
		"根据结构化字段为当前用户记一笔账。金额缺失或非法时返回 need_more_info。",
		map[string]any{
			"type":     "object",
			"required": []string{"amount"},
			"properties": map[string]any{
				"amount":     map[string]any{"type": "number", "description": "金额,单位元"},
				"currency":   map[string]any{"type": "string", "description": "币种,默认 CNY"},
				"direction":  map[string]any{"type": "string", "enum": []string{"支出", "收入"}, "description": "方向,默认 支出"},
				"category":   map[string]any{"type": "string", "description": "分类"},
				"occurredAt": map[string]any{"type": "string", "description": "发生时间,RFC3339 或 YYYY-MM-DD HH:mm"},
				"merchant":   map[string]any{"type": "string"},
				"location":   map[string]any{"type": "string"},
				"note":       map[string]any{"type": "string"},
			},
		},
		h.runCreateLedgerEntry,
	))
}

// agentTool 是通过闭包实现的通用 Tool 载体。
type agentTool struct {
	name        string
	description string
	schema      map[string]any
	run         func(ctx context.Context, args json.RawMessage) (json.RawMessage, error)
}

func newAgentTool(
	name, description string,
	schema map[string]any,
	run func(ctx context.Context, args json.RawMessage) (json.RawMessage, error),
) *agentTool {
	return &agentTool{name: name, description: description, schema: schema, run: run}
}

func (t *agentTool) Name() string           { return t.name }
func (t *agentTool) Description() string    { return t.description }
func (t *agentTool) Schema() map[string]any { return t.schema }
func (t *agentTool) Scope() string          { return agentToolScope }
func (t *agentTool) Run(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	return t.run(ctx, args)
}

// ---------- 具体 tool 实现 ----------

func (h *Handler) runQueryRecentTraces(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	userID, err := agentToolUserID(ctx)
	if err != nil {
		return nil, err
	}
	var payload struct {
		Days int `json:"days"`
	}
	if len(args) > 0 {
		_ = json.Unmarshal(args, &payload)
	}
	days := payload.Days
	if days <= 0 {
		days = 7
	}
	if days > 30 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ? AND created_at >= ?", userID, since).
		Order("created_at DESC").
		Limit(20).
		Find(&traces).Error; err != nil {
		return nil, fmt.Errorf("query traces: %w", err)
	}

	type item struct {
		Title     string `json:"title"`
		Mood      string `json:"mood,omitempty"`
		TimeLabel string `json:"timeLabel,omitempty"`
		Location  string `json:"location,omitempty"`
	}
	list := make([]item, 0, len(traces))
	for _, t := range traces {
		list = append(list, item{
			Title:     t.Title,
			Mood:      t.Mood,
			TimeLabel: t.TimeLabel,
			Location:  t.Location,
		})
	}
	return json.Marshal(map[string]any{"ok": true, "days": days, "traces": list})
}

func (h *Handler) runQueryPendingPlans(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	userID, err := agentToolUserID(ctx)
	if err != nil {
		return nil, err
	}
	var payload struct {
		Limit int `json:"limit"`
	}
	if len(args) > 0 {
		_ = json.Unmarshal(args, &payload)
	}
	limit := payload.Limit
	if limit <= 0 {
		limit = 8
	}
	if limit > 20 {
		limit = 20
	}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(limit).
		Find(&plans).Error; err != nil {
		return nil, fmt.Errorf("query plans: %w", err)
	}

	type item struct {
		Title     string `json:"title"`
		Type      string `json:"type,omitempty"`
		TimeLabel string `json:"timeLabel,omitempty"`
		Reminder  bool   `json:"reminder"`
	}
	list := make([]item, 0, len(plans))
	for _, p := range plans {
		list = append(list, item{
			Title:     p.Title,
			Type:      p.Type,
			TimeLabel: p.TimeLabel,
			Reminder:  p.Reminder,
		})
	}
	return json.Marshal(map[string]any{"ok": true, "limit": limit, "plans": list})
}

func (h *Handler) runCreatePlan(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	userID, err := agentToolUserID(ctx)
	if err != nil {
		return nil, err
	}
	var draft lifeTraceAssistantPlanDraft
	if err := json.Unmarshal(args, &draft); err != nil {
		return marshalToolError("参数解析失败: " + err.Error()), nil
	}
	return marshalToolPayload(h.createAssistantPlanFromDraft(userID, draft)), nil
}

func (h *Handler) runCreatePantryItem(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	userID, err := agentToolUserID(ctx)
	if err != nil {
		return nil, err
	}
	c := agentToolGinContext(ctx)
	if c == nil {
		return marshalToolError("缺少请求上下文,无法解析家庭空间"), nil
	}
	var draft lifeTraceAssistantPantryDraft
	if err := json.Unmarshal(args, &draft); err != nil {
		return marshalToolError("参数解析失败: " + err.Error()), nil
	}
	return marshalToolPayload(h.createAssistantPantryItemFromDraft(c, userID, draft)), nil
}

func (h *Handler) runCreateLedgerEntry(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	userID, err := agentToolUserID(ctx)
	if err != nil {
		return nil, err
	}
	var draft lifeTraceAssistantLedgerDraft
	if err := json.Unmarshal(args, &draft); err != nil {
		return marshalToolError("参数解析失败: " + err.Error()), nil
	}
	return marshalToolPayload(h.createAssistantLedgerEntryFromDraft(userID, draft)), nil
}

// marshalToolPayload 把 actionPayload 序列化成 tool 结果 JSON。
// 结构:{"ok":true|false,"status":"...","message":"...","needMoreInfoFields":[...],"payload":<原始 payload>}
func marshalToolPayload(payload *lifeTraceAssistantActionPayload) json.RawMessage {
	if payload == nil {
		return json.RawMessage(`{"ok":false,"error":"nil payload"}`)
	}
	ok := payload.Status == "created" || payload.Status == "exists"
	envelope := map[string]any{
		"ok":      ok,
		"status":  payload.Status,
		"message": payload.Message,
		"payload": payload,
	}
	if len(payload.NeedMoreInfoFields) > 0 {
		envelope["needMoreInfoFields"] = payload.NeedMoreInfoFields
	}
	buf, err := json.Marshal(envelope)
	if err != nil {
		return marshalToolError("序列化失败: " + err.Error())
	}
	return buf
}

func marshalToolError(message string) json.RawMessage {
	buf, _ := json.Marshal(map[string]any{"ok": false, "error": message})
	return buf
}
