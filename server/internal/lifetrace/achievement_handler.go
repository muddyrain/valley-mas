package lifetrace

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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
	Plans                  []model.LifeTracePlan
	Traces                 []model.LifeTraceTrace
	PantryItems            []model.LifeTracePantryItem
	SharedPantryItems      []model.LifeTracePantryItem
	WeeklyReviews          []model.LifeTraceWeeklyReview
	AIActionCount          int64
	AIMessageCount         int64
	SharedHomeCount        int64
	SharedHouseholdIDs     []model.Int64String
	MaxSharedMemberCount   int
	FirstSharedHouseholdID string
}

var errAchievementAICommentUnavailable = errors.New("achievement AI comment unavailable")

var runAchievementAICommentAsync = func(job func()) {
	go job()
}

var generateAchievementAIComment = generateAchievementAICommentWithARK

var lifeTraceAchievementDefinitions = []achievementDefinition{
	{Code: "first_plan", Title: "把想法落到日历上", Description: "创建第一个生活计划。", Category: "plan", Rarity: "common", Icon: "calendar-plus", Tone: "plan", Target: 1},
	{Code: "first_plan_done", Title: "今天没有糊弄过去", Description: "完成第一个生活计划。", Category: "plan", Rarity: "common", Icon: "check-circle-2", Tone: "plan", Target: 1},
	{Code: "plan_triple", Title: "安排开始成形", Description: "创建三个生活计划。", Category: "plan", Rarity: "common", Icon: "list-checks", Tone: "plan", Target: 3},
	{Code: "plan_ten_done", Title: "十件小事有回音", Description: "完成十个生活计划。", Category: "plan", Rarity: "rare", Icon: "badge-check", Tone: "plan", Target: 10},
	{Code: "plan_thirty_done", Title: "三十件小事走完", Description: "完成三十个生活计划。", Category: "plan", Rarity: "epic", Icon: "medal", Tone: "plan", Target: 30},
	{Code: "plan_type_collector", Title: "生活不止一种样子", Description: "创建三种不同类型的生活计划。", Category: "plan", Rarity: "rare", Icon: "shapes", Tone: "plan", Target: 3},
	{Code: "daily_planner_week", Title: "一周都有安排", Description: "连续七天都有生活计划。", Category: "plan", Rarity: "epic", Icon: "calendar-range", Tone: "plan", Target: 7},
	{Code: "morning_plan", Title: "早一点开始", Description: "安排一个上午的生活计划。", Category: "plan", Rarity: "rare", Icon: "sunrise", Tone: "health", Target: 1},
	{Code: "reading_plan_done", Title: "给自己留了几页", Description: "完成一个阅读计划。", Category: "plan", Rarity: "rare", Icon: "book-open", Tone: "plan", Target: 1},
	{Code: "sport_plan_done", Title: "身体也被照顾到", Description: "完成一个运动计划。", Category: "plan", Rarity: "rare", Icon: "activity", Tone: "health", Target: 1},
	{Code: "social_plan_done", Title: "见面这件事发生了", Description: "完成一个聚会计划。", Category: "plan", Rarity: "rare", Icon: "party-popper", Tone: "plan", Target: 1},
	{Code: "weekend_life", Title: "周末终于像周末", Description: "在周末完成一个生活计划。", Category: "plan", Rarity: "rare", Icon: "sun-medium", Tone: "health", Target: 1},
	{Code: "light_day", Title: "轻装上阵", Description: "一天只安排少量计划，并把它们完成。", Category: "plan", Rarity: "rare", Icon: "leaf", Tone: "trace", Target: 1},
	{Code: "ai_plan_done", Title: "AI 给的真做了", Description: "完成一个来自 AI 的生活计划。", Category: "plan", Rarity: "rare", Icon: "sparkles", Tone: "ai", Target: 1},
	{Code: "first_trace", Title: "生活有回声", Description: "留下第一条生活踪迹。", Category: "trace", Rarity: "common", Icon: "footprints", Tone: "trace", Target: 1},
	{Code: "image_trace", Title: "有图有真相", Description: "留下一条带图片的生活踪迹。", Category: "trace", Rarity: "common", Icon: "image", Tone: "trace", Target: 1},
	{Code: "trace_seven_total", Title: "七段日常被保存", Description: "留下七条生活踪迹。", Category: "trace", Rarity: "common", Icon: "notebook-tabs", Tone: "trace", Target: 7},
	{Code: "trace_fourteen_total", Title: "十四段生活切片", Description: "留下十四条生活踪迹。", Category: "trace", Rarity: "rare", Icon: "notebook-pen", Tone: "trace", Target: 14},
	{Code: "trace_thirty_day_streak", Title: "一个月都有回声", Description: "连续三十天都有生活踪迹。", Category: "trace", Rarity: "epic", Icon: "calendar-heart", Tone: "trace", Target: 30},
	{Code: "tag_collector", Title: "给生活贴上标签", Description: "生活踪迹累计使用五个不同标签。", Category: "trace", Rarity: "rare", Icon: "tags", Tone: "trace", Target: 5},
	{Code: "late_night_trace", Title: "深夜也有一盏灯", Description: "在深夜留下生活踪迹。", Category: "trace", Rarity: "rare", Icon: "moon-star", Tone: "trace", Target: 1},
	{Code: "place_keeper", Title: "地点也被记住", Description: "留下一个带地点的生活踪迹。", Category: "trace", Rarity: "rare", Icon: "map-pin", Tone: "trace", Target: 1},
	{Code: "manual_trace_three", Title: "亲手记下三次", Description: "留下三条手动生活踪迹。", Category: "trace", Rarity: "rare", Icon: "pen-line", Tone: "trace", Target: 3},
	{Code: "photo_memory_three", Title: "相册里有生活", Description: "留下三条带图片的生活踪迹。", Category: "trace", Rarity: "rare", Icon: "images", Tone: "trace", Target: 3},
	{Code: "mood_keeper", Title: "情绪也有位置", Description: "留下三种不同心情的生活踪迹。", Category: "trace", Rarity: "rare", Icon: "smile-plus", Tone: "trace", Target: 3},
	{Code: "long_trace", Title: "生活不是表格", Description: "写下一条更完整的生活记录。", Category: "trace", Rarity: "rare", Icon: "book-open-text", Tone: "trace", Target: 1},
	{Code: "three_day_trace", Title: "今天也留下证据", Description: "连续三天都有生活踪迹。", Category: "trace", Rarity: "rare", Icon: "calendar-days", Tone: "trace", Target: 3},
	{Code: "lookback_trace", Title: "回头看也不错", Description: "已经留下七天前的生活记录。", Category: "trace", Rarity: "rare", Icon: "history", Tone: "trace", Target: 1},
	{Code: "first_pantry", Title: "冰箱不再是黑洞", Description: "收进第一个库存物品。", Category: "pantry", Rarity: "common", Icon: "package-plus", Tone: "health", Target: 1},
	{Code: "pantry_five_items", Title: "储物架有了秩序", Description: "收进五个库存物品。", Category: "pantry", Rarity: "common", Icon: "boxes", Tone: "health", Target: 5},
	{Code: "pantry_twenty_items", Title: "库存开始成体系", Description: "收进二十个库存物品。", Category: "pantry", Rarity: "epic", Icon: "warehouse", Tone: "health", Target: 20},
	{Code: "pantry_category_three", Title: "不只是一种库存", Description: "库存覆盖三种不同分类。", Category: "pantry", Rarity: "rare", Icon: "layers-3", Tone: "health", Target: 3},
	{Code: "pantry_location_three", Title: "每个角落都有数", Description: "库存覆盖三个不同位置。", Category: "pantry", Rarity: "rare", Icon: "map", Tone: "health", Target: 3},
	{Code: "pantry_reminder_keeper", Title: "提醒先安排上", Description: "保存一个开启提醒的库存物品。", Category: "pantry", Rarity: "common", Icon: "bell-ring", Tone: "health", Target: 1},
	{Code: "expiry_rescue", Title: "临期救援队", Description: "在过期前处理一个临期食品。", Category: "pantry", Rarity: "rare", Icon: "alarm-clock-check", Tone: "alert", Target: 1},
	{Code: "expiry_rescue_three", Title: "临期救援三连", Description: "在过期前处理三个临期食品。", Category: "pantry", Rarity: "epic", Icon: "alarm-clock-plus", Tone: "alert", Target: 3},
	{Code: "used_food", Title: "没有浪费这口饭", Description: "用完一个食品库存。", Category: "pantry", Rarity: "common", Icon: "utensils", Tone: "health", Target: 1},
	{Code: "waste_saver_three", Title: "三次没浪费", Description: "用完三个食品库存。", Category: "pantry", Rarity: "rare", Icon: "recycle", Tone: "health", Target: 3},
	{Code: "fresh_start", Title: "新鲜感被记住", Description: "记录一个已开封的库存物品。", Category: "pantry", Rarity: "rare", Icon: "package-open", Tone: "health", Target: 1},
	{Code: "pantry_photo_memory", Title: "库存也有照片", Description: "保存一个带图片的库存物品。", Category: "pantry", Rarity: "rare", Icon: "image", Tone: "health", Target: 1},
	{Code: "pantry_ten_normal", Title: "厨房秩序恢复中", Description: "拥有十件状态正常的库存。", Category: "pantry", Rarity: "rare", Icon: "archive", Tone: "health", Target: 10},
	{Code: "barcode_memory", Title: "这次没有重复买", Description: "保存一个带包装编码的库存。", Category: "pantry", Rarity: "rare", Icon: "scan-barcode", Tone: "ai", Target: 1},
	{Code: "first_ai_chat", Title: "和 AI 商量了一下", Description: "和 Life AI 开始一次对话。", Category: "ai", Rarity: "common", Icon: "message-circle", Tone: "ai", Target: 1},
	{Code: "ai_conversation_three", Title: "已经聊顺手了", Description: "和 Life AI 累计三次对话消息。", Category: "ai", Rarity: "common", Icon: "messages-square", Tone: "ai", Target: 3},
	{Code: "ai_conversation_ten", Title: "生活助理成了熟人", Description: "和 Life AI 累计十次对话消息。", Category: "ai", Rarity: "rare", Icon: "message-square-more", Tone: "ai", Target: 10},
	{Code: "ai_action_three", Title: "AI 建议有了去处", Description: "保存三条 AI 相关生活动作。", Category: "ai", Rarity: "rare", Icon: "sparkle", Tone: "ai", Target: 3},
	{Code: "ai_action_ten", Title: "十条建议留下来", Description: "保存十条 AI 相关生活动作。", Category: "ai", Rarity: "epic", Icon: "sparkles", Tone: "ai", Target: 10},
	{Code: "image_to_plan", Title: "一张图变成一个计划", Description: "从图片分析创建一个计划。", Category: "ai", Rarity: "rare", Icon: "image-plus", Tone: "ai", Target: 1},
	{Code: "ai_image_plan_three", Title: "三张图都有去处", Description: "从图片分析创建三个计划。", Category: "ai", Rarity: "epic", Icon: "images", Tone: "ai", Target: 3},
	{Code: "recipe_plan", Title: "厨房搭子上线", Description: "把智能菜谱加入吃饭计划。", Category: "ai", Rarity: "rare", Icon: "chef-hat", Tone: "health", Target: 1},
	{Code: "recipe_plan_three", Title: "三餐有了灵感", Description: "把三个智能菜谱加入吃饭计划。", Category: "ai", Rarity: "epic", Icon: "cooking-pot", Tone: "health", Target: 3},
	{Code: "weekly_review", Title: "本周有复盘", Description: "生成一次每周回顾。", Category: "ai", Rarity: "common", Icon: "clipboard-list", Tone: "ai", Target: 1},
	{Code: "weekly_review_four", Title: "一个月有复盘", Description: "生成四次每周回顾。", Category: "ai", Rarity: "epic", Icon: "calendar-check", Tone: "ai", Target: 4},
	{Code: "review_to_plan", Title: "复盘变成行动", Description: "从周回顾行动创建一个计划。", Category: "ai", Rarity: "rare", Icon: "clipboard-check", Tone: "ai", Target: 1},
	{Code: "review_to_plan_three", Title: "复盘连续落地", Description: "从周回顾行动创建三个计划。", Category: "ai", Rarity: "epic", Icon: "clipboard-check", Tone: "ai", Target: 3},
	{Code: "first_household", Title: "家庭开始同步", Description: "创建或加入一个共享家庭。", Category: "family", Rarity: "rare", Icon: "users", Tone: "plan", Target: 1},
	{Code: "family_three_members", Title: "三个人有了同一张清单", Description: "共享家庭达到三位成员。", Category: "family", Rarity: "rare", Icon: "users-round", Tone: "plan", Target: 3},
	{Code: "shared_pantry_first", Title: "第一件共享库存", Description: "共享家庭收进第一个库存。", Category: "family", Rarity: "common", Icon: "package-plus", Tone: "health", Target: 1},
	{Code: "shared_pantry_ten", Title: "家里的储物架成形", Description: "共享家庭收进十个库存。", Category: "family", Rarity: "rare", Icon: "boxes", Tone: "health", Target: 10},
	{Code: "shared_pantry_category_three", Title: "家里不只一种库存", Description: "共享家庭库存覆盖三种分类。", Category: "family", Rarity: "rare", Icon: "layers-3", Tone: "health", Target: 3},
	{Code: "shared_pantry_used_food", Title: "一起吃掉一份库存", Description: "共享家庭用完一个食品库存。", Category: "family", Rarity: "rare", Icon: "utensils", Tone: "health", Target: 1},
	{Code: "shared_pantry_expiry_rescue", Title: "家里的临期也救下了", Description: "共享家庭在过期前处理一个临期食品。", Category: "family", Rarity: "epic", Icon: "alarm-clock-check", Tone: "alert", Target: 1},
	{Code: "shared_pantry_photo_memory", Title: "共享库存也有照片", Description: "共享家庭保存一个带图片的库存。", Category: "family", Rarity: "rare", Icon: "image", Tone: "health", Target: 1},
	{Code: "shared_pantry_location_three", Title: "家里角落都有数", Description: "共享家庭库存覆盖三个位置。", Category: "family", Rarity: "rare", Icon: "map", Tone: "health", Target: 3},
	{Code: "spring_trace", Title: "春天被保存过", Description: "在春天留下生活踪迹。", Category: "trace", Rarity: "rare", Icon: "sprout", Tone: "trace", Target: 1},
	{Code: "summer_night_trace", Title: "夏夜也有回声", Description: "在夏夜留下生活踪迹。", Category: "trace", Rarity: "rare", Icon: "moon-star", Tone: "trace", Target: 1},
	{Code: "autumn_pantry", Title: "秋天把库存收好", Description: "在秋天保存一个库存物品。", Category: "pantry", Rarity: "rare", Icon: "leaf", Tone: "health", Target: 1},
	{Code: "winter_meal_plan", Title: "冬天也有热饭计划", Description: "在冬天完成一个吃饭计划。", Category: "plan", Rarity: "rare", Icon: "cooking-pot", Tone: "health", Target: 1},
	{Code: "plan_three_day_streak", Title: "三天都认真安排", Description: "连续三天都有生活计划。", Category: "plan", Rarity: "rare", Icon: "calendar-days", Tone: "plan", Target: 3},
	{Code: "trace_fourteen_day_streak", Title: "十四天都有生活证据", Description: "连续十四天都有生活踪迹。", Category: "trace", Rarity: "epic", Icon: "calendar-heart", Tone: "trace", Target: 14},
	{Code: "weekly_review_to_plan_five", Title: "五次复盘变成行动", Description: "从周回顾行动创建五个计划。", Category: "ai", Rarity: "epic", Icon: "clipboard-check", Tone: "ai", Target: 5},
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
		card := achievementCard{
			Code:         definition.Code,
			Title:        definition.Title,
			Description:  definition.Description,
			Category:     definition.Category,
			Rarity:       definition.Rarity,
			Icon:         definition.Icon,
			Tone:         definition.Tone,
			Hidden:       definition.Hidden,
			Unlocked:     true,
			UnlockedAt:   &record.UnlockedAt,
			Progress:     progress.Progress,
			Target:       target,
			EvidenceType: progress.EvidenceType,
			EvidenceID:   progress.EvidenceID,
		}
		queueAchievementAIComment(userID, card)
	}

	return buildAchievementCards(progressByCode, unlocked), nil
}

