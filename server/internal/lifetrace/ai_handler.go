package lifetrace

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	lifeagent "valley-server/internal/lifetrace/agent"
	lifeai "valley-server/internal/lifetrace/ai"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"gorm.io/gorm"
)

type lifeTraceAIAdvice struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Detail string `json:"detail"`
	Tone   string `json:"tone"`
}

type todayAdviceAIResponse struct {
	Summary string              `json:"summary"`
	Items   []lifeTraceAIAdvice `json:"items"`
}

type weeklyReviewAIResponse struct {
	Summary     string   `json:"summary"`
	Wins        []string `json:"wins"`
	Delays      []string `json:"delays"`
	Insights    []string `json:"insights"`
	NextActions []string `json:"nextActions"`
}

type lifeTraceAssistantMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type lifeTraceAssistantRequest struct {
	Message string                      `json:"message"`
	History []lifeTraceAssistantMessage `json:"history"`
}

type lifeTraceAssistantStreamChunk struct {
	Chunk  string                           `json:"chunk,omitempty"`
	Done   bool                             `json:"done,omitempty"`
	Error  string                           `json:"error,omitempty"`
	Source string                           `json:"source,omitempty"`
	Model  string                           `json:"model,omitempty"`
	Action *lifeTraceAssistantActionPayload `json:"action,omitempty"`
}

type lifeTraceAIConfig = lifeai.TextConfig

type lifeTraceAssistantPlanDraft struct {
	Title            string `json:"title"`
	Type             string `json:"type"`
	ScheduledDate    string `json:"scheduledDate"`
	ScheduledTime    string `json:"scheduledTime"`
	Timezone         string `json:"timezone"`
	NotePrefix       string `json:"notePrefix"`
	RelativeSchedule bool   `json:"-"`
}

type lifeTraceAssistantPantryDraft struct {
	Name      string `json:"name"`
	Category  string `json:"category"`
	Quantity  int    `json:"quantity"`
	Unit      string `json:"unit"`
	Location  string `json:"location"`
	ExpiresAt string `json:"expiresAt"`
	OpenedAt  string `json:"openedAt"`
	Note      string `json:"note"`
}

type lifeTraceAssistantLedgerDraft struct {
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	Direction  string  `json:"direction"`
	Category   string  `json:"category"`
	OccurredAt string  `json:"occurredAt"`
	Merchant   string  `json:"merchant"`
	Location   string  `json:"location"`
	Note       string  `json:"note"`
}

type lifeTraceAssistantActionPayload struct {
	Type               string                     `json:"type"`
	Status             string                     `json:"status"`
	Message            string                     `json:"message"`
	NeedMoreInfoFields []string                   `json:"needMoreInfoFields,omitempty"`
	HouseholdName      string                     `json:"householdName,omitempty"`
	Plan               *model.LifeTracePlan       `json:"plan,omitempty"`
	PantryItem         *model.LifeTracePantryItem `json:"pantryItem,omitempty"`
	LedgerEntry        *ledgerEntryResponse       `json:"ledgerEntry,omitempty"`
}

type lifeTraceAssistantStructuredAction struct {
	Type               string                         `json:"type"`
	Message            string                         `json:"message"`
	NeedMoreInfoFields []string                       `json:"needMoreInfoFields,omitempty"`
	Plan               *lifeTraceAssistantPlanDraft   `json:"plan,omitempty"`
	Pantry             *lifeTraceAssistantPantryDraft `json:"pantry,omitempty"`
	Ledger             *lifeTraceAssistantLedgerDraft `json:"ledger,omitempty"`
}

type lifeTraceAssistantStructuredResponse struct {
	Reply  string                              `json:"reply"`
	Action *lifeTraceAssistantStructuredAction `json:"action,omitempty"`
}

var lifeTraceAssistantActionRegistry = lifeagent.NewRegistry(
	lifeagent.ActionSpec{
		Type:               "create_plan",
		Description:        "Create a Life Trace plan or reminder from assistant intent.",
		RequiredFields:     []string{"title", "scheduledDate", "scheduledTime"},
		NeedMoreInfoFields: []string{"scheduledDate", "scheduledTime"},
		AuditScene:         "life-trace-assistant-create-plan",
	},
	lifeagent.ActionSpec{
		Type:               "create_pantry_item",
		Description:        "Create a Pantry item draft from assistant intent.",
		RequiredFields:     []string{"name"},
		NeedMoreInfoFields: []string{"expiresAt"},
		AuditScene:         "life-trace-assistant-create-pantry-item",
	},
	lifeagent.ActionSpec{
		Type:               "create_ledger_entry",
		Description:        "Create a lightweight ledger entry from assistant intent.",
		RequiredFields:     []string{"amount"},
		NeedMoreInfoFields: []string{"amount"},
		AuditScene:         "life-trace-assistant-create-ledger-entry",
	},
)

var (
	errLifeTraceAssistantToolUnsupported = errors.New("assistant tool calling unsupported")
	errLifeTraceAssistantToolInvalid     = errors.New("assistant tool calling invalid")
)

const lifeTraceTodayAdviceDefaultTimeout = 30 * time.Second
const lifeTraceTodayAdviceCacheTTL = 10 * time.Minute
const lifeTraceWeeklyReviewMaxTokens = 520
const lifeTraceAssistantToolName = "submit_life_trace_response"

var (
	assistantPlanIntentPattern       = regexp.MustCompile(`计划|安排|提醒我|提醒|记得|别忘|预约|看电影|电影|吃饭|午饭|晚饭|早餐|午餐|晚餐|餐厅|火锅|咖啡|运动|跑步|健身|阅读|看书|聚会|见朋友|喝咖啡`)
	assistantReminderIntentPattern   = regexp.MustCompile(`提醒我|提醒|记得|别忘|预约|叫我|提示我`)
	assistantClockPattern            = regexp.MustCompile(`([01]?\d|2[0-3])[:：点时]([0-5]\d)?`)
	assistantRelativeDurationPattern = regexp.MustCompile(`(?:(\d+)\s*(?:个)?小时\s*(?:(\d+)\s*分钟?)?后|(\d+)\s*分钟?后)`)
	assistantPlanTitleNoise          = regexp.MustCompile(`今天|今晚|晚上|明天|明早|明晚|周末|周五|周六|周日|星期五|星期六|星期日|早上|上午|中午|下午|下班后?|(?:(\d+)\s*(?:个)?小时\s*(?:(\d+)\s*分钟?)?后|(\d+)\s*分钟?后)|([01]?\d|2[0-3])[:：点时]([0-5]\d)?|提醒我|提醒|记得|别忘了?|叫我|提示我|帮我|我要|想要|想|计划|安排|一下|去|，|。|,|、|\s+`)
	assistantPantryIntentPattern     = regexp.MustCompile(`库存|保质期|生产日期|生产日|有效期|到期|过期|临期|我这边有|我有|家里有|买了|刚买了|新买了|收到|入库|加到库存|添加库存`)
	assistantPantryNamePattern       = regexp.MustCompile(`(?:我这边有|我有|家里有|买了|刚买了|新买了|收到|入库|加到库存(?:里)?|添加库存(?:里)?|库存里有)\s*(?:一|1|一个|一件|一盒|一瓶|一袋|一包|一桶|一支|一罐|一杯|一份|一条|一箱|\d+\s*(?:瓶|盒|袋|包|罐|个|件|桶|支|片|听|杯|箱|条|份))?\s*([^，。,；;]+?)\s*(?:生产日期|生产日|保质期|有效期|到期|过期|开封|放在|放到|存放在|，|。|,|;|；|$)`)
	assistantDatePattern             = regexp.MustCompile(`(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?`)
	assistantProductionDatePattern   = regexp.MustCompile(`(?:生产日期|生产日)[:：是 ]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)`)
	assistantExpiryDatePattern       = regexp.MustCompile(`(?:到期日|过期日|有效期至|保质期至|截止日期|截止到)[:：是 ]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)`)
	assistantShelfLifePattern        = regexp.MustCompile(`(?:保质期|有效期)[^0-9]{0,8}(\d+)\s*(天|日|个月|月|年)|(\d+)\s*(天|日|个月|月|年)\s*(?:保质期|有效期)`)
	assistantOpenedAtPattern         = regexp.MustCompile(`(?:开封日期|开封于|开封)[:：是 ]*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)`)
	assistantPantryQuantityPattern   = regexp.MustCompile(`(\d+)\s*(瓶|盒|袋|包|罐|个|件|桶|支|片|听|杯|箱|条|份)`)
	assistantPantryLeadingCount      = regexp.MustCompile(`^(?:一|1|一个|一件)?\s*(瓶|盒|袋|包|罐|个|件|桶|支|片|听|杯|箱|条|份)\s*`)
	assistantLedgerIntentPattern     = regexp.MustCompile(`记账|记一笔|记个账|账目|消费|花了|支出|收入|退款|转账|付款|付了|买单|收款|工资|奖金|报销`)
	assistantLedgerSymbolAmount      = regexp.MustCompile(`(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)`)
	assistantLedgerUnitAmount        = regexp.MustCompile(`(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱|rmb|RMB)`)
	assistantLedgerIntentAmount      = regexp.MustCompile(`(?:记账|记一笔|记个账|账目|消费|花了|支出|收入|退款|转账|付款|付了|买单|收款|工资|奖金|报销)[^0-9¥￥]{0,12}(\d+(?:\.\d{1,2})?)`)
	assistantLedgerMerchantNoise     = regexp.MustCompile(`记账|记一笔|记个账|帮我|帮忙|一下|今天|刚刚|刚才|花了|消费|支出|收入|退款|转账|付款|付了|买单|收款|工资|奖金|报销|(?:¥|￥)?\s*\d+(?:\.\d{1,2})?\s*(?:元|块|块钱|rmb|RMB)?`)
)

type todayAdviceCacheEntry struct {
	Response  todayAdviceAIResponse
	Source    string
	Model     string
	ExpiresAt time.Time
}

var lifeTraceTodayAdviceCache = struct {
	sync.RWMutex
	items map[string]todayAdviceCacheEntry
}{
	items: make(map[string]todayAdviceCacheEntry),
}

var adviceDefaults = map[string]lifeTraceAIAdvice{
	"wear":    {ID: "wear", Title: "穿衣", Detail: "根据温度和天气调整穿搭", Tone: "plan"},
	"skin":    {ID: "skin", Title: "护肤", Detail: "根据紫外线和湿度调整护肤", Tone: "health"},
	"out":     {ID: "out", Title: "出门", Detail: "出门前检查天气和随身物品", Tone: "weather"},
	"commute": {ID: "commute", Title: "通勤", Detail: "按通勤方式预留缓冲时间", Tone: "ai"},
	"health":  {ID: "health", Title: "健康", Detail: "结合天气安排轻运动和休息", Tone: "trace"},
	"plan":    {ID: "plan", Title: "今日计划", Detail: "优先完成一个轻量计划", Tone: "alert"},
}

var adviceOrder = []string{"wear", "skin", "out", "commute", "health", "plan"}

var validAdviceTones = map[string]bool{
	"weather": true,
	"ai":      true,
	"plan":    true,
	"trace":   true,
	"health":  true,
	"alert":   true,
}

func (h *Handler) GenerateTodayAdvice(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取偏好失败"})
		return
	}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(8).
		Find(&plans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取计划失败"})
		return
	}

	weather := h.weather.Fetch(c.Request.Context(), settings.City, false)
	prompt := buildTodayAdvicePrompt(settings, weather, plans)
	cacheKey := buildTodayAdviceCacheKey(userID, aiCfg, prompt)
	if cached, ok := getCachedTodayAdvice(cacheKey, time.Now()); ok {
		success(c, gin.H{
			"summary": cached.Response.Summary,
			"list":    cached.Response.Items,
			"source":  cached.Source,
			"model":   cached.Model,
			"cached":  true,
		})
		return
	}

	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-today-advice", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAI(aiCtx, aiCfg, prompt)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
		return
	}

	parsed, err := parseTodayAdviceAIResponse(raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 建议解析失败：" + err.Error()})
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	setCachedTodayAdvice(cacheKey, todayAdviceCacheEntry{
		Response:  parsed,
		Source:    aiCfg.Source,
		Model:     modelName,
		ExpiresAt: time.Now().Add(lifeTraceTodayAdviceCacheTTL),
	})

	success(c, gin.H{
		"summary": parsed.Summary,
		"list":    parsed.Items,
		"source":  aiCfg.Source,
		"model":   modelName,
		"cached":  false,
	})
}

