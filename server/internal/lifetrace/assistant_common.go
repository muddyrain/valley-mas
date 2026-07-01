package lifetrace

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	lifeagent "valley-server/internal/lifetrace/agent"
	lifeai "valley-server/internal/lifetrace/ai"
	prompts "valley-server/internal/lifetrace/ai/prompts"
)

const lifeTraceAssistantToolName = prompts.AssistantToolName

var (
	errLifeTraceAssistantToolUnsupported = lifeai.ErrAssistantToolUnsupported
	errLifeTraceAssistantToolInvalid     = lifeai.ErrAssistantToolInvalid
)

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
