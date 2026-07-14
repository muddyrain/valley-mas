package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/aiclient"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"gorm.io/gorm"
)

const (
	aiAppTypeAgent    = "agent"
	aiAppTypeWorkflow = "workflow"
)

var builtInAITools = []gin.H{
	{"name": "content.search", "description": "搜索当前用户可访问的内容", "permission": "read"},
	{"name": "blog.create_draft", "description": "创建当前用户的博客草稿", "permission": "write"},
	{"name": "blog.update_draft", "description": "更新当前用户的博客草稿", "permission": "write"},
	{"name": "resource.create_draft", "description": "创建当前用户的资源草稿", "permission": "write"},
}

type aiAppPayload struct {
	Type        string          `json:"type"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Config      json.RawMessage `json:"config"`
}

func currentAIAppUser(c *gin.Context) (model.Int64String, bool) {
	userID := GetCurrentUserID(c)
	if userID <= 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return 0, false
	}
	return model.Int64String(userID), true
}

func validAIAppType(value string) bool { return value == aiAppTypeAgent || value == aiAppTypeWorkflow }

func ListAIApps(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	if err := syncLegacyWorkflowApps(userID); err != nil {
		Error(c, 500, "同步工作流应用失败")
		return
	}
	var apps []model.AIApp
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC").Find(&apps).Error; err != nil {
		Error(c, 500, "加载应用失败")
		return
	}
	Success(c, gin.H{"list": apps})
}

// syncLegacyWorkflowApps materializes an AIApp mirror for old workflow rows.
// Legacy routes keep owning the graph editor and detailed node history.
func syncLegacyWorkflowApps(userID model.Int64String) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var workflows []model.Workflow
		if err := tx.Where("user_id = ?", userID).Find(&workflows).Error; err != nil {
			return err
		}
		for _, definition := range workflows {
			if _, _, err := syncWorkflowAIApp(tx, definition); err != nil {
				return err
			}
		}
		return nil
	})
}

func syncWorkflowAIApp(tx *gorm.DB, definition model.Workflow) (model.AIApp, model.AIAppVersion, error) {
	workflowID := definition.ID
	var app model.AIApp
	err := tx.Where("workflow_id = ?", workflowID).First(&app).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	if err == gorm.ErrRecordNotFound {
		var unlinked []model.AIApp
		if err := tx.Where("user_id = ? AND type = ? AND workflow_id IS NULL AND name = ?", definition.UserID, aiAppTypeWorkflow, definition.Name).Limit(2).Find(&unlinked).Error; err != nil {
			return model.AIApp{}, model.AIAppVersion{}, err
		}
		if len(unlinked) == 1 {
			app = unlinked[0]
			if err := tx.Model(&app).Update("workflow_id", workflowID).Error; err != nil {
				return model.AIApp{}, model.AIAppVersion{}, err
			}
			app.WorkflowID = &workflowID
		} else {
			app = model.AIApp{UserID: definition.UserID, Type: aiAppTypeWorkflow, WorkflowID: &workflowID, Name: definition.Name, Description: definition.Description, Status: definition.Status}
			if err := tx.Create(&app).Error; err != nil {
				return model.AIApp{}, model.AIAppVersion{}, err
			}
		}
	}
	var latest model.AIAppVersion
	if err := tx.Where("app_id = ?", app.ID).Order("number DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	if latest.ID == 0 || latest.Config != definition.Graph {
		latest = model.AIAppVersion{AppID: app.ID, Number: latest.Number + 1, Config: definition.Graph}
		if err := tx.Create(&latest).Error; err != nil {
			return model.AIApp{}, model.AIAppVersion{}, err
		}
	}
	updates := map[string]any{"name": definition.Name, "description": definition.Description, "status": definition.Status, "draft_version_id": latest.ID}
	if definition.Status == "published" {
		updates["published_version_id"] = latest.ID
	}
	if err := tx.Model(&app).Updates(updates).Error; err != nil {
		return model.AIApp{}, model.AIAppVersion{}, err
	}
	app.Name = definition.Name
	app.Description = definition.Description
	app.Status = definition.Status
	app.DraftVersionID = latest.ID
	if definition.Status == "published" {
		app.PublishedVersionID = latest.ID
	}
	return app, latest, nil
}

func CreateAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiAppPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, 400, "应用参数错误")
		return
	}
	payload.Type = strings.TrimSpace(payload.Type)
	payload.Name = strings.TrimSpace(payload.Name)
	if !validAIAppType(payload.Type) || payload.Name == "" {
		Error(c, 400, "应用类型、名称不能为空")
		return
	}
	config := payload.Config
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	if !json.Valid(config) {
		Error(c, 400, "应用配置必须为 JSON")
		return
	}
	app := model.AIApp{UserID: userID, Type: payload.Type, Name: payload.Name, Description: strings.TrimSpace(payload.Description)}
	version := model.AIAppVersion{Number: 1, Config: string(config)}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&app).Error; err != nil {
			return err
		}
		version.AppID = app.ID
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		return tx.Model(&app).Update("draft_version_id", version.ID).Error
	}); err != nil {
		Error(c, 500, "创建应用失败")
		return
	}
	app.DraftVersionID = version.ID
	Success(c, gin.H{"app": app, "version": version})
}

func GetAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var versions []model.AIAppVersion
	_ = database.GetDB().Where("app_id = ?", app.ID).Order("number DESC").Find(&versions).Error
	Success(c, gin.H{"app": app, "versions": versions})
}

func SaveAIAppVersion(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload aiAppPayload
	if err := c.ShouldBindJSON(&payload); err != nil || !json.Valid(payload.Config) {
		Error(c, 400, "版本配置必须为 JSON")
		return
	}
	var latest model.AIAppVersion
	if err := database.GetDB().Where("app_id = ?", app.ID).Order("number DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
		Error(c, 500, "读取应用版本失败")
		return
	}
	version := model.AIAppVersion{AppID: app.ID, Number: latest.Number + 1, Config: string(payload.Config)}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&version).Error; err != nil {
			return err
		}
		updates := map[string]any{"draft_version_id": version.ID}
		if strings.TrimSpace(payload.Name) != "" {
			updates["name"] = strings.TrimSpace(payload.Name)
		}
		if payload.Description != "" {
			updates["description"] = strings.TrimSpace(payload.Description)
		}
		return tx.Model(&app).Updates(updates).Error
	}); err != nil {
		Error(c, 500, "保存版本失败")
		return
	}
	Success(c, gin.H{"version": version})
}

// RestoreAIAppVersion copies a historical immutable snapshot into a new draft.
// It deliberately does not alter the published pointer: restoring is reviewable
// and must be followed by an explicit publish action.
func RestoreAIAppVersion(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		VersionID model.Int64String `json:"versionId"`
	}
	if c.ShouldBindJSON(&payload) != nil || payload.VersionID == 0 {
		Error(c, http.StatusBadRequest, "请选择要恢复的历史版本")
		return
	}
	var source model.AIAppVersion
	if err := database.GetDB().Where("id = ? AND app_id = ?", payload.VersionID, app.ID).First(&source).Error; err != nil {
		Error(c, http.StatusNotFound, "历史版本不存在")
		return
	}
	var restored model.AIAppVersion
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var latest model.AIAppVersion
		if err := tx.Where("app_id = ?", app.ID).Order("number DESC").First(&latest).Error; err != nil && err != gorm.ErrRecordNotFound {
			return err
		}
		restored = model.AIAppVersion{AppID: app.ID, Number: latest.Number + 1, Config: source.Config}
		if err := tx.Create(&restored).Error; err != nil {
			return err
		}
		return tx.Model(&app).Update("draft_version_id", restored.ID).Error
	}); err != nil {
		Error(c, http.StatusInternalServerError, "恢复历史版本失败")
		return
	}
	Success(c, gin.H{"version": restored, "restoredFromVersionId": source.ID})
}

func PublishAIApp(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		VersionID model.Int64String `json:"versionId"`
	}
	_ = c.ShouldBindJSON(&payload)
	versionID := payload.VersionID
	if versionID == 0 {
		versionID = app.DraftVersionID
	}
	var version model.AIAppVersion
	if versionID == 0 || database.GetDB().Where("id = ? AND app_id = ?", versionID, app.ID).First(&version).Error != nil {
		Error(c, 400, "待发布版本不存在")
		return
	}
	if err := database.GetDB().Model(&app).Updates(map[string]any{"published_version_id": version.ID, "status": "published"}).Error; err != nil {
		Error(c, 500, "发布应用失败")
		return
	}
	Success(c, gin.H{"appId": app.ID, "publishedVersionId": version.ID})
}

// DebugAIApp executes the current draft version privately. Tool bindings and
// knowledge bases are intentionally excluded until their reviewed runtimes land.
func DebugAIApp(c *gin.Context) {
	started := time.Now()
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	if app.Type != aiAppTypeAgent {
		Error(c, 400, "当前仅支持调试智能体应用")
		return
	}
	var payload struct {
		Message string `json:"message"`
		Stream  bool   `json:"stream"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Message) == "" {
		Error(c, 400, "调试消息不能为空")
		return
	}
	message := truncateAIAgentRunes(payload.Message, 12000)
	var version model.AIAppVersion
	if app.DraftVersionID == 0 || database.GetDB().Where("id = ? AND app_id = ?", app.DraftVersionID, app.ID).First(&version).Error != nil {
		Error(c, 400, "草稿版本不存在")
		return
	}
	var config struct {
		SystemPrompt string `json:"systemPrompt"`
	}
	if json.Unmarshal([]byte(version.Config), &config) != nil {
		Error(c, 400, "智能体版本配置无效")
		return
	}
	arkConfig, configErr := aiclient.ReadARKTextConfig()
	if configErr != "" {
		persistAIAppRun(app, version, userID, "failed", "", message, "", "ARK_NOT_CONFIGURED", started)
		Error(c, http.StatusServiceUnavailable, configErr)
		return
	}
	messages := make([]*arkmodel.ChatCompletionMessage, 0, 2)
	if system := strings.TrimSpace(config.SystemPrompt); system != "" {
		messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleSystem, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &system}})
	}
	messages = append(messages, &arkmodel.ChatCompletionMessage{Role: arkmodel.ChatMessageRoleUser, Content: &arkmodel.ChatCompletionMessageContent{StringValue: &message}})
	client := aiclient.ARKClient(60 * time.Second)
	if client == nil {
		persistAIAppRun(app, version, userID, "failed", arkConfig.Model, message, "", "ARK_NOT_CONFIGURED", started)
		Error(c, http.StatusServiceUnavailable, "AI 服务未配置")
		return
	}
	if payload.Stream {
		streamDebugAIApp(c, client, arkConfig.Model, messages, app, version, userID, message, started)
		return
	}
	response, err := client.CreateChatCompletion(c.Request.Context(), aiclient.NewARKChatRequest(arkConfig.Model, messages))
	if err != nil {
		persistAIAppRun(app, version, userID, "failed", arkConfig.Model, message, "", "ARK_UPSTREAM_FAILED", started)
		Error(c, http.StatusBadGateway, "AI 上游调用失败")
		return
	}
	reply, err := aiclient.ExtractARKContent(response)
	if err != nil || strings.TrimSpace(reply) == "" {
		persistAIAppRun(app, version, userID, "failed", arkConfig.Model, message, "", "ARK_EMPTY_RESPONSE", started)
		Error(c, http.StatusBadGateway, "AI 未返回有效内容")
		return
	}
	modelName := strings.TrimSpace(response.Model)
	if modelName == "" {
		modelName = arkConfig.Model
	}
	run := persistAIAppRun(app, version, userID, "succeeded", modelName, message, reply, "", started)
	Success(c, gin.H{"run": run, "reply": reply, "model": modelName, "versionId": version.ID})
}

