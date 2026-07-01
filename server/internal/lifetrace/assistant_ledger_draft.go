package lifetrace

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
)

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
