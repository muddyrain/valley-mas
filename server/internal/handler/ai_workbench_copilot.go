package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools"
	"valley-server/internal/aiclient"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	featureWorkbenchCopilot       = "ai-workbench-contextual-copilot"
	copilotARKTimeout             = 60 * time.Second
	copilotPlanningTimeout        = 90 * time.Second
	copilotActivityUpdateInterval = 12 * time.Second
)

var copilotPlanningActivities = []string{
	"等待 AI 返回，仍在处理中",
}

type copilotQuestion struct {
	ID      string   `json:"id"`
	Prompt  string   `json:"prompt"`
	Options []string `json:"options"`
}

type copilotAIEnvelope struct {
	Mode       string                       `json:"mode"`
	Message    string                       `json:"message"`
	TargetType string                       `json:"targetType"`
	Questions  []copilotQuestion            `json:"questions"`
	Operations []workflow.WorkflowOperation `json:"operations"`
	Workflow   *aiWorkflowDraft             `json:"workflow"`
	Agent      *agentProposal               `json:"agent"`
}

type copilotContextPayload struct {
	Draft          json.RawMessage   `json:"draft"`
	SelectedNodeID string            `json:"selectedNodeId"`
	NodeLabels     map[string]string `json:"nodeLabels"`
	RunID          string            `json:"runId"`
	BaseHash       string            `json:"baseHash"`
}

type copilotMessageRequest struct {
	Scope     string                `json:"scope"`
	TargetID  string                `json:"targetId"`
	SessionID string                `json:"sessionId"`
	Message   string                `json:"message"`
	Context   copilotContextPayload `json:"context"`
}

func workbenchCopilotEnabled() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("AI_WORKBENCH_COPILOT_ENABLED")))
	return value != "false" && value != "0" && value != "off" && value != "no"
}

func GetWorkbenchCopilotSession(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !workbenchCopilotEnabled() {
		Success(c, gin.H{"enabled": false, "messages": []any{}})
		return
	}
	scope := strings.TrimSpace(c.Query("scope"))
	targetID := strings.TrimSpace(c.Query("targetId"))
	if err := validateCopilotTarget(model.Int64String(userID), scope, targetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	session, err := loadCopilotSession(model.Int64String(userID), scope, targetID, strings.TrimSpace(c.Query("sessionId")))
	if err != nil {
		Error(c, http.StatusInternalServerError, "加载 AI 协作会话失败")
		return
	}
	var messages []model.AIWorkbenchCopilotMessage
	if err := database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, userID).Order("created_at DESC, id DESC").Limit(50).Find(&messages).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载 AI 协作记录失败")
		return
	}
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
	var proposals []model.AIWorkbenchChangeProposal
	_ = database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, userID).Order("created_at ASC").Find(&proposals).Error
	Success(c, gin.H{"enabled": true, "session": session, "messages": messages, "proposals": proposals})
}

func ListWorkbenchCopilotSessions(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !workbenchCopilotEnabled() {
		Success(c, gin.H{"enabled": false, "sessions": []any{}})
		return
	}
	scope := strings.TrimSpace(c.Query("scope"))
	targetID := strings.TrimSpace(c.Query("targetId"))
	if err := validateCopilotTarget(model.Int64String(userID), scope, targetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var sessions []model.AIWorkbenchCopilotSession
	if err := database.GetDB().Where("user_id = ? AND scope = ? AND target_id = ?", userID, scope, targetID).Order("updated_at DESC, id DESC").Limit(50).Find(&sessions).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载 AI 协作会话失败")
		return
	}
	Success(c, gin.H{"enabled": true, "sessions": sessions})
}

