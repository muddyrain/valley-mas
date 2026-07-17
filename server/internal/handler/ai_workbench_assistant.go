package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"valley-server/internal/aiapp"
	"valley-server/internal/aiclient"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

const (
	featureAIAppProposal   = "ai-workbench-agent-proposal"
	featurePromptAssistant = "ai-workbench-prompt-assistant"
	promptFieldSystem      = "system_prompt"
	promptFieldDescription = "description"
	promptFieldOpening     = "opening_message"
	promptFieldQuestions   = "example_questions"
	maxAgentDescription    = 500
)

type agentProposal struct {
	Name                     string                     `json:"name"`
	Description              string                     `json:"description"`
	Config                   aiapp.Config               `json:"config"`
	AvatarPrompt             string                     `json:"avatarPrompt"`
	ToolSuggestions          []agentToolSuggestion      `json:"toolSuggestions"`
	KnowledgeBaseSuggestions []agentKnowledgeSuggestion `json:"knowledgeBaseSuggestions"`
}

type agentToolSuggestion struct {
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

type agentKnowledgeSuggestion struct {
	ID     model.Int64String `json:"id"`
	Name   string            `json:"name"`
	Reason string            `json:"reason"`
}

type promptAssistantSuggestion struct {
	OptimizedPrompt  string   `json:"optimizedPrompt"`
	Description      string   `json:"description,omitempty"`
	Summary          []string `json:"summary"`
	OpeningMessage   string   `json:"openingMessage,omitempty"`
	ExampleQuestions []string `json:"exampleQuestions,omitempty"`
}

type promptAssistantAgentContext struct {
	Name             string   `json:"name"`
	Description      string   `json:"description"`
	SystemPrompt     string   `json:"systemPrompt"`
	OpeningMessage   string   `json:"openingMessage"`
	ExampleQuestions []string `json:"exampleQuestions"`
}

type structuredAIResult struct {
	Content          string
	Model            string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

var callWorkbenchStructuredAI = func(ctx context.Context, systemPrompt, userPrompt string) (structuredAIResult, error) {
	config, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		return structuredAIResult{}, errors.New(configErr)
	}
	client := aiclient.ARKClient(75 * time.Second)
	if client == nil {
		return structuredAIResult{}, errors.New("AI 未配置：缺少 ARK_API_KEY")
	}
	messages := []*arkmodel.ChatCompletionMessage{
		{Role: arkmodel.ChatMessageRoleSystem, Content: textARKMessageContent(systemPrompt)},
		{Role: arkmodel.ChatMessageRoleUser, Content: textARKMessageContent(userPrompt)},
	}
	response, err := client.CreateChatCompletion(ctx, aiclient.NewARKChatRequest(config.Model, messages, aiclient.WithARKChatTokens(4096), aiclient.WithARKChatTemperature(0.2)))
	if err != nil {
		return structuredAIResult{}, err
	}
	content, err := aiclient.ExtractARKContent(response)
	if err != nil {
		return structuredAIResult{}, err
	}
	modelName := strings.TrimSpace(response.Model)
	if modelName == "" {
		modelName = config.Model
	}
	return structuredAIResult{
		Content: content, Model: modelName,
		PromptTokens: response.Usage.PromptTokens, CompletionTokens: response.Usage.CompletionTokens, TotalTokens: response.Usage.TotalTokens,
	}, nil
}

func textARKMessageContent(value string) *arkmodel.ChatCompletionMessageContent {
	return &arkmodel.ChatCompletionMessageContent{StringValue: &value}
}

func runStructuredWorkbenchAI(ctx context.Context, feature string, userID model.Int64String, systemPrompt, userPrompt string, target any, validate func() error) error {
	started := time.Now()
	result, err := callWorkbenchStructuredAI(ctx, systemPrompt, userPrompt)
	repairEligible := false
	if err == nil {
		err = decodeStructuredWorkbenchOutput(result.Content, target)
		if err == nil && validate != nil {
			err = validate()
		}
		repairEligible = err != nil
	}
	if repairEligible && ctx.Err() == nil {
		repairSystem, repairUser := buildStructuredRepairRequest(systemPrompt, userPrompt, result.Content, err)
		result, err = callWorkbenchStructuredAI(ctx, repairSystem, repairUser)
		if err == nil {
			err = decodeStructuredWorkbenchOutput(result.Content, target)
			if err == nil && validate != nil {
				err = validate()
			}
		}
	}
	status := aiusage.StatusSuccess
	errorMessage := ""
	if err != nil {
		status = aiusage.StatusFailed
		errorMessage = err.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature: feature, Provider: "ark", Model: result.Model, UserID: userID.String(), Status: status,
		PromptChars:   utf8.RuneCountInString(systemPrompt) + utf8.RuneCountInString(userPrompt),
		ResponseChars: utf8.RuneCountInString(result.Content), PromptTokens: result.PromptTokens,
		CompletionTokens: result.CompletionTokens, TotalTokens: result.TotalTokens,
		LatencyMs: time.Since(started).Milliseconds(), ErrorMessage: errorMessage,
	})
	return err
}

