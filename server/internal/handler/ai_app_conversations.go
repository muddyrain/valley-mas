package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/ai/agent"
	"valley-server/internal/ai/tools/content"
	filetool "valley-server/internal/ai/tools/file"
	imagetool "valley-server/internal/ai/tools/image"
	"valley-server/internal/aiapp"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const aiAppConversationHistoryLimit = 24

const aiAppConversationRuntimePrompt = `平台对话规则（优先于智能体自定义指令）：你正在与用户进行多轮对话。请直接回应最新一条用户消息的实际意图，并结合此前对话理解上下文。智能体自定义指令中的角色、能力说明、示例或视觉描述只约束你的回答方式，不代表用户本轮已经提出了对应任务；除非用户明确提出，否则不要擅自执行或补全这些任务。若最新消息只是问候、确认或信息不足，请自然回应或简短澄清，不要把自定义指令直接复述成答案。`

func buildAIAppConversationSystemPrompt(customPrompt, knowledgeContext string) string {
	parts := make([]string, 0, 3)
	if customPrompt = strings.TrimSpace(customPrompt); customPrompt != "" {
		parts = append(parts, "智能体自定义指令：\n"+customPrompt)
	}
	if knowledgeContext = strings.TrimSpace(knowledgeContext); knowledgeContext != "" {
		parts = append(parts, "以下是与当前问题相关的私有参考资料。请优先依据这些资料回答；资料不足时明确说明。引用资料中的事实时，在对应句子后保留资料编号，例如 [1]；不要编造不存在的编号。\n"+knowledgeContext)
	}
	parts = append(parts, aiAppConversationRuntimePrompt)
	return strings.Join(parts, "\n\n")
}

func appendAIAppConversationImageContext(system string, referenceCount int, styleProfileID string) string {
	parts := []string{strings.TrimSpace(system)}
	if referenceCount > 0 {
		parts = append(parts, "本轮用户上传了图片，图片内容已直接提供给视觉模型。请先理解图片并回答用户的真实问题；只有用户明确要求生成、重绘或编辑图片时，才调用图片生成工具，并把上传图片作为参考图。")
	}
	if strings.TrimSpace(styleProfileID) != "" {
		parts = append(parts, "本轮用户显式选择了一个已绑定技能作为视觉风格。若调用图片工具，必须保留该技能对应的视觉风格，不要把它误解为用户已经要求执行其他任务。")
	}
	return strings.Join(parts, "\n\n")
}

func selectedAIAppImageStyle(config aiapp.Config, selected []string) (string, error) {
	if len(selected) == 0 {
		return "", nil
	}
	if len(selected) > 1 {
		return "", errors.New("一次只能选择一个视觉技能")
	}
	id := strings.TrimSpace(selected[0])
	for _, boundID := range config.SkillIDs {
		if id == boundID {
			return "skill:" + id, nil
		}
	}
	return "", errors.New("所选技能未绑定到当前智能体")
}

func imageGenerationIDsFromToolResult(toolName string, result json.RawMessage) []string {
	if toolName != imagetool.ToolName {
		return nil
	}
	var payload struct {
		OK           bool   `json:"ok"`
		GenerationID string `json:"generationId"`
	}
	if json.Unmarshal(result, &payload) != nil || !payload.OK || strings.TrimSpace(payload.GenerationID) == "" {
		return nil
	}
	return []string{payload.GenerationID}
}

func uniqueAIAppGenerationIDs(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, raw := range values {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func findAIAppConversation(db *gorm.DB, userID, appID, conversationID model.Int64String) (model.AIAppConversation, bool) {
	var conversation model.AIAppConversation
	if db.Where("id = ? AND user_id = ? AND app_id = ? AND status = ?", conversationID, userID, appID, "active").First(&conversation).Error != nil {
		return conversation, false
	}
	return conversation, true
}

func aiAppConversationContext(c *gin.Context) (model.Int64String, model.AIApp, bool) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return 0, model.AIApp{}, false
	}
	app, found := findAIApp(c, userID)
	if !found {
		return 0, model.AIApp{}, false
	}
	if app.Type != aiAppTypeAgent {
		Error(c, http.StatusBadRequest, "当前仅支持智能体私有会话")
		return 0, model.AIApp{}, false
	}
	return userID, app, true
}

func ListAIAppConversations(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	var conversations []model.AIAppConversation
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND status = ?", userID, app.ID, "active").Order("updated_at DESC").Find(&conversations).Error; err != nil {
		Error(c, 500, "加载私有会话失败")
		return
	}
	Success(c, gin.H{"list": conversations})
}

func CreateAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	var payload struct {
		Title string `json:"title"`
	}
	_ = c.ShouldBindJSON(&payload)
	versionID := app.DraftVersionID
	if versionID == 0 {
		versionID = app.PublishedVersionID
	}
	if versionID == 0 {
		Error(c, http.StatusBadRequest, "请先保存智能体配置")
		return
	}
	var version model.AIAppVersion
	if database.GetDB().Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error != nil {
		Error(c, http.StatusBadRequest, "智能体配置不存在")
		return
	}
	conversation := model.AIAppConversation{UserID: userID, AppID: app.ID, VersionID: version.ID, Title: truncateAIAgentRunes(payload.Title, 120)}
	if database.GetDB().Create(&conversation).Error != nil {
		Error(c, 500, "创建私有会话失败")
		return
	}
	Success(c, gin.H{"conversation": conversation})
}

func GetAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	var messages []model.AIAppConversationMessage
	var traces []model.AIAppConversationToolTrace
	var runs []model.AIAppRun
	var attachments []model.AIAppConversationAttachment
	var artifacts []model.AIAppArtifact
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&messages).Error; err != nil {
		Error(c, 500, "加载会话消息失败")
		return
	}
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&traces).Error; err != nil {
		Error(c, 500, "加载工具轨迹失败")
		return
	}
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&runs).Error; err != nil {
		Error(c, 500, "加载会话运行记录失败")
		return
	}
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&attachments).Error; err != nil {
		Error(c, 500, "加载会话文件失败")
		return
	}
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at ASC").Find(&artifacts).Error; err != nil {
		Error(c, 500, "加载成果文件失败")
		return
	}
	Success(c, gin.H{
		"conversation":      conversation,
		"messages":          messages,
		"toolTraces":        traces,
		"runs":              runs,
		"referencesByRunId": aiAppConversationReferencesByRunID(runs),
		"attachments":       attachments,
		"artifacts":         artifacts,
	})
}

func aiAppConversationReferencesByRunID(runs []model.AIAppRun) map[string][]aiKnowledgeReference {
	referencesByRunID := make(map[string][]aiKnowledgeReference)
	for _, run := range runs {
		var references []aiKnowledgeReference
		if json.Unmarshal([]byte(run.References), &references) != nil || len(references) == 0 {
			continue
		}
		referencesByRunID[run.ID.String()] = references
	}
	return referencesByRunID
}

func writeAIAppConversationFailure(
	c *gin.Context,
	status int,
	errorCode string,
	message string,
	run model.AIAppRun,
	userMessage model.AIAppConversationMessage,
	cause error,
) {
	logger.Error(c, "AI App conversation failed", cause, logrus.Fields{
		"error_code":      errorCode,
		"run_id":          run.ID,
		"conversation_id": run.ConversationID,
	})
	c.JSON(status, gin.H{
		"code":      status,
		"errorCode": errorCode,
		"message":   message,
		"data": gin.H{
			"run":         run,
			"userMessage": userMessage,
		},
		"logId": logger.GetLogID(c),
	})
}