func streamDebugAIApp(c *gin.Context, client *arkruntime.Client, modelID string, messages []*arkmodel.ChatCompletionMessage, app model.AIApp, version model.AIAppVersion, userID model.Int64String, message string, started time.Time) {
	stream, err := client.CreateChatCompletionStream(c.Request.Context(), aiclient.NewARKChatRequest(modelID, messages))
	if err != nil {
		persistAIAppRun(app, version, userID, "failed", modelID, message, "", "ARK_UPSTREAM_FAILED", started)
		Error(c, http.StatusBadGateway, "AI 上游调用失败")
		return
	}
	defer stream.Close()
	writer, err := aiclient.NewSSEWriter(c)
	if err != nil {
		return
	}
	_ = writer.Send(gin.H{"type": "meta", "versionId": version.ID, "model": modelID})
	var reply strings.Builder
	currentModel := modelID
	for {
		response, recvErr := stream.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			if c.Request.Context().Err() != nil {
				persistAIAppRun(app, version, userID, "cancelled", currentModel, message, reply.String(), "RUN_CANCELLED", started)
				return
			}
			run := persistAIAppRun(app, version, userID, "failed", currentModel, message, reply.String(), "ARK_UPSTREAM_FAILED", started)
			_ = writer.Send(gin.H{"type": "error", "message": "AI 上游调用失败", "run": run})
			return
		}
		if strings.TrimSpace(response.Model) != "" {
			currentModel = response.Model
		}
		for _, choice := range response.Choices {
			if choice == nil || strings.TrimSpace(choice.Delta.Content) == "" {
				continue
			}
			reply.WriteString(choice.Delta.Content)
			_ = writer.Send(gin.H{"type": "delta", "chunk": choice.Delta.Content})
		}
	}
	result := strings.TrimSpace(reply.String())
	if result == "" {
		run := persistAIAppRun(app, version, userID, "failed", currentModel, message, "", "ARK_EMPTY_RESPONSE", started)
		_ = writer.Send(gin.H{"type": "error", "message": "AI 未返回有效内容", "run": run})
		return
	}
	run := persistAIAppRun(app, version, userID, "succeeded", currentModel, message, result, "", started)
	_ = writer.Send(gin.H{"type": "done", "run": run, "reply": result, "model": currentModel})
}