func (h *Handler) GenerateWeeklyReview(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取偏好失败"})
		return
	}

	now := time.Now()
	weekStart, weekEnd := currentWeeklyReviewRange(now)
	var completedPlans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ? AND completed_at >= ?", userID, true, weekStart).
		Order("completed_at DESC, updated_at DESC").
		Limit(12).
		Find(&completedPlans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取已完成计划失败"})
		return
	}

	var openPlans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(12).
		Find(&openPlans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取未完成计划失败"})
		return
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ? AND created_at >= ?", userID, weekStart).
		Order("created_at DESC").
		Limit(12).
		Find(&traces).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取踪迹失败"})
		return
	}

	prompt := buildWeeklyReviewPrompt(settings, weekStart, weekEnd, completedPlans, openPlans, traces)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-weekly-review", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, aiCfg, prompt, lifeTraceWeeklyReviewMaxTokens)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
		return
	}

	parsed, err := parseWeeklyReviewAIResponse(raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 周报解析失败：" + err.Error()})
		return
	}

	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	review, err := saveWeeklyReview(userID, weekStart, weekEnd, parsed, aiCfg.Source, modelName)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: weeklyReviewSaveErrorMessage(err)})
		return
	}

	evaluateAchievementsQuietly(userID)
	success(c, weeklyReviewPayload(review))
}

func (h *Handler) ListWeeklyReviews(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var reviews []model.LifeTraceWeeklyReview
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("week_start DESC").
		Limit(24).
		Find(&reviews).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取每周回顾失败"})
		return
	}

	list := make([]gin.H, 0, len(reviews))
	for _, review := range reviews {
		list = append(list, weeklyReviewPayload(review))
	}
	success(c, gin.H{"list": list})
}

func (h *Handler) DeleteWeeklyReview(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var review model.LifeTraceWeeklyReview
	err := database.GetDB().First(&review, "id = ? AND user_id = ?", c.Param("id"), userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusNotFound, "周报不存在")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取周报失败")
		return
	}

	if err := database.GetDB().Delete(&review).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除周报失败")
		return
	}

	success(c, gin.H{"id": review.ID})
}

func (h *Handler) StreamAssistant(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req lifeTraceAssistantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请输入你想安排的生活问题"})
		return
	}
	req.Message = trimRunes(req.Message, 240)

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	settings, err := findSettings(userID)
	if err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取偏好失败"})
		return
	}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND completed = ?", userID, false).
		Order("created_at DESC").
		Limit(8).
		Find(&plans).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取计划失败"})
		return
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(5).
		Find(&traces).Error; err != nil {
		c.JSON(http.StatusOK, apiResponse{Code: http.StatusInternalServerError, Message: "获取踪迹失败"})
		return
	}

	weather := h.weather.Fetch(c.Request.Context(), settings.City, false)
	systemPrompt := lifeTraceAssistantSystemPrompt()
	now := time.Now()
	userPrompt := buildLifeTraceAssistantPrompt(settings, weather, plans, traces, req)
	structuredPrompt := buildLifeTraceAssistantStructuredPrompt(settings, weather, plans, traces, req, now)
	planDraft := buildLifeTraceAssistantPlanDraft(req.Message, now)
	pantryDraft := buildLifeTraceAssistantPantryDraft(req.Message)
	ledgerDraft := buildLifeTraceAssistantLedgerDraft(req.Message, now)
	if planDraft == nil {
		planDraft = buildLifeTraceAssistantPlanFollowUpDraft(req.Message, findRecentAssistantPlanDraft(req.History, now), now)
	}
	if pantryDraft == nil {
		pantryDraft = buildLifeTraceAssistantPantryFollowUpDraft(req.Message, findRecentAssistantPantryDraft(req.History))
	}
	actionEventSent := false
	sendActionEvent := func(send func(lifeTraceAssistantStreamChunk)) {
		if actionEventSent {
			return
		}

		switch {
		case ledgerDraft != nil:
			actionEventSent = true
			send(lifeTraceAssistantStreamChunk{
				Action: h.createAssistantLedgerEntryFromDraft(userID, *ledgerDraft),
			})
		case pantryDraft != nil:
			actionEventSent = true
			send(lifeTraceAssistantStreamChunk{
				Action: h.createAssistantPantryItemFromDraft(c, userID, *pantryDraft),
			})
		case planDraft != nil:
			actionEventSent = true
			send(lifeTraceAssistantStreamChunk{
				Action: h.createAssistantPlanFromDraft(userID, *planDraft),
			})
		}
	}

	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	defer cancel()

	if err := h.streamLifeTraceAssistantStructured(c, aiCtx, aiCfg, systemPrompt, structuredPrompt, userID, now, planDraft, pantryDraft, ledgerDraft); err == nil {
		return
	}

	if aiCfg.Source == "openai" {
		if err := streamLifeTraceAssistantOpenAI(c, aiCtx, aiCfg, systemPrompt, userPrompt, sendActionEvent); err != nil {
			c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
		}
		return
	}

	client := ensureLifeTraceArkClient(aiCfg.APIKey, aiCfg.BaseURL)
	if err := streamLifeTraceAssistantARK(c, aiCtx, client, aiCfg.Model, systemPrompt, userPrompt, sendActionEvent); err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 服务请求失败：" + err.Error()})
	}
}

func buildLifeTraceAssistantPlanDraft(message string, now time.Time) *lifeTraceAssistantPlanDraft {
	text := strings.TrimSpace(message)
	if text == "" || !assistantPlanIntentPattern.MatchString(text) {
		return nil
	}

	planType := inferLifeTraceAssistantPlanType(text)
	title := buildLifeTraceAssistantPlanTitle(text, planType)
	scheduledDate, scheduledTime, relativeSchedule := inferLifeTraceAssistantRelativeSchedule(text, now)
	if !relativeSchedule {
		scheduledTime = inferLifeTraceAssistantPlanTime(text, planType)
		scheduledDate = inferLifeTraceAssistantPlanDate(text, now)
	}
	notePrefix := "来自生活助理计划"
	if assistantReminderIntentPattern.MatchString(text) {
		notePrefix = "来自生活助理提醒"
	}

	return &lifeTraceAssistantPlanDraft{
		Title:            title,
		Type:             planType,
		ScheduledDate:    scheduledDate,
		ScheduledTime:    scheduledTime,
		Timezone:         "Asia/Shanghai",
		NotePrefix:       notePrefix,
		RelativeSchedule: relativeSchedule,
	}
}

func inferLifeTraceAssistantPlanType(text string) string {
	switch {
	case strings.Contains(text, "电影") || strings.Contains(text, "观影") || strings.Contains(text, "影院"):
		return "电影"
	case strings.Contains(text, "吃饭") || strings.Contains(text, "餐厅") || strings.Contains(text, "火锅") || strings.Contains(text, "咖啡") || strings.Contains(text, "午饭") || strings.Contains(text, "晚饭") || strings.Contains(text, "早餐") || strings.Contains(text, "午餐") || strings.Contains(text, "晚餐"):
		return "吃饭"
	case strings.Contains(text, "运动") || strings.Contains(text, "跑步") || strings.Contains(text, "健身") || strings.Contains(text, "瑜伽") || strings.Contains(text, "骑行") || strings.Contains(text, "游泳"):
		return "运动"
	case strings.Contains(text, "阅读") || strings.Contains(text, "看书") || strings.Contains(text, "读书"):
		return "阅读"
	case strings.Contains(text, "聚会") || strings.Contains(text, "见朋友") || strings.Contains(text, "约朋友") || strings.Contains(text, "约会"):
		return "聚会"
	default:
		return "普通事项"
	}
}

func buildLifeTraceAssistantPlanTitle(text string, planType string) string {
	title := strings.TrimSpace(assistantPlanTitleNoise.ReplaceAllString(text, ""))
	if title != "" {
		return trimRunes(title, 36)
	}

	switch planType {
	case "电影":
		return "看电影"
	case "吃饭":
		return "吃饭"
	case "运动":
		return "运动"
	case "阅读":
		return "阅读"
	case "聚会":
		return "聚会"
	default:
		return "生活计划"
	}
}

func inferLifeTraceAssistantPlanTime(text string, planType string) string {
	if match := assistantClockPattern.FindStringSubmatch(text); len(match) >= 2 {
		hour := match[1]
		if len(hour) == 1 {
			hour = "0" + hour
		}
		minute := "00"
		if len(match) >= 3 && match[2] != "" {
			minute = match[2]
		}
		return hour + ":" + minute
	}

	switch {
	case strings.Contains(text, "早上") || strings.Contains(text, "上午") || strings.Contains(text, "明早"):
		return "09:00"
	case strings.Contains(text, "中午") || strings.Contains(text, "午饭") || strings.Contains(text, "午餐"):
		return "12:00"
	case strings.Contains(text, "下午"):
		return "15:00"
	case strings.Contains(text, "下班"):
		return "18:30"
	case strings.Contains(text, "晚上") || strings.Contains(text, "今晚") || strings.Contains(text, "明晚") || strings.Contains(text, "晚饭") || strings.Contains(text, "晚餐"):
		return "19:30"
	case planType == "吃饭":
		return "12:00"
	case planType == "电影" || planType == "运动" || planType == "聚会":
		return "19:30"
	default:
		return "20:00"
	}
}

func inferLifeTraceAssistantRelativeSchedule(text string, now time.Time) (string, string, bool) {
	match := assistantRelativeDurationPattern.FindStringSubmatch(strings.TrimSpace(text))
	if len(match) < 3 {
		return "", "", false
	}

	hours := 0
	minutes := 0
	if match[1] != "" {
		parsedHours, err := strconv.Atoi(match[1])
		if err != nil {
			return "", "", false
		}
		hours = parsedHours
	}
	if match[2] != "" {
		parsedMinutes, err := strconv.Atoi(match[2])
		if err != nil {
			return "", "", false
		}
		minutes = parsedMinutes
	}
	if match[3] != "" {
		parsedMinutes, err := strconv.Atoi(match[3])
		if err != nil {
			return "", "", false
		}
		minutes = parsedMinutes
	}
	if hours <= 0 && minutes <= 0 {
		return "", "", false
	}

	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.Local
	}
	dueAt := now.In(location).Add(time.Duration(hours)*time.Hour + time.Duration(minutes)*time.Minute)
	if dueAt.Second() > 0 || dueAt.Nanosecond() > 0 {
		dueAt = dueAt.Truncate(time.Minute).Add(time.Minute)
	}
	return dueAt.Format("2006-01-02"), dueAt.Format("15:04"), true
}

func inferLifeTraceAssistantPlanDate(text string, now time.Time) string {
	base := lifeTraceAssistantLocalDate(now)
	if strings.Contains(text, "明天") || strings.Contains(text, "明早") || strings.Contains(text, "明晚") {
		return base.AddDate(0, 0, 1).Format("2006-01-02")
	}
	if strings.Contains(text, "周末") || strings.Contains(text, "周六") || strings.Contains(text, "星期六") {
		return base.AddDate(0, 0, daysUntilWeekday(base, time.Saturday)).Format("2006-01-02")
	}
	if strings.Contains(text, "周日") || strings.Contains(text, "星期日") {
		return base.AddDate(0, 0, daysUntilWeekday(base, time.Sunday)).Format("2006-01-02")
	}
	if strings.Contains(text, "周五") || strings.Contains(text, "星期五") {
		return base.AddDate(0, 0, daysUntilWeekday(base, time.Friday)).Format("2006-01-02")
	}
	return base.Format("2006-01-02")
}

func extractAssistantStandaloneDate(text string) string {
	if match := assistantDatePattern.FindStringSubmatch(strings.TrimSpace(text)); len(match) >= 4 {
		return normalizeAssistantDate(match[0])
	}
	return ""
}

func lifeTraceAssistantLocalDate(now time.Time) time.Time {
	location, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		location = time.Local
	}
	localNow := now.In(location)
	return time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, location)
}

func daysUntilWeekday(base time.Time, target time.Weekday) int {
	return (int(target) - int(base.Weekday()) + 7) % 7
}

func formatLifeTraceAssistantPlanTimeLabel(scheduledDate string, scheduledTime string) string {
	return strings.TrimSpace(scheduledDate + " " + scheduledTime)
}

func assistantPlanMarker(draft lifeTraceAssistantPlanDraft) string {
	return fmt.Sprintf("#assistant-plan:%s-%s-%s-%s", draft.ScheduledDate, draft.ScheduledTime, draft.Type, draft.Title)
}

func missingAssistantPlanFields(draft lifeTraceAssistantPlanDraft) []string {
	fields := make([]string, 0, 2)
	if normalizeAssistantDate(draft.ScheduledDate) == "" {
		fields = append(fields, "scheduledDate")
	}
	if normalizeTimeText(draft.ScheduledTime, "") == "" {
		fields = append(fields, "scheduledTime")
	}
	return fields
}