func queueAchievementAIComment(userID model.Int64String, card achievementCard) {
	if !card.Unlocked || card.AIComment != "" {
		return
	}

	runAchievementAICommentAsync(func() {
		comment, err := generateAchievementAIComment(userID, card)
		if err != nil {
			logAchievementAICommentWarning(userID, card.Code, err, "LifeTrace achievement AI comment generation failed")
			return
		}
		comment, ok := sanitizeAchievementAIComment(comment)
		if !ok {
			logAchievementAICommentWarning(userID, card.Code, nil, "LifeTrace achievement AI comment generation returned empty content")
			return
		}
		if err := database.GetDB().Model(&model.LifeTraceAchievement{}).
			Where("user_id = ? AND code = ? AND (ai_comment IS NULL OR ai_comment = '')", userID, card.Code).
			Update("ai_comment", comment).Error; err != nil {
			logAchievementAICommentWarning(userID, card.Code, err, "LifeTrace achievement AI comment update failed")
		}
	})
}

func logAchievementAICommentWarning(userID model.Int64String, code string, err error, message string) {
	if logger.Log == nil {
		return
	}
	entry := logger.Log.WithField("userId", userID.String()).WithField("achievementCode", code)
	if err != nil {
		entry = entry.WithError(err)
	}
	entry.Warn(message)
}

