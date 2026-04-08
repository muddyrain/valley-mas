package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const (
	creatorAuditConfigPrimaryID   = 1
	creatorAuditStrictnessMin     = 0
	creatorAuditStrictnessMax     = 100
	defaultCreatorAuditStrictness = 20
)

var (
	creatorAuditConfigMigrateOnce sync.Once
	creatorAuditConfigMigrateErr  error
)

type creatorApplicationAIDecision struct {
	Status     string `json:"status"`
	ReviewNote string `json:"reviewNote"`
}

// GetCreatorApplicationAuditConfig 获取创作者申请 AI 审核配置（管理员）
func GetCreatorApplicationAuditConfig(c *gin.Context) {
	db := database.DB
	cfg, err := getOrCreateCreatorAuditConfig(db)
	if err != nil {
		Error(c, http.StatusInternalServerError, "获取审核配置失败")
		return
	}

	Success(c, gin.H{
		"strictness": cfg.Strictness,
		"updatedAt":  cfg.UpdatedAt,
		"updatedBy":  cfg.UpdatedBy,
	})
}

// UpdateCreatorApplicationAuditConfig 更新创作者申请 AI 审核配置（管理员）
func UpdateCreatorApplicationAuditConfig(c *gin.Context) {
	db := database.DB

	type updateRequest struct {
		Strictness *int `json:"strictness"`
	}

	var req updateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}
	if req.Strictness == nil {
		Error(c, http.StatusBadRequest, "strictness 不能为空")
		return
	}
	if *req.Strictness < creatorAuditStrictnessMin || *req.Strictness > creatorAuditStrictnessMax {
		Error(c, http.StatusBadRequest, "strictness 必须在 0-100 之间")
		return
	}

	cfg, err := getOrCreateCreatorAuditConfig(db)
	if err != nil {
		Error(c, http.StatusInternalServerError, "获取审核配置失败")
		return
	}

	cfg.Strictness = normalizeCreatorAuditStrictness(*req.Strictness)
	if userID, exists := c.Get("userId"); exists {
		updater := model.Int64String(userID.(int64))
		cfg.UpdatedBy = &updater
	}

	if err := db.Save(&cfg).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存审核配置失败")
		return
	}

	Success(c, gin.H{
		"strictness": cfg.Strictness,
		"updatedAt":  cfg.UpdatedAt,
		"updatedBy":  cfg.UpdatedBy,
	})
}

func tryAutoReviewCreatorApplication(db *gorm.DB, application *model.CreatorApplication) {
	decision, strictness, modelID, err := runCreatorApplicationAIAudit(db, *application)
	if err != nil {
		logger.Log.WithFields(logrus.Fields{
			"applicationId": application.ID,
			"userId":        application.UserID,
			"error":         err.Error(),
		}).Warn("创作者申请 AI 审核失败，已回退到人工审核")
		return
	}
	if decision == nil {
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return applyCreatorApplicationReview(tx, application, decision.Status, decision.ReviewNote, nil, "ai")
	}); err != nil {
		logger.Log.WithFields(logrus.Fields{
			"applicationId": application.ID,
			"userId":        application.UserID,
			"status":        decision.Status,
			"error":         err.Error(),
		}).Warn("创作者申请 AI 自动审核落库失败，已回退到人工审核")
		return
	}

	logger.Log.WithFields(logrus.Fields{
		"applicationId": application.ID,
		"userId":        application.UserID,
		"status":        decision.Status,
		"strictness":    strictness,
		"model":         modelID,
	}).Info("创作者申请已完成 AI 自动审核")
}

func runCreatorApplicationAIAudit(
	db *gorm.DB,
	application model.CreatorApplication,
) (*creatorApplicationAIDecision, int, string, error) {
	cfg, err := getOrCreateCreatorAuditConfig(db)
	if err != nil {
		return nil, defaultCreatorAuditStrictness, "", err
	}

	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		// AI 未配置时保持 pending，回退人工审核
		logger.Log.WithFields(logrus.Fields{
			"applicationId": application.ID,
			"userId":        application.UserID,
			"strictness":    cfg.Strictness,
			"reason":        errMsg,
		}).Info("创作者申请 AI 审核跳过")
		return nil, cfg.Strictness, "", nil
	}

	client := ensureSharedArkClient(apiKey, arkBaseURL)
	prompt := buildCreatorApplicationAuditPrompt(application, cfg.Strictness)
	rawText, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		return nil, cfg.Strictness, textModel, err
	}

	decision, err := parseCreatorApplicationAIDecision(rawText)
	if err != nil {
		return nil, cfg.Strictness, textModel, fmt.Errorf("解析 AI 审核结果失败: %w", err)
	}

	decision.ReviewNote = decorateCreatorAuditReviewNote(decision.ReviewNote, cfg.Strictness)
	return &decision, cfg.Strictness, textModel, nil
}