func ListAIAppRuns(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var runs []model.AIAppRun
	if err := database.GetDB().Where("app_id = ? AND user_id = ?", app.ID, userID).Order("created_at DESC").Limit(20).Find(&runs).Error; err != nil {
		Error(c, 500, "加载调试记录失败")
		return
	}
	Success(c, gin.H{"list": runs})
}

func persistAIAppRun(app model.AIApp, version model.AIAppVersion, userID model.Int64String, status, modelName, input, output, errorCode string, started time.Time) model.AIAppRun {
	run := model.AIAppRun{AppID: app.ID, VersionID: version.ID, UserID: userID, Status: status, Model: modelName, Input: aiclient.TrimRunes(input, 1000), Output: aiclient.TrimRunes(output, 2000), ErrorCode: errorCode, DurationMs: time.Since(started).Milliseconds()}
	_ = database.GetDB().Create(&run).Error
	return run
}

func ListAIAppTools(c *gin.Context) {
	if _, ok := currentAIAppUser(c); ok {
		Success(c, gin.H{"list": builtInAITools})
	}
}

func ReplaceAIAppTools(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	var payload struct {
		Tools []string `json:"tools"`
	}
	if c.ShouldBindJSON(&payload) != nil {
		Error(c, 400, "工具参数错误")
		return
	}
	allowed := map[string]bool{}
	for _, tool := range builtInAITools {
		allowed[tool["name"].(string)] = true
	}
	seen := map[string]bool{}
	bindings := make([]model.AIAppToolBinding, 0, len(payload.Tools))
	for _, name := range payload.Tools {
		name = strings.TrimSpace(name)
		if !allowed[name] {
			Error(c, 400, "包含未审核的工具")
			return
		}
		if !seen[name] {
			seen[name] = true
			bindings = append(bindings, model.AIAppToolBinding{AppID: app.ID, ToolName: name})
		}
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("app_id = ?", app.ID).Delete(&model.AIAppToolBinding{}).Error; err != nil {
			return err
		}
		if len(bindings) > 0 {
			return tx.Create(&bindings).Error
		}
		return nil
	}); err != nil {
		Error(c, 500, "保存工具绑定失败")
		return
	}
	Success(c, gin.H{"tools": payload.Tools})
}

