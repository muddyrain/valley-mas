package lifetrace

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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