func buildStructuredRepairRequest(systemPrompt, userPrompt, invalidOutput string, validationErr error) (string, string) {
	repairSystem := "你是 JSON 修复器。严格遵守原始输出合约，只输出一个合法 JSON 对象，不要 Markdown、解释或代码围栏。"
	repairUser := fmt.Sprintf("原始输出合约：\n%s\n\n原始任务：\n%s\n\n无效输出：\n%s\n\n校验错误：%s", truncateAIAgentRunes(systemPrompt, 8000), truncateAIAgentRunes(userPrompt, 12000), truncateAIAgentRunes(invalidOutput, 12000), validationErr.Error())
	return repairSystem, repairUser
}

func decodeStructuredWorkbenchOutput(raw string, target any) error {
	object := strings.TrimSpace(aiclient.ExtractJSONObject(raw))
	if object == "" {
		return errors.New("模型未返回 JSON 对象")
	}
	decoder := json.NewDecoder(strings.NewReader(object))
	decoder.DisallowUnknownFields()
	value := reflect.ValueOf(target)
	if value.Kind() != reflect.Pointer || value.IsNil() {
		return errors.New("结构化输出目标必须是非空指针")
	}
	value.Elem().Set(reflect.Zero(value.Elem().Type()))
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("结构化输出无效: %w", err)
	}
	return nil
}

func isARKConfigurationError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "AI 未配置")
}