func buildAssistantPlanNeedMoreInfoMessage(title string, fields []string) string {
	if len(fields) == 0 {
		return "想帮你加入计划的话，我还需要具体的日期和提醒时间。"
	}

	hasDate := false
	hasTime := false
	for _, field := range fields {
		if field == "scheduledDate" {
			hasDate = true
		}
		if field == "scheduledTime" {
			hasTime = true
		}
	}

	target := "这个计划"
	if trimmedTitle := strings.TrimSpace(title); trimmedTitle != "" {
		target = fmt.Sprintf("「%s」", trimmedTitle)
	}

	switch {
	case hasDate && hasTime:
		return fmt.Sprintf("要把%s加进计划，我还差具体日期和提醒时间。你告诉我是几号、几点提醒就行。", target)
	case hasDate:
		return fmt.Sprintf("要把%s加进计划，我还差具体日期。你告诉我哪一天提醒就行。", target)
	case hasTime:
		return fmt.Sprintf("要把%s加进计划，我还差提醒时间。你告诉我几点提醒就行。", target)
	default:
		return "想帮你加入计划的话，我还需要再确认一点时间信息。"
	}
}

func (h *Handler) createAssistantPlanFromDraft(userID model.Int64String, draft lifeTraceAssistantPlanDraft) *lifeTraceAssistantActionPayload {
	if strings.TrimSpace(draft.Title) == "" {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_plan",
			Status:  "error",
			Message: "计划信息还不够完整，至少需要一个标题。",
		}
	}
	if missingFields := missingAssistantPlanFields(draft); len(missingFields) > 0 {
		return buildAssistantNeedMoreInfoPayload(
			"create_plan",
			buildAssistantPlanNeedMoreInfoMessage(draft.Title, missingFields),
			missingFields,
		)
	}

	marker := assistantPlanMarker(draft)
	var existing model.LifeTracePlan
	err := database.GetDB().
		Where("user_id = ? AND title = ? AND scheduled_date = ? AND scheduled_time = ? AND source = ?", userID, draft.Title, draft.ScheduledDate, draft.ScheduledTime, "ai_advice").
		First(&existing).Error
	if err == nil {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_plan",
			Status:  "exists",
			Message: fmt.Sprintf("「%s」已经在计划里了。", draft.Title),
			Plan:    &existing,
		}
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_plan",
			Status:  "error",
			Message: "生活助理已回复，但检查计划是否存在失败，请稍后再试。",
		}
	}

	plan := model.LifeTracePlan{
		UserID:        userID,
		Title:         draft.Title,
		Type:          normalizePlanType(draft.Type),
		TimeLabel:     formatLifeTraceAssistantPlanTimeLabel(draft.ScheduledDate, draft.ScheduledTime),
		ScheduledDate: draft.ScheduledDate,
		ScheduledTime: draft.ScheduledTime,
		Timezone:      draft.Timezone,
		Reminder:      true,
		Note:          sanitizePlanNote(fmt.Sprintf("%s：%s。%s", draft.NotePrefix, draft.Title, marker)),
		Source:        "ai_advice",
	}
	if err := database.GetDB().Create(&plan).Error; err != nil {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_plan",
			Status:  "error",
			Message: "生活助理已回复，但计划保存失败，请稍后再试。",
		}
	}

	evaluateAchievementsQuietly(userID)
	return &lifeTraceAssistantActionPayload{
		Type:    "create_plan",
		Status:  "created",
		Message: fmt.Sprintf("「%s」已加入计划，会在 %s 提醒。", plan.Title, plan.TimeLabel),
		Plan:    &plan,
	}
}

func buildLifeTraceAssistantPantryDraft(message string) *lifeTraceAssistantPantryDraft {
	text := strings.TrimSpace(message)
	if text == "" || !assistantPantryIntentPattern.MatchString(text) {
		return nil
	}

	name := inferLifeTraceAssistantPantryName(text)
	if name == "" {
		return nil
	}

	productionDate := inferLifeTraceAssistantProductionDate(text)
	expiresAt := inferLifeTraceAssistantExpiryDate(text, productionDate)
	location := inferLifeTraceAssistantPantryLocation(text)
	category := inferLifeTraceAssistantPantryCategory(text)
	quantity, unit := inferLifeTraceAssistantPantryQuantity(text)
	openedAt := inferLifeTraceAssistantOpenedDate(text)
	note := trimRunes(strings.TrimSpace(text), 120)

	return &lifeTraceAssistantPantryDraft{
		Name:      name,
		Category:  category,
		Quantity:  quantity,
		Unit:      unit,
		Location:  location,
		ExpiresAt: expiresAt,
		OpenedAt:  openedAt,
		Note:      note,
	}
}

func buildLifeTraceAssistantLedgerDraft(message string, now time.Time) *lifeTraceAssistantLedgerDraft {
	text := strings.TrimSpace(message)
	if text == "" || !assistantLedgerIntentPattern.MatchString(text) {
		return nil
	}

	return &lifeTraceAssistantLedgerDraft{
		Amount:     inferLifeTraceAssistantLedgerAmount(text),
		Currency:   "CNY",
		Direction:  inferLifeTraceAssistantLedgerDirection(text),
		Category:   inferLifeTraceAssistantLedgerCategory(text),
		OccurredAt: now.Format(time.RFC3339),
		Merchant:   inferLifeTraceAssistantLedgerMerchant(text),
		Note:       trimRunes(text, 180),
	}
}

func buildLifeTraceAssistantPlanFollowUpDraft(
	message string,
	base *lifeTraceAssistantPlanDraft,
	now time.Time,
) *lifeTraceAssistantPlanDraft {
	if base == nil {
		return nil
	}
	text := strings.TrimSpace(message)
	if text == "" {
		return nil
	}

	next := *base
	changed := false
	if scheduledDate, scheduledTime, ok := inferLifeTraceAssistantRelativeSchedule(text, now); ok {
		next.ScheduledDate = scheduledDate
		next.ScheduledTime = scheduledTime
		changed = true
	} else if assistantClockPattern.MatchString(text) ||
		strings.Contains(text, "早上") ||
		strings.Contains(text, "上午") ||
		strings.Contains(text, "中午") ||
		strings.Contains(text, "下午") ||
		strings.Contains(text, "晚上") ||
		strings.Contains(text, "今晚") ||
		strings.Contains(text, "明晚") ||
		strings.Contains(text, "下班") {
		next.ScheduledTime = inferLifeTraceAssistantPlanTime(text, next.Type)
		changed = true
	}
	if strings.Contains(text, "明天") ||
		strings.Contains(text, "明早") ||
		strings.Contains(text, "明晚") ||
		strings.Contains(text, "周末") ||
		strings.Contains(text, "周五") ||
		strings.Contains(text, "周六") ||
		strings.Contains(text, "周日") ||
		strings.Contains(text, "星期五") ||
		strings.Contains(text, "星期六") ||
		strings.Contains(text, "星期日") {
		next.ScheduledDate = inferLifeTraceAssistantPlanDate(text, now)
		changed = true
	} else if date := extractAssistantStandaloneDate(text); date != "" {
		next.ScheduledDate = date
		changed = true
	}
	if !changed {
		return nil
	}
	return &next
}

func inferLifeTraceAssistantPantryName(text string) string {
	if match := assistantPantryNamePattern.FindStringSubmatch(text); len(match) >= 2 {
		name := cleanLifeTraceAssistantPantryName(match[1])
		name = strings.Trim(name, "，。,；;：: ")
		if name != "" {
			return trimRunes(name, 36)
		}
	}

	for _, prefix := range []string{"生产日期", "生产日", "保质期", "有效期", "到期", "过期", "开封"} {
		if head, _, ok := strings.Cut(text, prefix); ok {
			head = strings.TrimSpace(head)
			head = strings.TrimPrefix(head, "我这边有")
			head = strings.TrimPrefix(head, "我有")
			head = strings.TrimPrefix(head, "家里有")
			head = strings.TrimPrefix(head, "买了")
			head = strings.TrimPrefix(head, "刚买了")
			head = strings.TrimPrefix(head, "新买了")
			head = cleanLifeTraceAssistantPantryName(head)
			head = strings.TrimSpace(strings.Trim(head, "，。,；;：: "))
			if head != "" {
				return trimRunes(head, 36)
			}
		}
	}

	return ""
}

func cleanLifeTraceAssistantPantryName(raw string) string {
	name := strings.TrimSpace(raw)
	name = assistantPantryLeadingCount.ReplaceAllString(name, "")
	return strings.TrimSpace(name)
}

func buildLifeTraceAssistantPantryFollowUpDraft(
	message string,
	base *lifeTraceAssistantPantryDraft,
) *lifeTraceAssistantPantryDraft {
	if base == nil {
		return nil
	}
	text := strings.TrimSpace(message)
	if text == "" {
		return nil
	}

	next := *base
	changed := false
	productionDate := inferLifeTraceAssistantProductionDate(text)
	if productionDate == "" {
		productionDate = inferLifeTraceAssistantProductionDate(base.Note)
	}
	expiresAt := inferLifeTraceAssistantExpiryDate(text, productionDate)
	if expiresAt == "" && productionDate != "" && assistantShelfLifePattern.MatchString(base.Note) {
		expiresAt = inferLifeTraceAssistantExpiryDate(base.Note, productionDate)
	}
	if expiresAt == "" {
		expiresAt = extractAssistantStandaloneDate(text)
	}
	if expiresAt != "" {
		next.ExpiresAt = expiresAt
		changed = true
	}

	if openedAt := inferLifeTraceAssistantOpenedDate(text); openedAt != "" {
		next.OpenedAt = openedAt
		changed = true
	}
	if quantity, unit := inferLifeTraceAssistantPantryQuantity(text); quantity > 0 && (quantity != 1 || unit != "件") {
		next.Quantity = quantity
		next.Unit = unit
		changed = true
	}
	if location := inferLifeTraceAssistantPantryLocation(text); location != "" && location != next.Location {
		if strings.Contains(text, "冷冻") ||
			strings.Contains(text, "冰箱") ||
			strings.Contains(text, "冷藏") ||
			strings.Contains(text, "卫生间") ||
			strings.Contains(text, "玄关") ||
			strings.Contains(text, "储物柜") {
			next.Location = location
			changed = true
		}
	}
	if category := inferLifeTraceAssistantPantryCategory(text); category != "" && category != next.Category {
		if strings.Contains(text, "药") ||
			strings.Contains(text, "胶囊") ||
			strings.Contains(text, "药片") ||
			strings.Contains(text, "纸巾") ||
			strings.Contains(text, "洗衣液") ||
			strings.Contains(text, "牙膏") ||
			strings.Contains(text, "沐浴露") ||
			strings.Contains(text, "猫") ||
			strings.Contains(text, "狗") ||
			strings.Contains(text, "宠物") {
			next.Category = category
			changed = true
		}
	}
	if note := trimRunes(strings.TrimSpace(base.Note+" "+text), 180); note != next.Note {
		next.Note = note
		changed = true
	}
	if !changed {
		return nil
	}
	return &next
}

func findRecentAssistantPlanDraft(history []lifeTraceAssistantMessage, now time.Time) *lifeTraceAssistantPlanDraft {
	for index := len(history) - 1; index >= 0; index -= 1 {
		item := history[index]
		if strings.TrimSpace(item.Role) != "user" {
			continue
		}
		if draft := buildLifeTraceAssistantPlanDraft(item.Content, now); draft != nil {
			return draft
		}
	}
	return nil
}

func findRecentAssistantPantryDraft(history []lifeTraceAssistantMessage) *lifeTraceAssistantPantryDraft {
	for index := len(history) - 1; index >= 0; index -= 1 {
		item := history[index]
		if strings.TrimSpace(item.Role) != "user" {
			continue
		}
		if draft := buildLifeTraceAssistantPantryDraft(item.Content); draft != nil {
			return draft
		}
	}
	return nil
}

func inferLifeTraceAssistantLedgerAmount(text string) float64 {
	for _, pattern := range []*regexp.Regexp{
		assistantLedgerSymbolAmount,
		assistantLedgerUnitAmount,
		assistantLedgerIntentAmount,
	} {
		if match := pattern.FindStringSubmatch(text); len(match) >= 2 {
			amount, err := strconv.ParseFloat(strings.TrimSpace(match[1]), 64)
			if err == nil && amount > 0 {
				return amount
			}
		}
	}
	return 0
}

func inferLifeTraceAssistantLedgerDirection(text string) string {
	switch {
	case strings.Contains(text, "收入") || strings.Contains(text, "工资") || strings.Contains(text, "奖金") || strings.Contains(text, "收款"):
		return "收入"
	case strings.Contains(text, "退款") || strings.Contains(text, "退了"):
		return "退款"
	case strings.Contains(text, "转账"):
		return "转账备注"
	default:
		return "支出"
	}
}