func DeleteAIAppConversation(c *gin.Context) {
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		query := "user_id = ? AND app_id = ? AND conversation_id = ?"
		var taskIDs []model.Int64String
		if err := tx.Model(&model.AIAppTask{}).Where(query, userID, app.ID, conversation.ID).Pluck("id", &taskIDs).Error; err != nil {
			return err
		}
		if len(taskIDs) > 0 {
			if err := tx.Where("user_id = ? AND task_id IN ?", userID, taskIDs).Delete(&model.AIAppToolApproval{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppConversationMessage{}).Error; err != nil {
			return err
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppConversationToolTrace{}).Error; err != nil {
			return err
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppConversationAttachment{}).Error; err != nil {
			return err
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppArtifact{}).Error; err != nil {
			return err
		}
		if err := tx.Where(query, userID, app.ID, conversation.ID).Delete(&model.AIAppTask{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Delete(&model.AIAppRun{}).Error; err != nil {
			return err
		}
		return tx.Delete(&conversation).Error
	}); err != nil {
		Error(c, 500, "删除私有会话失败")
		return
	}
	Success(c, gin.H{"deletedId": conversation.ID})
}

func ChatWithAIAppConversation(c *gin.Context) {
	started := time.Now()
	userID, app, ok := aiAppConversationContext(c)
	if !ok {
		return
	}
	conversationID, err := parsePathInt64(c, "conversationId")
	if err != nil {
		Error(c, 400, "无效的会话 ID")
		return
	}
	conversation, found := findAIAppConversation(database.GetDB(), userID, app.ID, model.Int64String(conversationID))
	if !found {
		Error(c, 404, "私有会话不存在")
		return
	}
	var payload struct {
		Message         string   `json:"message"`
		ModelID         string   `json:"modelId"`
		Stream          bool     `json:"stream"`
		ReferenceImages []string `json:"referenceImages"`
		ActiveSkillIDs  []string `json:"activeSkillIds"`
		AttachmentIDs   []string `json:"attachmentIds"`
	}
	// Three 5MB images expand to roughly 20MB when sent as data URLs. Keep the
	// same bounded request envelope as the image studio while never persisting
	// the raw attachment.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 22<<20)
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Message) == "" {
		Error(c, 400, "请输入消息")
		return
	}
	message := truncateAIAgentRunes(payload.Message, 12000)
	attachments, attachmentContext, attachmentErr := resolveAIAppConversationAttachments(database.GetDB(), userID, app.ID, conversation.ID, payload.AttachmentIDs)
	if attachmentErr != nil {
		Error(c, http.StatusBadRequest, attachmentErr.Error())
		return
	}
	run := model.AIAppRun{AppID: app.ID, VersionID: conversation.VersionID, ConversationID: &conversation.ID, UserID: userID, Status: "running", Input: aiclient.TrimRunes(message, 1000)}
	if len(payload.ReferenceImages) > service.MaxAIImageReferences {
		Error(c, http.StatusBadRequest, "最多支持 3 张参考图")
		return
	}
	userMessage := model.AIAppConversationMessage{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "user", Content: message, ReferenceImageCount: len(payload.ReferenceImages)}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&run).Error; err != nil {
			return err
		}
		userMessage.RunID = &run.ID
		if err := tx.Create(&userMessage).Error; err != nil {
			return err
		}
		if len(attachments) > 0 {
			ids := make([]model.Int64String, 0, len(attachments))
			for _, attachment := range attachments {
				ids = append(ids, attachment.ID)
			}
			return tx.Model(&model.AIAppConversationAttachment{}).Where("id IN ?", ids).Update("message_id", userMessage.ID).Error
		}
		return nil
	}); err != nil {
		Error(c, 500, "创建会话运行记录失败")
		return
	}
	if conversation.Title == "新对话" {
		conversation.Title = truncateAIAgentRunes(message, 32)
		_ = database.GetDB().Model(&conversation).Updates(map[string]any{"title": conversation.Title, "updated_at": time.Now()}).Error
	}

	fail := func(status int, code, message string, cause error) {
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": "failed", "error_code": code, "duration_ms": time.Since(started).Milliseconds()}).Error
		run.Status = "failed"
		run.ErrorCode = code
		run.DurationMs = time.Since(started).Milliseconds()
		writeAIAppConversationFailure(c, status, code, message, run, userMessage, cause)
	}

	var version model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ?", conversation.VersionID, app.ID).First(&version).Error; err != nil {
		fail(http.StatusBadRequest, "CONVERSATION_VERSION_NOT_FOUND", "会话配置不存在", err)
		return
	}

	config, configParseErr := aiapp.Parse(version.Config)
	if configParseErr != nil {
		fail(400, "APP_CONFIG_INVALID", "智能体配置无效", errors.New("invalid AI App config"))
		return
	}
	styleProfileID, styleErr := selectedAIAppImageStyle(config, payload.ActiveSkillIDs)
	if styleErr != nil {
		fail(http.StatusBadRequest, "SKILL_SELECTION_INVALID", styleErr.Error(), styleErr)
		return
	}
	skillInstructions, skillErr := resolveAISkillRuntimeInstructions(database.GetDB(), userID, config.SkillIDs)
	if skillErr != nil {
		fail(http.StatusBadRequest, "APP_SKILLS_UNAVAILABLE", "已绑定技能不可用", skillErr)
		return
	}
	selectedModelID, requiredCapability, missingModelCode := selectAIAppConversationModel(config, payload.ModelID, len(payload.ReferenceImages) > 0)
	if selectedModelID == "" {
		message := "请先为智能体选择对话模型"
		fail(http.StatusBadRequest, missingModelCode, message, errors.New("no compatible model configured"))
		return
	}
	invocation, invocationErr := aimodel.ResolveInvocation(database.GetDB(), selectedModelID, requiredCapability, 60*time.Second)
	if invocationErr != nil {
		code := "MODEL_NOT_CONFIGURED"
		message := "所选对话模型暂不可用"
		if requiredCapability == "vision" {
			code = "VISION_MODEL_NOT_CONFIGURED"
			message = "所选对话模型不支持图片理解，请切换模型"
		}
		fail(http.StatusServiceUnavailable, code, message, invocationErr)
		return
	}
	run.Model = invocation.Model.ModelID
	_ = database.GetDB().Model(&run).Update("model", run.Model).Error
	knowledgeContext, references, retrievalErr := retrieveAIKnowledgeContext(c.Request.Context(), userID, version, message)
	if retrievalErr != nil {
		code, publicMessage := aiKnowledgeRetrievalFailure(retrievalErr)
		fail(http.StatusServiceUnavailable, code, publicMessage, retrievalErr)
		return
	}
	system := buildAIAppConversationSystemPrompt(config.SystemInstructions(), knowledgeContext)
	if attachmentContext != "" {
		system = strings.TrimSpace(system + "\n\n以下是用户本轮明确附加的文件内容。回答时应结合文件；若文件内容与用户要求冲突，以用户最新要求为准。\n" + attachmentContext)
	}
	system = appendAIAppConversationImageContext(system, len(payload.ReferenceImages), styleProfileID)
	if skillInstructions != "" {
		system = strings.TrimSpace(system + "\n\n" + skillInstructions)
	}
	registry, toolNames, toolErr := resolveAIAppTools(database.GetDB(), app.ID, version)
	if toolErr != nil {
		fail(500, "AI_TOOL_REGISTRY_UNAVAILABLE", "加载智能体工具失败", toolErr)
		return
	}
	toolPolicies, policyErr := loadAIAppToolPolicies(database.GetDB(), version)
	if policyErr != nil {
		fail(500, "AI_TOOL_POLICY_UNAVAILABLE", "加载工具授权策略失败", policyErr)
		return
	}
	for _, toolName := range toolNames {
		if toolPolicies[toolName] == "always" {
			fail(http.StatusConflict, "TOOL_APPROVAL_REQUIRED", "当前智能体包含需要确认的工具，请使用后台执行", agent.ErrToolApprovalRequired)
			return
		}
	}
	if !aimodel.HasCapabilities(invocation.Model, []string{"tool_call"}) {
		toolNames = nil
	}
	system = appendContentSearchDateContext(system, toolNames, time.Now())

	var history []model.AIAppConversationMessage
	if err := database.GetDB().Where("user_id = ? AND app_id = ? AND conversation_id = ?", userID, app.ID, conversation.ID).Order("created_at DESC").Limit(aiAppConversationHistoryLimit).Find(&history).Error; err != nil {
		fail(500, "CONVERSATION_HISTORY_UNAVAILABLE", "加载会话历史失败", err)
		return
	}
	messages := make([]agent.Message, 0, len(history))
	for index := len(history) - 1; index >= 0; index-- {
		item := history[index]
		role := agent.RoleUser
		if item.Role == "assistant" {
			role = agent.RoleAssistant
		}
		message := agent.Message{Role: role, Content: item.Content}
		if item.ID == userMessage.ID {
			message.Images = payload.ReferenceImages
		}
		messages = append(messages, message)
	}
	loop := agent.NewLocalLoop(agent.NewCompatibleBackend(invocation.Client), registry)
	runContext := content.WithOwner(c.Request.Context(), userID)
	runContext = imagetool.WithRequestInput(runContext, userID, payload.ReferenceImages, styleProfileID)
	runContext = filetool.WithRequestContext(runContext, filetool.RequestContext{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID})
	events, loopErr := loop.RunStream(runContext, agent.Spec{Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID, System: system, Tools: toolNames, MaxSteps: 6, MaxTokens: 1200, Feature: "ai-workbench-conversation"}, messages)
	if loopErr != nil {
		fail(http.StatusBadGateway, "AI_AGENT_RUN_FAILED", "智能体工具调用失败", loopErr)
		return
	}

	var writer *aiclient.SSEWriter
	if payload.Stream {
		writer, err = aiclient.NewSSEWriter(c)
		if err != nil {
			return
		}
		_ = writer.Send(gin.H{"type": "meta", "conversation": conversation, "versionId": version.ID, "model": invocation.Model.ModelID})
	}
	var reply strings.Builder
	var result agent.Result
	var runErr error
	imageGenerationIDs := make([]string, 0, 1)
	pendingToolNarrations := make([]string, 0, 1)
	for event := range events {
		switch event.Type {
		case agent.EventDelta:
			reply.WriteString(event.Delta)
			if writer != nil {
				_ = writer.Send(gin.H{"type": "delta", "chunk": event.Delta})
			}
		case agent.EventToolCall:
			pendingToolNarrations = append(pendingToolNarrations, event.Narration)
			if writer != nil {
				_ = writer.Send(gin.H{"type": "tool_call", "toolName": event.ToolName, "narration": event.Narration})
			}
		case agent.EventToolResult:
			narration := ""
			if len(pendingToolNarrations) > 0 {
				narration = pendingToolNarrations[0]
				pendingToolNarrations = pendingToolNarrations[1:]
			}
			imageGenerationIDs = append(imageGenerationIDs, imageGenerationIDsFromToolResult(event.ToolName, event.ToolResult)...)
			ok := !strings.Contains(string(event.ToolResult), `"ok":false`)
			status := "succeeded"
			if !ok {
				status = "failed"
			}
			trace := model.AIAppConversationToolTrace{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: run.ID, ToolName: event.ToolName, Narration: narration, Status: status, DurationMs: event.ToolDurationMs}
			_ = database.GetDB().Create(&trace).Error
			if writer != nil {
				_ = writer.Send(gin.H{"type": "tool_result", "toolName": event.ToolName, "narration": narration, "ok": ok, "durationMs": event.ToolDurationMs})
			}
		case agent.EventDone:
			if event.Result != nil {
				result = *event.Result
			}
		case agent.EventError:
			runErr = event.Err
		}
	}
	if result.Reply == "" {
		result.Reply = reply.String()
	}
	if runErr != nil || strings.TrimSpace(result.Reply) == "" {
		code := "AI_AGENT_RUN_FAILED"
		message := "智能体工具调用失败"
		status := "failed"
		if c.Request.Context().Err() != nil {
			code = "RUN_CANCELLED"
			message = "会话生成已停止"
			status = "cancelled"
		}
		if runErr == nil && c.Request.Context().Err() == nil {
			code = "AI_EMPTY_RESPONSE"
			message = "AI 未返回有效内容"
		}
		run.Status = status
		run.Model = result.Model
		run.Output = aiclient.TrimRunes(result.Reply, 2000)
		run.ErrorCode = code
		run.DurationMs = time.Since(started).Milliseconds()
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "model": run.Model, "output": run.Output, "error_code": run.ErrorCode, "duration_ms": run.DurationMs}).Error
		if writer != nil {
			_ = writer.Send(gin.H{"type": "error", "errorCode": code, "message": message, "run": run, "userMessage": userMessage})
			return
		}
		failure := runErr
		if failure == nil {
			failure = errors.New(message)
		}
		writeAIAppConversationFailure(c, http.StatusBadGateway, code, message, run, userMessage, failure)
		return
	}
	modelName := result.Model
	if modelName == "" {
		modelName = invocation.Model.ModelID
	}
	referenceSummary, _ := json.Marshal(references)
	run.Status = "succeeded"
	run.Model = modelName
	run.Output = aiclient.TrimRunes(result.Reply, 2000)
	run.References = string(referenceSummary)
	run.DurationMs = time.Since(started).Milliseconds()
	_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "model": run.Model, "output": run.Output, "references": run.References, "duration_ms": run.DurationMs}).Error
	imageGenerationIDs = uniqueAIAppGenerationIDs(imageGenerationIDs)
	serializedImageGenerationIDs, _ := json.Marshal(imageGenerationIDs)
	assistantMessage := model.AIAppConversationMessage{UserID: userID, AppID: app.ID, ConversationID: conversation.ID, RunID: &run.ID, Role: "assistant", Content: strings.TrimSpace(result.Reply), ImageGenerationIDs: string(serializedImageGenerationIDs)}
	if database.GetDB().Create(&assistantMessage).Error != nil {
		run.Status = "failed"
		run.ErrorCode = "ASSISTANT_MESSAGE_PERSISTENCE_FAILED"
		_ = database.GetDB().Model(&run).Updates(map[string]any{"status": run.Status, "error_code": run.ErrorCode}).Error
		if writer != nil {
			_ = writer.Send(gin.H{"type": "error", "errorCode": run.ErrorCode, "message": "保存助手回复失败", "run": run, "userMessage": userMessage})
			return
		}
		writeAIAppConversationFailure(c, http.StatusInternalServerError, run.ErrorCode, "保存助手回复失败", run, userMessage, errors.New("assistant message persistence failed"))
		return
	}
	_ = database.GetDB().Model(&conversation).Update("updated_at", time.Now()).Error
	if writer != nil {
		_ = writer.Send(gin.H{"type": "done", "run": run, "conversation": conversation, "userMessage": userMessage, "assistantMessage": assistantMessage, "reply": assistantMessage.Content, "references": references})
		return
	}
	Success(c, gin.H{"run": run, "conversation": conversation, "userMessage": userMessage, "assistantMessage": assistantMessage, "reply": assistantMessage.Content, "references": references})
}
