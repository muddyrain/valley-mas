package lifetrace

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

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