func generateAchievementAICommentWithARK(userID model.Int64String, card achievementCard) (string, error) {
	apiKey, arkBaseURL, textModel, errMsg := readLifeTraceArkTextConfig()
	if errMsg != "" {
		return "", fmt.Errorf("%w: %s", errAchievementAICommentUnavailable, errMsg)
	}

	client := ensureLifeTraceArkClient(apiKey, arkBaseURL)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	prompt := strings.Join([]string{
		"你是 Life Trace 的生活成就纪念语助手。",
		"只输出一句中文短句，不要 Markdown，不要编号，不要表格，不要解释。",
		"短句必须温暖克制，像给用户保存一枚生活徽章，不要夸张。",
		"控制在 60 个中文字符以内。",
		fmt.Sprintf("成就标题：%s", card.Title),
		fmt.Sprintf("成就说明：%s", card.Description),
		fmt.Sprintf("成就类别：%s", card.Category),
		fmt.Sprintf("稀有度：%s", card.Rarity),
		fmt.Sprintf("用户 ID：%s", userID.String()),
	}, "\n")

	raw, _, err := callLifeTraceTextAIWithMaxTokens(ctx, client, textModel, prompt, 80)
	if err != nil {
		return "", err
	}
	comment, ok := sanitizeAchievementAIComment(raw)
	if !ok {
		return "", errAchievementAICommentUnavailable
	}
	return comment, nil
}