func respondWorkbenchAIError(c *gin.Context, err error) {
	if c.Request.Context().Err() != nil {
		return
	}
	if isARKConfigurationError(err) {
		Error(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	Error(c, http.StatusBadGateway, "AI 未返回可用的结构化结果，请重试")
}

func CreateAIAppProposal(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload struct {
		Description string         `json:"description"`
		Current     *agentProposal `json:"current"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Description) == "" {
		Error(c, http.StatusBadRequest, "请描述你想创建的智能体")
		return
	}
	description := truncateAIAgentRunes(strings.TrimSpace(payload.Description), 4000)
	var knowledgeBases []model.AIKnowledgeBase
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC").Limit(50).Find(&knowledgeBases).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载知识库目录失败")
		return
	}
	catalog, _ := json.Marshal(knowledgeBases)
	current, _ := json.Marshal(payload.Current)
	systemPrompt := `你是 Valley 智能体设计助手。根据用户需求生成一个可编辑提案。严格只输出 JSON，字段必须且只能是：name、description、config、avatarPrompt、toolSuggestions、knowledgeBaseSuggestions。config 必须包含 modelProfile="ark-text-default"、systemPrompt、openingMessage、exampleQuestions；exampleQuestions 最多 4 条。toolSuggestions 只能推荐 content.search，且仅在确有搜索需求时推荐。知识库只能从给定目录选择，不能虚构 ID。提示词要明确角色、目标、约束、工作步骤、异常处理和输出格式。avatarPrompt 只描述无文字、方形、简洁统一风格的头像视觉概念。`
	userPrompt := fmt.Sprintf("用户需求：\n%s\n\n当前提案（可能为空）：\n%s\n\n可选知识库目录：\n%s", description, current, catalog)
	var proposal agentProposal
	err := runStructuredWorkbenchAI(c.Request.Context(), featureAIAppProposal, userID, systemPrompt, userPrompt, &proposal, func() error {
		return validateAgentProposal(&proposal, knowledgeBases)
	})
	if err != nil {
		respondWorkbenchAIError(c, err)
		return
	}
	Success(c, gin.H{"proposal": proposal})
}

func validateAgentProposal(proposal *agentProposal, catalog []model.AIKnowledgeBase) error {
	proposal.Name = truncateAIAgentRunes(strings.TrimSpace(proposal.Name), 100)
	proposal.Description = truncateAIAgentRunes(strings.TrimSpace(proposal.Description), 500)
	proposal.AvatarPrompt = truncateAIAgentRunes(strings.TrimSpace(proposal.AvatarPrompt), 500)
	proposal.Config = aiapp.Normalize(proposal.Config)
	if proposal.Name == "" || proposal.Description == "" {
		return errors.New("名称和简介不能为空")
	}
	if err := aiapp.ValidateGenerated(proposal.Config); err != nil {
		return err
	}
	for index := range proposal.ToolSuggestions {
		item := &proposal.ToolSuggestions[index]
		item.Name = strings.TrimSpace(item.Name)
		item.Reason = truncateAIAgentRunes(strings.TrimSpace(item.Reason), 240)
		if item.Name != "content.search" || item.Reason == "" {
			return errors.New("工具建议超出只读白名单")
		}
	}
	allowed := make(map[model.Int64String]string, len(catalog))
	for _, item := range catalog {
		allowed[item.ID] = item.Name
	}
	seen := map[model.Int64String]struct{}{}
	filtered := make([]agentKnowledgeSuggestion, 0, len(proposal.KnowledgeBaseSuggestions))
	for _, item := range proposal.KnowledgeBaseSuggestions {
		name, exists := allowed[item.ID]
		if !exists || strings.TrimSpace(item.Reason) == "" {
			return errors.New("知识库建议不在 owner 目录中")
		}
		if _, duplicate := seen[item.ID]; duplicate {
			continue
		}
		seen[item.ID] = struct{}{}
		item.Name = name
		item.Reason = truncateAIAgentRunes(strings.TrimSpace(item.Reason), 240)
		filtered = append(filtered, item)
	}
	proposal.KnowledgeBaseSuggestions = filtered
	return nil
}

var workflowVariablePattern = regexp.MustCompile(`\{\{[a-zA-Z0-9_-]+\.[a-zA-Z0-9_.-]+\}\}`)

func CreatePromptAssistantSuggestion(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload struct {
		Target            string                      `json:"target"`
		Field             string                      `json:"field"`
		Mode              string                      `json:"mode"`
		AppID             model.Int64String           `json:"appId"`
		CurrentPrompt     string                      `json:"currentPrompt"`
		Instruction       string                      `json:"instruction"`
		DebugRunIDs       []model.Int64String         `json:"debugRunIds"`
		AllowedVariables  []string                    `json:"allowedVariables"`
		GenerateGreetings bool                        `json:"generateGreetings"`
		AgentContext      promptAssistantAgentContext `json:"agentContext"`
		Stream            bool                        `json:"stream"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "提示词优化参数错误")
		return
	}
	payload.Target = strings.TrimSpace(payload.Target)
	payload.Field = strings.TrimSpace(payload.Field)
	if payload.Field == "" {
		payload.Field = promptFieldSystem
	}
	payload.Mode = strings.TrimSpace(payload.Mode)
	if payload.Target != "agent" && payload.Target != "workflow_llm" {
		Error(c, http.StatusBadRequest, "不支持的提示词目标")
		return
	}
	if payload.Mode != "auto" && payload.Mode != "instruction" && payload.Mode != "debug_run" {
		Error(c, http.StatusBadRequest, "不支持的优化模式")
		return
	}
	if payload.Field != promptFieldSystem && payload.Field != promptFieldDescription && payload.Field != promptFieldOpening && payload.Field != promptFieldQuestions {
		Error(c, http.StatusBadRequest, "不支持的 AI 生成字段")
		return
	}
	if payload.Target == "workflow_llm" && payload.Field != promptFieldSystem {
		Error(c, http.StatusBadRequest, "工作流节点仅支持优化提示词")
		return
	}
	currentPrompt := truncateAIAgentRunes(strings.TrimSpace(payload.CurrentPrompt), aiapp.MaxSystemPromptRunes)
	if payload.Field == promptFieldSystem && currentPrompt == "" {
		Error(c, http.StatusBadRequest, "当前提示词不能为空")
		return
	}
	if payload.Mode == "instruction" && strings.TrimSpace(payload.Instruction) == "" {
		Error(c, http.StatusBadRequest, "请填写调整要求")
		return
	}
	debugContext, err := loadPromptAssistantDebugContext(userID, payload.AppID, payload.DebugRunIDs, payload.Mode)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	allowedVariables := normalizeAllowedVariables(payload.AllowedVariables)
	variablesJSON, _ := json.Marshal(allowedVariables)
	payload.AgentContext.Name = truncateAIAgentRunes(strings.TrimSpace(payload.AgentContext.Name), 100)
	payload.AgentContext.Description = truncateAIAgentRunes(strings.TrimSpace(payload.AgentContext.Description), maxAgentDescription)
	payload.AgentContext.SystemPrompt = truncateAIAgentRunes(strings.TrimSpace(payload.AgentContext.SystemPrompt), aiapp.MaxSystemPromptRunes)
	payload.AgentContext.OpeningMessage = truncateAIAgentRunes(strings.TrimSpace(payload.AgentContext.OpeningMessage), aiapp.MaxOpeningMessageRunes)
	payload.AgentContext.ExampleQuestions = aiapp.Normalize(aiapp.Config{ExampleQuestions: payload.AgentContext.ExampleQuestions}).ExampleQuestions
	contextJSON, _ := json.Marshal(payload.AgentContext)
	systemPrompt := `你是 Valley 智能体创作助手。严格只输出 JSON，字段必须且只能是 optimizedPrompt、description、summary、openingMessage、exampleQuestions；未生成的字符串字段输出空字符串，未生成的数组字段输出空数组。summary 必须是 1-6 条简短摘要。不得声称拥有上下文中未提供的工具。`
	switch payload.Field {
	case promptFieldDescription:
		systemPrompt += ` 本次只生成智能体简介：description 必须是 1-2 句、清楚说明能力与适用场景、最多 500 字；其他内容字段保持为空。`
	case promptFieldOpening:
		systemPrompt += ` 本次只生成开场白：openingMessage 要符合智能体角色、自然友好并引导用户开始任务、最多 1000 字；其他内容字段保持为空。`
	case promptFieldQuestions:
		systemPrompt += ` 本次只生成 3-4 条可直接点击的用户示例问题，每条具体、互不重复且不超过 120 字；其他内容字段保持为空。`
	default:
		systemPrompt += ` 本次优化系统提示词：optimizedPrompt 必须保留用户原意，并补齐角色、目标、边界、步骤、异常处理和输出格式。除非要求同时生成问候语，否则 openingMessage 为空且 exampleQuestions 为空。description 保持为空。`
	}
	if payload.Target == "workflow_llm" {
		systemPrompt += ` 这是工作流 LLM 节点提示词。所有已有 {{node.output.field}} 变量必须原样保留，只能使用给定变量白名单，不能新增未知变量。`
	}
	userPrompt := fmt.Sprintf("目标：%s\n字段：%s\n模式：%s\n生成问候语：%t\n用户调整要求：%s\n合法变量：%s\n调试摘要：%s\n智能体上下文：%s\n\n当前字段内容：\n%s", payload.Target, payload.Field, payload.Mode, payload.GenerateGreetings, truncateAIAgentRunes(payload.Instruction, 2000), variablesJSON, debugContext, contextJSON, currentPrompt)
	var suggestion promptAssistantSuggestion
	validate := func() error {
		return validatePromptSuggestion(&suggestion, currentPrompt, payload.Target, allowedVariables, payload.GenerateGreetings, payload.Field)
	}
	if payload.Stream {
		streamPromptAssistantSuggestion(c, userID, systemPrompt, userPrompt, &suggestion, validate)
		return
	}
	err = runStructuredWorkbenchAI(c.Request.Context(), featurePromptAssistant, userID, systemPrompt, userPrompt, &suggestion, func() error {
		return validate()
	})
	if err != nil {
		respondWorkbenchAIError(c, err)
		return
	}
	Success(c, gin.H{"suggestion": suggestion})
}

func streamPromptAssistantSuggestion(c *gin.Context, userID model.Int64String, systemPrompt, userPrompt string, suggestion *promptAssistantSuggestion, validate func() error) {
	config, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		Error(c, http.StatusServiceUnavailable, configErr)
		return
	}
	client := aiclient.ARKClient(75 * time.Second)
	if client == nil {
		Error(c, http.StatusServiceUnavailable, "AI 未配置：缺少 ARK_API_KEY")
		return
	}
	messages := []*arkmodel.ChatCompletionMessage{
		{Role: arkmodel.ChatMessageRoleSystem, Content: textARKMessageContent(systemPrompt)},
		{Role: arkmodel.ChatMessageRoleUser, Content: textARKMessageContent(userPrompt)},
	}
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), aiclient.NewARKChatRequest(config.Model, messages, aiclient.WithARKChatTokens(4096), aiclient.WithARKChatTemperature(0.2)))
	if err != nil {
		Error(c, http.StatusBadGateway, "AI 上游调用失败")
		return
	}
	defer stream.Close()
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")
	started := time.Now()
	var builder strings.Builder
	result := structuredAIResult{Model: config.Model}
	for {
		response, recvErr := stream.Recv()
		if recvErr == io.EOF {
			break
		}
		if recvErr != nil {
			err = recvErr
			break
		}
		if strings.TrimSpace(response.Model) != "" {
			result.Model = response.Model
		}
		if response.Usage != nil {
			result.PromptTokens = response.Usage.PromptTokens
			result.CompletionTokens = response.Usage.CompletionTokens
			result.TotalTokens = response.Usage.TotalTokens
		}
		for _, choice := range response.Choices {
			if choice == nil || choice.Delta.Content == "" {
				continue
			}
			builder.WriteString(choice.Delta.Content)
			writeWorkbenchSSE(c, gin.H{"type": "delta", "chunk": choice.Delta.Content})
		}
	}
	result.Content = builder.String()
	if err == nil {
		err = decodeStructuredWorkbenchOutput(result.Content, suggestion)
		if err == nil {
			err = validate()
		}
		if err != nil && c.Request.Context().Err() == nil {
			repairSystem, repairUser := buildStructuredRepairRequest(systemPrompt, userPrompt, result.Content, err)
			var repaired structuredAIResult
			repaired, err = callWorkbenchStructuredAI(c.Request.Context(), repairSystem, repairUser)
			if err == nil {
				result.CompletionTokens += repaired.CompletionTokens
				result.PromptTokens += repaired.PromptTokens
				result.TotalTokens += repaired.TotalTokens
				result.Content = repaired.Content
				err = decodeStructuredWorkbenchOutput(repaired.Content, suggestion)
				if err == nil {
					err = validate()
				}
			}
		}
	}
	status := aiusage.StatusSuccess
	errorMessage := ""
	if err != nil {
		status = aiusage.StatusFailed
		errorMessage = err.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature: featurePromptAssistant, Provider: "ark", Model: result.Model, UserID: userID.String(), Status: status, Stream: true,
		PromptChars: utf8.RuneCountInString(systemPrompt) + utf8.RuneCountInString(userPrompt), ResponseChars: utf8.RuneCountInString(result.Content),
		PromptTokens: result.PromptTokens, CompletionTokens: result.CompletionTokens, TotalTokens: result.TotalTokens,
		LatencyMs: time.Since(started).Milliseconds(), ErrorMessage: errorMessage,
	})
	if c.Request.Context().Err() != nil {
		return
	}
	if err != nil {
		writeWorkbenchSSE(c, gin.H{"type": "error", "message": "AI 未返回可用的结构化结果，请重试"})
		return
	}
	writeWorkbenchSSE(c, gin.H{"type": "done", "suggestion": suggestion})
}

