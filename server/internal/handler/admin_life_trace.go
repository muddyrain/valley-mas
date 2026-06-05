package handler

import (
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	adminLifeTraceDefaultPageSize = 20
	adminLifeTraceMaxPageSize     = 100
)

type adminLifeTraceUserRow struct {
	UserID            string     `json:"userId"`
	Nickname          string     `json:"nickname"`
	Username          string     `json:"username"`
	Avatar            string     `json:"avatar"`
	Role              string     `json:"role"`
	IsActive          bool       `json:"isActive"`
	City              string     `json:"city"`
	CommuteMethod     string     `json:"commuteMethod"`
	DailyBriefTime    string     `json:"dailyBriefTime"`
	NotificationReady bool       `json:"notificationReady"`
	Plans             int64      `json:"plans"`
	OpenPlans         int64      `json:"openPlans"`
	Traces            int64      `json:"traces"`
	PantryItems       int64      `json:"pantryItems"`
	Checkins          int64      `json:"checkins"`
	WeeklyReviews     int64      `json:"weeklyReviews"`
	AIConversations   int64      `json:"aiConversations"`
	Feedbacks         int64      `json:"feedbacks"`
	PushSubscriptions int64      `json:"pushSubscriptions"`
	LatestActivityAt  *time.Time `json:"latestActivityAt,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
}

type adminLifeTraceRecordRow struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	UserID    string         `json:"userId"`
	UserName  string         `json:"userName"`
	Title     string         `json:"title"`
	Status    string         `json:"status"`
	Source    string         `json:"source"`
	TimeLabel string         `json:"timeLabel,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt *time.Time     `json:"updatedAt,omitempty"`
	Detail    map[string]any `json:"detail"`
}

type adminLifeTraceCountRow struct {
	UserID   model.Int64String `gorm:"column:user_id"`
	Total    int64             `gorm:"column:total"`
	LatestAt *time.Time        `gorm:"column:latest_at"`
}

type adminLifeTracePageParams struct {
	Page     int
	PageSize int
	Offset   int
}

func parseAdminLifeTracePage(c *gin.Context) adminLifeTracePageParams {
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", adminLifeTraceDefaultPageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > adminLifeTraceMaxPageSize {
		pageSize = adminLifeTraceDefaultPageSize
	}

	return adminLifeTracePageParams{
		Page:     page,
		PageSize: pageSize,
		Offset:   (page - 1) * pageSize,
	}
}

func parseAdminLifeTraceUserID(c *gin.Context) (model.Int64String, bool) {
	raw := strings.TrimSpace(c.Query("userId"))
	if raw == "" {
		return 0, false
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0, false
	}
	return model.Int64String(value), true
}

func applyAdminLifeTraceDateFilters(query *gorm.DB, c *gin.Context, column string) *gorm.DB {
	if dateFrom := strings.TrimSpace(c.Query("dateFrom")); dateFrom != "" {
		if _, err := time.Parse("2006-01-02", dateFrom); err == nil {
			query = query.Where(column+" >= ?", dateFrom+" 00:00:00")
		}
	}
	if dateTo := strings.TrimSpace(c.Query("dateTo")); dateTo != "" {
		if _, err := time.Parse("2006-01-02", dateTo); err == nil {
			query = query.Where(column+" <= ?", dateTo+" 23:59:59")
		}
	}
	return query
}

func adminLifeTraceUserName(user *model.User, fallback model.Int64String) string {
	if user == nil {
		return fallback.String()
	}
	if strings.TrimSpace(user.Nickname) != "" {
		return user.Nickname
	}
	if strings.TrimSpace(user.Username) != "" {
		return user.Username
	}
	return user.ID.String()
}

func loadAdminLifeTraceUsers(userIDs []model.Int64String) map[model.Int64String]*model.User {
	result := map[model.Int64String]*model.User{}
	if len(userIDs) == 0 {
		return result
	}

	var users []model.User
	if err := database.GetDB().Where("id IN ?", userIDs).Find(&users).Error; err != nil {
		return result
	}
	for i := range users {
		user := users[i]
		result[user.ID] = &user
	}
	return result
}

func mergeAdminLifeTraceCount(
	counts map[model.Int64String]int64,
	latest map[model.Int64String]time.Time,
	rows []adminLifeTraceCountRow,
) {
	for _, row := range rows {
		counts[row.UserID] = row.Total
		if row.LatestAt != nil {
			current, ok := latest[row.UserID]
			if !ok || row.LatestAt.After(current) {
				latest[row.UserID] = *row.LatestAt
			}
		}
	}
}

