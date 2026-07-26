package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"
	"valley-server/internal/workflowtrigger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const maxWorkflowTriggerPayloadBytes = 256 << 10

type workflowTriggerCreatePayload struct {
	Type           string `json:"type"`
	CronExpression string `json:"cronExpression"`
	Timezone       string `json:"timezone"`
	EventKey       string `json:"eventKey"`
}

func createWorkflowTrigger(
	c *gin.Context,
	userID int64,
	definition model.Workflow,
	version model.AIAppVersion,
) {
	var payload workflowTriggerCreatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "触发器参数无效")
		return
	}
	payload.Type = strings.ToLower(strings.TrimSpace(payload.Type))
	if payload.Type == "" {
		payload.Type = workflowtrigger.TypeCron
	}
	graph, err := decodeWorkflowGraph(version.Config)
	if err != nil {
		Error(c, http.StatusConflict, "已发布工作流版本无效")
		return
	}
	if err := workflowtrigger.ValidateGraph(graph, workflowRuntimeRegistry(), payload.Type); err != nil {
		Error(c, http.StatusBadRequest, "该工作流暂不支持此触发方式: "+err.Error())
		return
	}
	trigger := model.WorkflowTrigger{
		WorkflowID: definition.ID,
		UserID:     model.Int64String(userID),
		Type:       payload.Type,
		Status:     "active",
	}
	switch payload.Type {
	case workflowtrigger.TypeCron:
		schedule, parseErr := workflowtrigger.Parse(payload.CronExpression, payload.Timezone)
		if parseErr != nil {
			Error(c, http.StatusBadRequest, "Cron 表达式或时区无效")
			return
		}
		nextRunAt := schedule.Next(time.Now())
		trigger.CronExpression = schedule.Expression
		trigger.Timezone = schedule.Timezone
		trigger.NextRunAt = &nextRunAt
	case workflowtrigger.TypeWebhook:
		secret, secretErr := newWorkflowWebhookSecret()
		if secretErr != nil {
			Error(c, http.StatusInternalServerError, "创建 Webhook 密钥失败")
			return
		}
		trigger.SecretHash = hashWorkflowWebhookSecret(secret)
		trigger.WebhookSecret = secret
	case workflowtrigger.TypeEvent:
		trigger.EventKey = strings.TrimSpace(payload.EventKey)
		if !validWorkflowEventKey(trigger.EventKey) {
			Error(c, http.StatusBadRequest, "事件键只能包含字母、数字、点、下划线、冒号和连字符")
			return
		}
	default:
		Error(c, http.StatusBadRequest, "不支持的触发器类型")
		return
	}
	if err := database.GetDB().Create(&trigger).Error; err != nil {
		Error(c, http.StatusInternalServerError, "创建触发器失败")
		return
	}
	if trigger.Type == workflowtrigger.TypeWebhook {
		trigger.WebhookPath = workflowWebhookPath(trigger.ID)
	}
	Success(c, trigger)
}

func RotateWorkflowWebhookSecret(c *gin.Context) {
	userID, definition, ok := workflowTriggerOwnedDefinition(c)
	if !ok {
		return
	}
	triggerID, err := parsePathInt64(c, "triggerId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的触发器 ID")
		return
	}
	var trigger model.WorkflowTrigger
	if err := database.GetDB().Where(
		"id = ? AND workflow_id = ? AND user_id = ? AND type = ?",
		triggerID,
		definition.ID,
		userID,
		workflowtrigger.TypeWebhook,
	).First(&trigger).Error; err != nil {
		Error(c, http.StatusNotFound, "Webhook 触发器不存在")
		return
	}
	secret, err := newWorkflowWebhookSecret()
	if err != nil {
		Error(c, http.StatusInternalServerError, "轮换 Webhook 密钥失败")
		return
	}
	if err := database.GetDB().Model(&trigger).Update("secret_hash", hashWorkflowWebhookSecret(secret)).Error; err != nil {
		Error(c, http.StatusInternalServerError, "轮换 Webhook 密钥失败")
		return
	}
	trigger.WebhookSecret = secret
	trigger.WebhookPath = workflowWebhookPath(trigger.ID)
	Success(c, trigger)
}

func InvokeWorkflowWebhook(c *gin.Context) {
	triggerID, err := parsePathInt64(c, "triggerId")
	if err != nil {
		workflowTriggerRequestError(c, http.StatusUnauthorized, "Webhook 凭据无效", true)
		return
	}
	var trigger model.WorkflowTrigger
	if err := database.GetDB().Where(
		"id = ? AND type = ? AND status = ?",
		triggerID,
		workflowtrigger.TypeWebhook,
		"active",
	).First(&trigger).Error; err != nil {
		workflowTriggerRequestError(c, http.StatusUnauthorized, "Webhook 凭据无效", true)
		return
	}
	secret := bearerToken(c.GetHeader("Authorization"))
	if secret == "" || !workflowWebhookSecretMatches(trigger.SecretHash, secret) {
		workflowTriggerRequestError(c, http.StatusUnauthorized, "Webhook 凭据无效", true)
		return
	}
	deliveryID := strings.TrimSpace(c.GetHeader("X-Valley-Delivery"))
	if !validWorkflowDeliveryID(deliveryID) {
		workflowTriggerRequestError(c, http.StatusBadRequest, "X-Valley-Delivery 无效", true)
		return
	}
	inputs, ok := decodeWorkflowTriggerInputs(c, true)
	if !ok {
		return
	}
	job, created, err := workflowtrigger.EnqueueInvocation(
		c.Request.Context(),
		database.GetDB(),
		trigger,
		inputs,
		deliveryID,
		time.Now(),
	)
	if err != nil {
		workflowTriggerInvocationError(c, err, true)
		return
	}
	workflowTriggerAccepted(c, job, created)
}

