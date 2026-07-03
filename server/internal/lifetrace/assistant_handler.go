package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

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

	if lifeTraceAssistantUseAgent() {
		if err := h.streamLifeTraceAssistantAgent(c, aiCtx, aiCfg, systemPrompt, req, userID); err == nil {
			return
		}
	}

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

func lifeTraceAssistantSystemPrompt() string {
	return prompts.AssistantSystemPrompt()
}

func buildLifeTraceAssistantPrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
	req lifeTraceAssistantRequest,
) string {
	return prompts.BuildAssistantContextPrompt(assistantContextInputFrom(settings, weather, plans, traces, req))
}

func buildLifeTraceAssistantStructuredPrompt(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
	req lifeTraceAssistantRequest,
	now time.Time,
) string {
	return prompts.BuildAssistantStructuredPrompt(prompts.AssistantStructuredInput{
		Context:  assistantContextInputFrom(settings, weather, plans, traces, req),
		ToolName: lifeTraceAssistantToolName,
		Now:      now,
	})
}

func assistantContextInputFrom(
	settings model.LifeTraceSettings,
	weather WeatherResponse,
	plans []model.LifeTracePlan,
	traces []model.LifeTraceTrace,
	req lifeTraceAssistantRequest,
) prompts.AssistantContextInput {
	planLines := make([]prompts.AssistantPlanLine, 0, len(plans))
	for _, plan := range plans {
		planLines = append(planLines, prompts.AssistantPlanLine{
			Title:     plan.Title,
			Type:      plan.Type,
			TimeLabel: plan.TimeLabel,
			Reminder:  plan.Reminder,
		})
	}
	traceLines := make([]prompts.AssistantTraceLine, 0, len(traces))
	for _, trace := range traces {
		traceLines = append(traceLines, prompts.AssistantTraceLine{
			Title:     trace.Title,
			Mood:      trace.Mood,
			TimeLabel: trace.TimeLabel,
		})
	}
	history := make([]prompts.AssistantMessage, 0, len(req.History))
	for _, item := range req.History {
		history = append(history, prompts.AssistantMessage{
			Role:    item.Role,
			Content: item.Content,
		})
	}
	return prompts.AssistantContextInput{
		City:          settings.City,
		WorkStart:     settings.WorkStart,
		WorkEnd:       settings.WorkEnd,
		CommuteMethod: settings.CommuteMethod,
		Weather: prompts.AssistantWeather{
			Text:       weather.Now.Text,
			High:       weather.Now.High,
			Low:        weather.Now.Low,
			FeelsLike:  weather.Now.FeelsLike,
			Humidity:   weather.Now.Humidity,
			WindScale:  weather.Now.WindScale,
			Precip:     weather.Now.Precip,
			UVIndex:    weather.Now.UVIndex,
			AirQuality: weather.Now.AirQuality,
		},
		Plans:       planLines,
		Traces:      traceLines,
		History:     history,
		UserMessage: req.Message,
	}
}

func parseLifeTraceAssistantStructuredResponse(raw string) (lifeTraceAssistantStructuredResponse, error) {
	out, err := prompts.ParseAssistantStructuredOutput(raw)
	if err != nil {
		return lifeTraceAssistantStructuredResponse{}, err
	}
	resp := lifeTraceAssistantStructuredResponse{Reply: out.Reply}
	if out.Action == nil {
		return resp, nil
	}
	action := &lifeTraceAssistantStructuredAction{
		Type:               out.Action.Type,
		Message:            out.Action.Message,
		NeedMoreInfoFields: out.Action.NeedMoreInfoFields,
	}
	if out.Action.Plan != nil {
		action.Plan = &lifeTraceAssistantPlanDraft{
			Title:         out.Action.Plan.Title,
			Type:          out.Action.Plan.Type,
			ScheduledDate: out.Action.Plan.ScheduledDate,
			ScheduledTime: out.Action.Plan.ScheduledTime,
			Timezone:      out.Action.Plan.Timezone,
			NotePrefix:    out.Action.Plan.NotePrefix,
		}
	}
	if out.Action.Pantry != nil {
		action.Pantry = &lifeTraceAssistantPantryDraft{
			Name:      out.Action.Pantry.Name,
			Category:  out.Action.Pantry.Category,
			Quantity:  out.Action.Pantry.Quantity,
			Unit:      out.Action.Pantry.Unit,
			Location:  out.Action.Pantry.Location,
			ExpiresAt: out.Action.Pantry.ExpiresAt,
			OpenedAt:  out.Action.Pantry.OpenedAt,
			Note:      out.Action.Pantry.Note,
		}
	}
	if out.Action.Ledger != nil {
		action.Ledger = &lifeTraceAssistantLedgerDraft{
			Amount:     out.Action.Ledger.Amount,
			Currency:   out.Action.Ledger.Currency,
			Direction:  out.Action.Ledger.Direction,
			Category:   out.Action.Ledger.Category,
			OccurredAt: out.Action.Ledger.OccurredAt,
			Merchant:   out.Action.Ledger.Merchant,
			Location:   out.Action.Ledger.Location,
			Note:       out.Action.Ledger.Note,
		}
	}
	resp.Action = action
	return resp, nil
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