func inferLifeTraceAssistantLedgerCategory(text string) string {
	switch {
	case strings.Contains(text, "饭") || strings.Contains(text, "餐") || strings.Contains(text, "咖啡") || strings.Contains(text, "奶茶") || strings.Contains(text, "外卖") || strings.Contains(text, "火锅"):
		return "吃饭"
	case strings.Contains(text, "地铁") || strings.Contains(text, "公交") || strings.Contains(text, "打车") || strings.Contains(text, "停车") || strings.Contains(text, "加油") || strings.Contains(text, "火车") || strings.Contains(text, "机票"):
		return "交通"
	case strings.Contains(text, "电影") || strings.Contains(text, "书") || strings.Contains(text, "音乐") || strings.Contains(text, "游戏") || strings.Contains(text, "展"):
		return "书影音"
	case strings.Contains(text, "会员") || strings.Contains(text, "订阅") || strings.Contains(text, "续费"):
		return "订阅"
	case strings.Contains(text, "家用") || strings.Contains(text, "日用品") || strings.Contains(text, "水电") || strings.Contains(text, "燃气"):
		return "家用"
	case strings.Contains(text, "礼物") || strings.Contains(text, "红包"):
		return "礼物"
	case strings.Contains(text, "医院") || strings.Contains(text, "药") || strings.Contains(text, "体检") || strings.Contains(text, "牙"):
		return "医疗"
	case strings.Contains(text, "买") || strings.Contains(text, "购") || strings.Contains(text, "超市") || strings.Contains(text, "便利店") || strings.Contains(text, "商场"):
		return "购物"
	default:
		return "其他"
	}
}

func inferLifeTraceAssistantLedgerMerchant(text string) string {
	merchant := assistantLedgerMerchantNoise.ReplaceAllString(text, " ")
	merchant = strings.NewReplacer("，", " ", ",", " ", "。", " ", "；", " ", ";", " ", "：", " ", ":", " ").Replace(merchant)
	merchant = strings.Join(strings.Fields(merchant), " ")
	return trimRunes(strings.TrimSpace(merchant), 80)
}

func inferLifeTraceAssistantProductionDate(text string) string {
	if match := assistantProductionDatePattern.FindStringSubmatch(text); len(match) >= 2 {
		return normalizeAssistantDate(match[1])
	}
	return ""
}

func inferLifeTraceAssistantExpiryDate(text string, productionDate string) string {
	if match := assistantExpiryDatePattern.FindStringSubmatch(text); len(match) >= 2 {
		return normalizeAssistantDate(match[1])
	}
	if productionDate == "" {
		return ""
	}
	if days, unit := inferLifeTraceAssistantShelfLife(text); days > 0 {
		base, err := time.Parse("2006-01-02", productionDate)
		if err != nil {
			return ""
		}
		switch unit {
		case "天", "日":
			return base.AddDate(0, 0, days).Format("2006-01-02")
		case "个月", "月":
			return base.AddDate(0, days, 0).Format("2006-01-02")
		case "年":
			return base.AddDate(days, 0, 0).Format("2006-01-02")
		}
	}
	return ""
}

func inferLifeTraceAssistantShelfLife(text string) (int, string) {
	match := assistantShelfLifePattern.FindStringSubmatch(text)
	if len(match) == 0 {
		return 0, ""
	}

	dayText := ""
	unit := ""
	if len(match) >= 3 && strings.TrimSpace(match[1]) != "" {
		dayText = match[1]
		unit = match[2]
	} else if len(match) >= 5 && strings.TrimSpace(match[3]) != "" {
		dayText = match[3]
		unit = match[4]
	}
	days, err := strconv.Atoi(strings.TrimSpace(dayText))
	if err != nil || days <= 0 {
		return 0, ""
	}
	return days, strings.TrimSpace(unit)
}

func inferLifeTraceAssistantOpenedDate(text string) string {
	if match := assistantOpenedAtPattern.FindStringSubmatch(text); len(match) >= 2 {
		return normalizeAssistantDate(match[1])
	}
	return ""
}

func inferLifeTraceAssistantPantryQuantity(text string) (int, string) {
	if match := assistantPantryQuantityPattern.FindStringSubmatch(text); len(match) >= 3 {
		quantity, err := strconv.Atoi(strings.TrimSpace(match[1]))
		if err == nil && quantity > 0 {
			return quantity, normalizePantryUnit(match[2])
		}
	}
	return 1, "件"
}

func inferLifeTraceAssistantPantryCategory(text string) string {
	switch {
	case strings.Contains(text, "药") || strings.Contains(text, "胶囊") || strings.Contains(text, "药片"):
		return "药品"
	case strings.Contains(text, "纸巾") || strings.Contains(text, "洗衣液") || strings.Contains(text, "牙膏") || strings.Contains(text, "沐浴露"):
		return "日用品"
	case strings.Contains(text, "猫") || strings.Contains(text, "狗") || strings.Contains(text, "宠物"):
		return "宠物"
	default:
		return "食品"
	}
}

func inferLifeTraceAssistantPantryLocation(text string) string {
	switch {
	case strings.Contains(text, "冷冻"):
		return "冷冻"
	case strings.Contains(text, "冰箱") || strings.Contains(text, "冷藏") || strings.Contains(text, "牛奶") || strings.Contains(text, "酸奶"):
		return "冷藏"
	case strings.Contains(text, "卫生间"):
		return "卫生间"
	case strings.Contains(text, "玄关"):
		return "玄关"
	case strings.Contains(text, "储物柜"):
		return "储物柜"
	default:
		return "厨房"
	}
}

func normalizeAssistantDate(raw string) string {
	match := assistantDatePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if len(match) < 4 {
		return ""
	}
	year, err := strconv.Atoi(match[1])
	if err != nil {
		return ""
	}
	month, err := strconv.Atoi(match[2])
	if err != nil {
		return ""
	}
	day, err := strconv.Atoi(match[3])
	if err != nil {
		return ""
	}
	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
	if date.Year() != year || int(date.Month()) != month || date.Day() != day {
		return ""
	}
	return date.Format("2006-01-02")
}

func normalizeAssistantNeedMoreInfoFields(fields []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(fields))
	for _, field := range fields {
		field = strings.TrimSpace(field)
		switch field {
		case "expiresAt", "scheduledDate", "scheduledTime", "amount":
			if !seen[field] {
				seen[field] = true
				result = append(result, field)
			}
		}
	}
	return result
}

func buildAssistantPantryNeedMoreInfoMessage(name string) string {
	if strings.TrimSpace(name) == "" {
		return "想帮你加入库存的话，我还需要商品名。"
	}
	return fmt.Sprintf("要把「%s」收进库存，我还差一个生产日期或到期日。你告诉我生产日期，我就能按保质期算到期日。", name)
}

func buildAssistantLedgerNeedMoreInfoMessage(draft *lifeTraceAssistantLedgerDraft) string {
	if draft != nil && strings.TrimSpace(draft.Merchant) != "" {
		return fmt.Sprintf("要记下「%s」这笔账，我还差金额。", draft.Merchant)
	}
	return "要帮你记这笔账，我还差金额。"
}

func assistantPantryNeedsProductionDate(draft lifeTraceAssistantPantryDraft) bool {
	if normalizePantryDate(draft.ExpiresAt) != "" {
		return false
	}
	return assistantShelfLifePattern.MatchString(draft.Note)
}

func buildAssistantNeedMoreInfoPayload(actionType string, message string, fields []string) *lifeTraceAssistantActionPayload {
	return &lifeTraceAssistantActionPayload{
		Type:               actionType,
		Status:             "need_more_info",
		Message:            trimRunes(strings.TrimSpace(message), 80),
		NeedMoreInfoFields: normalizeAssistantNeedMoreInfoFields(fields),
	}
}

func mergeAssistantLedgerDraft(primary *lifeTraceAssistantLedgerDraft, fallback *lifeTraceAssistantLedgerDraft) *lifeTraceAssistantLedgerDraft {
	if primary == nil && fallback == nil {
		return nil
	}

	merged := lifeTraceAssistantLedgerDraft{
		Currency:   "CNY",
		Direction:  "支出",
		Category:   "其他",
		OccurredAt: time.Now().Format(time.RFC3339),
	}
	if fallback != nil {
		merged = *fallback
	}
	if primary == nil {
		return &merged
	}
	if amountToCents(primary.Amount) > 0 {
		merged.Amount = primary.Amount
	}
	if currency := normalizeLedgerCurrency(primary.Currency); currency != "" {
		merged.Currency = currency
	}
	if direction := strings.TrimSpace(primary.Direction); validLedgerDirections[direction] {
		merged.Direction = direction
	}
	if category := strings.TrimSpace(primary.Category); validLedgerCategories[category] {
		merged.Category = category
	}
	if occurredAt := strings.TrimSpace(primary.OccurredAt); occurredAt != "" {
		if _, ok := parseLedgerTime(occurredAt); ok {
			merged.OccurredAt = occurredAt
		}
	}
	if merchant := strings.TrimSpace(primary.Merchant); merchant != "" {
		merged.Merchant = trimRunes(merchant, 80)
	}
	if location := strings.TrimSpace(primary.Location); location != "" {
		merged.Location = trimRunes(location, 80)
	}
	if note := strings.TrimSpace(primary.Note); note != "" {
		merged.Note = trimRunes(note, 180)
	}
	return &merged
}

func mergeAssistantPlanDraft(primary *lifeTraceAssistantPlanDraft, fallback *lifeTraceAssistantPlanDraft) *lifeTraceAssistantPlanDraft {
	if primary == nil && fallback == nil {
		return nil
	}

	merged := lifeTraceAssistantPlanDraft{
		Title:         "",
		Type:          "普通事项",
		ScheduledDate: "",
		ScheduledTime: "",
		Timezone:      "Asia/Shanghai",
		NotePrefix:    "来自生活助理计划",
	}
	if fallback != nil {
		merged = *fallback
	}
	if primary == nil {
		return &merged
	}

	if title := trimRunes(strings.TrimSpace(primary.Title), 24); title != "" {
		merged.Title = title
	}
	if planType := normalizePlanType(primary.Type); planType != "" {
		merged.Type = planType
	}
	if !merged.RelativeSchedule {
		if date := normalizeAssistantDate(primary.ScheduledDate); date != "" {
			merged.ScheduledDate = date
		}
		if timeText := normalizeTimeText(primary.ScheduledTime, ""); timeText != "" {
			merged.ScheduledTime = timeText
		}
	}
	if timezone := strings.TrimSpace(primary.Timezone); timezone != "" {
		merged.Timezone = timezone
	}
	if notePrefix := trimRunes(strings.TrimSpace(primary.NotePrefix), 24); notePrefix != "" {
		merged.NotePrefix = notePrefix
	}
	if strings.TrimSpace(merged.Title) == "" {
		return nil
	}
	return &merged
}

func mergeAssistantPantryDraft(primary *lifeTraceAssistantPantryDraft, fallback *lifeTraceAssistantPantryDraft) *lifeTraceAssistantPantryDraft {
	if primary == nil && fallback == nil {
		return nil
	}

	merged := lifeTraceAssistantPantryDraft{
		Name:      "",
		Category:  "食品",
		Quantity:  1,
		Unit:      "件",
		Location:  "厨房",
		ExpiresAt: "",
		OpenedAt:  "",
		Note:      "",
	}
	if fallback != nil {
		merged = *fallback
	}
	if primary == nil {
		return &merged
	}

	if name := trimRunes(strings.TrimSpace(primary.Name), 36); name != "" {
		merged.Name = name
	}
	if category := normalizePantryCategory(primary.Category); category != "" {
		merged.Category = category
	}
	if quantity := normalizePantryQuantity(primary.Quantity); quantity > 0 {
		merged.Quantity = quantity
	}
	if unit := normalizePantryUnit(primary.Unit); unit != "" {
		merged.Unit = unit
	}
	if location := normalizePantryLocation(primary.Location); location != "" {
		merged.Location = location
	}
	if date := normalizePantryDate(primary.ExpiresAt); date != "" {
		merged.ExpiresAt = date
	}
	if date := normalizePantryDate(primary.OpenedAt); date != "" {
		merged.OpenedAt = date
	}
	if note := trimRunes(strings.TrimSpace(primary.Note), 180); note != "" {
		merged.Note = note
	}
	if strings.TrimSpace(merged.Name) == "" {
		return nil
	}
	return &merged
}

