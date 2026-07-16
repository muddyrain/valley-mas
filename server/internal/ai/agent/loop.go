package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"valley-server/internal/ai/tools"
	"valley-server/internal/aiusage"
)

const (
	defaultMaxSteps    = 6
	toolResultCharsMax = 2000
)

// LocalLoop 是阶段 A 的手写 tool loop 实现。
// 内部串行执行 tool_call：调 backend → 若无 tool_call 则终止 → 否则依次
// 执行 tool → append tool 消息 → 再调 backend，直到 MaxSteps 上限。
//
// 未来迁 CloudWeGo eino 时，只替换本文件即可。
type LocalLoop struct {
	Backend  Backend
	Registry *tools.Registry
}

// NewLocalLoop 构造 LocalLoop。
// backend 与 registry 都不能为 nil，否则 Run/RunStream 会立即返回错误。
func NewLocalLoop(backend Backend, registry *tools.Registry) *LocalLoop {
	return &LocalLoop{Backend: backend, Registry: registry}
}

// Run 同步执行 loop，返回最终 assistant 文本。
// 达到 MaxSteps 时返回 ErrMaxStepsExceeded 与最后一次 assistant 内容。
func (l *LocalLoop) Run(ctx context.Context, spec Spec, msgs []Message) (Result, error) {
	events, err := l.RunStream(ctx, spec, msgs)
	if err != nil {
		return Result{}, err
	}

	var reply strings.Builder
	var result Result
	var loopErr error
	for ev := range events {
		switch ev.Type {
		case EventDelta:
			reply.WriteString(ev.Delta)
		case EventDone:
			if ev.Result != nil {
				result = *ev.Result
			}
		case EventError:
			loopErr = ev.Err
		}
	}
	if result.Reply == "" {
		result.Reply = reply.String()
	}
	return result, loopErr
}

// RunStream 启动 loop 并通过 channel 分发 Event。channel 关闭表示会话结束。
func (l *LocalLoop) RunStream(ctx context.Context, spec Spec, msgs []Message) (<-chan Event, error) {
	if l.Backend == nil {
		return nil, fmt.Errorf("agent: backend is nil")
	}
	if l.Registry == nil {
		return nil, fmt.Errorf("agent: registry is nil")
	}
	maxSteps := spec.MaxSteps
	if maxSteps <= 0 {
		maxSteps = defaultMaxSteps
	}

	// 复制一份消息，避免修改调用方的 slice 底层数组。
	buf := make([]Message, 0, len(msgs)+maxSteps*2)
	if s := strings.TrimSpace(spec.System); s != "" {
		buf = append(buf, Message{Role: RoleSystem, Content: s})
	}
	buf = append(buf, msgs...)

	// 白名单过滤 tool。
	toolList := l.Registry.Filter("", spec.Tools)
	descriptors := make([]ToolDescriptor, 0, len(toolList))
	toolIndex := make(map[string]tools.Tool, len(toolList))
	for _, t := range toolList {
		descriptors = append(descriptors, ToolDescriptor{
			Name:        t.Name(),
			Description: t.Description(),
			Schema:      t.Schema(),
		})
		toolIndex[t.Name()] = t
	}

	out := make(chan Event, 8)
	go l.run(ctx, spec, buf, descriptors, toolIndex, maxSteps, out)
	return out, nil
}

