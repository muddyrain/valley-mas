package lifetrace

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type pantryReminderPayload struct {
	Enabled      bool     `json:"enabled"`
	UseDefault   bool     `json:"useDefault"`
	Rules        []string `json:"rules"`
	ReminderTime string   `json:"reminderTime"`
}

type createPantryItemRequest struct {
	Name         string                `json:"name"`
	Category     string                `json:"category"`
	Quantity     int                   `json:"quantity"`
	Unit         string                `json:"unit"`
	Location     string                `json:"location"`
	ExpiresAt    string                `json:"expiresAt"`
	OpenedAt     string                `json:"openedAt"`
	Note         string                `json:"note"`
	ImageURL     string                `json:"imageUrl"`
	ThumbnailURL string                `json:"thumbnailUrl"`
	Status       string                `json:"status"`
	Reminder     pantryReminderPayload `json:"reminder"`
}

type updatePantryStatusRequest struct {
	Status string `json:"status"`
}

type pantryListSummary struct {
	Total    int64 `json:"total"`
	Expiring int64 `json:"expiring"`
	Expired  int64 `json:"expired"`
	Active   int64 `json:"active"`
}

var validPantryCategories = map[string]bool{
	"食品":  true,
	"日用品": true,
	"药品":  true,
	"宠物":  true,
	"其他":  true,
}

var validPantryLocations = map[string]bool{
	"冷藏":  true,
	"冷冻":  true,
	"厨房":  true,
	"储物柜": true,
	"卫生间": true,
	"玄关":  true,
	"其他":  true,
}

var validPantryStatuses = map[string]bool{
	"normal":    true,
	"expiring":  true,
	"expired":   true,
	"used-up":   true,
	"discarded": true,
}

func normalizePantryCategory(category string) string {
	category = strings.TrimSpace(category)
	if !validPantryCategories[category] {
		return "食品"
	}
	return category
}

func normalizePantryLocation(location string) string {
	location = strings.TrimSpace(location)
	if !validPantryLocations[location] {
		return "冷藏"
	}
	return location
}

func normalizePantryStatus(status string) string {
	status = strings.TrimSpace(status)
	if !validPantryStatuses[status] {
		return "normal"
	}
	return status
}

func normalizePantryDate(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if _, err := time.Parse("2006-01-02", value); err != nil {
		return ""
	}
	return value
}

func normalizePantryUnit(unit string) string {
	unit = strings.TrimSpace(unit)
	if unit == "" {
		return "件"
	}
	return unit
}

func normalizePantryQuantity(quantity int) int {
	if quantity <= 0 {
		return 1
	}
	return quantity
}

func normalizePantryReminder(payload pantryReminderPayload) (bool, bool, model.StringList, string) {
	return payload.Enabled, payload.UseDefault, normalizePantryReminderRules(payload.Rules), normalizeTimeText(payload.ReminderTime, "09:00")
}

func truncatePantryTraceText(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit])
}

func formatPantryTraceTime(now time.Time) string {
	return now.Format("01/02 15:04")
}

func buildPantryTraceRecord(userID model.Int64String, item model.LifeTracePantryItem, action string, now time.Time) model.LifeTraceTrace {
	expiryText := ""
	if item.ExpiresAt != "" {
		expiryText = "，保质期记录到 " + item.ExpiresAt
	}

	trace := model.LifeTraceTrace{
		UserID:    userID,
		Location:  truncatePantryTraceText(item.Location, 120),
		ImageURL:  truncatePantryTraceText(item.ImageURL, 800),
		TimeLabel: formatPantryTraceTime(now),
		Source:    "库存",
	}

	switch action {
	case "used-up":
		trace.Title = truncatePantryTraceText(item.Name+" 已用完", 160)
		trace.Summary = truncatePantryTraceText(
			"Life Trace 记录了「"+item.Name+"」已经处理完成，这次属于家庭库存的正常消耗。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "用完"})
	case "discarded":
		trace.Title = truncatePantryTraceText(item.Name+" 已丢弃", 160)
		trace.Summary = truncatePantryTraceText(
			"Life Trace 记录了「"+item.Name+"」已经被丢弃，后续可以结合库存提醒减少浪费。",
			1000,
		)
		trace.Mood = "提醒"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "丢弃"})
	default:
		trace.Title = truncatePantryTraceText("新增库存："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"Life Trace 已将「"+item.Name+"」加入家庭库存，数量为 "+strconv.Itoa(item.Quantity)+item.Unit+expiryText+"。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "新增库存"})
	}

	return trace
}