func (h *Handler) createAssistantPantryItemFromDraft(c *gin.Context, userID model.Int64String, draft lifeTraceAssistantPantryDraft) *lifeTraceAssistantActionPayload {
	if strings.TrimSpace(draft.Name) == "" {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_pantry_item",
			Status:  "error",
			Message: "库存信息还不够完整，至少需要商品名。",
		}
	}
	expiresAt := normalizePantryDate(draft.ExpiresAt)
	if assistantPantryNeedsProductionDate(draft) {
		return buildAssistantNeedMoreInfoPayload(
			"create_pantry_item",
			buildAssistantPantryNeedMoreInfoMessage(draft.Name),
			[]string{"expiresAt"},
		)
	}

	householdCtx, err := resolveHouseholdContext(c, userID)
	if err != nil {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_pantry_item",
			Status:  "error",
			Message: "生活助理已回复，但读取当前库存空间失败，请稍后再试。",
		}
	}

	var existing model.LifeTracePantryItem
	err = database.GetDB().
		Where("household_id = ? AND name = ? AND expires_at = ? AND status NOT IN ?", householdCtx.Household.ID, draft.Name, expiresAt, []string{"used-up", "discarded"}).
		Order("updated_at DESC").
		First(&existing).Error
	if err == nil {
		message := fmt.Sprintf("「%s」已经在「%s」里了，位置在%s。", draft.Name, householdCtx.Household.Name, existing.Location)
		if existing.ExpiresAt != "" {
			message = fmt.Sprintf("「%s」已经在「%s」里了，位置在%s，保质期到 %s。", draft.Name, householdCtx.Household.Name, existing.Location, existing.ExpiresAt)
		}
		return &lifeTraceAssistantActionPayload{
			Type:          "create_pantry_item",
			Status:        "exists",
			Message:       message,
			HouseholdName: householdCtx.Household.Name,
			PantryItem:    &existing,
		}
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_pantry_item",
			Status:  "error",
			Message: "生活助理已回复，但检查库存是否存在失败，请稍后再试。",
		}
	}

	item := model.LifeTracePantryItem{
		UserID:             userID,
		HouseholdID:        householdCtx.Household.ID,
		Name:               trimRunes(strings.TrimSpace(draft.Name), 36),
		Category:           normalizePantryCategory(draft.Category),
		Quantity:           normalizePantryQuantity(draft.Quantity),
		Unit:               normalizePantryUnit(draft.Unit),
		Location:           normalizePantryLocation(draft.Location),
		ExpiresAt:          expiresAt,
		OpenedAt:           normalizePantryDate(draft.OpenedAt),
		Note:               trimRunes(strings.TrimSpace(draft.Note), 180),
		Status:             "normal",
		CreatedBy:          userID,
		UpdatedBy:          userID,
		ReminderEnabled:    expiresAt != "",
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_pantry_item",
			Status:  "error",
			Message: "生活助理已回复，但库存保存失败，请稍后再试。",
		}
	}
	if item.ExpiresAt == "" {
		if err := database.GetDB().Model(&item).UpdateColumn("reminder_enabled", false).Error; err != nil {
			return &lifeTraceAssistantActionPayload{
				Type:    "create_pantry_item",
				Status:  "error",
				Message: "生活助理已回复，但库存保存失败，请稍后再试。",
			}
		}
		item.ReminderEnabled = false
	}

	evaluateAchievementsQuietly(userID)
	message := fmt.Sprintf("已经帮你把「%s」收进「%s」了，放在%s。", item.Name, householdCtx.Household.Name, item.Location)
	if item.ExpiresAt != "" {
		message = fmt.Sprintf("已经帮你把「%s」收进「%s」了，放在%s，保质期到 %s。", item.Name, householdCtx.Household.Name, item.Location, item.ExpiresAt)
	}

	return &lifeTraceAssistantActionPayload{
		Type:          "create_pantry_item",
		Status:        "created",
		Message:       message,
		HouseholdName: householdCtx.Household.Name,
		PantryItem:    &item,
	}
}

func (h *Handler) createAssistantLedgerEntryFromDraft(userID model.Int64String, draft lifeTraceAssistantLedgerDraft) *lifeTraceAssistantActionPayload {
	if amountToCents(draft.Amount) <= 0 {
		return buildAssistantNeedMoreInfoPayload(
			"create_ledger_entry",
			buildAssistantLedgerNeedMoreInfoMessage(&draft),
			[]string{"amount"},
		)
	}

	req := ledgerEntryRequest{
		Amount:     draft.Amount,
		Currency:   draft.Currency,
		Direction:  draft.Direction,
		Category:   draft.Category,
		OccurredAt: draft.OccurredAt,
		Merchant:   draft.Merchant,
		Location:   draft.Location,
		Note:       draft.Note,
	}
	entry, message, ok := buildLedgerEntryFromRequest(req, userID)
	if !ok {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_ledger_entry",
			Status:  "error",
			Message: message,
		}
	}
	if entry.Note == "" {
		entry.Note = "来自生活助理记账"
	}

	if err := database.GetDB().Create(&entry).Error; err != nil {
		return &lifeTraceAssistantActionPayload{
			Type:    "create_ledger_entry",
			Status:  "error",
			Message: "生活助理已回复，但账目保存失败，请稍后再试。",
		}
	}

	response := ledgerEntryToResponse(entry)
	evaluateAchievementsQuietly(userID)
	return &lifeTraceAssistantActionPayload{
		Type:        "create_ledger_entry",
		Status:      "created",
		Message:     fmt.Sprintf("已记下%s %.2f 元，分类为%s。", entry.Direction, response.Amount, entry.Category),
		LedgerEntry: &response,
	}
}

func readLifeTraceAIConfig() (lifeTraceAIConfig, string) {
	return lifeai.ReadTextConfig(lifeTraceTodayAdviceDefaultTimeout)
}

func readLifeTraceArkTextConfig() (apiKey, arkBaseURL, textModel string, errMsg string) {
	apiKey = strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	textModel = strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	arkBaseURL = strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return "", "", "", "AI 未配置：缺少 ARK_API_KEY"
	}
	if !strings.HasPrefix(textModel, "ep-") {
		return "", "", "", "AI 未配置：ARK_TEXT_MODEL 必须以 ep- 开头"
	}
	return apiKey, arkBaseURL, textModel, ""
}

func buildTodayAdviceCacheKey(userID model.Int64String, cfg lifeTraceAIConfig, prompt string) string {
	sum := sha256.Sum256([]byte(strings.Join([]string{
		fmt.Sprint(userID),
		cfg.Source,
		cfg.Model,
		prompt,
	}, "\x00")))
	return fmt.Sprintf("%x", sum)
}

func getCachedTodayAdvice(key string, now time.Time) (todayAdviceCacheEntry, bool) {
	lifeTraceTodayAdviceCache.RLock()
	entry, ok := lifeTraceTodayAdviceCache.items[key]
	lifeTraceTodayAdviceCache.RUnlock()
	if !ok {
		return todayAdviceCacheEntry{}, false
	}
	if now.After(entry.ExpiresAt) {
		lifeTraceTodayAdviceCache.Lock()
		delete(lifeTraceTodayAdviceCache.items, key)
		lifeTraceTodayAdviceCache.Unlock()
		return todayAdviceCacheEntry{}, false
	}
	return entry, true
}

func setCachedTodayAdvice(key string, entry todayAdviceCacheEntry) {
	lifeTraceTodayAdviceCache.Lock()
	lifeTraceTodayAdviceCache.items[key] = entry
	lifeTraceTodayAdviceCache.Unlock()
}

func clearCachedTodayAdvice() {
	lifeTraceTodayAdviceCache.Lock()
	lifeTraceTodayAdviceCache.items = make(map[string]todayAdviceCacheEntry)
	lifeTraceTodayAdviceCache.Unlock()
}

func ensureLifeTraceArkClient(apiKey, arkBaseURL string) *arkruntime.Client {
	return lifeai.EnsureARKClient(apiKey, arkBaseURL)
}

func buildTodayAdvicePrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
) string {
	planLines := make([]string, 0, len(plans))
	for _, plan := range plans {
		planLines = append(planLines, fmt.Sprintf("- %s｜%s｜%s", plan.Title, plan.Type, plan.TimeLabel))
	}
	if len(planLines) == 0 {
		planLines = append(planLines, "- 暂无待完成计划")
	}

	return strings.Join([]string{
		"你是 Life Trace 的生活计划 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"summary\":\"一句今日总建议，32字以内\",\"items\":[{\"id\":\"wear\",\"detail\":\"16字以内建议\"}]}",
		"items 必须严格包含 6 项，id 顺序固定为 wear, skin, out, commute, health, plan。",
		"不要输出 title 和 tone，服务端会自动补齐。",
		"建议要结合天气、通勤、工作时间和未完成计划，使用简体中文，短促可执行。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s。", settings.City, settings.WorkStart, settings.WorkEnd, settings.CommuteMethod),
		"",
		"今日天气：",
		fmt.Sprintf("天气：%s；气温：%s/%s；体感：%s；湿度：%s；风力：%s；降水：%s；紫外线：%s；空气：%s。", weather.Now.Text, weather.Now.High, weather.Now.Low, weather.Now.FeelsLike, weather.Now.Humidity, weather.Now.WindScale, weather.Now.Precip, weather.Now.UVIndex, weather.Now.AirQuality),
		"",
		"未完成计划：",
		strings.Join(planLines, "\n"),
	}, "\n")
}

func buildWeeklyReviewPrompt(
	settings model.LifeTraceSettings,
	weekStart time.Time,
	weekEnd time.Time,
	completedPlans []model.LifeTracePlan,
	openPlans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
) string {
	completedPlanLines := buildWeeklyPlanLines(completedPlans, "暂无已完成计划")
	openPlanLines := buildWeeklyPlanLines(openPlans, "暂无未完成计划")
	traceLines := make([]string, 0, len(traces))
	for _, trace := range traces {
		tags := strings.Join(trace.Tags, "、")
		traceLines = append(traceLines, fmt.Sprintf("- %s｜%s｜%s｜%s｜%s", trace.Title, trace.Mood, trace.TimeLabel, trace.Source, tags))
	}
	if len(traceLines) == 0 {
		traceLines = append(traceLines, "- 暂无生活踪迹")
	}

	return strings.Join([]string{
		"你是 Life Trace 的复盘 Agent，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"summary\":\"一句本周复盘，48字以内\",\"wins\":[\"完成事项，24字以内\"],\"delays\":[\"延迟事项，24字以内\"],\"insights\":[\"生活洞察，28字以内\"],\"nextActions\":[\"下周行动，24字以内\"]}",
		"wins、delays、insights、nextActions 各输出 1-3 条；没有延迟事项时 delays 输出 [\"暂无明显延迟事项\"]。",
		"复盘要基于计划和踪迹，不要编造资产、订阅或没有出现过的生活事件。",
		"语气温暖、克制、可执行，使用简体中文。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s。", settings.City, settings.WorkStart, settings.WorkEnd, settings.CommuteMethod),
		"",
		"周报范围：",
		fmt.Sprintf("%s 至 %s", weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02")),
		"",
		"本周已完成计划：",
		strings.Join(completedPlanLines, "\n"),
		"",
		"当前未完成计划：",
		strings.Join(openPlanLines, "\n"),
		"",
		"本周生活踪迹：",
		strings.Join(traceLines, "\n"),
	}, "\n")
}

func currentWeeklyReviewRange(now time.Time) (time.Time, time.Time) {
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	daysFromMonday := (int(dayStart.Weekday()) + 6) % 7
	return dayStart.AddDate(0, 0, -daysFromMonday), now
}

func buildWeeklyPlanLines(plans []model.LifeTracePlan, emptyText string) []string {
	lines := make([]string, 0, len(plans))
	for _, plan := range plans {
		status := "未完成"
		if plan.Completed {
			status = "已完成"
		}
		lines = append(lines, fmt.Sprintf("- %s｜%s｜%s｜%s", plan.Title, plan.Type, plan.TimeLabel, status))
	}
	if len(lines) == 0 {
		lines = append(lines, "- "+emptyText)
	}
	return lines
}

func saveWeeklyReview(
	userID model.Int64String,
	weekStart time.Time,
	weekEnd time.Time,
	parsed weeklyReviewAIResponse,
	source string,
	modelName string,
) (model.LifeTraceWeeklyReview, error) {
	review := model.LifeTraceWeeklyReview{
		UserID:      userID,
		WeekStart:   weekStart.Format("2006-01-02"),
		WeekEnd:     weekEnd.Format("2006-01-02"),
		Summary:     parsed.Summary,
		Wins:        model.StringList(parsed.Wins),
		Delays:      model.StringList(parsed.Delays),
		Insights:    model.StringList(parsed.Insights),
		NextActions: model.StringList(parsed.NextActions),
		Source:      source,
		Model:       modelName,
	}

	var existing model.LifeTraceWeeklyReview
	err := database.GetDB().
		Where("user_id = ? AND week_start = ?", userID, review.WeekStart).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := database.GetDB().Create(&review).Error; err != nil {
			return model.LifeTraceWeeklyReview{}, err
		}
		return review, nil
	}
	if err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}

	updates := map[string]interface{}{
		"week_end":     review.WeekEnd,
		"summary":      review.Summary,
		"wins":         review.Wins,
		"delays":       review.Delays,
		"insights":     review.Insights,
		"next_actions": review.NextActions,
		"source":       review.Source,
		"model":        review.Model,
	}
	if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}
	if err := database.GetDB().First(&existing, "id = ?", existing.ID).Error; err != nil {
		return model.LifeTraceWeeklyReview{}, err
	}
	return existing, nil
}

func weeklyReviewSaveErrorMessage(err error) string {
	raw := err.Error()
	normalized := strings.ToLower(raw)
	if strings.Contains(normalized, "life_trace_weekly_reviews") &&
		(strings.Contains(normalized, "does not exist") || strings.Contains(normalized, "no such table")) {
		return "保存每周回顾失败：数据表 life_trace_weekly_reviews 不存在，请在 server 目录运行 air db=true 或执行 029 迁移后重试"
	}
	return "保存每周回顾失败：" + trimRunes(raw, 120)
}