func writeWorkbenchSSE(c *gin.Context, event any) {
	encoded, _ := json.Marshal(event)
	_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", encoded)
	if flusher, ok := c.Writer.(http.Flusher); ok {
		flusher.Flush()
	}
}

func loadPromptAssistantDebugContext(userID, appID model.Int64String, runIDs []model.Int64String, mode string) (string, error) {
	if mode != "debug_run" {
		return "无", nil
	}
	if appID == 0 || len(runIDs) == 0 || len(runIDs) > 3 {
		return "", errors.New("请选择最近 1–3 次调试结果")
	}
	var app model.AIApp
	if err := database.GetDB().Where("id = ? AND user_id = ?", appID, userID).First(&app).Error; err != nil {
		return "", errors.New("智能体不存在或无权访问")
	}
	var runs []model.AIAppRun
	if err := database.GetDB().Where("app_id = ? AND user_id = ? AND id IN ?", appID, userID, runIDs).Order("created_at DESC").Find(&runs).Error; err != nil || len(runs) != len(runIDs) {
		return "", errors.New("调试结果不存在或无权访问")
	}
	items := make([]string, 0, len(runs))
	for _, run := range runs {
		items = append(items, fmt.Sprintf("状态=%s；错误码=%s；输入=%s；输出=%s", run.Status, run.ErrorCode, truncateAIAgentRunes(run.Input, 1200), truncateAIAgentRunes(run.Output, 1800)))
	}
	return strings.Join(items, "\n---\n"), nil
}