func applyCreatorApplicationReview(
	tx *gorm.DB,
	application *model.CreatorApplication,
	status string,
	reviewNote string,
	reviewerID *model.Int64String,
	reviewSource string,
) error {
	status = strings.ToLower(strings.TrimSpace(status))
	if status != "approved" && status != "rejected" {
		return fmt.Errorf("invalid review status: %s", status)
	}
	if application.Status != "pending" {
		return errors.New("该申请已被审核")
	}

	now := time.Now()
	trimmedNote := strings.TrimSpace(reviewNote)
	if len([]rune(trimmedNote)) > 500 {
		trimmedNote = truncateAIText(trimmedNote, 500)
	}

	application.Status = status
	application.ReviewerID = reviewerID
	application.ReviewNote = trimmedNote
	application.ReviewedAt = &now

	if err := tx.Save(application).Error; err != nil {
		return err
	}

	extraData := map[string]interface{}{
		"applicationId": application.ID,
		"status":        status,
		"reviewSource":  reviewSource,
	}
	extraDataBytes, _ := json.Marshal(extraData)
	notifyContent := "你的创作者申请已通过审核，已为你开通创作者权限。"
	if status == "rejected" {
		notifyContent = "你的创作者申请未通过审核。"
		if trimmedNote != "" {
			notifyContent += " 备注：" + trimmedNote
		}
	}
	notification := model.UserNotification{
		UserID:    application.UserID,
		Type:      "creator_application_review",
		Title:     "创作者申请审核结果",
		Content:   notifyContent,
		IsRead:    false,
		ExtraData: string(extraDataBytes),
	}
	if err := tx.Create(&notification).Error; err != nil {
		return err
	}

	if status == "approved" {
		var existingCreator model.Creator
		err := tx.Where("user_id = ?", application.UserID).First(&existingCreator).Error
		if err == nil {
			return errors.New("该用户已经是创作者")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		code, err := generateCreatorCodeForApplication(tx)
		if err != nil {
			return err
		}

		creator := model.Creator{
			UserID:      application.UserID,
			Description: application.Description,
			Code:        code,
			IsActive:    true,
		}
		if err := tx.Create(&creator).Error; err != nil {
			return err
		}

		space := model.CreatorSpace{
			CreatorID:   creator.ID,
			Description: application.Description,
			IsActive:    true,
		}
		if err := tx.Create(&space).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.User{}).Where("id = ?", application.UserID).Update("role", "creator").Error; err != nil {
			return err
		}

		logFields := logrus.Fields{
			"applicationId": application.ID,
			"userId":        application.UserID,
			"creatorId":     creator.ID,
			"spaceId":       space.ID,
			"reviewSource":  reviewSource,
		}
		if reviewerID != nil {
			logFields["reviewerId"] = *reviewerID
		}
		logger.Log.WithFields(logFields).Info("创作者申请审核通过，已自动创建创作者和空间")
		return nil
	}

	logFields := logrus.Fields{
		"applicationId": application.ID,
		"userId":        application.UserID,
		"reviewSource":  reviewSource,
		"reason":        trimmedNote,
	}
	if reviewerID != nil {
		logFields["reviewerId"] = *reviewerID
	}
	logger.Log.WithFields(logFields).Info("创作者申请被拒绝")
	return nil
}