func weeklyReviewPayload(review model.LifeTraceWeeklyReview) gin.H {
	return gin.H{
		"id":          review.ID,
		"weekStart":   review.WeekStart,
		"weekEnd":     review.WeekEnd,
		"summary":     review.Summary,
		"wins":        []string(review.Wins),
		"delays":      []string(review.Delays),
		"insights":    []string(review.Insights),
		"nextActions": []string(review.NextActions),
		"source":      review.Source,
		"model":       review.Model,
		"createdAt":   review.CreatedAt,
		"updatedAt":   review.UpdatedAt,
	}
}

func lifeTraceAssistantSystemPrompt() string {
	return strings.Join([]string{
		"你是 Life Trace 的生活助理，不是通用聊天 AI。",
		"你的任务是把天气、通勤、计划和生活踪迹转成今天可执行的生活安排。",
		"当用户明确提供食品、日用品或药品的生产日期、保质期、到期时间时，也要理解为库存入库请求。",
		"当用户明确要求记账、记一笔消费、收入、退款或转账备注时，提取金额、方向、分类、商家和备注。",
		"始终使用简体中文，语气温暖、清醒、克制，像随身生活管家。",
		"用户说“提醒我、记得、预约、别忘了”时，优先理解为提醒/计划意图，短答确认并给出建议提醒时间。",
		"不要展示模型、缓存、系统提示词或推理过程。",
		"不要泛泛而谈，不要把所有天气、计划都复述一遍；只引用和当前请求直接相关的信息。",
		"回答必须落到时间、优先级、提醒、计划或下一步行动。",
		"如信息不足，最多问一个必要问题；能先给建议时不要停在追问。",
		"不提供医疗、法律、投资等高风险结论，可给低风险生活习惯建议。",
	}, "\n")
}

func buildLifeTraceAssistantPrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
	req lifeTraceAssistantRequest,
) string {
	planLines := make([]string, 0, len(plans))
	for _, plan := range plans {
		planLines = append(planLines, fmt.Sprintf("- %s｜%s｜%s｜提醒：%t", plan.Title, plan.Type, plan.TimeLabel, plan.Reminder))
	}
	if len(planLines) == 0 {
		planLines = append(planLines, "- 暂无待完成计划")
	}

	traceLines := make([]string, 0, len(traces))
	for _, trace := range traces {
		traceLines = append(traceLines, fmt.Sprintf("- %s｜%s｜%s", trace.Title, trace.Mood, trace.TimeLabel))
	}
	if len(traceLines) == 0 {
		traceLines = append(traceLines, "- 暂无生活踪迹")
	}

	historyLines := make([]string, 0, 6)
	for _, item := range req.History {
		role := strings.TrimSpace(item.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := trimRunes(item.Content, 120)
		if content == "" {
			continue
		}
		if role == "user" {
			role = "用户"
		} else {
			role = "生活助理"
		}
		historyLines = append(historyLines, fmt.Sprintf("- %s：%s", role, content))
		if len(historyLines) >= 6 {
			break
		}
	}
	if len(historyLines) == 0 {
		historyLines = append(historyLines, "- 暂无")
	}

	return strings.Join([]string{
		"请基于下面的 Life Trace 生活上下文回答用户，不要当普通问答机器人。",
		"输出要求：如果用户只是要提醒/记事/入库，直接用 1-2 句确认，不要生成今日综合建议。",
		"若用户要安排一天或做选择，先给一句核心判断，再给 2-3 条可执行安排。",
		"当本轮会自动创建计划或库存时，直接说“已帮你加入计划/库存…”，不要再说“可以加入…”。",
		"只有信息不足、暂时还不能自动创建时，才可以说“可以加入计划：...”或“可以加入库存：...”。",
		"普通回答控制在 140 字以内；提醒/记事/入库类控制在 60 字以内；不要 Markdown 标题，不要表格。",
		"",
		"用户偏好：",
		fmt.Sprintf("城市：%s；工作时间：%s-%s；通勤：%s。", settings.City, settings.WorkStart, settings.WorkEnd, settings.CommuteMethod),
		"",
		"今日天气：",
		fmt.Sprintf("天气：%s；气温：%s/%s；体感：%s；湿度：%s；风力：%s；降水：%s；紫外线：%s；空气：%s。", weather.Now.Text, weather.Now.High, weather.Now.Low, weather.Now.FeelsLike, weather.Now.Humidity, weather.Now.WindScale, weather.Now.Precip, weather.Now.UVIndex, weather.Now.AirQuality),
		"",
		"未完成计划：",
		strings.Join(planLines, "\n"),
		"",
		"最近生活踪迹：",
		strings.Join(traceLines, "\n"),
		"",
		"最近对话：",
		strings.Join(historyLines, "\n"),
		"",
		"用户当前请求：",
		req.Message,
	}, "\n")
}

func buildLifeTraceAssistantStructuredPrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
	req lifeTraceAssistantRequest,
	now time.Time,
) string {
	contextPrompt := buildLifeTraceAssistantPrompt(settings, weather, plans, traces, req)
	return strings.Join([]string{
		fmt.Sprintf("如果当前模型支持工具调用，你必须调用工具 %s 来提交最终结果；不要直接输出 JSON，不要解释，不要代码块。", lifeTraceAssistantToolName),
		"如果当前模型不支持工具调用，才退回只输出一个 JSON 对象。",
		"JSON / 工具参数结构：",
		`{"reply":"给用户看的简短中文","action":{"type":"none|create_plan|create_pantry_item|create_ledger_entry","message":"动作说明","needMoreInfoFields":["amount"],"plan":{"title":"计划标题","type":"电影|吃饭|运动|阅读|聚会|普通事项","scheduledDate":"YYYY-MM-DD","scheduledTime":"HH:MM","timezone":"Asia/Shanghai","notePrefix":"来自生活助理计划"},"pantry":{"name":"商品名","category":"食品|日用品|药品|宠物|其他","quantity":1,"unit":"件","location":"冷藏|冷冻|厨房|储物柜|卫生间|玄关|其他","expiresAt":"YYYY-MM-DD","openedAt":"YYYY-MM-DD","note":"补充备注"},"ledger":{"amount":36.5,"currency":"CNY","direction":"支出|收入|退款|转账备注","category":"吃饭|交通|购物|书影音|订阅|家用|礼物|医疗|其他","occurredAt":"YYYY-MM-DDTHH:MM:SS+08:00","merchant":"商家或事项","location":"地点","note":"补充备注"}}}`,
		"规则：",
		"- 如果不需要执行动作，action 可以为 null，或 type=none。",
		"- 如果要创建计划，reply 直接写成已处理结果；action.type=create_plan，并尽量补齐 plan 字段。",
		"- 如果要创建库存，reply 直接写成已处理结果；action.type=create_pantry_item，并尽量补齐 pantry 字段。",
		"- 如果要记账，必须有明确金额；有金额时 action.type=create_ledger_entry 并补齐 ledger 字段；没有金额时 type=create_ledger_entry，needMoreInfoFields 包含 amount，只追问金额。",
		"- 如果用户这轮是在补充上一轮你追问的信息，要结合最近对话，把同一件计划/库存补齐后继续完成，不要重新从头问。",
		"- 如果用户只是在记录库存，没有提供保质期、生产日期或到期日，仍然创建普通库存；expiresAt 留空，不要追问。",
		"- 如果用户提供了生产日期和 180天/90天/7天等保质期，必须计算 expiresAt。",
		"- 如果用户只提供了保质期天数但没有生产日期或到期日，仍然返回 action.type=create_pantry_item；reply 和 action.message 只追问生产日期；needMoreInfoFields 包含 expiresAt；不要按今天或购买日期伪造到期日。",
		"- 日期必须输出绝对日期 YYYY-MM-DD；时间必须输出 HH:MM。",
		"- reply 140 字以内；涉及提醒/记事/入库时尽量控制在 60 字以内。",
		fmt.Sprintf("- 当前时间基准：%s（Asia/Shanghai）。", now.Format("2006-01-02 15:04")),
		"",
		"下面是上下文，请基于它生成上面的 JSON：",
		contextPrompt,
	}, "\n")
}

func parseLifeTraceAssistantStructuredResponse(raw string) (lifeTraceAssistantStructuredResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return lifeTraceAssistantStructuredResponse{}, errors.New("missing JSON object")
	}

	var parsed lifeTraceAssistantStructuredResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return lifeTraceAssistantStructuredResponse{}, err
	}
	parsed.Reply = trimRunes(strings.TrimSpace(parsed.Reply), 140)
	if parsed.Reply == "" {
		return lifeTraceAssistantStructuredResponse{}, errors.New("empty assistant reply")
	}
	if parsed.Action == nil {
		return parsed, nil
	}

	parsed.Action.Type = strings.TrimSpace(parsed.Action.Type)
	parsed.Action.Message = trimRunes(strings.TrimSpace(parsed.Action.Message), 80)
	parsed.Action.NeedMoreInfoFields = normalizeAssistantNeedMoreInfoFields(parsed.Action.NeedMoreInfoFields)
	switch parsed.Action.Type {
	case "", "none":
		parsed.Action = nil
		return parsed, nil
	case "create_plan", "create_pantry_item", "create_ledger_entry":
		if parsed.Action.Message == "" {
			parsed.Action.Message = parsed.Reply
		}
		return parsed, nil
	default:
		return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("unsupported assistant action type: %s", parsed.Action.Type)
	}
}

func (h *Handler) streamLifeTraceAssistantStructured(
	c *gin.Context,
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
	userID model.Int64String,
	now time.Time,
	fallbackPlanDraft *lifeTraceAssistantPlanDraft,
	fallbackPantryDraft *lifeTraceAssistantPantryDraft,
	fallbackLedgerDraft *lifeTraceAssistantLedgerDraft,
) error {
	decision, modelName, err := callLifeTraceAssistantStructuredResponse(ctx, cfg, systemPrompt, structuredPrompt)
	if err != nil {
		return err
	}

	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	if strings.TrimSpace(modelName) == "" {
		modelName = cfg.Model
	}
	send(lifeTraceAssistantStreamChunk{Source: cfg.Source, Model: modelName})

	if reply := strings.TrimSpace(decision.Reply); reply != "" {
		send(lifeTraceAssistantStreamChunk{
			Source: cfg.Source,
			Model:  modelName,
			Chunk:  reply,
		})
	}

	if payload := h.resolveLifeTraceAssistantStructuredAction(c, userID, decision.Action, now, fallbackPlanDraft, fallbackPantryDraft, fallbackLedgerDraft); payload != nil {
		send(lifeTraceAssistantStreamChunk{
			Source: cfg.Source,
			Model:  modelName,
			Action: payload,
		})
	}

	send(lifeTraceAssistantStreamChunk{Source: cfg.Source, Model: modelName, Done: true})
	return nil
}

func (h *Handler) resolveLifeTraceAssistantStructuredAction(
	c *gin.Context,
	userID model.Int64String,
	action *lifeTraceAssistantStructuredAction,
	now time.Time,
	fallbackPlanDraft *lifeTraceAssistantPlanDraft,
	fallbackPantryDraft *lifeTraceAssistantPantryDraft,
	fallbackLedgerDraft *lifeTraceAssistantLedgerDraft,
) *lifeTraceAssistantActionPayload {
	if action == nil {
		switch {
		case fallbackLedgerDraft != nil:
			return h.createAssistantLedgerEntryFromDraft(userID, *fallbackLedgerDraft)
		case fallbackPantryDraft != nil:
			return h.createAssistantPantryItemFromDraft(c, userID, *fallbackPantryDraft)
		case fallbackPlanDraft != nil:
			return h.createAssistantPlanFromDraft(userID, *fallbackPlanDraft)
		default:
			return nil
		}
	}

	if strings.TrimSpace(action.Type) == "none" {
		return nil
	}
	if _, ok := lifeTraceAssistantActionRegistry.Get(action.Type); !ok {
		return nil
	}

	switch action.Type {
	case "create_plan":
		draft := mergeAssistantPlanDraft(action.Plan, fallbackPlanDraft)
		if draft == nil {
			return nil
		}
		if draft.ScheduledDate == "" || draft.ScheduledTime == "" {
			fallback := buildLifeTraceAssistantPlanDraft(draft.Title, now)
			draft = mergeAssistantPlanDraft(draft, fallback)
		}
		if draft == nil {
			return nil
		}
		if missingFields := missingAssistantPlanFields(*draft); len(missingFields) > 0 {
			message := action.Message
			if strings.TrimSpace(message) == "" {
				message = buildAssistantPlanNeedMoreInfoMessage(draft.Title, missingFields)
			}
			return buildAssistantNeedMoreInfoPayload(
				"create_plan",
				message,
				append(action.NeedMoreInfoFields, missingFields...),
			)
		}
		return h.createAssistantPlanFromDraft(userID, *draft)
	case "create_pantry_item":
		draft := mergeAssistantPantryDraft(action.Pantry, fallbackPantryDraft)
		if draft == nil {
			if fallbackPantryDraft == nil {
				return nil
			}
			draft = fallbackPantryDraft
		}
		if assistantPantryNeedsProductionDate(*draft) {
			message := action.Message
			if strings.TrimSpace(message) == "" {
				message = buildAssistantPantryNeedMoreInfoMessage(draft.Name)
			}
			return buildAssistantNeedMoreInfoPayload(
				"create_pantry_item",
				message,
				append(action.NeedMoreInfoFields, "expiresAt"),
			)
		}
		return h.createAssistantPantryItemFromDraft(c, userID, *draft)
	case "create_ledger_entry":
		draft := mergeAssistantLedgerDraft(action.Ledger, fallbackLedgerDraft)
		if draft == nil {
			if fallbackLedgerDraft == nil {
				return nil
			}
			draft = fallbackLedgerDraft
		}
		if amountToCents(draft.Amount) <= 0 {
			message := action.Message
			if strings.TrimSpace(message) == "" {
				message = buildAssistantLedgerNeedMoreInfoMessage(draft)
			}
			return buildAssistantNeedMoreInfoPayload(
				"create_ledger_entry",
				message,
				append(action.NeedMoreInfoFields, "amount"),
			)
		}
		return h.createAssistantLedgerEntryFromDraft(userID, *draft)
	default:
		return nil
	}
}