func CreateWorkbenchCopilotSession(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !workbenchCopilotEnabled() {
		Error(c, http.StatusNotFound, "AI 协作未启用")
		return
	}
	var payload struct {
		Scope    string `json:"scope"`
		TargetID string `json:"targetId"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "AI 协作会话请求无效")
		return
	}
	payload.Scope = strings.TrimSpace(payload.Scope)
	payload.TargetID = strings.TrimSpace(payload.TargetID)
	ownerID := model.Int64String(userID)
	if err := validateCopilotTarget(ownerID, payload.Scope, payload.TargetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	session := model.AIWorkbenchCopilotSession{UserID: ownerID, Scope: payload.Scope, TargetID: payload.TargetID, Title: "新会话"}
	if err := database.GetDB().Create(&session).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建 AI 协作会话失败")
		return
	}
	Success(c, gin.H{"session": session})
}

func StreamWorkbenchCopilotMessage(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if !workbenchCopilotEnabled() {
		Error(c, http.StatusNotFound, "AI 协作未启用")
		return
	}
	var payload copilotMessageRequest
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "AI 协作请求无效")
		return
	}
	payload.Scope = strings.TrimSpace(payload.Scope)
	payload.TargetID = strings.TrimSpace(payload.TargetID)
	payload.SessionID = strings.TrimSpace(payload.SessionID)
	payload.Message = truncateAIAgentRunes(strings.TrimSpace(payload.Message), 4000)
	if payload.Message == "" {
		Error(c, http.StatusBadRequest, "请输入要讨论的内容")
		return
	}
	ownerID := model.Int64String(userID)
	if err := validateCopilotTarget(ownerID, payload.Scope, payload.TargetID); err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	session, err := loadCopilotSession(ownerID, payload.Scope, payload.TargetID, payload.SessionID)
	if err != nil {
		Error(c, http.StatusInternalServerError, "创建 AI 协作会话失败")
		return
	}
	userMessage := model.AIWorkbenchCopilotMessage{SessionID: session.ID, UserID: ownerID, Role: "user", Kind: "text", Content: payload.Message}
	if err := database.GetDB().Create(&userMessage).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存消息失败")
		return
	}
	if session.Title == "AI 协作" || session.Title == "新会话" {
		session.Title = truncateAIAgentRunes(payload.Message, 36)
	}
	session.UpdatedAt = time.Now()
	_ = database.GetDB().Model(&session).Updates(map[string]any{"title": session.Title, "updated_at": session.UpdatedAt}).Error

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	sendCopilotEvent(c, "session", gin.H{"session": session})
	sendCopilotEvent(c, "activity", gin.H{"label": "正在读取当前草稿与可用能力"})

	draft, err := resolveCopilotDraft(ownerID, payload)
	if err != nil {
		sendCopilotEvent(c, "error", gin.H{"message": err.Error()})
		return
	}
	baseHash := canonicalJSONHash(draft)
	if payload.Context.BaseHash != "" && payload.Context.BaseHash != baseHash {
		sendCopilotEvent(c, "error", gin.H{"message": "当前草稿已变化，请重新发送需求"})
		return
	}

	var history []model.AIWorkbenchCopilotMessage
	_ = database.GetDB().Where("session_id = ? AND user_id = ?", session.ID, ownerID).Order("created_at DESC, id DESC").Limit(20).Find(&history).Error
	for left, right := 0, len(history)-1; left < right; left, right = left+1, right-1 {
		history[left], history[right] = history[right], history[left]
	}
	capabilities, _ := json.Marshal(compactCopilotCapabilities(workflowRuntimeRegistry()))
	type promptMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	promptHistory := make([]promptMessage, 0, len(history))
	for _, item := range history {
		promptHistory = append(promptHistory, promptMessage{Role: item.Role, Content: truncateAIAgentRunes(item.Content, 1000)})
	}
	historyJSON, _ := json.Marshal(promptHistory)
	draftJSON, _ := json.Marshal(draft)
	systemPrompt := `你是 Valley Graph v4 上下文副驾驶。严格只输出 JSON，字段必须且只能是 mode、message、targetType、questions、operations、workflow、agent。mode 只能是 answer、clarify、proposal。信息不足时用 clarify，给 1-3 个问题，每题 2-4 个简短选项。workflow 作用域的 proposal 只能返回 operations，workflow 必须为 null；不得返回完整候选图。operations 只能使用 startInput.upsert、startInput.remove、node.insert、node.update、node.remove、edge.connect、edge.disconnect。node.insert 优先使用 afterNodeId 或 beforeNodeId 自动重连。节点定位不唯一时必须 clarify，不得猜测。通用节点只有 start、end、llm、tool、condition、merge、variable、subworkflow；业务能力只能使用 tool/config.capabilityId。不得保存、运行、发布或实际调用工具。生成封面时，在用户指定的摘要节点后插入 tool/image.generateCover，默认直接执行；仅当用户明确要求依赖已有上游布尔输出时，才为该节点设置 node.when。不得为封面新增 Start 输入，不得创建 Condition，不得修改其他节点。agent 作用域继续在 agent 字段返回候选，operations 为空。`
	labelsJSON, _ := json.Marshal(payload.Context.NodeLabels)
	userPrompt := fmt.Sprintf("作用域：%s\n目标 ID：%s\n选中节点：%s\n节点名称映射：%s\n安全运行 ID：%s\n能力目录：%s\n最近对话：%s\n当前草稿：%s\n\n用户消息：%s", payload.Scope, payload.TargetID, payload.Context.SelectedNodeID, labelsJSON, payload.Context.RunID, capabilities, historyJSON, draftJSON, payload.Message)
	sendCopilotEvent(c, "activity", gin.H{"label": "正在理解需求"})
	var envelope copilotAIEnvelope
	var knowledgeBases []model.AIKnowledgeBase
	_ = database.GetDB().Where("user_id = ?", ownerID).Order("updated_at DESC").Limit(50).Find(&knowledgeBases).Error
	if payload.Scope == "workflow" {
		if planned, handled := planDeterministicWorkflowOperations(payload, draft); handled {
			sendCopilotEvent(c, "activity", gin.H{"label": "正在生成操作"})
			envelope = planned
			sendCopilotEvent(c, "activity", gin.H{"label": "正在应用操作并校验候选"})
			err = validateCopilotEnvelope(&envelope, knowledgeBases, payload, draft)
		}
	}
	if envelope.Mode == "" && err == nil {
		err = runCopilotPlanningWithActivity(
			c.Request.Context(),
			copilotPlanningTimeout,
			copilotActivityUpdateInterval,
			func(label string) { sendCopilotEvent(c, "activity", gin.H{"label": label}) },
			func(planningContext context.Context) error {
				sendCopilotEvent(c, "activity", gin.H{"label": "正在生成操作"})
				return runCopilotAgentStructured(planningContext, ownerID, systemPrompt, userPrompt, payload, draft, &envelope, func() error {
					sendCopilotEvent(c, "activity", gin.H{"label": "正在应用操作并校验候选"})
					return validateCopilotEnvelope(&envelope, knowledgeBases, payload, draft)
				})
			},
		)
	}
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		} else if errors.Is(err, context.DeadlineExceeded) {
			sendCopilotEvent(c, "error", gin.H{"message": "AI 规划超时，请重试或简化需求", "statusCode": http.StatusBadGateway})
		} else if isARKConfigurationError(err) {
			sendCopilotEvent(c, "error", gin.H{"message": err.Error(), "statusCode": http.StatusServiceUnavailable})
		} else {
			sendCopilotEvent(c, "error", gin.H{"message": "AI 未返回可用结果，请重试", "statusCode": http.StatusBadGateway})
		}
		return
	}

	assistantKind := envelope.Mode
	assistantMessage := model.AIWorkbenchCopilotMessage{SessionID: session.ID, UserID: ownerID, Role: "assistant", Kind: assistantKind, Content: envelope.Message}
	if err := database.GetDB().Create(&assistantMessage).Error; err != nil {
		sendCopilotEvent(c, "error", gin.H{"message": "保存 AI 回复失败"})
		return
	}
	for _, delta := range chunkCopilotText(envelope.Message, 48) {
		sendCopilotEvent(c, "assistant.delta", gin.H{"messageId": assistantMessage.ID, "content": delta})
	}
	if envelope.Mode == "clarify" {
		sendCopilotEvent(c, "clarification", gin.H{"messageId": assistantMessage.ID, "questions": envelope.Questions})
	}
	if envelope.Mode == "proposal" {
		proposal, proposalErr := persistCopilotProposal(session, ownerID, payload.TargetID, baseHash, draft, envelope)
		if proposalErr != nil {
			sendCopilotEvent(c, "error", gin.H{"message": "保存变更提案失败"})
			return
		}
		var candidate any
		var diff any
		_ = json.Unmarshal([]byte(proposal.Candidate), &candidate)
		_ = json.Unmarshal([]byte(proposal.Diff), &diff)
		sendCopilotEvent(c, "proposal", gin.H{"proposal": proposal, "candidate": candidate, "diff": diff})
	}
	sendCopilotEvent(c, "done", gin.H{"messageId": assistantMessage.ID})
}

type copilotReadOnlyTool struct {
	name        string
	description string
	schema      map[string]any
	run         func(context.Context, json.RawMessage) (any, error)
}

func (tool copilotReadOnlyTool) Name() string           { return tool.name }
func (tool copilotReadOnlyTool) Description() string    { return tool.description }
func (tool copilotReadOnlyTool) Schema() map[string]any { return tool.schema }
func (tool copilotReadOnlyTool) Scope() string          { return "workbench-copilot" }
func (tool copilotReadOnlyTool) Run(ctx context.Context, args json.RawMessage) (json.RawMessage, error) {
	result, err := tool.run(ctx, args)
	if err != nil {
		return nil, err
	}
	return json.Marshal(result)
}

func runCopilotPlanningWithActivity(
	ctx context.Context,
	timeout time.Duration,
	activityInterval time.Duration,
	onActivity func(string),
	run func(context.Context) error,
) error {
	planningContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	result := make(chan error, 1)
	go func() {
		result <- run(planningContext)
	}()

	ticker := time.NewTicker(activityInterval)
	defer ticker.Stop()
	activityIndex := 0
	for {
		select {
		case err := <-result:
			return err
		case <-planningContext.Done():
			return planningContext.Err()
		case <-ticker.C:
			if onActivity == nil {
				continue
			}
			index := activityIndex
			if index >= len(copilotPlanningActivities) {
				index = len(copilotPlanningActivities) - 1
			}
			onActivity(copilotPlanningActivities[index])
			activityIndex++
		}
	}
}

func runCopilotAgentStructured(ctx context.Context, userID model.Int64String, systemPrompt, userPrompt string, payload copilotMessageRequest, draft any, target any, validate func() error) error {
	arkConfig, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		return errors.New(configErr)
	}
	client := aiclient.ARKClient(copilotARKTimeout)
	if client == nil {
		return errors.New("AI 未配置：缺少 ARK_API_KEY")
	}
	registry := copilotToolRegistry(userID, payload, draft)
	loop := agent.NewLocalLoop(&aiAppAgentBackend{client: client}, registry)
	spec := agent.Spec{
		Provider: "ark", Model: arkConfig.Model, System: systemPrompt,
		Tools:    []string{"workbench.current", "workflow.capabilities", "workflow.runSummary", "workflow.validateDraft"},
		MaxSteps: 3, MaxTokens: 4096, Temperature: 0.2, Feature: featureWorkbenchCopilot,
	}
	if payload.Scope == "workflow" {
		spec.MaxTokens = 1500
		spec.MaxSteps = 1
		spec.Tools = []string{"workbench.current", "workflow.capabilities", "workflow.runSummary"}
	}
	ctx = aiusage.WithAudit(ctx, featureWorkbenchCopilot, userID.String())
	result, err := loop.Run(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: userPrompt}})
	return completeCopilotStructuredResult(ctx, result, err, target, validate, func(ctx context.Context, reply string, outputErr error) (agent.Result, error) {
		repairSystem, repairUser := buildStructuredRepairRequest(systemPrompt, userPrompt, reply, outputErr)
		spec.System = repairSystem
		spec.Tools = nil
		spec.MaxSteps = 1
		return loop.Run(ctx, spec, []agent.Message{{Role: agent.RoleUser, Content: repairUser}})
	})
}

func completeCopilotStructuredResult(
	ctx context.Context,
	result agent.Result,
	runErr error,
	target any,
	validate func() error,
	repair func(context.Context, string, error) (agent.Result, error),
) error {
	if runErr != nil {
		return runErr
	}
	outputErr := decodeStructuredWorkbenchOutput(result.Reply, target)
	if outputErr == nil && validate != nil {
		outputErr = validate()
	}
	if outputErr == nil {
		return nil
	}
	if err := ctx.Err(); err != nil {
		return err
	}

	repaired, repairErr := repair(ctx, result.Reply, outputErr)
	if repairErr != nil {
		return repairErr
	}
	if err := decodeStructuredWorkbenchOutput(repaired.Reply, target); err != nil {
		return err
	}
	if validate != nil {
		return validate()
	}
	return nil
}

func copilotToolRegistry(userID model.Int64String, payload copilotMessageRequest, draft any) *tools.Registry {
	registry := tools.NewRegistry()
	emptySchema := map[string]any{"type": "object", "properties": map[string]any{}, "additionalProperties": false}
	registry.MustRegister(copilotReadOnlyTool{
		name: "workbench.current", description: "检查当前工作台资产、选中节点和草稿基线。只返回标识与哈希。", schema: emptySchema,
		run: func(context.Context, json.RawMessage) (any, error) {
			return gin.H{"scope": payload.Scope, "targetId": payload.TargetID, "selectedNodeId": payload.Context.SelectedNodeID, "baseHash": canonicalJSONHash(draft)}, nil
		},
	})
	registry.MustRegister(copilotReadOnlyTool{
		name: "workflow.capabilities", description: "查询当前服务端开放的工作流节点能力目录。", schema: emptySchema,
		run: func(context.Context, json.RawMessage) (any, error) {
			return workflow.Capabilities(workflowRuntimeRegistry()), nil
		},
	})
	registry.MustRegister(copilotReadOnlyTool{
		name: "workflow.validateDraft", description: "校验完整候选工作流 Graph，返回业务校验错误；不会保存或运行。",
		schema: map[string]any{"type": "object", "properties": map[string]any{"graph": map[string]any{"type": "object"}}, "required": []string{"graph"}, "additionalProperties": false},
		run: func(_ context.Context, args json.RawMessage) (any, error) {
			var input struct {
				Graph workflow.Graph `json:"graph"`
			}
			if err := json.Unmarshal(args, &input); err != nil {
				return nil, err
			}
			errors := workflow.ValidateGraph(input.Graph, workflowRuntimeRegistry())
			return gin.H{"valid": len(errors) == 0, "errors": errors}, nil
		},
	})
	registry.MustRegister(copilotReadOnlyTool{
		name: "workflow.runSummary", description: "获取当前用户最近指定运行的安全状态摘要，不返回原始输入、文件或提示词。", schema: emptySchema,
		run: func(context.Context, json.RawMessage) (any, error) {
			if strings.TrimSpace(payload.Context.RunID) == "" {
				return gin.H{"available": false}, nil
			}
			var run model.WorkflowRun
			if err := database.GetDB().Select("id", "status", "started_at", "finished_at").Where("id = ? AND user_id = ?", payload.Context.RunID, userID).First(&run).Error; err != nil {
				return gin.H{"available": false}, nil
			}
			var nodes []model.WorkflowNodeRun
			_ = database.GetDB().Select("node_id", "node_type", "status", "error_code", "duration_ms").Where("workflow_run_id = ?", run.ID).Order("created_at ASC").Find(&nodes).Error
			return gin.H{"available": true, "run": run, "nodes": nodes}, nil
		},
	})
	return registry
}

func UpdateWorkbenchCopilotProposal(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	id, err := parsePathInt64(c, "proposalId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的提案 ID")
		return
	}
	var payload struct {
		Status      string `json:"status"`
		CurrentHash string `json:"currentHash"`
	}
	if c.ShouldBindJSON(&payload) != nil || (payload.Status != "accepted" && payload.Status != "rejected" && payload.Status != "reverted") {
		Error(c, http.StatusBadRequest, "提案状态无效")
		return
	}
	now := time.Now()
	query := database.GetDB().Model(&model.AIWorkbenchChangeProposal{}).Where("id = ? AND user_id = ?", id, userID)
	if payload.Status == "reverted" {
		query = query.Where("status = ? AND candidate_hash <> '' AND candidate_hash = ?", "accepted", strings.TrimSpace(payload.CurrentHash))
	} else {
		query = query.Where("status = ?", "pending")
	}
	result := query.Updates(map[string]any{"status": payload.Status, "resolved_at": &now})
	if result.Error != nil {
		Error(c, http.StatusInternalServerError, "更新提案失败")
		return
	}
	if result.RowsAffected == 0 {
		if payload.Status == "reverted" {
			Error(c, http.StatusConflict, "草稿已变化，无法安全撤销该提案")
		} else {
			Error(c, http.StatusConflict, "提案已处理或不存在")
		}
		return
	}
	Success(c, nil)
}

func resolveCopilotSession(userID model.Int64String, scope, targetID string) (model.AIWorkbenchCopilotSession, error) {
	var session model.AIWorkbenchCopilotSession
	err := database.GetDB().Where("user_id = ? AND scope = ? AND target_id = ?", userID, scope, targetID).Order("updated_at DESC, id DESC").First(&session).Error
	if err == nil {
		return session, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return session, err
	}
	session = model.AIWorkbenchCopilotSession{UserID: userID, Scope: scope, TargetID: targetID, Title: "新会话"}
	if err := database.GetDB().Create(&session).Error; err != nil {
		return session, err
	}
	return session, nil
}

func loadCopilotSession(userID model.Int64String, scope, targetID, sessionID string) (model.AIWorkbenchCopilotSession, error) {
	if sessionID == "" {
		return resolveCopilotSession(userID, scope, targetID)
	}
	id, err := strconv.ParseInt(sessionID, 10, 64)
	if err != nil || id <= 0 {
		return model.AIWorkbenchCopilotSession{}, errors.New("AI 协作会话无效")
	}
	var session model.AIWorkbenchCopilotSession
	err = database.GetDB().Where("id = ? AND user_id = ? AND scope = ? AND target_id = ?", id, userID, scope, targetID).First(&session).Error
	return session, err
}

func validateCopilotTarget(userID model.Int64String, scope, targetID string) error {
	switch scope {
	case "workbench":
		if targetID != "" {
			return errors.New("工作台首页不需要目标 ID")
		}
	case "workflow":
		if targetID == "" {
			return errors.New("请选择工作流")
		}
		var count int64
		if database.GetDB().Model(&model.Workflow{}).Where("id = ? AND user_id = ?", targetID, userID).Count(&count).Error != nil || count != 1 {
			return errors.New("工作流不存在")
		}
	case "agent":
		if targetID == "" {
			return errors.New("请选择智能体")
		}
		var count int64
		if database.GetDB().Model(&model.AIApp{}).Where("id = ? AND user_id = ? AND type = ?", targetID, userID, "agent").Count(&count).Error != nil || count != 1 {
			return errors.New("智能体不存在")
		}
	default:
		return errors.New("AI 协作作用域无效")
	}
	return nil
}

func resolveCopilotDraft(userID model.Int64String, payload copilotMessageRequest) (any, error) {
	if len(payload.Context.Draft) > 0 && string(payload.Context.Draft) != "null" {
		var draft any
		if err := json.Unmarshal(payload.Context.Draft, &draft); err != nil {
			return nil, errors.New("当前草稿格式无效")
		}
		return draft, nil
	}
	if payload.Scope == "workflow" {
		var definition model.Workflow
		if err := database.GetDB().Where("id = ? AND user_id = ?", payload.TargetID, userID).First(&definition).Error; err != nil {
			return nil, errors.New("工作流不存在")
		}
		var graph any
		if json.Unmarshal([]byte(definition.Graph), &graph) != nil {
			return nil, errors.New("工作流草稿格式无效")
		}
		return map[string]any{"name": definition.Name, "description": definition.Description, "graph": graph}, nil
	}
	return map[string]any{}, nil
}

func validateCopilotEnvelope(envelope *copilotAIEnvelope, knowledgeBases []model.AIKnowledgeBase, payload copilotMessageRequest, base any) error {
	envelope.Mode = strings.TrimSpace(envelope.Mode)
	envelope.Message = truncateAIAgentRunes(strings.TrimSpace(envelope.Message), 4000)
	if envelope.Message == "" {
		return errors.New("AI 回复不能为空")
	}
	switch envelope.Mode {
	case "answer":
		return nil
	case "clarify":
		if len(envelope.Questions) < 1 || len(envelope.Questions) > 3 {
			return errors.New("澄清问题必须为 1 到 3 个")
		}
		for index := range envelope.Questions {
			question := &envelope.Questions[index]
			question.ID = truncateAIAgentRunes(strings.TrimSpace(question.ID), 40)
			question.Prompt = truncateAIAgentRunes(strings.TrimSpace(question.Prompt), 300)
			if question.ID == "" || question.Prompt == "" || len(question.Options) < 2 || len(question.Options) > 4 {
				return errors.New("澄清问题结构无效")
			}
		}
		return nil
	case "proposal":
		if envelope.TargetType == "workflow" && payload.Scope == "workflow" {
			if len(envelope.Operations) == 0 {
				return errors.New("工作流提案必须包含 operations")
			}
			if envelope.Workflow != nil {
				return errors.New("修改工作流时不得返回完整候选 Graph")
			}
			baseDraft, err := decodeCopilotWorkflowDraft(base)
			if err != nil {
				return err
			}
			candidateGraph, err := workflow.ApplyOperations(baseDraft.Graph, envelope.Operations, workflowRuntimeRegistry())
			if err != nil {
				return err
			}
			envelope.Workflow = &aiWorkflowDraft{Name: baseDraft.Name, Description: baseDraft.Description, Graph: candidateGraph}
			return validateCopilotWorkflowEditIntent(payload, base, envelope.Workflow)
		}
		if envelope.TargetType == "workflow" && envelope.Workflow != nil {
			return validateAIWorkflowDraft(envelope.Workflow)
		}
		if envelope.TargetType == "agent" && envelope.Agent != nil {
			return validateAgentProposal(envelope.Agent, knowledgeBases)
		}
		return errors.New("提案目标与候选草稿不匹配")
	default:
		return errors.New("AI 回复模式无效")
	}
}

func decodeCopilotWorkflowDraft(value any) (aiWorkflowDraft, error) {
	raw, _ := json.Marshal(value)
	var draft aiWorkflowDraft
	if err := json.Unmarshal(raw, &draft); err != nil || draft.Graph.SchemaVersion == 0 {
		return aiWorkflowDraft{}, errors.New("无法读取基础工作流")
	}
	return draft, nil
}

func compactCopilotCapabilities(registry *workflow.Registry) map[string]any {
	catalog := workflow.Capabilities(registry)
	tools := make([]map[string]any, 0, len(catalog.ToolCapabilities))
	for _, capability := range catalog.ToolCapabilities {
		tools = append(tools, map[string]any{"id": capability.ID, "inputSchema": capability.InputSchema, "outputSchema": capability.OutputSchema, "sideEffect": capability.SideEffect, "aiUsage": capability.AIUsage})
	}
	nodeTypes := make([]workflow.NodeType, 0, len(catalog.NodeTypes))
	for _, definition := range catalog.NodeTypes {
		nodeTypes = append(nodeTypes, definition.Type)
	}
	return map[string]any{"schemaVersion": workflow.SchemaVersion, "nodeTypes": nodeTypes, "tools": tools, "limits": catalog.Limits}
}

func planDeterministicWorkflowOperations(payload copilotMessageRequest, base any) (copilotAIEnvelope, bool) {
	message := strings.TrimSpace(payload.Message)
	if !strings.Contains(message, "封面") || !containsAny(message, "勾选", "不勾选", "是否生成", "生成封面") {
		return copilotAIEnvelope{}, false
	}
	draft, err := decodeCopilotWorkflowDraft(base)
	if err != nil {
		return copilotAIEnvelope{}, false
	}
	matchingIDs := make([]string, 0, 2)
	for id, label := range payload.Context.NodeLabels {
		if strings.TrimSpace(label) != "" && strings.Contains(message, strings.TrimSpace(label)) {
			matchingIDs = append(matchingIDs, id)
		}
	}
	if len(matchingIDs) == 0 && containsAny(message, "当前节点", "这个节点", "此节点") && payload.Context.SelectedNodeID != "" {
		matchingIDs = append(matchingIDs, payload.Context.SelectedNodeID)
	}
	if len(matchingIDs) != 1 {
		return copilotAIEnvelope{Mode: "clarify", Message: "我需要确认封面节点插入到哪一步之后。", TargetType: "workflow", Questions: []copilotQuestion{{ID: "cover_anchor", Prompt: "请选择生成封面的上一步", Options: copilotNodeOptions(draft.Graph, payload.Context.NodeLabels)}}}, true
	}
	anchorID := matchingIDs[0]
	anchorIndex := -1
	for index, node := range draft.Graph.Nodes {
		if node.ID == anchorID {
			anchorIndex = index
			break
		}
	}
	if anchorIndex < 0 {
		return copilotAIEnvelope{}, false
	}
	outgoing := 0
	for _, edge := range draft.Graph.Edges {
		if edge.Source == anchorID {
			outgoing++
		}
	}
	if outgoing != 1 {
		return copilotAIEnvelope{Mode: "clarify", Message: "这个节点有多个下游，需要先确认封面应插入哪条路径。", TargetType: "workflow", Questions: []copilotQuestion{{ID: "cover_path", Prompt: "封面生成应连接到哪个下游？", Options: copilotDownstreamOptions(draft.Graph, anchorID)}}}, true
	}
	coverID := uniqueWorkflowNodeID(draft.Graph, "generate-cover")
	summaryField := "text"
	anchor := draft.Graph.Nodes[anchorIndex]
	if anchor.Type == workflow.NodeTypeTool {
		var config struct {
			CapabilityID string `json:"capabilityId"`
		}
		_ = json.Unmarshal(anchor.Config, &config)
		if config.CapabilityID == workflow.CapabilityParseMarkdown {
			summaryField = "excerpt"
		}
	}
	titleReference := "{{" + anchorID + ".output." + summaryField + "}}"
	for _, node := range draft.Graph.Nodes {
		if node.Type != workflow.NodeTypeStart {
			continue
		}
		var config struct {
			Inputs map[string]any `json:"inputs"`
		}
		_ = json.Unmarshal(node.Config, &config)
		if _, exists := config.Inputs["title"]; exists {
			titleReference = "{{" + node.ID + ".output.title}}"
		}
	}
	coverConfig, _ := json.Marshal(map[string]any{"capabilityId": workflow.CapabilityGenerateCover, "inputs": map[string]any{"title": titleReference, "summary": "{{" + anchorID + ".output." + summaryField + "}}", "style": "editorial"}})
	coverNode := workflow.Node{ID: coverID, Type: workflow.NodeTypeTool, Label: "生成封面", Position: workflow.Position{X: anchor.Position.X + 280, Y: anchor.Position.Y}, Config: coverConfig}
	operations := []workflow.WorkflowOperation{
		{Type: workflow.OperationNodeInsert, Node: &coverNode, AfterNodeID: anchorID},
	}
	return copilotAIEnvelope{Mode: "proposal", Message: "已在指定摘要节点后增加生成封面节点。", TargetType: "workflow", Questions: []copilotQuestion{}, Operations: operations}, true
}

func uniqueWorkflowNodeID(graph workflow.Graph, prefix string) string {
	used := map[string]bool{}
	for _, node := range graph.Nodes {
		used[node.ID] = true
	}
	if !used[prefix] {
		return prefix
	}
	for index := 2; ; index++ {
		candidate := fmt.Sprintf("%s-%d", prefix, index)
		if !used[candidate] {
			return candidate
		}
	}
}

func copilotNodeOptions(graph workflow.Graph, labels map[string]string) []string {
	options := make([]string, 0, 4)
	for _, node := range graph.Nodes {
		if node.Type == workflow.NodeTypeStart || node.Type == workflow.NodeTypeEnd {
			continue
		}
		label := strings.TrimSpace(labels[node.ID])
		if label == "" {
			label = node.Label
		}
		if label != "" {
			options = append(options, label)
		}
		if len(options) == 4 {
			break
		}
	}
	if len(options) < 2 {
		options = append(options, "生成摘要", "创建草稿")
	}
	return options[:minInt(len(options), 4)]
}

func copilotDownstreamOptions(graph workflow.Graph, sourceID string) []string {
	labels := map[string]string{}
	for _, node := range graph.Nodes {
		labels[node.ID] = node.Label
	}
	options := []string{}
	for _, edge := range graph.Edges {
		if edge.Source == sourceID {
			label := labels[edge.Target]
			if label == "" {
				label = edge.Target
			}
			options = append(options, label)
		}
	}
	if len(options) < 2 {
		options = append(options, "主流程", "另一路径")
	}
	return options[:minInt(len(options), 4)]
}

func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}

func validateCopilotWorkflowEditIntent(payload copilotMessageRequest, base any, candidate *aiWorkflowDraft) error {
	message := strings.TrimSpace(payload.Message)
	if !strings.Contains(message, "封面") {
		return nil
	}
	var baseDraft struct {
		Graph workflow.Graph `json:"graph"`
	}
	baseJSON, _ := json.Marshal(base)
	if json.Unmarshal(baseJSON, &baseDraft) != nil {
		return errors.New("无法读取基础工作流")
	}
	baseNodeIDs := make(map[string]struct{}, len(baseDraft.Graph.Nodes))
	for _, node := range baseDraft.Graph.Nodes {
		baseNodeIDs[node.ID] = struct{}{}
	}
	coverID := ""
	for _, node := range candidate.Graph.Nodes {
		if node.Type != workflow.NodeTypeTool {
			continue
		}
		var toolConfig struct {
			CapabilityID string `json:"capabilityId"`
		}
		_ = json.Unmarshal(node.Config, &toolConfig)
		if toolConfig.CapabilityID != workflow.CapabilityGenerateCover {
			continue
		}
		if _, existed := baseNodeIDs[node.ID]; !existed {
			coverID = node.ID
			break
		}
	}
	if coverID == "" {
		return errors.New("封面需求必须新增 image.generateCover 节点")
	}
	anchorID := namedCopilotNodeID(message, payload.Context.NodeLabels)
	if anchorID == "" && containsAny(message, "当前节点", "这个节点", "此节点") {
		anchorID = strings.TrimSpace(payload.Context.SelectedNodeID)
	}
	if anchorID == "" {
		return nil
	}
	if _, exists := baseNodeIDs[anchorID]; !exists {
		return errors.New("用户指定的插入节点不在当前工作流中")
	}
	originalTargets := map[string]struct{}{}
	for _, edge := range baseDraft.Graph.Edges {
		if edge.Source == anchorID {
			originalTargets[edge.Target] = struct{}{}
		}
	}
	hasAnchorToCover := false
	coverTargets := map[string]struct{}{}
	for _, edge := range candidate.Graph.Edges {
		if edge.Source == anchorID && edge.Target == coverID {
			hasAnchorToCover = true
		}
		if edge.Source == anchorID {
			if _, wasOriginal := originalTargets[edge.Target]; wasOriginal {
				return errors.New("插入封面节点后必须移除锚点原出边")
			}
		}
		if edge.Source == coverID {
			coverTargets[edge.Target] = struct{}{}
		}
	}
	if !hasAnchorToCover {
		return errors.New("封面节点必须直接插入用户指定节点之后")
	}
	for target := range originalTargets {
		if _, exists := coverTargets[target]; !exists {
			return errors.New("封面节点必须重新连接原下游节点")
		}
	}
	return nil
}

func namedCopilotNodeID(message string, labels map[string]string) string {
	type entry struct{ id, label string }
	entries := make([]entry, 0, len(labels))
	for id, label := range labels {
		label = strings.TrimSpace(label)
		if strings.TrimSpace(id) != "" && label != "" {
			entries = append(entries, entry{id: id, label: label})
		}
	}
	sort.Slice(entries, func(i, j int) bool { return len([]rune(entries[i].label)) > len([]rune(entries[j].label)) })
	for _, item := range entries {
		if strings.Contains(message, item.label) {
			return item.id
		}
	}
	return ""
}

func containsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if strings.Contains(value, candidate) {
			return true
		}
	}
	return false
}

func persistCopilotProposal(session model.AIWorkbenchCopilotSession, userID model.Int64String, targetID, baseHash string, base any, envelope copilotAIEnvelope) (model.AIWorkbenchChangeProposal, error) {
	var candidate any
	if envelope.TargetType == "workflow" {
		candidate = envelope.Workflow
	} else {
		candidate = envelope.Agent
	}
	candidateJSON, _ := json.Marshal(candidate)
	baseJSON, _ := json.Marshal(base)
	diffJSON, _ := json.Marshal(copilotSemanticDiff(envelope.TargetType, base, candidate, envelope.Operations))
	proposal := model.AIWorkbenchChangeProposal{SessionID: session.ID, UserID: userID, TargetType: envelope.TargetType, TargetID: targetID, BaseHash: baseHash, BaseDraft: string(baseJSON), Candidate: string(candidateJSON), CandidateHash: canonicalJSONHash(candidate), Diff: string(diffJSON), Status: "pending"}
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.AIWorkbenchChangeProposal{}).Where("session_id = ? AND user_id = ? AND status = ?", session.ID, userID, "pending").Update("status", "superseded").Error; err != nil {
			return err
		}
		return tx.Create(&proposal).Error
	})
	return proposal, err
}

func copilotSemanticDiff(targetType string, base any, candidate any, operations []workflow.WorkflowOperation) map[string]any {
	if targetType != "workflow" {
		return map[string]any{"summary": []string{"更新智能体名称、简介或编排字段"}}
	}
	baseJSON, _ := json.Marshal(base)
	var baseDraft struct {
		Graph workflow.Graph `json:"graph"`
	}
	_ = json.Unmarshal(baseJSON, &baseDraft)
	candidateJSON, _ := json.Marshal(candidate)
	var next aiWorkflowDraft
	_ = json.Unmarshal(candidateJSON, &next)
	baseNodes := make(map[string]workflow.Node, len(baseDraft.Graph.Nodes))
	for _, node := range baseDraft.Graph.Nodes {
		baseNodes[node.ID] = node
	}
	nextNodes := make(map[string]workflow.Node, len(next.Graph.Nodes))
	for _, node := range next.Graph.Nodes {
		nextNodes[node.ID] = node
	}
	added, removed, updated := []string{}, []string{}, []string{}
	for id, node := range nextNodes {
		previous, exists := baseNodes[id]
		if !exists {
			added = append(added, id)
		} else if previous.Type != node.Type || string(previous.Config) != string(node.Config) {
			updated = append(updated, id)
		}
	}
	for id := range baseNodes {
		if _, exists := nextNodes[id]; !exists {
			removed = append(removed, id)
		}
	}
	sort.Strings(added)
	sort.Strings(removed)
	sort.Strings(updated)
	risks := []string{}
	for _, node := range next.Graph.Nodes {
		if node.Type == workflow.NodeTypeTool {
			var config struct {
				CapabilityID string `json:"capabilityId"`
			}
			_ = json.Unmarshal(node.Config, &config)
			if config.CapabilityID != workflow.CapabilityCreateBlogDraft {
				continue
			}
			risks = append(risks, "试运行会创建博客草稿")
		}
	}
	return map[string]any{"schemaFrom": baseDraft.Graph.SchemaVersion, "schemaTo": next.Graph.SchemaVersion, "added": added, "removed": removed, "updated": updated, "risks": risks, "operations": operations}
}

func canonicalJSONHash(value any) string {
	raw, _ := json.Marshal(value)
	var normalized any
	if json.Unmarshal(raw, &normalized) == nil {
		raw, _ = json.Marshal(normalized)
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func sendCopilotEvent(c *gin.Context, eventType string, data any) {
	encoded, _ := json.Marshal(gin.H{"type": eventType, "data": data})
	_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", encoded)
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func chunkCopilotText(value string, size int) []string {
	characters := []rune(value)
	if size <= 0 || len(characters) <= size {
		return []string{value}
	}
	chunks := make([]string, 0, (len(characters)+size-1)/size)
	for start := 0; start < len(characters); start += size {
		end := start + size
		if end > len(characters) {
			end = len(characters)
		}
		chunks = append(chunks, string(characters[start:end]))
	}
	return chunks
}