func PublishWorkflowEvent(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	eventKey := strings.TrimSpace(c.Param("eventKey"))
	if !validWorkflowEventKey(eventKey) {
		Error(c, http.StatusBadRequest, "事件键无效")
		return
	}
	deliveryID := strings.TrimSpace(c.GetHeader("X-Valley-Delivery"))
	if !validWorkflowDeliveryID(deliveryID) {
		Error(c, http.StatusBadRequest, "X-Valley-Delivery 无效")
		return
	}
	inputs, valid := decodeWorkflowTriggerInputs(c, false)
	if !valid {
		return
	}
	var triggers []model.WorkflowTrigger
	if err := database.GetDB().Where(
		"user_id = ? AND type = ? AND event_key = ? AND status = ?",
		userID,
		workflowtrigger.TypeEvent,
		eventKey,
		"active",
	).Find(&triggers).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载事件订阅失败")
		return
	}
	if len(triggers) == 0 {
		Error(c, http.StatusNotFound, "没有启用中的事件订阅")
		return
	}
	jobs := make([]model.WorkflowRunJob, 0, len(triggers))
	createdCount := 0
	for _, trigger := range triggers {
		job, created, err := workflowtrigger.EnqueueInvocation(
			c.Request.Context(),
			database.GetDB(),
			trigger,
			inputs,
			deliveryID,
			time.Now(),
		)
		if err != nil {
			logger.Log.Warnf("workflow event %s trigger %s enqueue failed: %v", eventKey, trigger.ID, err)
			continue
		}
		if created {
			createdCount++
		}
		jobs = append(jobs, job)
	}
	if len(jobs) == 0 {
		Error(c, http.StatusConflict, "事件订阅当前不可执行")
		return
	}
	c.JSON(http.StatusAccepted, Response{
		Code:    0,
		Message: "accepted",
		Data: gin.H{
			"eventKey":     eventKey,
			"jobs":         jobs,
			"createdCount": createdCount,
		},
		LogID: logger.GetLogID(c),
	})
}

func decodeWorkflowTriggerInputs(c *gin.Context, external bool) (map[string]any, bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxWorkflowTriggerPayloadBytes)
	decoder := json.NewDecoder(c.Request.Body)
	var inputs map[string]any
	if err := decoder.Decode(&inputs); err != nil {
		var sizeError *http.MaxBytesError
		if errors.As(err, &sizeError) {
			workflowTriggerRequestError(c, http.StatusRequestEntityTooLarge, "请求体不能超过 256 KiB", external)
			return nil, false
		}
		workflowTriggerRequestError(c, http.StatusBadRequest, "请求体必须是 JSON 对象", external)
		return nil, false
	}
	if inputs == nil {
		workflowTriggerRequestError(c, http.StatusBadRequest, "请求体必须是 JSON 对象", external)
		return nil, false
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		workflowTriggerRequestError(c, http.StatusBadRequest, "请求体只能包含一个 JSON 对象", external)
		return nil, false
	}
	return inputs, true
}

func workflowTriggerAccepted(c *gin.Context, job model.WorkflowRunJob, created bool) {
	c.JSON(http.StatusAccepted, Response{
		Code:    0,
		Message: "accepted",
		Data: gin.H{
			"jobId":   job.ID,
			"status":  job.Status,
			"created": created,
		},
		LogID: logger.GetLogID(c),
	})
}

func workflowTriggerInvocationError(c *gin.Context, err error, external bool) {
	if errors.Is(err, workflowtrigger.ErrTriggerUnavailable) {
		workflowTriggerRequestError(c, http.StatusConflict, "触发器当前不可用", external)
		return
	}
	if errors.Is(err, workflowtrigger.ErrPublishedVersion) || errors.Is(err, gorm.ErrRecordNotFound) {
		workflowTriggerRequestError(c, http.StatusConflict, "已发布工作流版本不可用", external)
		return
	}
	workflowTriggerRequestError(c, http.StatusInternalServerError, "创建工作流任务失败", external)
}

func workflowTriggerRequestError(c *gin.Context, status int, message string, external bool) {
	if !external {
		Error(c, status, message)
		return
	}
	logger.Warn(c, "Workflow trigger request failed", logrus.Fields{
		"status_code": status,
		"message":     message,
		"path":        c.Request.URL.Path,
		"method":      c.Request.Method,
	})
	c.JSON(status, Response{
		Code: status, Message: message, LogID: logger.GetLogID(c),
	})
}

func newWorkflowWebhookSecret() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashWorkflowWebhookSecret(secret string) string {
	digest := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(digest[:])
}

func workflowWebhookSecretMatches(hash, secret string) bool {
	expected, err := hex.DecodeString(hash)
	if err != nil || len(expected) != sha256.Size {
		return false
	}
	actual := sha256.Sum256([]byte(secret))
	return subtle.ConstantTimeCompare(expected, actual[:]) == 1
}

func bearerToken(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func workflowWebhookPath(triggerID model.Int64String) string {
	return "/api/v1/workflow-hooks/" + triggerID.String()
}

func validWorkflowEventKey(value string) bool {
	if value == "" || len(value) > 100 {
		return false
	}
	for _, char := range value {
		if (char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '.' || char == '_' || char == ':' || char == '-' {
			continue
		}
		return false
	}
	return true
}

func validWorkflowDeliveryID(value string) bool {
	if value == "" || len(value) > 120 {
		return false
	}
	for _, char := range value {
		if (char >= 'a' && char <= 'z') ||
			(char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '.' || char == '_' || char == ':' || char == '-' {
			continue
		}
		return false
	}
	return true
}