func callLifeTraceAssistantStructuredResponse(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	decision, model, err := callLifeTraceAssistantToolResponse(ctx, cfg, systemPrompt, structuredPrompt)
	if err == nil {
		return decision, model, nil
	}
	if !shouldFallbackToStructuredJSON(err) {
		return lifeTraceAssistantStructuredResponse{}, model, err
	}

	var (
		raw       string
		jsonModel string
		jsonErr   error
	)

	if cfg.Source == "openai" {
		raw, jsonModel, jsonErr = callLifeTraceAssistantStructuredOpenAI(ctx, cfg, systemPrompt, structuredPrompt)
	} else {
		raw, jsonModel, jsonErr = callLifeTraceAssistantStructuredARK(ctx, cfg, systemPrompt, structuredPrompt)
	}
	if jsonErr != nil {
		return lifeTraceAssistantStructuredResponse{}, jsonModel, jsonErr
	}

	parsed, err := parseLifeTraceAssistantStructuredResponse(raw)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, jsonModel, err
	}
	return parsed, jsonModel, nil
}

func shouldFallbackToStructuredJSON(err error) bool {
	return errors.Is(err, errLifeTraceAssistantToolUnsupported) || errors.Is(err, errLifeTraceAssistantToolInvalid)
}

func callLifeTraceAssistantToolResponse(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	if cfg.Source == "openai" {
		return callLifeTraceAssistantToolOpenAI(ctx, cfg, systemPrompt, structuredPrompt)
	}
	return callLifeTraceAssistantToolARK(ctx, cfg, systemPrompt, structuredPrompt)
}

func buildLifeTraceAssistantToolSchema() map[string]any {
	actionTypes := append([]string{"none"}, lifeTraceAssistantActionRegistry.Types()...)
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"reply": map[string]any{
				"type":        "string",
				"description": "给用户看的简短中文回复",
			},
			"action": map[string]any{
				"type":        "object",
				"description": "要执行的生活迹动作，没有动作时 type=none",
				"properties": map[string]any{
					"type": map[string]any{
						"type": "string",
						"enum": actionTypes,
					},
					"message": map[string]any{
						"type": "string",
					},
					"needMoreInfoFields": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "string",
							"enum": []string{"expiresAt", "scheduledDate", "scheduledTime", "amount"},
						},
					},
					"plan": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"title":         map[string]any{"type": "string"},
							"type":          map[string]any{"type": "string", "enum": []string{"电影", "吃饭", "运动", "阅读", "聚会", "普通事项"}},
							"scheduledDate": map[string]any{"type": "string"},
							"scheduledTime": map[string]any{"type": "string"},
							"timezone":      map[string]any{"type": "string"},
							"notePrefix":    map[string]any{"type": "string"},
						},
					},
					"pantry": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"name":      map[string]any{"type": "string"},
							"category":  map[string]any{"type": "string", "enum": []string{"食品", "日用品", "药品", "宠物", "其他"}},
							"quantity":  map[string]any{"type": "integer"},
							"unit":      map[string]any{"type": "string"},
							"location":  map[string]any{"type": "string", "enum": []string{"冷藏", "冷冻", "厨房", "储物柜", "卫生间", "玄关", "其他"}},
							"expiresAt": map[string]any{"type": "string"},
							"openedAt":  map[string]any{"type": "string"},
							"note":      map[string]any{"type": "string"},
						},
					},
					"ledger": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"amount":     map[string]any{"type": "number"},
							"currency":   map[string]any{"type": "string"},
							"direction":  map[string]any{"type": "string", "enum": []string{"支出", "收入", "退款", "转账备注"}},
							"category":   map[string]any{"type": "string", "enum": []string{"吃饭", "交通", "购物", "书影音", "订阅", "家用", "礼物", "医疗", "其他"}},
							"occurredAt": map[string]any{"type": "string"},
							"merchant":   map[string]any{"type": "string"},
							"location":   map[string]any{"type": "string"},
							"note":       map[string]any{"type": "string"},
						},
					},
				},
				"required": []string{"type"},
			},
		},
		"required": []string{"reply", "action"},
	}
}

func buildLifeTraceAssistantARKTools() []*arkmodel.Tool {
	return []*arkmodel.Tool{
		{
			Type: arkmodel.ToolTypeFunction,
			Function: &arkmodel.FunctionDefinition{
				Name:        lifeTraceAssistantToolName,
				Description: "提交 Life Trace 生活助理的回复和动作结果",
				Parameters:  buildLifeTraceAssistantToolSchema(),
			},
		},
	}
}

func buildLifeTraceAssistantOpenAITools() []lifeTraceOpenAITool {
	return []lifeTraceOpenAITool{
		{
			Type: "function",
			Function: &lifeTraceOpenAIFunctionDefinition{
				Name:        lifeTraceAssistantToolName,
				Description: "提交 Life Trace 生活助理的回复和动作结果",
				Parameters:  buildLifeTraceAssistantToolSchema(),
			},
		},
	}
}

func parseLifeTraceAssistantToolArguments(raw string) (lifeTraceAssistantStructuredResponse, error) {
	return parseLifeTraceAssistantStructuredResponse(raw)
}

func parseLifeTraceAssistantARKToolCalls(toolCalls []*arkmodel.ToolCall) (lifeTraceAssistantStructuredResponse, error) {
	for _, toolCall := range toolCalls {
		if toolCall == nil {
			continue
		}
		if toolCall.Function.Name != lifeTraceAssistantToolName {
			continue
		}
		parsed, err := parseLifeTraceAssistantToolArguments(toolCall.Function.Arguments)
		if err != nil {
			return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: %v", errLifeTraceAssistantToolInvalid, err)
		}
		return parsed, nil
	}
	return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: missing matching tool call", errLifeTraceAssistantToolInvalid)
}

func parseLifeTraceAssistantOpenAIToolCalls(toolCalls []lifeTraceOpenAIToolCall) (lifeTraceAssistantStructuredResponse, error) {
	for _, toolCall := range toolCalls {
		if toolCall.Function.Name != lifeTraceAssistantToolName {
			continue
		}
		parsed, err := parseLifeTraceAssistantToolArguments(toolCall.Function.Arguments)
		if err != nil {
			return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: %v", errLifeTraceAssistantToolInvalid, err)
		}
		return parsed, nil
	}
	return lifeTraceAssistantStructuredResponse{}, fmt.Errorf("%w: missing matching tool call", errLifeTraceAssistantToolInvalid)
}

func isLifeTraceAssistantToolUnsupported(statusCode int, respBody []byte) bool {
	if statusCode != http.StatusBadRequest {
		return false
	}
	body := strings.ToLower(string(respBody))
	if !(strings.Contains(body, "tools") || strings.Contains(body, "tool_choice") || strings.Contains(body, "tool_calls")) {
		return false
	}
	return strings.Contains(body, "not supported") || strings.Contains(body, "invalid")
}

func callLifeTraceAssistantToolARK(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	maxTokens := 420
	temperature := float32(0.2)
	parallelToolCalls := false
	systemContent := strings.TrimSpace(systemPrompt)
	userContent := strings.TrimSpace(structuredPrompt)

	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleSystem,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &systemContent,
				},
			},
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &userContent,
				},
			},
		},
		MaxTokens:         &maxTokens,
		Temperature:       &temperature,
		Tools:             buildLifeTraceAssistantARKTools(),
		ToolChoice:        arkmodel.ToolChoice{Type: arkmodel.ToolTypeFunction, Function: arkmodel.ToolChoiceFunction{Name: lifeTraceAssistantToolName}},
		ParallelToolCalls: &parallelToolCalls,
	})
	if err != nil {
		lower := strings.ToLower(err.Error())
		if strings.Contains(lower, "tools") || strings.Contains(lower, "tool_choice") || strings.Contains(lower, "tool_calls") {
			return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("%w: %v", errLifeTraceAssistantToolUnsupported, err)
		}
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	if len(resp.Choices) == 0 {
		return lifeTraceAssistantStructuredResponse{}, resp.Model, fmt.Errorf("%w: empty AI response", errLifeTraceAssistantToolInvalid)
	}
	parsed, err := parseLifeTraceAssistantARKToolCalls(resp.Choices[0].Message.ToolCalls)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, resp.Model, err
	}
	return parsed, resp.Model, nil
}

func callLifeTraceAssistantToolOpenAI(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (lifeTraceAssistantStructuredResponse, string, error) {
	parallelToolCalls := false
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: structuredPrompt},
		},
		Temperature:       0.2,
		MaxTokens:         420,
		Tools:             buildLifeTraceAssistantOpenAITools(),
		ToolChoice:        lifeTraceOpenAIToolChoice{Type: "function", Function: lifeTraceOpenAIToolChoiceFunction{Name: lifeTraceAssistantToolName}},
		ParallelToolCalls: &parallelToolCalls,
	})
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if isLifeTraceAssistantToolUnsupported(resp.StatusCode, respBody) {
			return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("%w: %s", errLifeTraceAssistantToolUnsupported, trimRunes(string(respBody), 180))
		}
		return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return lifeTraceAssistantStructuredResponse{}, "", fmt.Errorf("decode OpenAI response failed: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return lifeTraceAssistantStructuredResponse{}, parsed.Model, fmt.Errorf("%w: OpenAI upstream returned no choices", errLifeTraceAssistantToolInvalid)
	}
	decision, err := parseLifeTraceAssistantOpenAIToolCalls(parsed.Choices[0].Message.ToolCalls)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, parsed.Model, err
	}
	return decision, parsed.Model, nil
}

func callLifeTraceAssistantStructuredARK(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (string, string, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	maxTokens := 420
	temperature := float32(0.2)
	systemContent := strings.TrimSpace(systemPrompt)
	userContent := strings.TrimSpace(structuredPrompt)

	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleSystem,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &systemContent,
				},
			},
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &userContent,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", resp.Model, errors.New("empty AI response")
	}

	content := resp.Choices[0].Message.Content
	if content.StringValue != nil && strings.TrimSpace(*content.StringValue) != "" {
		return strings.TrimSpace(*content.StringValue), resp.Model, nil
	}

	parts := make([]string, 0, len(content.ListValue))
	for _, part := range content.ListValue {
		if part != nil && strings.TrimSpace(part.Text) != "" {
			parts = append(parts, strings.TrimSpace(part.Text))
		}
	}
	raw := strings.TrimSpace(strings.Join(parts, "\n"))
	if raw == "" {
		return "", resp.Model, errors.New("empty AI content")
	}
	return raw, resp.Model, nil
}

func callLifeTraceAssistantStructuredOpenAI(
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	structuredPrompt string,
) (string, string, error) {
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: structuredPrompt},
		},
		Temperature: 0.2,
		MaxTokens:   420,
		ResponseFormat: &lifeTraceResponseFormat{
			Type: "json_object",
		},
	})
	if err != nil {
		return "", "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", "", fmt.Errorf("decode OpenAI response failed: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", parsed.Model, errors.New("OpenAI upstream returned no choices")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return "", parsed.Model, errors.New("OpenAI upstream returned empty content")
	}
	return content, parsed.Model, nil
}