func buildCreatorApplicationAuditPrompt(application model.CreatorApplication, strictness int) string {
	level := "宽松"
	if strictness >= 70 {
		level = "严格"
	} else if strictness >= 31 {
		level = "适中"
	}

	name := truncateAIText(application.Name, 50)
	reason := truncateAIText(application.Reason, 500)
	description := truncateAIText(application.Description, 300)
	if description == "" {
		description = "无"
	}

	return fmt.Sprintf(
		"你是 Valley 的创作者申请自动审核助手。\n"+
			"目标：新系统初期默认尽量通过，只有明显违规才拒绝。\n"+
			"当前严谨度：%d/100（%s）。\n\n"+
			"请只输出 JSON，不要 Markdown，不要解释：\n"+
			"{\"status\":\"approved|rejected\",\"reviewNote\":\"不超过60字中文\"}\n\n"+
			"审核规则：\n"+
			"1. 申请理由表达正常、无违规风险时，一律 approved。\n"+
			"2. 仅在出现明确违规时 rejected，例如：违法犯罪、涉黄涉赌、暴恐仇恨、诈骗引流、辱骂攻击、明显广告刷屏、无意义乱码灌水。\n"+
			"3. 严谨度只影响边界情况：0-30 尽量通过，31-70 中性，71-100 更严格。\n"+
			"4. 若拒绝，reviewNote 必须指出具体问题并保持克制语气。\n\n"+
			"申请信息：\n"+
			"- 创作者名称：%s\n"+
			"- 申请理由：%s\n"+
			"- 创作者描述：%s\n",
		normalizeCreatorAuditStrictness(strictness),
		level,
		name,
		reason,
		description,
	)
}

func parseCreatorApplicationAIDecision(raw string) (creatorApplicationAIDecision, error) {
	text := strings.TrimSpace(raw)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	if start := strings.Index(text, "{"); start >= 0 {
		if end := strings.LastIndex(text, "}"); end > start {
			text = text[start : end+1]
		}
	}

	var decision creatorApplicationAIDecision
	if err := json.Unmarshal([]byte(text), &decision); err != nil {
		return decision, err
	}

	decision.Status = strings.ToLower(strings.TrimSpace(decision.Status))
	if decision.Status != "approved" && decision.Status != "rejected" {
		return decision, fmt.Errorf("invalid status: %s", decision.Status)
	}

	decision.ReviewNote = strings.Join(strings.Fields(strings.TrimSpace(decision.ReviewNote)), " ")
	if decision.ReviewNote == "" {
		if decision.Status == "approved" {
			decision.ReviewNote = "申请理由正常，已自动通过。"
		} else {
			decision.ReviewNote = "申请理由存在违规风险，未通过自动审核。"
		}
	}
	return decision, nil
}

func decorateCreatorAuditReviewNote(note string, strictness int) string {
	cleanNote := strings.Join(strings.Fields(strings.TrimSpace(note)), " ")
	if cleanNote == "" {
		cleanNote = "申请理由正常，已自动通过。"
	}
	return truncateAIText(
		fmt.Sprintf("AI自动审核（严谨度%d）：%s", normalizeCreatorAuditStrictness(strictness), cleanNote),
		500,
	)
}

func getOrCreateCreatorAuditConfig(db *gorm.DB) (model.CreatorAuditConfig, error) {
	if err := ensureCreatorAuditConfigTable(db); err != nil {
		return model.CreatorAuditConfig{}, err
	}

	var cfg model.CreatorAuditConfig
	err := db.Where("id = ?", creatorAuditConfigPrimaryID).First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		cfg = model.CreatorAuditConfig{
			ID:         creatorAuditConfigPrimaryID,
			Strictness: defaultCreatorAuditStrictness,
		}
		if createErr := db.Create(&cfg).Error; createErr != nil {
			return model.CreatorAuditConfig{}, createErr
		}
		return cfg, nil
	}
	if err != nil {
		return model.CreatorAuditConfig{}, err
	}

	normalized := normalizeCreatorAuditStrictness(cfg.Strictness)
	if normalized != cfg.Strictness {
		cfg.Strictness = normalized
		if saveErr := db.Model(&cfg).Update("strictness", normalized).Error; saveErr != nil {
			return model.CreatorAuditConfig{}, saveErr
		}
	}
	return cfg, nil
}

func ensureCreatorAuditConfigTable(db *gorm.DB) error {
	creatorAuditConfigMigrateOnce.Do(func() {
		creatorAuditConfigMigrateErr = db.AutoMigrate(&model.CreatorAuditConfig{})
	})
	return creatorAuditConfigMigrateErr
}

func normalizeCreatorAuditStrictness(value int) int {
	if value < creatorAuditStrictnessMin {
		return creatorAuditStrictnessMin
	}
	if value > creatorAuditStrictnessMax {
		return creatorAuditStrictnessMax
	}
	return value
}