func sanitizeAchievementAIComment(raw string) (string, bool) {
	comment := strings.TrimSpace(raw)
	comment = strings.TrimPrefix(comment, "```markdown")
	comment = strings.TrimPrefix(comment, "```json")
	comment = strings.TrimPrefix(comment, "```")
	comment = strings.TrimSuffix(comment, "```")
	comment = strings.TrimSpace(comment)
	comment = strings.ReplaceAll(comment, "\r", " ")
	comment = strings.ReplaceAll(comment, "\n", " ")
	comment = strings.Join(strings.Fields(comment), " ")
	comment = strings.Trim(comment, "`*_\"“”' ")
	comment = strings.TrimSpace(comment)

	for {
		next := strings.TrimSpace(comment)
		next = strings.TrimPrefix(next, "- ")
		next = strings.TrimPrefix(next, "* ")
		nextRunes := []rune(next)
		if len(nextRunes) > 2 && nextRunes[0] >= '0' && nextRunes[0] <= '9' && (nextRunes[1] == '.' || nextRunes[1] == '、') {
			next = strings.TrimSpace(string(nextRunes[2:]))
		}
		if next == comment {
			break
		}
		comment = next
	}

	comment = strings.Trim(comment, "`*_\"“”' ")
	if comment == "" {
		return "", false
	}
	runes := []rune(comment)
	if len(runes) > 60 {
		comment = string(runes[:60])
	}
	return comment, true
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
	if err := db.Model(&model.LifeTraceAIAction{}).Where("user_id = ?", userID).Count(&snapshot.AIActionCount).Error; err != nil {
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
	if err := loadSharedAchievementSnapshot(db, userID, &snapshot); err != nil {
		return snapshot, err
	}

	return snapshot, nil
}

func loadSharedAchievementSnapshot(db *gorm.DB, userID model.Int64String, snapshot *achievementSnapshot) error {
	rows, err := db.Table("household_members").
		Select("household_members.household_id").
		Joins("JOIN households ON households.id = household_members.household_id").
		Where("household_members.user_id = ? AND household_members.status = ? AND households.kind = ? AND households.status = ?", userID, householdMemberStatusActive, householdKindShared, householdStatusActive).
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var householdID model.Int64String
		if err := rows.Scan(&householdID); err != nil {
			return err
		}
		snapshot.SharedHouseholdIDs = append(snapshot.SharedHouseholdIDs, householdID)
		if snapshot.FirstSharedHouseholdID == "" {
			snapshot.FirstSharedHouseholdID = householdID.String()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(snapshot.SharedHouseholdIDs) == 0 {
		return nil
	}

	var memberRows []struct {
		HouseholdID model.Int64String
		Count       int
	}
	if err := db.Model(&model.HouseholdMember{}).
		Select("household_id, count(*) as count").
		Where("household_id IN ? AND status = ?", snapshot.SharedHouseholdIDs, householdMemberStatusActive).
		Group("household_id").
		Scan(&memberRows).Error; err != nil {
		return err
	}
	for _, row := range memberRows {
		if row.Count > snapshot.MaxSharedMemberCount {
			snapshot.MaxSharedMemberCount = row.Count
		}
	}
	return db.Where("household_id IN ?", snapshot.SharedHouseholdIDs).Find(&snapshot.SharedPantryItems).Error
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
	progress["plan_triple"] = countProgress(len(snapshot.Plans), "plan", firstPlanEvidenceID(snapshot.Plans))
	progress["plan_ten_done"] = completedPlanCountProgress(snapshot.Plans)
	progress["plan_thirty_done"] = completedPlanCountProgress(snapshot.Plans)
	progress["plan_type_collector"] = planTypeCollectorProgress(snapshot.Plans)
	progress["daily_planner_week"] = dailyPlannerWeekProgress(snapshot.Plans)
	progress["plan_three_day_streak"] = planThreeDayStreakProgress(snapshot.Plans)
	progress["morning_plan"] = morningPlanProgress(snapshot.Plans)
	progress["reading_plan_done"] = completedPlanTypeProgress(snapshot.Plans, "阅读")
	progress["sport_plan_done"] = completedPlanTypeProgress(snapshot.Plans, "运动")
	progress["social_plan_done"] = completedPlanTypeProgress(snapshot.Plans, "聚会")
	progress["weekend_life"] = weekendPlanProgress(snapshot.Plans)
	progress["light_day"] = lightDayProgress(snapshot.Plans)
	progress["ai_plan_done"] = aiPlanDoneProgress(snapshot.Plans)
	progress["first_trace"] = firstTraceProgress(snapshot.Traces)
	progress["image_trace"] = imageTraceProgress(snapshot.Traces)
	progress["trace_seven_total"] = countProgress(len(snapshot.Traces), "trace", firstTraceEvidenceID(snapshot.Traces))
	progress["trace_fourteen_total"] = countProgress(len(snapshot.Traces), "trace", firstTraceEvidenceID(snapshot.Traces))
	progress["trace_thirty_day_streak"] = traceDayStreakProgress(snapshot.Traces)
	progress["trace_fourteen_day_streak"] = traceFourteenDayStreakProgress(snapshot.Traces)
	progress["tag_collector"] = tagCollectorProgress(snapshot.Traces)
	progress["late_night_trace"] = lateNightTraceProgress(snapshot.Traces)
	progress["place_keeper"] = placeKeeperProgress(snapshot.Traces)
	progress["manual_trace_three"] = manualTraceCountProgress(snapshot.Traces)
	progress["spring_trace"] = seasonalTraceProgress(snapshot.Traces, time.March, time.April, time.May)
	progress["summer_night_trace"] = summerNightTraceProgress(snapshot.Traces)
	progress["photo_memory_three"] = imageTraceCountProgress(snapshot.Traces)
	progress["mood_keeper"] = moodKeeperProgress(snapshot.Traces)
	progress["long_trace"] = longTraceProgress(snapshot.Traces)
	progress["three_day_trace"] = threeDayTraceProgress(snapshot.Traces)
	progress["lookback_trace"] = lookbackTraceProgress(snapshot.Traces)
	progress["first_pantry"] = firstPantryProgress(snapshot.PantryItems)
	progress["pantry_five_items"] = countProgress(len(snapshot.PantryItems), "pantry", firstPantryEvidenceID(snapshot.PantryItems))
	progress["pantry_twenty_items"] = countProgress(len(snapshot.PantryItems), "pantry", firstPantryEvidenceID(snapshot.PantryItems))
	progress["pantry_category_three"] = pantryCategoryCollectorProgress(snapshot.PantryItems)
	progress["pantry_location_three"] = pantryLocationCollectorProgress(snapshot.PantryItems)
	progress["pantry_reminder_keeper"] = pantryReminderKeeperProgress(snapshot.PantryItems)
	progress["autumn_pantry"] = seasonalPantryProgress(snapshot.PantryItems, time.September, time.October, time.November)
	progress["expiry_rescue"] = expiryRescueProgress(snapshot.PantryItems)
	progress["expiry_rescue_three"] = expiryRescueCountProgress(snapshot.PantryItems)
	progress["used_food"] = usedFoodProgress(snapshot.PantryItems)
	progress["waste_saver_three"] = usedFoodCountProgress(snapshot.PantryItems)
	progress["fresh_start"] = openedPantryProgress(snapshot.PantryItems)
	progress["pantry_photo_memory"] = pantryPhotoProgress(snapshot.PantryItems)
	progress["pantry_ten_normal"] = pantryTenNormalProgress(snapshot.PantryItems)
	progress["barcode_memory"] = barcodeMemoryProgress(snapshot.PantryItems)
	progress["first_ai_chat"] = countProgress(int(snapshot.AIMessageCount), "ai_message", "")
	progress["ai_conversation_three"] = countProgress(int(snapshot.AIMessageCount), "ai_message", "")
	progress["ai_conversation_ten"] = countProgress(int(snapshot.AIMessageCount), "ai_message", "")
	progress["ai_action_three"] = countProgress(int(snapshot.AIActionCount), "ai_action", "")
	progress["ai_action_ten"] = countProgress(int(snapshot.AIActionCount), "ai_action", "")
	progress["image_to_plan"] = imageToPlanProgress(snapshot.Plans)
	progress["ai_image_plan_three"] = imageToPlanCountProgress(snapshot.Plans)
	progress["recipe_plan"] = recipePlanProgress(snapshot.Plans)
	progress["recipe_plan_three"] = recipePlanCountProgress(snapshot.Plans)
	progress["winter_meal_plan"] = winterMealPlanProgress(snapshot.Plans)
	progress["weekly_review"] = weeklyReviewProgress(snapshot.WeeklyReviews)
	progress["weekly_review_four"] = weeklyReviewProgress(snapshot.WeeklyReviews)
	progress["review_to_plan"] = reviewToPlanProgress(snapshot.Plans)
	progress["review_to_plan_three"] = reviewToPlanCountProgress(snapshot.Plans)
	progress["weekly_review_to_plan_five"] = reviewToPlanCountProgress(snapshot.Plans)
	progress["first_household"] = countProgress(int(snapshot.SharedHomeCount), "household", "")
	progress["family_three_members"] = countProgress(snapshot.MaxSharedMemberCount, "household", snapshot.FirstSharedHouseholdID)
	progress["shared_pantry_first"] = firstSharedPantryProgress(snapshot.SharedPantryItems)
	progress["shared_pantry_ten"] = countProgress(len(snapshot.SharedPantryItems), "pantry", firstPantryEvidenceID(snapshot.SharedPantryItems))
	progress["shared_pantry_category_three"] = pantryCategoryCollectorProgress(snapshot.SharedPantryItems)
	progress["shared_pantry_used_food"] = usedFoodProgress(snapshot.SharedPantryItems)
	progress["shared_pantry_expiry_rescue"] = expiryRescueProgress(snapshot.SharedPantryItems)
	progress["shared_pantry_photo_memory"] = pantryPhotoProgress(snapshot.SharedPantryItems)
	progress["shared_pantry_location_three"] = pantryLocationCollectorProgress(snapshot.SharedPantryItems)

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

func firstPlanEvidenceID(plans []model.LifeTracePlan) string {
	if len(plans) == 0 {
		return ""
	}
	return plans[0].ID.String()
}

func firstCompletedPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if plan.Completed {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func completedPlanCountProgress(plans []model.LifeTracePlan) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, plan := range plans {
		if !plan.Completed {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = plan.ID.String()
		}
	}
	return countProgress(progress, "plan", evidenceID)
}

func completedPlanTypeProgress(plans []model.LifeTracePlan, planType string) achievementProgress {
	for _, plan := range plans {
		if plan.Completed && strings.TrimSpace(plan.Type) == planType {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func planTypeCollectorProgress(plans []model.LifeTracePlan) achievementProgress {
	types := map[string]string{}
	for _, plan := range plans {
		planType := strings.TrimSpace(plan.Type)
		if planType == "" {
			continue
		}
		if _, exists := types[planType]; !exists {
			types[planType] = plan.ID.String()
		}
	}
	for _, evidenceID := range types {
		return countProgress(len(types), "plan", evidenceID)
	}
	return countProgress(0, "plan", "")
}

func dailyPlannerWeekProgress(plans []model.LifeTracePlan) achievementProgress {
	days := map[string]model.LifeTracePlan{}
	for _, plan := range plans {
		date := planActivityDate(plan)
		if date == "" {
			continue
		}
		if _, exists := days[date]; !exists {
			days[date] = plan
		}
	}
	best := longestConsecutivePlanDays(days)
	for _, plan := range days {
		return countProgress(best, "plan", plan.ID.String())
	}
	return countProgress(0, "plan", "")
}

func planThreeDayStreakProgress(plans []model.LifeTracePlan) achievementProgress {
	days := map[string]model.LifeTracePlan{}
	for _, plan := range plans {
		date := planActivityDate(plan)
		if date == "" {
			continue
		}
		if _, exists := days[date]; !exists {
			days[date] = plan
		}
	}
	best := longestConsecutivePlanDays(days)
	if best >= 3 {
		for _, plan := range days {
			return countProgress(best, "plan", plan.ID.String())
		}
	}
	return countProgress(best, "plan", "")
}

func morningPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if isMorningPlan(plan) {
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

func imageToPlanCountProgress(plans []model.LifeTracePlan) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, plan := range plans {
		if plan.Source != "image_ai" {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = plan.ID.String()
		}
	}
	return countProgress(progress, "plan", evidenceID)
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

func recipePlanCountProgress(plans []model.LifeTracePlan) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, plan := range plans {
		note := strings.TrimSpace(plan.Note)
		if plan.Type != "吃饭" || plan.Source != "ai_advice" ||
			(!strings.Contains(note, "AI 智能菜谱") && !strings.Contains(note, "消耗库存")) {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = plan.ID.String()
		}
	}
	return countProgress(progress, "plan", evidenceID)
}

func winterMealPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if !plan.Completed || strings.TrimSpace(plan.Type) != "吃饭" {
			continue
		}
		if date := planDate(plan); !date.IsZero() && isMonthIn(date.Month(), time.December, time.January, time.February) {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func reviewToPlanProgress(plans []model.LifeTracePlan) achievementProgress {
	for _, plan := range plans {
		if isReviewToPlan(plan) {
			return countProgress(1, "plan", plan.ID.String())
		}
	}
	return countProgress(0, "plan", "")
}

func reviewToPlanCountProgress(plans []model.LifeTracePlan) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, plan := range plans {
		if !isReviewToPlan(plan) {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = plan.ID.String()
		}
	}
	return countProgress(progress, "plan", evidenceID)
}

func isReviewToPlan(plan model.LifeTracePlan) bool {
	return strings.Contains(strings.TrimSpace(plan.Source), "weekly") || strings.Contains(strings.TrimSpace(plan.Note), "周回顾")
}

func firstTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	if len(traces) == 0 {
		return countProgress(0, "trace", "")
	}
	return countProgress(len(traces), "trace", traces[0].ID.String())
}

func firstTraceEvidenceID(traces []model.LifeTraceTrace) string {
	if len(traces) == 0 {
		return ""
	}
	return traces[0].ID.String()
}

func imageTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		if strings.TrimSpace(trace.ImageURL) != "" {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func imageTraceCountProgress(traces []model.LifeTraceTrace) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, trace := range traces {
		if strings.TrimSpace(trace.ImageURL) == "" {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = trace.ID.String()
		}
	}
	return countProgress(progress, "trace", evidenceID)
}

func traceDayStreakProgress(traces []model.LifeTraceTrace) achievementProgress {
	days := map[string]model.LifeTraceTrace{}
	for _, trace := range traces {
		days[trace.CreatedAt.Format("2006-01-02")] = trace
	}
	best := longestConsecutiveTraceDays(days)
	for _, trace := range days {
		return countProgress(best, "trace", trace.ID.String())
	}
	return countProgress(0, "trace", "")
}

func traceFourteenDayStreakProgress(traces []model.LifeTraceTrace) achievementProgress {
	days := map[string]model.LifeTraceTrace{}
	for _, trace := range traces {
		days[trace.CreatedAt.Format("2006-01-02")] = trace
	}
	best := longestConsecutiveTraceDays(days)
	if best >= 14 {
		for _, trace := range days {
			return countProgress(best, "trace", trace.ID.String())
		}
	}
	return countProgress(best, "trace", "")
}

func moodKeeperProgress(traces []model.LifeTraceTrace) achievementProgress {
	moods := map[string]string{}
	for _, trace := range traces {
		mood := strings.TrimSpace(trace.Mood)
		if mood == "" {
			continue
		}
		if _, exists := moods[mood]; !exists {
			moods[mood] = trace.ID.String()
		}
	}
	for _, evidenceID := range moods {
		return countProgress(len(moods), "trace", evidenceID)
	}
	return countProgress(0, "trace", "")
}

func tagCollectorProgress(traces []model.LifeTraceTrace) achievementProgress {
	tags := map[string]string{}
	for _, trace := range traces {
		for _, rawTag := range trace.Tags {
			tag := strings.TrimSpace(rawTag)
			if tag == "" {
				continue
			}
			if _, exists := tags[tag]; !exists {
				tags[tag] = trace.ID.String()
			}
		}
	}
	for _, evidenceID := range tags {
		return countProgress(len(tags), "trace", evidenceID)
	}
	return countProgress(0, "trace", "")
}

func lateNightTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		hour := trace.CreatedAt.Hour()
		if hour >= 22 || hour < 5 {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func placeKeeperProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		if strings.TrimSpace(trace.Location) != "" {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func manualTraceCountProgress(traces []model.LifeTraceTrace) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, trace := range traces {
		if strings.TrimSpace(trace.Source) != "手动" {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = trace.ID.String()
		}
	}
	return countProgress(progress, "trace", evidenceID)
}

func seasonalTraceProgress(traces []model.LifeTraceTrace, months ...time.Month) achievementProgress {
	for _, trace := range traces {
		if isMonthIn(trace.CreatedAt.Month(), months...) {
			return countProgress(1, "trace", trace.ID.String())
		}
	}
	return countProgress(0, "trace", "")
}

func summerNightTraceProgress(traces []model.LifeTraceTrace) achievementProgress {
	for _, trace := range traces {
		hour := trace.CreatedAt.Hour()
		if isMonthIn(trace.CreatedAt.Month(), time.June, time.July, time.August) && (hour >= 22 || hour < 5) {
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

func firstSharedPantryProgress(items []model.LifeTracePantryItem) achievementProgress {
	if len(items) == 0 {
		return countProgress(0, "pantry", "")
	}
	return countProgress(len(items), "pantry", items[0].ID.String())
}

func firstPantryEvidenceID(items []model.LifeTracePantryItem) string {
	if len(items) == 0 {
		return ""
	}
	return items[0].ID.String()
}

func pantryCategoryCollectorProgress(items []model.LifeTracePantryItem) achievementProgress {
	categories := map[string]string{}
	for _, item := range items {
		category := strings.TrimSpace(item.Category)
		if category == "" {
			continue
		}
		if _, exists := categories[category]; !exists {
			categories[category] = item.ID.String()
		}
	}
	for _, evidenceID := range categories {
		return countProgress(len(categories), "pantry", evidenceID)
	}
	return countProgress(0, "pantry", "")
}

func pantryLocationCollectorProgress(items []model.LifeTracePantryItem) achievementProgress {
	locations := map[string]string{}
	for _, item := range items {
		location := strings.TrimSpace(item.Location)
		if location == "" {
			continue
		}
		if _, exists := locations[location]; !exists {
			locations[location] = item.ID.String()
		}
	}
	for _, evidenceID := range locations {
		return countProgress(len(locations), "pantry", evidenceID)
	}
	return countProgress(0, "pantry", "")
}

func pantryReminderKeeperProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if item.ReminderEnabled {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func seasonalPantryProgress(items []model.LifeTracePantryItem, months ...time.Month) achievementProgress {
	for _, item := range items {
		if !item.CreatedAt.IsZero() && isMonthIn(item.CreatedAt.Month(), months...) {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
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

func expiryRescueCountProgress(items []model.LifeTracePantryItem) achievementProgress {
	today := time.Now().Format("2006-01-02")
	progress := 0
	evidenceID := ""
	for _, item := range items {
		if item.Category != "食品" || (item.Status != "used-up" && item.Status != "discarded") ||
			item.ExpiresAt == "" || item.ExpiresAt < today {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = item.ID.String()
		}
	}
	return countProgress(progress, "pantry", evidenceID)
}

func usedFoodProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if item.Category == "食品" && item.Status == "used-up" {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func usedFoodCountProgress(items []model.LifeTracePantryItem) achievementProgress {
	progress := 0
	evidenceID := ""
	for _, item := range items {
		if item.Category != "食品" || item.Status != "used-up" {
			continue
		}
		progress++
		if evidenceID == "" {
			evidenceID = item.ID.String()
		}
	}
	return countProgress(progress, "pantry", evidenceID)
}

func openedPantryProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if strings.TrimSpace(item.OpenedAt) != "" {
			return countProgress(1, "pantry", item.ID.String())
		}
	}
	return countProgress(0, "pantry", "")
}

func pantryPhotoProgress(items []model.LifeTracePantryItem) achievementProgress {
	for _, item := range items {
		if strings.TrimSpace(item.ImageURL) != "" || strings.TrimSpace(item.ThumbnailURL) != "" {
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

func isMorningPlan(plan model.LifeTracePlan) bool {
	if scheduledTime := strings.TrimSpace(plan.ScheduledTime); len(scheduledTime) >= 2 {
		hour, err := strconv.Atoi(scheduledTime[:2])
		if err == nil && hour >= 5 && hour < 12 {
			return true
		}
	}
	timeLabel := strings.TrimSpace(plan.TimeLabel)
	return strings.Contains(timeLabel, "上午") || strings.Contains(timeLabel, "早上") || strings.Contains(timeLabel, "清晨")
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

func planDate(plan model.LifeTracePlan) time.Time {
	if date := parseLifeTraceDate(plan.ScheduledDate); !date.IsZero() {
		return date
	}
	if plan.CompletedAt != nil {
		return *plan.CompletedAt
	}
	return plan.CreatedAt
}

func isMonthIn(month time.Month, months ...time.Month) bool {
	for _, candidate := range months {
		if month == candidate {
			return true
		}
	}
	return false
}

func parseLifeTraceDate(raw string) time.Time {
	date, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(raw), time.Local)
	if err != nil {
		return time.Time{}
	}
	return date
}

func longestConsecutivePlanDays(days map[string]model.LifeTracePlan) int {
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