func streamLifeTraceAssistantARK(
	c *gin.Context,
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	send(lifeTraceAssistantStreamChunk{Source: "ark", Model: modelID})

	maxTokens := 320
	temperature := float32(0.55)
	systemContent := systemPrompt
	userContent := userPrompt
	stream, err := client.CreateChatCompletionStream(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleSystem,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &systemContent,
				},
			},
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &userContent,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer stream.Close()

	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "ark", Model: modelID, Done: true})
			return nil
		}
		if err != nil {
			send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
			return nil
		}

		currentModel := strings.TrimSpace(resp.Model)
		if currentModel == "" {
			currentModel = modelID
		}

		done := false
		for _, choice := range resp.Choices {
			if choice == nil {
				continue
			}
			if strings.TrimSpace(choice.Delta.Content) != "" {
				send(lifeTraceAssistantStreamChunk{
					Source: "ark",
					Model:  currentModel,
					Chunk:  choice.Delta.Content,
				})
			}
			if choice.FinishReason != arkmodel.FinishReasonNull && choice.FinishReason != "" {
				done = true
			}
		}
		if done {
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "ark", Model: currentModel, Done: true})
			return nil
		}
	}
}

func callLifeTraceTextAI(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
) (string, string, error) {
	return callLifeTraceTextAIWithMaxTokens(ctx, client, modelID, prompt, 260)
}

func callLifeTraceTextAIWithMaxTokens(
	ctx context.Context,
	client *arkruntime.Client,
	modelID string,
	prompt string,
	maxTokens int,
) (string, string, error) {
	start := time.Now()
	temperature := float32(0.35)
	content := strings.TrimSpace(prompt)
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: modelID,
		Messages: []*arkmodel.ChatCompletionMessage{
			{
				Role: arkmodel.ChatMessageRoleUser,
				Content: &arkmodel.ChatCompletionMessageContent{
					StringValue: &content,
				},
			},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		recordLifeTraceAIUsage(ctx, "ark", modelID, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		err := errors.New("empty AI response")
		recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), err)
		return "", resp.Model, err
	}

	raw := ""
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw = *contentValue.StringValue
	} else {
		parts := make([]string, 0, len(contentValue.ListValue))
		for _, part := range contentValue.ListValue {
			if part != nil && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		raw = strings.Join(parts, "\n")
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		err := errors.New("empty AI content")
		recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, "", aiusage.Since(start), err)
		return "", resp.Model, err
	}
	recordLifeTraceAIUsage(ctx, "ark", resp.Model, prompt, raw, aiusage.Since(start), nil)
	return raw, resp.Model, nil
}

func recordLifeTraceAIUsage(ctx context.Context, provider string, modelName string, prompt string, response string, latencyMs int64, err error) {
	audit := aiusage.FromContext(ctx)
	status := aiusage.StatusSuccess
	errMessage := ""
	if err != nil {
		status = aiusage.StatusFailed
		errMessage = err.Error()
	}
	aiusage.Record(aiusage.Entry{
		Feature:       audit.Feature,
		Provider:      provider,
		Model:         modelName,
		UserID:        audit.UserID,
		Status:        status,
		PromptChars:   aiusage.CharCount(prompt),
		ResponseChars: aiusage.CharCount(response),
		LatencyMs:     latencyMs,
		ErrorMessage:  errMessage,
	})
}

func callLifeTraceAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	return callLifeTraceAIWithMaxTokens(ctx, cfg, prompt, 260)
}

func callLifeTraceAIWithMaxTokens(ctx context.Context, cfg lifeTraceAIConfig, prompt string, maxTokens int) (string, string, error) {
	result, err := lifeai.NewClient().GenerateJSON(ctx, cfg, lifeai.TextRequest{
		Prompt:    prompt,
		MaxTokens: maxTokens,
		JSONMode:  true,
	})
	return result.Content, result.Model, err
}

type lifeTraceOpenAIRequest struct {
	Model             string                   `json:"model"`
	Messages          []lifeTraceOpenAIMessage `json:"messages"`
	Temperature       float64                  `json:"temperature,omitempty"`
	MaxTokens         int                      `json:"max_tokens,omitempty"`
	ResponseFormat    *lifeTraceResponseFormat `json:"response_format,omitempty"`
	Stream            bool                     `json:"stream,omitempty"`
	Tools             []lifeTraceOpenAITool    `json:"tools,omitempty"`
	ToolChoice        interface{}              `json:"tool_choice,omitempty"`
	ParallelToolCalls *bool                    `json:"parallel_tool_calls,omitempty"`
}

type lifeTraceOpenAIMessage struct {
	Role      string                    `json:"role"`
	Content   string                    `json:"content"`
	ToolCalls []lifeTraceOpenAIToolCall `json:"tool_calls,omitempty"`
}

type lifeTraceOpenAITool struct {
	Type     string                             `json:"type"`
	Function *lifeTraceOpenAIFunctionDefinition `json:"function,omitempty"`
}

type lifeTraceOpenAIFunctionDefinition struct {
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	Parameters  interface{} `json:"parameters"`
}

type lifeTraceOpenAIToolChoice struct {
	Type     string                            `json:"type"`
	Function lifeTraceOpenAIToolChoiceFunction `json:"function"`
}

type lifeTraceOpenAIToolChoiceFunction struct {
	Name string `json:"name"`
}

type lifeTraceOpenAIToolCall struct {
	ID       string                      `json:"id,omitempty"`
	Type     string                      `json:"type,omitempty"`
	Function lifeTraceOpenAIFunctionCall `json:"function"`
}

type lifeTraceOpenAIFunctionCall struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type lifeTraceResponseFormat struct {
	Type string `json:"type"`
}

type lifeTraceOpenAIResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Message lifeTraceOpenAIMessage `json:"message"`
	} `json:"choices"`
}

type lifeTraceOpenAIStreamResponse struct {
	Model   string `json:"model"`
	Choices []struct {
		Delta        lifeTraceOpenAIMessage `json:"delta"`
		FinishReason string                 `json:"finish_reason"`
	} `json:"choices"`
}

func callLifeTraceOpenAI(ctx context.Context, cfg lifeTraceAIConfig, prompt string) (string, string, error) {
	return callLifeTraceOpenAIWithMaxTokens(ctx, cfg, prompt, 260)
}

func callLifeTraceOpenAIWithMaxTokens(ctx context.Context, cfg lifeTraceAIConfig, prompt string, maxTokens int) (string, string, error) {
	start := time.Now()
	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{
				Role:    "system",
				Content: "你是 Life Trace 的生活计划 AI。只输出 JSON 对象，不要 Markdown，不要解释。",
			},
			{Role: "user", Content: prompt},
		},
		Temperature: 0.35,
		MaxTokens:   maxTokens,
		ResponseFormat: &lifeTraceResponseFormat{
			Type: "json_object",
		},
	})
	if err != nil {
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		err := fmt.Errorf("OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180))
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), err)
		return "", "", err
	}

	var parsed lifeTraceOpenAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		wrapped := fmt.Errorf("decode OpenAI response failed: %w", err)
		recordLifeTraceAIUsage(ctx, "openai", cfg.Model, prompt, "", aiusage.Since(start), wrapped)
		return "", "", wrapped
	}
	if len(parsed.Choices) == 0 {
		err := errors.New("OpenAI upstream returned no choices")
		recordLifeTraceAIUsage(ctx, "openai", parsed.Model, prompt, "", aiusage.Since(start), err)
		return "", parsed.Model, err
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		err := errors.New("OpenAI upstream returned empty content")
		recordLifeTraceAIUsage(ctx, "openai", parsed.Model, prompt, "", aiusage.Since(start), err)
		return "", parsed.Model, err
	}
	recordLifeTraceAIUsage(ctx, "openai", parsed.Model, prompt, content, aiusage.Since(start), nil)
	return content, parsed.Model, nil
}

func streamLifeTraceAssistantOpenAI(
	c *gin.Context,
	ctx context.Context,
	cfg lifeTraceAIConfig,
	systemPrompt string,
	userPrompt string,
	beforeDone func(func(lifeTraceAssistantStreamChunk)),
) error {
	send, ok := prepareLifeTraceSSE(c)
	if !ok {
		return errors.New("streaming not supported")
	}
	send(lifeTraceAssistantStreamChunk{Source: "openai", Model: cfg.Model})

	body, err := json.Marshal(lifeTraceOpenAIRequest{
		Model: cfg.Model,
		Messages: []lifeTraceOpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.55,
		MaxTokens:   320,
		Stream:      true,
	})
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	httpClient := &http.Client{Timeout: cfg.Timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := httpClient.Do(req)
	if err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + readErr.Error(), Done: true})
			return nil
		}
		send(lifeTraceAssistantStreamChunk{Error: fmt.Sprintf("AI 服务请求失败：OpenAI upstream returned %d: %s", resp.StatusCode, trimRunes(string(respBody), 180)), Done: true})
		return nil
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	currentModel := cfg.Model
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			if beforeDone != nil {
				beforeDone(send)
			}
			send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
			return nil
		}

		var chunk lifeTraceOpenAIStreamResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if strings.TrimSpace(chunk.Model) != "" {
			currentModel = chunk.Model
		}
		for _, choice := range chunk.Choices {
			if strings.TrimSpace(choice.Delta.Content) != "" {
				send(lifeTraceAssistantStreamChunk{
					Source: "openai",
					Model:  currentModel,
					Chunk:  choice.Delta.Content,
				})
			}
			if choice.FinishReason != "" {
				if beforeDone != nil {
					beforeDone(send)
				}
				send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
				return nil
			}
		}
	}
	if err := scanner.Err(); err != nil {
		send(lifeTraceAssistantStreamChunk{Error: "AI 服务请求失败：" + err.Error(), Done: true})
		return nil
	}

	if beforeDone != nil {
		beforeDone(send)
	}
	send(lifeTraceAssistantStreamChunk{Source: "openai", Model: currentModel, Done: true})
	return nil
}

func prepareLifeTraceSSE(c *gin.Context) (func(lifeTraceAssistantStreamChunk), bool) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return nil, false
	}

	return func(payload lifeTraceAssistantStreamChunk) {
		b, _ := json.Marshal(payload)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(b)
		_, _ = c.Writer.Write([]byte("\n\n"))
		flusher.Flush()
	}, true
}

func parseTodayAdviceAIResponse(raw string) (todayAdviceAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return todayAdviceAIResponse{}, errors.New("missing JSON object")
	}

	var parsed todayAdviceAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return todayAdviceAIResponse{}, err
	}

	parsed.Summary = trimRunes(parsed.Summary, 40)
	if parsed.Summary == "" {
		parsed.Summary = "今天优先完成一件轻量计划。"
	}

	normalized, err := normalizeTodayAdviceItems(parsed.Items)
	if err != nil {
		return todayAdviceAIResponse{}, err
	}
	parsed.Items = normalized
	return parsed, nil
}

func normalizeTodayAdviceItems(items []lifeTraceAIAdvice) ([]lifeTraceAIAdvice, error) {
	byID := make(map[string]lifeTraceAIAdvice, len(items))
	for _, item := range items {
		id := strings.TrimSpace(item.ID)
		if _, ok := adviceDefaults[id]; !ok {
			continue
		}

		def := adviceDefaults[id]
		item.ID = id
		item.Title = def.Title
		item.Detail = trimRunes(item.Detail, 24)
		if item.Detail == "" {
			item.Detail = def.Detail
		}
		item.Tone = strings.TrimSpace(item.Tone)
		if !validAdviceTones[item.Tone] {
			item.Tone = def.Tone
		}
		byID[id] = item
	}

	if len(byID) == 0 {
		return nil, errors.New("empty advice items")
	}

	result := make([]lifeTraceAIAdvice, 0, len(adviceOrder))
	for _, id := range adviceOrder {
		item, ok := byID[id]
		if !ok {
			item = adviceDefaults[id]
		}
		result = append(result, item)
	}
	return result, nil
}

func parseWeeklyReviewAIResponse(raw string) (weeklyReviewAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return weeklyReviewAIResponse{}, errors.New("missing JSON object")
	}

	var parsed weeklyReviewAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return weeklyReviewAIResponse{}, err
	}

	parsed.Summary = trimRunes(parsed.Summary, 56)
	if parsed.Summary == "" {
		parsed.Summary = "本周生活节奏已整理，适合下周继续轻量推进。"
	}
	parsed.Wins = normalizeWeeklyReviewList(parsed.Wins, "本周已有可回看的生活记录", 3, 28)
	parsed.Delays = normalizeWeeklyReviewList(parsed.Delays, "暂无明显延迟事项", 3, 28)
	parsed.Insights = normalizeWeeklyReviewList(parsed.Insights, "稳定记录能让下周安排更清晰", 3, 32)
	parsed.NextActions = normalizeWeeklyReviewList(parsed.NextActions, "下周先安排一件轻量计划", 3, 28)
	return parsed, nil
}

func normalizeWeeklyReviewList(items []string, fallback string, maxItems int, maxRunes int) []string {
	result := make([]string, 0, maxItems)
	seen := map[string]bool{}
	for _, item := range items {
		item = trimRunes(item, maxRunes)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
		if len(result) >= maxItems {
			break
		}
	}
	if len(result) == 0 {
		result = append(result, fallback)
	}
	return result
}

func trimRunes(text string, max int) string {
	text = strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
	if max <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return string(runes[:max])
}