func normalizeAllowedVariables(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, raw := range values {
		value := strings.TrimSpace(raw)
		if !workflowVariablePattern.MatchString(value) || workflowVariablePattern.FindString(value) != value {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func validatePromptSuggestion(suggestion *promptAssistantSuggestion, original, target string, allowedVariables []string, greetings bool, field string) error {
	if len(suggestion.Summary) == 0 || len(suggestion.Summary) > 6 {
		return errors.New("修改摘要必须为 1–6 条")
	}
	for index := range suggestion.Summary {
		suggestion.Summary[index] = truncateAIAgentRunes(strings.TrimSpace(suggestion.Summary[index]), 160)
		if suggestion.Summary[index] == "" {
			return errors.New("修改摘要不能为空")
		}
	}
	if field == promptFieldDescription {
		suggestion.Description = strings.TrimSpace(suggestion.Description)
		if suggestion.Description == "" || utf8.RuneCountInString(suggestion.Description) > maxAgentDescription {
			return errors.New("生成的简介为空或过长")
		}
		return nil
	}
	if field == promptFieldOpening {
		suggestion.OpeningMessage = strings.TrimSpace(suggestion.OpeningMessage)
		if suggestion.OpeningMessage == "" || utf8.RuneCountInString(suggestion.OpeningMessage) > aiapp.MaxOpeningMessageRunes {
			return errors.New("生成的开场白为空或过长")
		}
		return nil
	}
	if field == promptFieldQuestions {
		config := aiapp.Normalize(aiapp.Config{ExampleQuestions: suggestion.ExampleQuestions})
		suggestion.ExampleQuestions = config.ExampleQuestions
		if len(suggestion.ExampleQuestions) == 0 || len(suggestion.ExampleQuestions) > aiapp.MaxExampleQuestions {
			return errors.New("生成的示例问题必须为 1–4 条")
		}
		for _, question := range suggestion.ExampleQuestions {
			if utf8.RuneCountInString(question) > aiapp.MaxExampleQuestionRunes {
				return errors.New("生成的示例问题过长")
			}
		}
		return nil
	}
	suggestion.OptimizedPrompt = strings.TrimSpace(suggestion.OptimizedPrompt)
	if suggestion.OptimizedPrompt == "" || utf8.RuneCountInString(suggestion.OptimizedPrompt) > aiapp.MaxSystemPromptRunes {
		return errors.New("优化后的提示词为空或过长")
	}
	if !greetings {
		suggestion.OpeningMessage = ""
		suggestion.ExampleQuestions = []string{}
	}
	config := aiapp.Config{ModelProfile: aiapp.ModelProfileARKTextDefault, SystemPrompt: suggestion.OptimizedPrompt, OpeningMessage: suggestion.OpeningMessage, ExampleQuestions: suggestion.ExampleQuestions}
	if err := aiapp.ValidateGenerated(config); err != nil {
		return err
	}
	if target == "workflow_llm" {
		allowed := make(map[string]struct{}, len(allowedVariables))
		for _, variable := range allowedVariables {
			allowed[variable] = struct{}{}
		}
		originalVariables := workflowVariablePattern.FindAllString(original, -1)
		optimizedVariables := workflowVariablePattern.FindAllString(suggestion.OptimizedPrompt, -1)
		optimizedSet := make(map[string]struct{}, len(optimizedVariables))
		for _, variable := range optimizedVariables {
			optimizedSet[variable] = struct{}{}
			if _, exists := allowed[variable]; !exists {
				return fmt.Errorf("优化结果包含未知变量 %s", variable)
			}
		}
		for _, variable := range originalVariables {
			if _, exists := optimizedSet[variable]; !exists {
				return fmt.Errorf("优化结果丢失变量 %s", variable)
			}
		}
	}
	return nil
}
