package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// lifeTraceAssistantAgentTools 是 Life Trace 助理默认允许的 tool 白名单。
// 保持在同一处便于日后调整或按用户偏好裁剪。
var lifeTraceAssistantAgentTools = []string{
	"query_recent_traces",
	"query_pending_plans",
	"create_plan",
	"create_pantry_item",
	"create_ledger_entry",
}

// lifeTraceAssistantAgentToolLabels 把 tool 名映射成用户可读的中文标签。
// 用于前端"深度思考"折叠面板;未登记的 tool 前端会退回 tool 名本身。
var lifeTraceAssistantAgentToolLabels = map[string]string{
	"query_recent_traces": "查询最近踪迹",
	"query_pending_plans": "查询待办计划",
	"create_plan":         "创建计划",
	"create_pantry_item":  "整理食材库",
	"create_ledger_entry": "记一笔账",
}

// lifeTraceAssistantUseAgent 读取环境变量 LIFE_TRACE_ASSISTANT_USE_AGENT。
// 空/未识别值一律视为 false,方便做灰度切换。
func lifeTraceAssistantUseAgent() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("LIFE_TRACE_ASSISTANT_USE_AGENT")))
	switch v {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

// streamLifeTraceAssistantAgent 走 agent tool loop 分支。
// 与 streamLifeTraceAssistantStructured 类似,一旦成功打开 SSE writer
// 就自行完成整轮响应,不再回退到旧路径。返回 error 表示"尚未写响应",
// 允许上层继续走 structured / stream 分支。
func (h *Handler) streamLifeTraceAssistantAgent(
	c *gin.Context,
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	req lifeTraceAssistantRequest,
	userID model.Int64String,
) error {
	spec := agent.Spec{
		Provider:    cfg.Source,
		Model:       cfg.Model,
		System:      systemPrompt,
		Tools:       lifeTraceAssistantAgentTools,
		MaxSteps:    6,
		MaxTokens:   600,
		Temperature: 0.2,
		Feature:     "life-trace-assistant",
	}

	backend := newLifeTraceAgentBackend(cfg)
	loop := agent.NewLocalLoop(backend, tools.DefaultRegistry)

	msgs := buildLifeTraceAssistantAgentMessages(req)
	toolCtx := WithAgentToolContext(ctx, userID, c)
	toolCtx = aiusage.WithAudit(toolCtx, "life-trace-assistant", userID.String())

	events, err := loop.RunStream(toolCtx, spec, msgs)
	if err != nil {
		return err
	}

	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	modelName := cfg.Model
	send(lifeTraceAssistantStreamChunk{Source: cfg.Source, Model: modelName})

	var loopErr error
	thinkStep := 0
	for ev := range events {
		switch ev.Type {
		case agent.EventDelta:
			if strings.TrimSpace(ev.Delta) == "" {
				continue
			}
			send(lifeTraceAssistantStreamChunk{
				Source: cfg.Source,
				Model:  modelName,
				Chunk:  ev.Delta,
			})
		case agent.EventToolCall:
			thinkStep++
			send(lifeTraceAssistantStreamChunk{
				Source:   cfg.Source,
				Model:    modelName,
				Thinking: buildAssistantThinkingCall(thinkStep, ev.ToolName),
			})
		case agent.EventToolResult:
			send(lifeTraceAssistantStreamChunk{
				Source:   cfg.Source,
				Model:    modelName,
				Thinking: buildAssistantThinkingResult(thinkStep, ev.ToolName, ev.ToolResult),
			})
			if payload := extractAssistantActionPayload(ev.ToolName, ev.ToolResult); payload != nil {
				send(lifeTraceAssistantStreamChunk{
					Source: cfg.Source,
					Model:  modelName,
					Action: payload,
				})
			}
		case agent.EventDone:
			if ev.Result != nil && strings.TrimSpace(ev.Result.Model) != "" {
				modelName = ev.Result.Model
			}
		case agent.EventError:
			loopErr = ev.Err
		}
	}

	if loopErr != nil {
		send(lifeTraceAssistantStreamChunk{
			Source: cfg.Source,
			Model:  modelName,
			Error:  fmt.Sprintf("生活助理执行失败:%v", loopErr),
		})
	}
	send(lifeTraceAssistantStreamChunk{Source: cfg.Source, Model: modelName, Done: true})
	return nil
}

// buildLifeTraceAssistantAgentMessages 把请求里的 History + Message
// 转成 agent 中性 Message 列表。System prompt 由 Spec.System 注入,不进这里。
func buildLifeTraceAssistantAgentMessages(req lifeTraceAssistantRequest) []agent.Message {
	msgs := make([]agent.Message, 0, len(req.History)+1)
	for _, item := range req.History {
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		role := agent.RoleUser
		switch strings.ToLower(strings.TrimSpace(item.Role)) {
		case "assistant", "ai", "bot":
			role = agent.RoleAssistant
		case "system":
			role = agent.RoleSystem
		}
		msgs = append(msgs, agent.Message{Role: role, Content: content})
	}
	if user := strings.TrimSpace(req.Message); user != "" {
		msgs = append(msgs, agent.Message{Role: agent.RoleUser, Content: user})
	}
	return msgs
}

// extractAssistantActionPayload 尝试从 create_* tool 的 envelope 里
// 反解出 lifeTraceAssistantActionPayload,供 SSE Action 事件复用。
// 只识别 create_plan / create_pantry_item / create_ledger_entry,查询类 tool 忽略。
func extractAssistantActionPayload(toolName string, raw json.RawMessage) *lifeTraceAssistantActionPayload {
	switch toolName {
	case "create_plan", "create_pantry_item", "create_ledger_entry":
	default:
		return nil
	}
	if len(raw) == 0 {
		return nil
	}
	var envelope struct {
		Payload *lifeTraceAssistantActionPayload `json:"payload"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil
	}
	return envelope.Payload
}

// assistantToolLabel 返回 tool 的中文可读名。未登记的 tool 直接回退成 tool 名。
func assistantToolLabel(toolName string) string {
	if label, ok := lifeTraceAssistantAgentToolLabels[toolName]; ok {
		return label
	}
	return toolName
}

// buildAssistantThinkingCall 构造"模型宣布调用 tool"这一步的思考事件。
func buildAssistantThinkingCall(step int, toolName string) *lifeTraceAssistantThinkingStep {
	return &lifeTraceAssistantThinkingStep{
		Step:  step,
		Phase: "call",
		Tool:  toolName,
		Label: assistantToolLabel(toolName),
	}
}

// buildAssistantThinkingResult 构造"tool 执行完毕"这一步的思考事件。
// raw 是 tool 的 envelope,期望包含 {ok, message?} 字段;字段缺失时按成功处理。
func buildAssistantThinkingResult(step int, toolName string, raw json.RawMessage) *lifeTraceAssistantThinkingStep {
	label := assistantToolLabel(toolName)
	envelope := struct {
		OK      *bool  `json:"ok"`
		Message string `json:"message"`
		Error   string `json:"error"`
	}{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &envelope)
	}
	ok := true
	if envelope.OK != nil {
		ok = *envelope.OK
	}
	summary := strings.TrimSpace(envelope.Message)
	if !ok && summary == "" {
		summary = strings.TrimSpace(envelope.Error)
	}
	return &lifeTraceAssistantThinkingStep{
		Step:    step,
		Phase:   "result",
		Tool:    toolName,
		Label:   label,
		Summary: summary,
		OK:      &ok,
	}
}