func writePantryTrace(userID model.Int64String, item model.LifeTracePantryItem, action string) {
	trace := buildPantryTraceRecord(userID, item, action, time.Now())
	if err := database.GetDB().Create(&trace).Error; err != nil && logger.Log != nil {
		logger.Log.WithFields(map[string]interface{}{
			"userId":         userID.String(),
			"pantryItemId":   item.ID.String(),
			"pantryAction":   action,
			"pantryName":     item.Name,
			"pantryCategory": item.Category,
		}).WithError(err).Warn("LifeTrace pantry trace journaling failed")
	}
}

func pantryDerivedDateBounds(now time.Time) (string, string) {
	today := now.Format("2006-01-02")
	expiringDeadline := now.AddDate(0, 0, 7).Format("2006-01-02")
	return today, expiringDeadline
}

func applyPantryListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	status := strings.TrimSpace(c.Query("status"))
	if status == "" || status == "all" {
		query = query.Where("status NOT IN ?", []string{"used-up", "discarded"})
	} else if validPantryStatuses[status] {
		today, expiringDeadline := pantryDerivedDateBounds(time.Now())
		switch status {
		case "used-up", "discarded":
			query = query.Where("status = ?", status)
		case "expired":
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded"}).
				Where("expires_at <> '' AND expires_at < ?", today)
		case "expiring":
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded"}).
				Where("expires_at <> '' AND expires_at >= ? AND expires_at <= ?", today, expiringDeadline)
		default:
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded"}).
				Where("(expires_at = '' OR expires_at IS NULL OR expires_at > ?)", expiringDeadline)
		}
	}

	category := strings.TrimSpace(c.Query("category"))
	if validPantryCategories[category] {
		query = query.Where("category = ?", category)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(name LIKE ? OR note LIKE ? OR location LIKE ?)", like, like, like)
	}

	return query
}

func applyPantryListOrdering(query *gorm.DB, now time.Time) *gorm.DB {
	today, expiringDeadline := pantryDerivedDateBounds(now)
	priorityExpr := clause.Expr{
		SQL: `
CASE
	WHEN status = 'used-up' THEN 3
	WHEN status = 'discarded' THEN 4
	WHEN expires_at <> '' AND expires_at < ? THEN 0
	WHEN expires_at <> '' AND expires_at >= ? AND expires_at <= ? THEN 1
	ELSE 2
END
`,
		Vars: []interface{}{today, today, expiringDeadline},
	}

	return query.
		Order(priorityExpr).
		Order(clause.Expr{SQL: "CASE WHEN expires_at = '' OR expires_at IS NULL THEN 1 ELSE 0 END"}).
		Order("expires_at ASC").
		Order("updated_at DESC").
		Order("created_at DESC")
}

func buildPantryListSummary(householdID model.Int64String, now time.Time) (pantryListSummary, error) {
	today, expiringDeadline := pantryDerivedDateBounds(now)
	var summary pantryListSummary
	err := database.GetDB().
		Model(&model.LifeTracePantryItem{}).
		Where("household_id = ?", householdID).
		Select(`
COUNT(CASE WHEN status NOT IN ('used-up', 'discarded') THEN 1 END) AS total,
COUNT(CASE WHEN status NOT IN ('used-up', 'discarded') AND expires_at <> '' AND expires_at >= ? AND expires_at <= ? THEN 1 END) AS expiring,
COUNT(CASE WHEN status NOT IN ('used-up', 'discarded') AND expires_at <> '' AND expires_at < ? THEN 1 END) AS expired
`, today, expiringDeadline, today).
		Scan(&summary).Error
	if err != nil {
		return pantryListSummary{}, err
	}
	summary.Active = summary.Total - summary.Expired
	if summary.Active < 0 {
		summary.Active = 0
	}
	return summary, nil
}

func (h *Handler) ListPantryItems(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	baseQuery := database.GetDB().Model(&model.LifeTracePantryItem{}).Where("household_id = ?", householdCtx.Household.ID)
	baseQuery = applyPantryListFilters(baseQuery, c)
	now := time.Now()

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取库存失败")
		return
	}

	var items []model.LifeTracePantryItem
	if err := applyPantryListOrdering(baseQuery, now).
		Limit(pageSize).
		Offset(offset).
		Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取库存失败")
		return
	}

	summary, err := buildPantryListSummary(householdCtx.Household.ID, now)
	if err != nil {
		fail(c, http.StatusInternalServerError, "获取库存失败")
		return
	}

	success(c, gin.H{
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"list":          items,
		"pagination":    buildListPagination(page, pageSize, total),
		"summary":       summary,
	})
}