func loadAdminLifeTraceCounts(target any) []adminLifeTraceCountRow {
	var rows []adminLifeTraceCountRow
	_ = database.GetDB().
		Model(target).
		Select("user_id, COUNT(*) as total, MAX(updated_at) as latest_at").
		Group("user_id").
		Scan(&rows).Error
	return rows
}

func ListAdminLifeTraceUsers(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	keyword := strings.TrimSpace(c.Query("keyword"))

	query := database.GetDB().Model(&model.User{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"nickname LIKE ? OR username LIKE ? OR open_id LIKE ? OR email LIKE ?",
			like,
			like,
			like,
			like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询 Life Trace 用户失败")
		return
	}

	var users []model.User
	if err := query.
		Order("created_at DESC").
		Limit(page.PageSize).
		Offset(page.Offset).
		Find(&users).Error; err != nil {
		Error(c, 500, "查询 Life Trace 用户失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(users))
	for _, user := range users {
		userIDs = append(userIDs, user.ID)
	}

	settingsByUser := map[model.Int64String]model.LifeTraceSettings{}
	if len(userIDs) > 0 {
		var settings []model.LifeTraceSettings
		if err := database.GetDB().Where("user_id IN ?", userIDs).Find(&settings).Error; err == nil {
			for _, item := range settings {
				settingsByUser[item.UserID] = item
			}
		}
	}

	countsByKind := map[string]map[model.Int64String]int64{}
	latestByUser := map[model.Int64String]time.Time{}
	for kind, rows := range map[string][]adminLifeTraceCountRow{
		"plans":             loadAdminLifeTraceCounts(&model.LifeTracePlan{}),
		"traces":            loadAdminLifeTraceCounts(&model.LifeTraceTrace{}),
		"pantryItems":       loadAdminLifeTraceCounts(&model.LifeTracePantryItem{}),
		"checkins":          loadAdminLifeTraceCounts(&model.LifeTraceCheckin{}),
		"weeklyReviews":     loadAdminLifeTraceCounts(&model.LifeTraceWeeklyReview{}),
		"aiConversations":   loadAdminLifeTraceCounts(&model.LifeTraceAIConversation{}),
		"feedbacks":         loadAdminLifeTraceCounts(&model.LifeTraceFeedback{}),
		"pushSubscriptions": loadAdminLifeTraceCounts(&model.LifeTracePushSubscription{}),
	} {
		counts := map[model.Int64String]int64{}
		mergeAdminLifeTraceCount(counts, latestByUser, rows)
		countsByKind[kind] = counts
	}

	var openPlanRows []adminLifeTraceCountRow
	_ = database.GetDB().
		Model(&model.LifeTracePlan{}).
		Select("user_id, COUNT(*) as total").
		Where("completed = ?", false).
		Group("user_id").
		Scan(&openPlanRows).Error
	openPlansByUser := map[model.Int64String]int64{}
	mergeAdminLifeTraceCount(openPlansByUser, latestByUser, openPlanRows)

	rows := make([]adminLifeTraceUserRow, 0, len(users))
	for _, user := range users {
		settings := settingsByUser[user.ID]
		var latest *time.Time
		if value, ok := latestByUser[user.ID]; ok {
			latest = &value
		}
		rows = append(rows, adminLifeTraceUserRow{
			UserID:            user.ID.String(),
			Nickname:          user.Nickname,
			Username:          user.Username,
			Avatar:            user.Avatar,
			Role:              user.Role,
			IsActive:          user.IsActive,
			City:              settings.City,
			CommuteMethod:     settings.CommuteMethod,
			DailyBriefTime:    settings.DailyBriefTime,
			NotificationReady: countsByKind["pushSubscriptions"][user.ID] > 0,
			Plans:             countsByKind["plans"][user.ID],
			OpenPlans:         openPlansByUser[user.ID],
			Traces:            countsByKind["traces"][user.ID],
			PantryItems:       countsByKind["pantryItems"][user.ID],
			Checkins:          countsByKind["checkins"][user.ID],
			WeeklyReviews:     countsByKind["weeklyReviews"][user.ID],
			AIConversations:   countsByKind["aiConversations"][user.ID],
			Feedbacks:         countsByKind["feedbacks"][user.ID],
			PushSubscriptions: countsByKind["pushSubscriptions"][user.ID],
			LatestActivityAt:  latest,
			CreatedAt:         user.CreatedAt,
		})
	}

	Success(c, gin.H{
		"list":     rows,
		"total":    total,
		"page":     page.Page,
		"pageSize": page.PageSize,
	})
}

func GetAdminLifeTraceOverview(c *gin.Context) {
	db := database.GetDB()
	overview := gin.H{}

	countTargets := map[string]any{
		"settings":             &model.LifeTraceSettings{},
		"plans":                &model.LifeTracePlan{},
		"checkins":             &model.LifeTraceCheckin{},
		"traces":               &model.LifeTraceTrace{},
		"pantryItems":          &model.LifeTracePantryItem{},
		"weeklyReviews":        &model.LifeTraceWeeklyReview{},
		"feedbacks":            &model.LifeTraceFeedback{},
		"aiConversations":      &model.LifeTraceAIConversation{},
		"aiMessages":           &model.LifeTraceAIMessage{},
		"pushSubscriptions":    &model.LifeTracePushSubscription{},
		"pushPlanDeliveries":   &model.LifeTracePushDelivery{},
		"pushDailyDeliveries":  &model.LifeTraceDailyBriefDelivery{},
		"pushPantryDeliveries": &model.LifeTracePantryReminderDelivery{},
		"households":           &model.Household{},
	}

	for key, target := range countTargets {
		var count int64
		if err := db.Model(target).Count(&count).Error; err != nil {
			Error(c, 500, "查询 Life Trace 概览失败")
			return
		}
		overview[key] = count
	}

	var openFeedbacks int64
	db.Model(&model.LifeTraceFeedback{}).Where("status = ?", "open").Count(&openFeedbacks)
	var openPlans int64
	db.Model(&model.LifeTracePlan{}).Where("completed = ?", false).Count(&openPlans)
	var expiredPantryItems int64
	db.Model(&model.LifeTracePantryItem{}).Where("status = ?", "expired").Count(&expiredPantryItems)
	var pushErrors int64
	var pushDeliveryErrors int64
	var dailyBriefDeliveryErrors int64
	var pantryDeliveryErrors int64
	db.Model(&model.LifeTracePushSubscription{}).
		Where("last_error <> ''").
		Count(&pushErrors)
	db.Model(&model.LifeTracePushDelivery{}).
		Where("error <> ''").
		Count(&pushDeliveryErrors)
	db.Model(&model.LifeTraceDailyBriefDelivery{}).
		Where("error <> ''").
		Count(&dailyBriefDeliveryErrors)
	db.Model(&model.LifeTracePantryReminderDelivery{}).
		Where("error <> ''").
		Count(&pantryDeliveryErrors)
	pushErrors += pushDeliveryErrors + dailyBriefDeliveryErrors + pantryDeliveryErrors

	overview["openFeedbacks"] = openFeedbacks
	overview["openPlans"] = openPlans
	overview["expiredPantryItems"] = expiredPantryItems
	overview["pushErrors"] = pushErrors

	Success(c, gin.H{"overview": overview})
}

func ListAdminLifeTraceRecords(c *gin.Context) {
	recordType := strings.TrimSpace(c.DefaultQuery("type", "plans"))
	switch recordType {
	case "plans":
		listAdminLifeTracePlans(c)
	case "traces":
		listAdminLifeTraceTraces(c)
	case "pantry":
		listAdminLifeTracePantryItems(c)
	case "checkins":
		listAdminLifeTraceCheckins(c)
	case "weekly-reviews":
		listAdminLifeTraceWeeklyReviews(c)
	case "ai-conversations":
		listAdminLifeTraceAIConversations(c)
	case "push-subscriptions":
		listAdminLifeTracePushSubscriptions(c)
	case "push-plan-deliveries":
		listAdminLifeTracePushPlanDeliveries(c)
	case "push-daily-deliveries":
		listAdminLifeTracePushDailyDeliveries(c)
	case "push-pantry-deliveries":
		listAdminLifeTracePushPantryDeliveries(c)
	default:
		Error(c, 400, "不支持的 Life Trace 记录类型")
	}
}

func finishAdminLifeTraceRecords(c *gin.Context, rows []adminLifeTraceRecordRow, total int64, page adminLifeTracePageParams) {
	Success(c, gin.H{
		"list":     rows,
		"total":    total,
		"page":     page.Page,
		"pageSize": page.PageSize,
	})
}

func listAdminLifeTracePlans(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTracePlan{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if status := strings.TrimSpace(c.Query("status")); status == "open" || status == "completed" {
		query = query.Where("completed = ?", status == "completed")
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR note LIKE ? OR location LIKE ?", like, like, like)
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询计划记录失败")
		return
	}
	var items []model.LifeTracePlan
	if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询计划记录失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		status := "open"
		if item.Completed {
			status = "completed"
		}
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "plans",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.Title,
			Status:    status,
			Source:    item.Source,
			TimeLabel: item.TimeLabel,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"type":          item.Type,
				"scheduledDate": item.ScheduledDate,
				"scheduledTime": item.ScheduledTime,
				"location":      item.Location,
				"reminder":      item.Reminder,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTraceTraces(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTraceTrace{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR summary LIKE ? OR location LIKE ?", like, like, like)
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询踪迹记录失败")
		return
	}
	var items []model.LifeTraceTrace
	if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询踪迹记录失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "traces",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.Title,
			Status:    item.Mood,
			Source:    item.Source,
			TimeLabel: item.TimeLabel,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"summary":  item.Summary,
				"location": item.Location,
				"tags":     item.Tags,
				"imageUrl": item.ImageURL,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTracePantryItems(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTracePantryItem{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR category LIKE ? OR location LIKE ? OR note LIKE ?", like, like, like, like)
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询库存记录失败")
		return
	}
	var items []model.LifeTracePantryItem
	if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询库存记录失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "pantry",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.Name,
			Status:    item.Status,
			Source:    item.Category,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"householdId": item.HouseholdID,
				"quantity":    item.Quantity,
				"unit":        item.Unit,
				"location":    item.Location,
				"expiresAt":   item.ExpiresAt,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTraceCheckins(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTraceCheckin{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询打卡记录失败")
		return
	}
	var items []model.LifeTraceCheckin
	if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询打卡记录失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		status := "open"
		if item.Completed {
			status = "completed"
		}
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "checkins",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.Name,
			Status:    status,
			TimeLabel: item.Date,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"completedAt": item.CompletedAt,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTraceWeeklyReviews(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTraceWeeklyReview{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("summary LIKE ? OR source LIKE ? OR model LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询周报记录失败")
		return
	}
	var items []model.LifeTraceWeeklyReview
	if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询周报记录失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "weekly-reviews",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.WeekStart + " - " + item.WeekEnd,
			Status:    item.Model,
			Source:    item.Source,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"summary":     item.Summary,
				"wins":        item.Wins,
				"delays":      item.Delays,
				"insights":    item.Insights,
				"nextActions": item.NextActions,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTraceAIConversations(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTraceAIConversation{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		query = query.Where("title LIKE ?", "%"+keyword+"%")
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询 AI 对话失败")
		return
	}
	var items []model.LifeTraceAIConversation
	if err := query.Order("updated_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询 AI 对话失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "ai-conversations",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     item.Title,
			Status:    item.Status,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail:    map[string]any{},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTracePushSubscriptions(c *gin.Context) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(&model.LifeTracePushSubscription{})
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询推送订阅失败")
		return
	}
	var items []model.LifeTracePushSubscription
	if err := query.Order("updated_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
		Error(c, 500, "查询推送订阅失败")
		return
	}

	userIDs := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		userIDs = append(userIDs, item.UserID)
	}
	users := loadAdminLifeTraceUsers(userIDs)
	rows := make([]adminLifeTraceRecordRow, 0, len(items))
	for _, item := range items {
		updatedAt := item.UpdatedAt
		rows = append(rows, adminLifeTraceRecordRow{
			ID:        item.ID.String(),
			Type:      "push-subscriptions",
			UserID:    item.UserID.String(),
			UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
			Title:     "推送订阅",
			Status:    item.Status,
			CreatedAt: item.CreatedAt,
			UpdatedAt: &updatedAt,
			Detail: map[string]any{
				"endpoint":   item.Endpoint,
				"userAgent":  item.UserAgent,
				"lastError":  item.LastError,
				"lastSentAt": item.LastSentAt,
			},
		})
	}
	finishAdminLifeTraceRecords(c, rows, total, page)
}

func listAdminLifeTracePushPlanDeliveries(c *gin.Context) {
	listAdminLifeTracePushDeliveries[model.LifeTracePushDelivery](c, "push-plan-deliveries", "planId")
}

func listAdminLifeTracePushDailyDeliveries(c *gin.Context) {
	listAdminLifeTracePushDeliveries[model.LifeTraceDailyBriefDelivery](c, "push-daily-deliveries", "briefDate")
}

func listAdminLifeTracePushPantryDeliveries(c *gin.Context) {
	listAdminLifeTracePushDeliveries[model.LifeTracePantryReminderDelivery](c, "push-pantry-deliveries", "pantryItemId")
}

func listAdminLifeTracePushDeliveries[T any](c *gin.Context, recordType string, targetLabel string) {
	page := parseAdminLifeTracePage(c)
	query := database.GetDB().Model(new(T))
	if userID, ok := parseAdminLifeTraceUserID(c); ok {
		query = query.Where("user_id = ?", userID)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	query = applyAdminLifeTraceDateFilters(query, c, "created_at")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		Error(c, 500, "查询推送记录失败")
		return
	}

	switch recordType {
	case "push-plan-deliveries":
		var items []model.LifeTracePushDelivery
		if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
			Error(c, 500, "查询推送记录失败")
			return
		}
		userIDs := make([]model.Int64String, 0, len(items))
		for _, item := range items {
			userIDs = append(userIDs, item.UserID)
		}
		users := loadAdminLifeTraceUsers(userIDs)
		rows := make([]adminLifeTraceRecordRow, 0, len(items))
		for _, item := range items {
			rows = append(rows, adminLifeTraceRecordRow{
				ID:        item.ID.String(),
				Type:      recordType,
				UserID:    item.UserID.String(),
				UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
				Title:     "计划推送 " + item.PlanID.String(),
				Status:    item.Status,
				CreatedAt: item.CreatedAt,
				Detail: map[string]any{
					targetLabel:      item.PlanID,
					"dueAt":          item.DueAt,
					"subscriptionId": item.SubscriptionID,
					"error":          item.Error,
				},
			})
		}
		finishAdminLifeTraceRecords(c, rows, total, page)
	case "push-daily-deliveries":
		var items []model.LifeTraceDailyBriefDelivery
		if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
			Error(c, 500, "查询推送记录失败")
			return
		}
		userIDs := make([]model.Int64String, 0, len(items))
		for _, item := range items {
			userIDs = append(userIDs, item.UserID)
		}
		users := loadAdminLifeTraceUsers(userIDs)
		rows := make([]adminLifeTraceRecordRow, 0, len(items))
		for _, item := range items {
			rows = append(rows, adminLifeTraceRecordRow{
				ID:        item.ID.String(),
				Type:      recordType,
				UserID:    item.UserID.String(),
				UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
				Title:     "每日简报 " + item.BriefDate,
				Status:    item.Status,
				CreatedAt: item.CreatedAt,
				Detail: map[string]any{
					targetLabel:      item.BriefDate,
					"scheduledAt":    item.ScheduledAt,
					"subscriptionId": item.SubscriptionID,
					"error":          item.Error,
				},
			})
		}
		finishAdminLifeTraceRecords(c, rows, total, page)
	case "push-pantry-deliveries":
		var items []model.LifeTracePantryReminderDelivery
		if err := query.Order("created_at DESC").Limit(page.PageSize).Offset(page.Offset).Find(&items).Error; err != nil {
			Error(c, 500, "查询推送记录失败")
			return
		}
		userIDs := make([]model.Int64String, 0, len(items))
		for _, item := range items {
			userIDs = append(userIDs, item.UserID)
		}
		users := loadAdminLifeTraceUsers(userIDs)
		rows := make([]adminLifeTraceRecordRow, 0, len(items))
		for _, item := range items {
			rows = append(rows, adminLifeTraceRecordRow{
				ID:        item.ID.String(),
				Type:      recordType,
				UserID:    item.UserID.String(),
				UserName:  adminLifeTraceUserName(users[item.UserID], item.UserID),
				Title:     "库存提醒 " + item.PantryItemID.String(),
				Status:    item.Status,
				Source:    item.Rule,
				CreatedAt: item.CreatedAt,
				Detail: map[string]any{
					targetLabel:      item.PantryItemID,
					"dueAt":          item.DueAt,
					"subscriptionId": item.SubscriptionID,
					"error":          item.Error,
				},
			})
		}
		finishAdminLifeTraceRecords(c, rows, total, page)
	}
}
