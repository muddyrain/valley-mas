package lifetrace

import (
	"net/http"
	"sort"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

type achievementDefinition struct {
	Code        string `json:"code"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Rarity      string `json:"rarity"`
	Icon        string `json:"icon"`
	Tone        string `json:"tone"`
	Hidden      bool   `json:"hidden"`
	Target      int    `json:"target"`
}

type achievementProgress struct {
	Progress     int
	EvidenceType string
	EvidenceID   string
}

type achievementCard struct {
	Code         string     `json:"code"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	Category     string     `json:"category"`
	Rarity       string     `json:"rarity"`
	Icon         string     `json:"icon"`
	Tone         string     `json:"tone"`
	Hidden       bool       `json:"hidden"`
	Unlocked     bool       `json:"unlocked"`
	UnlockedAt   *time.Time `json:"unlockedAt,omitempty"`
	Progress     int        `json:"progress"`
	Target       int        `json:"target"`
	EvidenceType string     `json:"evidenceType,omitempty"`
	EvidenceID   string     `json:"evidenceId,omitempty"`
	AIComment    string     `json:"aiComment,omitempty"`
}

type achievementSnapshot struct {
	Plans           []model.LifeTracePlan
	Traces          []model.LifeTraceTrace
	PantryItems     []model.LifeTracePantryItem
	WeeklyReviews   []model.LifeTraceWeeklyReview
	AIMessageCount  int64
	SharedHomeCount int64
}

var lifeTraceAchievementDefinitions = []achievementDefinition{
	{Code: "first_plan", Title: "把想法落到日历上", Description: "创建第一个生活计划。", Category: "plan", Rarity: "common", Icon: "calendar-plus", Tone: "plan", Target: 1},
	{Code: "first_plan_done", Title: "今天没有糊弄过去", Description: "完成第一个生活计划。", Category: "plan", Rarity: "common", Icon: "check-circle-2", Tone: "plan", Target: 1},
	{Code: "weekend_life", Title: "周末终于像周末", Description: "在周末完成一个生活计划。", Category: "plan", Rarity: "rare", Icon: "sun-medium", Tone: "health", Target: 1},
	{Code: "light_day", Title: "轻装上阵", Description: "一天只安排少量计划，并把它们完成。", Category: "plan", Rarity: "rare", Icon: "leaf", Tone: "trace", Target: 1},
	{Code: "ai_plan_done", Title: "AI 给的真做了", Description: "完成一个来自 AI 的生活计划。", Category: "plan", Rarity: "rare", Icon: "sparkles", Tone: "ai", Target: 1},
	{Code: "first_trace", Title: "生活有回声", Description: "留下第一条生活踪迹。", Category: "trace", Rarity: "common", Icon: "footprints", Tone: "trace", Target: 1},
	{Code: "image_trace", Title: "有图有真相", Description: "留下一条带图片的生活踪迹。", Category: "trace", Rarity: "common", Icon: "image", Tone: "trace", Target: 1},
	{Code: "long_trace", Title: "生活不是表格", Description: "写下一条更完整的生活记录。", Category: "trace", Rarity: "rare", Icon: "book-open-text", Tone: "trace", Target: 1},
	{Code: "three_day_trace", Title: "今天也留下证据", Description: "连续三天都有生活踪迹。", Category: "trace", Rarity: "rare", Icon: "calendar-days", Tone: "trace", Target: 3},
	{Code: "lookback_trace", Title: "回头看也不错", Description: "已经留下七天前的生活记录。", Category: "trace", Rarity: "rare", Icon: "history", Tone: "trace", Target: 1},
	{Code: "first_pantry", Title: "冰箱不再是黑洞", Description: "收进第一个库存物品。", Category: "pantry", Rarity: "common", Icon: "package-plus", Tone: "health", Target: 1},
	{Code: "expiry_rescue", Title: "临期救援队", Description: "在过期前处理一个临期食品。", Category: "pantry", Rarity: "rare", Icon: "alarm-clock-check", Tone: "alert", Target: 1},
	{Code: "used_food", Title: "没有浪费这口饭", Description: "用完一个食品库存。", Category: "pantry", Rarity: "common", Icon: "utensils", Tone: "health", Target: 1},
	{Code: "pantry_ten_normal", Title: "厨房秩序恢复中", Description: "拥有十件状态正常的库存。", Category: "pantry", Rarity: "rare", Icon: "archive", Tone: "health", Target: 10},
	{Code: "barcode_memory", Title: "这次没有重复买", Description: "保存一个带包装编码的库存。", Category: "pantry", Rarity: "rare", Icon: "scan-barcode", Tone: "ai", Target: 1},
	{Code: "first_ai_chat", Title: "和 AI 商量了一下", Description: "和 Life AI 开始一次对话。", Category: "ai", Rarity: "common", Icon: "message-circle", Tone: "ai", Target: 1},
	{Code: "image_to_plan", Title: "一张图变成一个计划", Description: "从图片分析创建一个计划。", Category: "ai", Rarity: "rare", Icon: "image-plus", Tone: "ai", Target: 1},
	{Code: "recipe_plan", Title: "厨房搭子上线", Description: "把智能菜谱加入吃饭计划。", Category: "ai", Rarity: "rare", Icon: "chef-hat", Tone: "health", Target: 1},
	{Code: "weekly_review", Title: "本周有复盘", Description: "生成一次每周回顾。", Category: "ai", Rarity: "common", Icon: "clipboard-list", Tone: "ai", Target: 1},
	{Code: "first_household", Title: "家庭开始同步", Description: "创建或加入一个共享家庭。", Category: "family", Rarity: "rare", Icon: "users", Tone: "plan", Target: 1},
}

func (h *Handler) ListAchievements(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	cards, err := evaluateLifeTraceAchievements(userID)
	if err != nil {
		logger.Log.WithField("userId", userID.String()).WithError(err).Warn("LifeTrace achievements evaluation failed")
		fail(c, http.StatusInternalServerError, "获取生活成就失败")
		return
	}

	success(c, gin.H{
		"summary": buildAchievementSummary(cards, time.Now()),
		"list":    cards,
		"recent":  recentAchievementCards(cards, time.Now()),
	})
}

func evaluateAchievementsQuietly(userID model.Int64String) {
	if _, err := evaluateLifeTraceAchievements(userID); err != nil {
		logger.Log.WithField("userId", userID.String()).WithError(err).Warn("LifeTrace achievements evaluation failed")
	}
}

func evaluateLifeTraceAchievements(userID model.Int64String) ([]achievementCard, error) {
	snapshot, err := loadAchievementSnapshot(userID)
	if err != nil {
		return nil, err
	}

	progressByCode := buildAchievementProgress(snapshot)
	unlocked, err := loadUnlockedAchievements(userID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	for _, definition := range lifeTraceAchievementDefinitions {
		progress := progressByCode[definition.Code]
		target := achievementTarget(definition)
		if progress.Progress < target {
			continue
		}
		if _, exists := unlocked[definition.Code]; exists {
			continue
		}
		record := model.LifeTraceAchievement{
			UserID:       userID,
			Code:         definition.Code,
			Category:     definition.Category,
			EvidenceType: progress.EvidenceType,
			EvidenceID:   progress.EvidenceID,
			Progress:     progress.Progress,
			Target:       target,
			Metadata:     "{}",
			UnlockedAt:   now,
		}
		if err := database.GetDB().Create(&record).Error; err != nil {
			return nil, err
		}
		unlocked[definition.Code] = record
	}

	return buildAchievementCards(progressByCode, unlocked), nil
}

func loadAchievementSnapshot(userID model.Int64String) (achievementSnapshot, error) {
	db := database.GetDB()
	snapshot := achievementSnapshot{}

	if err := db.Where("user_id = ?", userID).Find(&snapshot.Plans).Error; err != nil {
		return snapshot, err
	}
	if err := db.Where("user_id = ?", userID).Find(&snapshot.Traces).Error; err != nil {
		return snapshot, err
	}
	if err := db.Where("user_id = ?", userID).Find(&snapshot.PantryItems).Error; err != nil {
		return snapshot, err
	}
	if err := db.Where("user_id = ?", userID).Find(&snapshot.WeeklyReviews).Error; err != nil {
		return snapshot, err
	}
	if err := db.Model(&model.LifeTraceAIMessage{}).Where("user_id = ?", userID).Count(&snapshot.AIMessageCount).Error; err != nil {
		return snapshot, err
	}
	if err := db.Table("household_members").
		Joins("JOIN households ON households.id = household_members.household_id").
		Where("household_members.user_id = ? AND household_members.status = ? AND households.kind = ? AND households.status = ?", userID, householdMemberStatusActive, householdKindShared, householdStatusActive).
		Count(&snapshot.SharedHomeCount).Error; err != nil {
		return snapshot, err
	}

	return snapshot, nil
}

func loadUnlockedAchievements(userID model.Int64String) (map[string]model.LifeTraceAchievement, error) {
	var records []model.LifeTraceAchievement
	if err := database.GetDB().Where("user_id = ?", userID).Find(&records).Error; err != nil {
		return nil, err
	}
	result := make(map[string]model.LifeTraceAchievement, len(records))
	for _, record := range records {
		result[record.Code] = record
	}
	return result, nil
}

func buildAchievementProgress(snapshot achievementSnapshot) map[string]achievementProgress {
	progress := make(map[string]achievementProgress, len(lifeTraceAchievementDefinitions))
	for _, definition := range lifeTraceAchievementDefinitions {
		progress[definition.Code] = countProgress(0, "", "")
	}

	progress["first_plan"] = firstPlanProgress(snapshot.Plans)
	progress["first_plan_done"] = firstCompletedPlanProgress(snapshot.Plans)
	progress["weekend_life"] = weekendPlanProgress(snapshot.Plans)
	progress["light_day"] = lightDayProgress(snapshot.Plans)
	progress["ai_plan_done"] = aiPlanDoneProgress(snapshot.Plans)
	progress["first_trace"] = firstTraceProgress(snapshot.Traces)
	progress["image_trace"] = imageTraceProgress(snapshot.Traces)
	progress["long_trace"] = longTraceProgress(snapshot.Traces)
	progress["three_day_trace"] = threeDayTraceProgress(snapshot.Traces)
	progress["lookback_trace"] = lookbackTraceProgress(snapshot.Traces)
	progress["first_pantry"] = firstPantryProgress(snapshot.PantryItems)
	progress["expiry_rescue"] = expiryRescueProgress(snapshot.PantryItems)
	progress["used_food"] = usedFoodProgress(snapshot.PantryItems)
	progress["pantry_ten_normal"] = pantryTenNormalProgress(snapshot.PantryItems)
	progress["barcode_memory"] = barcodeMemoryProgress(snapshot.PantryItems)
	progress["first_ai_chat"] = countProgress(int(snapshot.AIMessageCount), "ai_message", "")
	progress["image_to_plan"] = imageToPlanProgress(snapshot.Plans)
	progress["recipe_plan"] = recipePlanProgress(snapshot.Plans)
	progress["weekly_review"] = weeklyReviewProgress(snapshot.WeeklyReviews)
	progress["first_household"] = countProgress(int(snapshot.SharedHomeCount), "household", "")

	return progress
}

func buildAchievementCards(
	progressByCode map[string]achievementProgress,
	unlocked map[string]model.LifeTraceAchievement,
) []achievementCard {
	cards := make([]achievementCard, 0, len(lifeTraceAchievementDefinitions))
	for _, definition := range lifeTraceAchievementDefinitions {
		progress := progressByCode[definition.Code]
		target := achievementTarget(definition)
		card := achievementCard{
			Code:        definition.Code,
			Title:       definition.Title,
			Description: definition.Description,
			Category:    definition.Category,
			Rarity:      definition.Rarity,
			Icon:        definition.Icon,
			Tone:        definition.Tone,
			Hidden:      definition.Hidden,
			Progress:    minInt(progress.Progress, target),
			Target:      target,
		}
		if record, ok := unlocked[definition.Code]; ok {
			unlockedAt := record.UnlockedAt
			card.Unlocked = true
			card.UnlockedAt = &unlockedAt
			card.Progress = maxInt(record.Progress, card.Progress)
			card.EvidenceType = record.EvidenceType
			card.EvidenceID = record.EvidenceID
			card.AIComment = record.AIComment
		}
		cards = append(cards, card)
	}
	return cards
}

func buildAchievementSummary(cards []achievementCard, now time.Time) gin.H {
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	unlocked := 0
	monthlyNew := 0
	rareUnlocked := 0
	for _, card := range cards {
		if !card.Unlocked {
			continue
		}
		unlocked++
		if card.UnlockedAt != nil && !card.UnlockedAt.Before(monthStart) {
			monthlyNew++
		}
		if card.Rarity == "rare" || card.Rarity == "epic" {
			rareUnlocked++
		}
	}
	return gin.H{
		"total":        len(cards),
		"unlocked":     unlocked,
		"monthlyNew":   monthlyNew,
		"rareUnlocked": rareUnlocked,
	}
}

func recentAchievementCards(cards []achievementCard, now time.Time) []achievementCard {
	cutoff := now.AddDate(0, 0, -7)
	recent := make([]achievementCard, 0)
	for _, card := range cards {
		if card.UnlockedAt != nil && !card.UnlockedAt.Before(cutoff) {
			recent = append(recent, card)
		}
	}
	sort.Slice(recent, func(i, j int) bool {
		return recent[i].UnlockedAt.After(*recent[j].UnlockedAt)
	})
	if len(recent) > 5 {
		return recent[:5]
	}
	return recent
}

func achievementTarget(definition achievementDefinition) int {
	if definition.Target <= 0 {
		return 1
	}
	return definition.Target
}

func firstPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	if len(plans) == 0 {
		return countProgress(0, "plan", "")
	}
	return countProgress(len(plans), "plan", plans[0].ID.String())
}

func firstCompletedPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if plan.Completed {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func weekendPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if plan.Completed && isWeekendPlan(plan) {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func lightDayProgress(plans []model.LifeTracePlan) achievementProgress {
	plansByDate := map[string][]model.LifeTracePlan{}
	for _, plan := range plans {
		date := planActivityDate(plan)
		if date == "" {
			continue
		}
		plansByDate[date] = append(plansByDate[date], plan)
	}
	for _, dayPlans := range plansByDate {
		if len(dayPlans) == 0 || len(dayPlans) > 2 {
			continue
		}
		allDone := true
		for _, plan := range dayPlans {
			if !plan.Completed {
				allDone = false
				break
			}
		}
		if allDone {
			return countProgress(1, "plan", dayPlans[0].ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func aiPlanDoneProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if plan.Completed && plan.Source == "ai_advice" {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func imageToPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if plan.Source == "image_ai" {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func recipePlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		note := strings.TrimSpace(plan.Note)
		if plan.Type == "吃饭" && plan.Source == "ai_advice" &&
			(strings.Contains(note, "AI 智能菜谱") || strings.Contains(note, "消耗库存")) {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func firstTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	if len(traces) == 0 {
		return countProgress(0, "trace", "")
	}
	return countProgress(len(traces), "trace", traces[0].ID.String())
}

func imageTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		if strings.TrimSpace(trace.ImageURL) != "" {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func longTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		if len([]rune(strings.TrimSpace(trace.Summary))) >= 100 {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func threeDayTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	days := map[string]model.LifeTraceTrace{}
	for _, trace := range traces {
		days[trace.CreatedAt.Format("2006-01-02")] = trace
	}
	best := longestConsecutiveTraceDays(days)
	if best >= 3 {
		for _, trace := range days {
			return countProgress(best, "trace", trace.ID.String())
		}
	}
	return countProgress(best, "trace", "")
}

func lookbackTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	cutoff := time.Now().AddDate(0, 0, -7)
	for _, trace := range traces {
		if !trace.CreatedAt.After(cutoff) {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func firstPantryProgress(items []model.LifeTracePantryItem) achievementProgress {
	if len(items) == 0 {
		return countProgress(0, "pantry", "")
	}
	return countProgress(len(items), "pantry", items[0].ID.String())
}

func expiryRescueProgress(items []model.LifeTracePantryItem) achievementProgress {
	today := time.Now().Format("2006-01-02")
	for _, item := range items {
		if item.Category == "食品" && (item.Status == "used-up" || item.Status == "discarded") &&
			item.ExpiresAt != "" && item.ExpiresAt >= today {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func usedFoodProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if item.Category == "食品" && item.Status == "used-up" {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func pantryTenNormalProgress(items []model.LifeTracePantryItem) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, item := range items {
		if item.Status == "normal" {
			progress++
			if evidenceID == "" {
				evidenceID = item.ID.String()
			}
		}
	}
	return countProgress(progress, "pantry", evidenceID)
}

func barcodeMemoryProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if strings.TrimSpace(item.BarcodeValue) != "" {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func weeklyReviewProgress(reviews []model.LifeTraceWeeklyReview) achievementProgress {
	if len(reviews) == 0 {
		return countProgress(0, "weekly_review", "")
	}
	return countProgress(len(reviews), "weekly_review", reviews[0].ID.String())
}

func countProgress(progress int, evidenceType string, evidenceID string) achievementProgress {
	return achievementProgress{
		Progress:     progress,
		EvidenceType: evidenceType,
		EvidenceID:   evidenceID,
	}
}

func isWeekendPlan(plan model.LifeTracePlan) bool {
	if date := parseLifeTraceDate(plan.ScheduledDate); !date.IsZero() {
		return date.Weekday() == time.Saturday || date.Weekday() == time.Sunday
	}
	if plan.CompletedAt != nil {
		return plan.CompletedAt.Weekday() == time.Saturday || plan.CompletedAt.Weekday() == time.Sunday
	}
	return plan.CreatedAt.Weekday() == time.Saturday || plan.CreatedAt.Weekday() == time.Sunday
}

func planActivityDate(plan model.LifeTracePlan) string {
	if strings.TrimSpace(plan.ScheduledDate) != "" {
		return strings.TrimSpace(plan.ScheduledDate)
	}
	if plan.CompletedAt != nil {
		return plan.CompletedAt.Format("2006-01-02")
	}
	if !plan.CreatedAt.IsZero() {
		return plan.CreatedAt.Format("2006-01-02")
	}
	return ""
}

func parseLifeTraceDate(raw string) time.Time {
	date, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(raw), time.Local)
	if err != nil {
		return time.Time{}
	}
	return date
}

func longestConsecutiveTraceDays(days map[string]model.LifeTraceTrace) int {
	if len(days) == 0 {
		return 0
	}
	keys := make([]string, 0, len(days))
	for key := range days {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	best := 1
	current := 1
	for i := 1; i < len(keys); i++ {
		previous := parseLifeTraceDate(keys[i-1])
		next := parseLifeTraceDate(keys[i])
		if !previous.IsZero() && !next.IsZero() && next.Sub(previous) == 24*time.Hour {
			current++
		} else {
			current = 1
		}
		best = maxInt(best, current)
	}
	return best
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