func (h *Handler) CreatePantryItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createPantryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "商品名称不能为空")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	expiresAt := normalizePantryDate(req.ExpiresAt)
	reminderEnabled, reminderUseDefault, reminderRules, reminderTime := normalizePantryReminder(req.Reminder)
	if expiresAt == "" {
		reminderEnabled = false
	}
	item := model.LifeTracePantryItem{
		UserID:             userID,
		HouseholdID:        householdCtx.Household.ID,
		Name:               name,
		Category:           normalizePantryCategory(req.Category),
		Quantity:           normalizePantryQuantity(req.Quantity),
		Unit:               normalizePantryUnit(req.Unit),
		Location:           normalizePantryLocation(req.Location),
		ExpiresAt:          expiresAt,
		OpenedAt:           normalizePantryDate(req.OpenedAt),
		Note:               strings.TrimSpace(req.Note),
		ImageURL:           strings.TrimSpace(req.ImageURL),
		ThumbnailURL:       strings.TrimSpace(req.ThumbnailURL),
		Status:             normalizePantryStatus(req.Status),
		CreatedBy:          userID,
		UpdatedBy:          userID,
		ReminderEnabled:    reminderEnabled,
		ReminderUseDefault: reminderUseDefault,
		ReminderRules:      reminderRules,
		ReminderTime:       reminderTime,
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建库存失败")
		return
	}
	if !reminderEnabled {
		if err := database.GetDB().Model(&item).UpdateColumn("reminder_enabled", false).Error; err != nil {
			fail(c, http.StatusInternalServerError, "创建库存失败")
			return
		}
		item.ReminderEnabled = false
	}
	writePantryTrace(userID, item, "created")

	success(c, item)
}

func (h *Handler) UpdatePantryItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findPantryItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "库存不存在")
		return
	}

	var req createPantryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "商品名称不能为空")
		return
	}

	expiresAt := normalizePantryDate(req.ExpiresAt)
	reminderEnabled, reminderUseDefault, reminderRules, reminderTime := normalizePantryReminder(req.Reminder)
	if expiresAt == "" {
		reminderEnabled = false
	}
	updates := map[string]interface{}{
		"name":                 name,
		"category":             normalizePantryCategory(req.Category),
		"quantity":             normalizePantryQuantity(req.Quantity),
		"unit":                 normalizePantryUnit(req.Unit),
		"location":             normalizePantryLocation(req.Location),
		"expires_at":           expiresAt,
		"opened_at":            normalizePantryDate(req.OpenedAt),
		"note":                 strings.TrimSpace(req.Note),
		"image_url":            strings.TrimSpace(req.ImageURL),
		"thumbnail_url":        strings.TrimSpace(req.ThumbnailURL),
		"status":               normalizePantryStatus(req.Status),
		"updated_by":           userID,
		"reminder_enabled":     reminderEnabled,
		"reminder_use_default": reminderUseDefault,
		"reminder_rules":       reminderRules,
		"reminder_time":        reminderTime,
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新库存失败")
		return
	}
	resetPantryReminderDeliveries(nil, item.ID)

	if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取库存失败")
		return
	}
	success(c, item)
}

func (h *Handler) UpdatePantryItemStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findPantryItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "库存不存在")
		return
	}

	var req updatePantryStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	status := normalizePantryStatus(req.Status)
	if err := database.GetDB().Model(&item).Updates(map[string]interface{}{
		"status":     status,
		"updated_by": userID,
	}).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新库存状态失败")
		return
	}
	resetPantryReminderDeliveries(nil, item.ID)

	if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取库存失败")
		return
	}
	if status == "used-up" || status == "discarded" {
		writePantryTrace(userID, item, status)
	}

	success(c, item)
}

func (h *Handler) DeletePantryItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findPantryItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "库存不存在")
		return
	}

	if err := database.GetDB().Delete(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除库存失败")
		return
	}
	resetPantryReminderDeliveries(nil, item.ID)

	success(c, gin.H{"id": item.ID})
}

func findPantryItem(id string, householdID model.Int64String) (model.LifeTracePantryItem, bool) {
	var item model.LifeTracePantryItem
	err := database.GetDB().First(&item, "id = ? AND household_id = ?", id, householdID).Error
	if err == nil {
		return item, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, false
	}
	return item, false
}

func resetPantryReminderDeliveries(tx *gorm.DB, pantryItemID model.Int64String) {
	if tx == nil {
		tx = database.GetDB()
	}
	_ = tx.Unscoped().
		Where("pantry_item_id = ?", pantryItemID).
		Delete(&model.LifeTracePantryReminderDelivery{}).Error
}