func ListAIKnowledgeBases(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var items []model.AIKnowledgeBase
	if err := database.GetDB().Where("user_id = ?", userID).Order("updated_at DESC").Find(&items).Error; err != nil {
		Error(c, 500, "加载知识库失败")
		return
	}
	Success(c, gin.H{"list": items})
}
func CreateAIKnowledgeBase(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var input model.AIKnowledgeBase
	if c.ShouldBindJSON(&input) != nil || strings.TrimSpace(input.Name) == "" {
		Error(c, 400, "知识库名称不能为空")
		return
	}
	input.UserID = userID
	if database.GetDB().Create(&input).Error != nil {
		Error(c, 500, "创建知识库失败")
		return
	}
	Success(c, input)
}

func ListAIAPIKeys(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var keys []model.AIAPIKey
	if database.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error != nil {
		Error(c, 500, "加载 API Key 失败")
		return
	}
	Success(c, gin.H{"list": keys})
}
func CreateAIAPIKey(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload struct {
		Name string `json:"name"`
	}
	if c.ShouldBindJSON(&payload) != nil || strings.TrimSpace(payload.Name) == "" {
		Error(c, 400, "Key 名称不能为空")
		return
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		Error(c, 500, "生成 API Key 失败")
		return
	}
	plain := "valley_" + hex.EncodeToString(raw)
	digest := sha256.Sum256([]byte(plain))
	key := model.AIAPIKey{UserID: userID, Name: strings.TrimSpace(payload.Name), KeyPrefix: plain[:13], KeyHash: hex.EncodeToString(digest[:])}
	if database.GetDB().Create(&key).Error != nil {
		Error(c, 500, "创建 API Key 失败")
		return
	}
	Success(c, gin.H{"key": key, "secret": plain})
}
func RevokeAIAPIKey(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	id, err := parsePathInt64(c, "keyId")
	if err != nil {
		Error(c, 400, "无效的 Key ID")
		return
	}
	result := database.GetDB().Model(&model.AIAPIKey{}).Where("id = ? AND user_id = ?", id, userID).Update("status", "revoked")
	if result.Error != nil {
		Error(c, 500, "撤销 API Key 失败")
		return
	}
	if result.RowsAffected == 0 {
		Error(c, 404, "API Key 不存在")
		return
	}
	Success(c, nil)
}

func findAIApp(c *gin.Context, userID model.Int64String) (model.AIApp, bool) {
	id, err := parsePathInt64(c, "appId")
	if err != nil {
		Error(c, 400, "无效的应用 ID")
		return model.AIApp{}, false
	}
	var app model.AIApp
	if database.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&app).Error != nil {
		Error(c, 404, "应用不存在")
		return model.AIApp{}, false
	}
	return app, true
}

// VerifyAIAPIKey is intentionally reusable by the public invocation middleware.
func VerifyAIAPIKey(raw string) (*model.AIAPIKey, bool) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "valley_") {
		return nil, false
	}
	digest := sha256.Sum256([]byte(raw))
	var key model.AIAPIKey
	if database.GetDB().Where("key_hash = ? AND status = ?", hex.EncodeToString(digest[:]), "active").First(&key).Error != nil {
		return nil, false
	}
	now := time.Now()
	_ = database.GetDB().Model(&key).Update("last_used_at", now).Error
	key.LastUsedAt = &now
	return &key, true
}