func (l *LocalLoop) run(
	ctx context.Context,
	spec Spec,
	buf []Message,
	descriptors []ToolDescriptor,
	toolIndex map[string]tools.Tool,
	maxSteps int,
	out chan<- Event,
) {
	defer close(out)

	runStart := time.Now()
	var lastAssistant string
	var modelName string
	steps := 0

	for step := 0; step < maxSteps; step++ {
		if err := ctx.Err(); err != nil {
			emitError(out, err)
			return
		}
		steps = step + 1

		streamed := false
		var resp BackendResponse
		var err error
		if backend, ok := l.Backend.(StreamingBackend); ok {
			resp, err = backend.ChatStream(ctx, spec, buf, descriptors, func(delta string) {
				if strings.TrimSpace(delta) == "" {
					return
				}
				streamed = true
				out <- Event{Type: EventDelta, Delta: delta}
			})
		} else {
			resp, err = l.Backend.Chat(ctx, spec, buf, descriptors)
		}
		if err != nil {
			emitError(out, fmt.Errorf("agent: backend chat failed at step %d: %w", steps, err))
			return
		}
		if resp.Model != "" {
			modelName = resp.Model
		}

		buf = append(buf, resp.Message)
		lastAssistant = resp.Message.Content

		if len(resp.Message.ToolCalls) == 0 {
			// 终态：模型没有请求任何 tool。
			if !streamed && strings.TrimSpace(resp.Message.Content) != "" {
				out <- Event{Type: EventDelta, Delta: resp.Message.Content}
			}
			out <- Event{
				Type: EventDone,
				Result: &Result{
					Reply: resp.Message.Content,
					Steps: steps,
					Model: modelName,
				},
			}
			recordRun(ctx, spec, steps, modelName, runStart, nil)
			return
		}

		// 依次执行 tool。
		for i := range resp.Message.ToolCalls {
			tc := resp.Message.ToolCalls[i]
			out <- Event{Type: EventToolCall, ToolCall: &tc, ToolName: tc.Name}
			result, durationMs := runTool(ctx, spec, toolIndex, tc)
			buf = append(buf, Message{
				Role:       RoleTool,
				Content:    string(result),
				ToolCallID: tc.ID,
				ToolName:   tc.Name,
			})
			out <- Event{Type: EventToolResult, ToolName: tc.Name, ToolResult: result, ToolDurationMs: durationMs}
		}
	}

	// 达到 MaxSteps 上限。返回最后一次 assistant 内容作为兜底文本。
	err := fmt.Errorf("%w (steps=%d)", ErrMaxStepsExceeded, steps)
	if trimmed := strings.TrimSpace(lastAssistant); trimmed != "" {
		out <- Event{Type: EventDelta, Delta: lastAssistant}
	}
	out <- Event{
		Type:   EventDone,
		Result: &Result{Reply: lastAssistant, Steps: steps, Model: modelName},
	}
	out <- Event{Type: EventError, Err: err}
	recordRun(ctx, spec, steps, modelName, runStart, err)
}

func runTool(
	ctx context.Context,
	spec Spec,
	toolIndex map[string]tools.Tool,
	tc ToolCall,
) (json.RawMessage, int64) {
	stepStart := time.Now()

	tool, ok := toolIndex[tc.Name]
	if !ok {
		payload := errorPayload(fmt.Sprintf("tool %q not found", tc.Name))
		recordStep(ctx, spec, tc.Name, stepStart, fmt.Errorf("tool %q not found", tc.Name))
		return payload, time.Since(stepStart).Milliseconds()
	}
	result, err := tool.Run(ctx, tc.Args)
	if err != nil {
		recordStep(ctx, spec, tc.Name, stepStart, err)
		return errorPayload(err.Error()), time.Since(stepStart).Milliseconds()
	}
	if len(result) == 0 {
		result = json.RawMessage(`{"ok":true}`)
	}
	if len(result) > toolResultCharsMax {
		result = json.RawMessage(string(result[:toolResultCharsMax]))
	}
	recordStep(ctx, spec, tc.Name, stepStart, nil)
	return result, time.Since(stepStart).Milliseconds()
}

func errorPayload(message string) json.RawMessage {
	payload, _ := json.Marshal(map[string]any{"ok": false, "error": message})
	return payload
}

func emitError(out chan<- Event, err error) {
	out <- Event{Type: EventError, Err: err}
}

func recordStep(ctx context.Context, spec Spec, toolName string, start time.Time, err error) {
	feature := spec.Feature
	if feature == "" {
		feature = "agent"
	}
	audit := aiusage.FromContext(ctx)
	entry := aiusage.Entry{
		Feature:   feature + "-tool",
		Provider:  "agent",
		Model:     toolName,
		UserID:    audit.UserID,
		Status:    aiusage.StatusSuccess,
		LatencyMs: aiusage.Since(start),
	}
	if err != nil {
		entry.Status = aiusage.StatusFailed
		entry.ErrorMessage = err.Error()
	}
	aiusage.Record(entry)
}

func recordRun(ctx context.Context, spec Spec, steps int, model string, start time.Time, err error) {
	feature := spec.Feature
	if feature == "" {
		feature = "agent"
	}
	audit := aiusage.FromContext(ctx)
	entry := aiusage.Entry{
		Feature:   feature + "-run",
		Provider:  spec.Provider,
		Model:     model,
		UserID:    audit.UserID,
		Status:    aiusage.StatusSuccess,
		LatencyMs: aiusage.Since(start),
	}
	if err != nil {
		entry.Status = aiusage.StatusFailed
		entry.ErrorMessage = fmt.Sprintf("%v (steps=%d)", err, steps)
	}
	aiusage.Record(entry)
}
