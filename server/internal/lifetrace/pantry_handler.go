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
	Name          string                `json:"name"`
	Category      string                `json:"category"`
	Tags          []string              `json:"tags"`
	Quantity      int                   `json:"quantity"`
	Unit          string                `json:"unit"`
	Location      string                `json:"location"`
	ExpiresAt     string                `json:"expiresAt"`
	OpenedAt      string                `json:"openedAt"`
	Note          string                `json:"note"`
	ImageURL      string                `json:"imageUrl"`
	ThumbnailURL  string                `json:"thumbnailUrl"`
	BarcodeValue  string                `json:"barcodeValue"`
	BarcodeFormat string                `json:"barcodeFormat"`
	Status        string                `json:"status"`
	Reminder      pantryReminderPayload `json:"reminder"`
}

type updatePantryStatusRequest struct {
	Status string `json:"status"`
}

type consumePantryItemRequest struct {
	Action   string `json:"action"`
	Quantity int    `json:"quantity"`
}

type pantryListSummary struct {
	Total    int64 `json:"total"`
	Expiring int64 `json:"expiring"`
	Expired  int64 `json:"expired"`
	Active   int64 `json:"active"`
}

type pantryBarcodeMatchResponse struct {
	Matched       bool              `json:"matched"`
	Source        string            `json:"source,omitempty"`
	MatchedItemID model.Int64String `json:"matchedItemId,omitempty"`
	HouseholdID   model.Int64String `json:"householdId,omitempty"`
	Name          string            `json:"name,omitempty"`
	Category      string            `json:"category,omitempty"`
	Unit          string            `json:"unit,omitempty"`
	Location      string            `json:"location,omitempty"`
	BarcodeValue  string            `json:"barcodeValue,omitempty"`
	BarcodeFormat string            `json:"barcodeFormat,omitempty"`
	UpdatedAt     time.Time         `json:"updatedAt,omitempty"`
}

type pantryItemDetailResponse struct {
	Item      model.LifeTracePantryItem `json:"item"`
	Household householdSummary          `json:"household"`
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
	"kept":      true,
	"used-up":   true,
	"discarded": true,
}

var validPantrySorts = map[string]bool{
	"expiry-asc":   true,
	"created-desc": true,
	"expiry-desc":  true,
}

func normalizePantryCategory(category string) string {
	category = strings.TrimSpace(category)
	if !validPantryCategories[category] {
		return "食品"
	}
	return category
}

func normalizePantryTags(tags []string) model.StringList {
	seen := map[string]bool{}
	normalized := model.StringList{}
	for _, tag := range tags {
		value := strings.TrimSpace(tag)
		if value == "" {
			continue
		}
		if len([]rune(value)) > 16 {
			value = string([]rune(value)[:16])
		}
		if seen[value] {
			continue
		}
		seen[value] = true
		normalized = append(normalized, value)
		if len(normalized) >= 8 {
			break
		}
	}
	return normalized
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

func normalizePantrySort(sort string) string {
	sort = strings.TrimSpace(sort)
	if !validPantrySorts[sort] {
		return "expiry-asc"
	}
	return sort
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

func normalizePantryBarcodeValue(value string) string {
	value = strings.TrimSpace(value)
	return strings.Join(strings.Fields(value), "")
}

func normalizePantryBarcodeFormat(format string) string {
	format = strings.ToLower(strings.TrimSpace(format))
	format = strings.ReplaceAll(format, "-", "_")
	switch format {
	case "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code":
		return format
	case "":
		return ""
	default:
		return "unknown"
	}
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

type pantryTraceOptions struct {
	Action              string
	QuantityDelta       int
	TargetHouseholdName string
	SourceHouseholdName string
	Moved               bool
	Merged              bool
}

func formatPantryTraceQuantity(quantity int, unit string) string {
	return strconv.Itoa(normalizePantryQuantity(quantity)) + normalizePantryUnit(unit)
}

func buildPantryTraceRecord(
	userID model.Int64String,
	item model.LifeTracePantryItem,
	options pantryTraceOptions,
	now time.Time,
) model.LifeTraceTrace {
	trace := model.LifeTraceTrace{
		UserID:       userID,
		PantryItemID: &item.ID,
		Location:     truncatePantryTraceText(item.Location, 120),
		ImageURL:     truncatePantryTraceText(item.ImageURL, 800),
		TimeLabel:    formatPantryTraceTime(now),
		Source:       "库存",
	}

	quantityText := formatPantryTraceQuantity(item.Quantity, item.Unit)
	deltaText := formatPantryTraceQuantity(options.QuantityDelta, item.Unit)
	householdName := strings.TrimSpace(options.TargetHouseholdName)
	if householdName == "" {
		householdName = "我的空间"
	}
	expiryText := ""
	if item.ExpiresAt != "" {
		expiryText = "，保质期到 " + item.ExpiresAt
	}

	switch options.Action {
	case "used":
		trace.Title = truncatePantryTraceText("使用库存："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已使用「"+item.Name+"」"+deltaText+"，剩余 "+quantityText+"。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "使用"})
	case "discarded-partial":
		trace.Title = truncatePantryTraceText("丢弃库存："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已丢弃「"+item.Name+"」"+deltaText+"，剩余 "+quantityText+"。",
			1000,
		)
		trace.Mood = "提醒"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "丢弃"})
	case "used-up":
		trace.Title = truncatePantryTraceText("已用完："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已将「"+item.Name+"」标记为已用完，处理数量为 "+quantityText+"。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "用完"})
	case "discarded":
		trace.Title = truncatePantryTraceText("已丢弃："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已将「"+item.Name+"」标记为已丢弃，处理数量为 "+quantityText+"。",
			1000,
		)
		trace.Mood = "提醒"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "丢弃"})
	case "edited":
		trace.Title = truncatePantryTraceText("编辑库存："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已更新「"+item.Name+"」的库存信息，当前数量为 "+quantityText+expiryText+"。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "编辑"})
	case "transfer-created":
		trace.Title = truncatePantryTraceText("转移到共享家庭："+item.Name, 160)
		summary := "已将「" + item.Name + "」" + quantityText + "转移到「" + householdName + "」"
		if options.Moved {
			summary += "，并从个人空间移出"
		}
		summary += "。"
		trace.Summary = truncatePantryTraceText(summary, 1000)
		trace.Mood = "踏实"
		tags := []string{item.Category, "家庭库存", "转移到共享家庭"}
		if options.Moved {
			tags = append(tags, "从个人空间移出")
		}
		trace.Tags = normalizeTraceTags(tags)
	case "transfer-merged":
		trace.Title = truncatePantryTraceText("合并数量："+item.Name, 160)
		summary := "已将「" + item.Name + "」数量 +" + deltaText + " 合并到「" + householdName + "」"
		if options.Moved {
			summary += "，并从个人空间移出原条目"
		}
		summary += "；当前共 " + quantityText + "。"
		trace.Summary = truncatePantryTraceText(summary, 1000)
		trace.Mood = "踏实"
		tags := []string{item.Category, "家庭库存", "合并数量", "转移到共享家庭"}
		if options.Moved {
			tags = append(tags, "从个人空间移出")
		}
		trace.Tags = normalizeTraceTags(tags)
	default:
		trace.Title = truncatePantryTraceText("新增库存："+item.Name, 160)
		trace.Summary = truncatePantryTraceText(
			"已将「"+item.Name+"」新增到「"+householdName+"」，数量为 "+quantityText+expiryText+"。",
			1000,
		)
		trace.Mood = "踏实"
		trace.Tags = normalizeTraceTags([]string{item.Category, "家庭库存", "新增库存"})
	}

	return trace
}

func writePantryTrace(userID model.Int64String, item model.LifeTracePantryItem, options pantryTraceOptions) {
	trace := buildPantryTraceRecord(userID, item, options, time.Now())
	if err := database.GetDB().Create(&trace).Error; err != nil && logger.Log != nil {
		logger.Log.WithFields(map[string]interface{}{
			"userId":         userID.String(),
			"pantryItemId":   item.ID.String(),
			"pantryAction":   options.Action,
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
		query = query.
			Where("status NOT IN ?", []string{"used-up", "discarded"}).
			Where("expires_at <> ''")
	} else if status == "no-expiry" {
		query = query.
			Where("status NOT IN ?", []string{"used-up", "discarded"}).
			Where("expires_at = '' OR expires_at IS NULL")
	} else if validPantryStatuses[status] {
		today, expiringDeadline := pantryDerivedDateBounds(time.Now())
		switch status {
		case "used-up", "discarded", "kept":
			query = query.Where("status = ?", status)
		case "expired":
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded", "kept"}).
				Where("expires_at <> '' AND expires_at < ?", today)
		case "expiring":
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded", "kept"}).
				Where("expires_at <> '' AND expires_at >= ? AND expires_at <= ?", today, expiringDeadline)
		default:
			query = query.
				Where("status NOT IN ?", []string{"used-up", "discarded", "kept"}).
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
		query = query.Where("(name LIKE ? OR note LIKE ? OR location LIKE ? OR tags LIKE ?)", like, like, like, like)
	}

	return query
}

func applyPantryListOrdering(query *gorm.DB, now time.Time, sort string) *gorm.DB {
	switch normalizePantrySort(sort) {
	case "created-desc":
		return query.
			Order("created_at DESC").
			Order("updated_at DESC")
	case "expiry-desc":
		return query.
			Order(clause.Expr{SQL: "CASE WHEN expires_at = '' OR expires_at IS NULL THEN 1 ELSE 0 END"}).
			Order("expires_at DESC").
			Order("updated_at DESC").
			Order("created_at DESC")
	}

	today, expiringDeadline := pantryDerivedDateBounds(now)
	priorityExpr := clause.Expr{
		SQL: `
CASE
	WHEN status = 'used-up' THEN 3
	WHEN status = 'discarded' THEN 4
	WHEN status = 'kept' THEN 2
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
COUNT(CASE WHEN status NOT IN ('used-up', 'discarded', 'kept') AND expires_at <> '' AND expires_at >= ? AND expires_at <= ? THEN 1 END) AS expiring,
COUNT(CASE WHEN status NOT IN ('used-up', 'discarded', 'kept') AND expires_at <> '' AND expires_at < ? THEN 1 END) AS expired
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
	if err := applyPantryListOrdering(baseQuery, now, c.Query("sort")).
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

func (h *Handler) GetPantryItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, householdCtx, found := findAccessiblePantryItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "库存不存在")
		return
	}

	memberCount, err := activeHouseholdMemberCount(householdCtx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取库存失败")
		return
	}

	success(c, pantryItemDetailResponse{
		Item:      item,
		Household: householdSummaryFromContext(householdCtx, memberCount),
	})
}

func (h *Handler) ListPantryItemTimeline(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, _, found := findAccessiblePantryItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "库存不存在")
		return
	}

	likeName := "%" + item.Name + "%"
	query := database.GetDB().
		Where("source = ?", "库存").
		Where(
			"pantry_item_id = ? OR (user_id = ? AND pantry_item_id IS NULL AND (title LIKE ? OR summary LIKE ?))",
			item.ID,
			userID,
			likeName,
			likeName,
		)

	var traces []model.LifeTraceTrace
	if err := query.
		Order("created_at DESC").
		Limit(50).
		Find(&traces).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取库存时间线失败")
		return
	}

	success(c, gin.H{
		"itemId": item.ID,
		"list":   traces,
	})
}

func (h *Handler) LookupPantryBarcodeMatch(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	barcodeValue := normalizePantryBarcodeValue(c.Query("barcodeValue"))
	barcodeFormat := normalizePantryBarcodeFormat(c.Query("barcodeFormat"))
	if barcodeValue == "" {
		success(c, pantryBarcodeMatchResponse{Matched: false})
		return
	}

	query := database.GetDB().
		Where("household_id = ? AND barcode_value = ?", householdCtx.Household.ID, barcodeValue)
	if barcodeFormat != "" {
		query = query.Where("barcode_format = ?", barcodeFormat)
	}

	var item model.LifeTracePantryItem
	if err := query.
		Order("updated_at DESC").
		Order("created_at DESC").
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			success(c, pantryBarcodeMatchResponse{Matched: false})
			return
		}
		fail(c, http.StatusInternalServerError, "查询包装编码失败")
		return
	}

	success(c, pantryBarcodeMatchResponse{
		Matched:       true,
		Source:        "pantry-history",
		MatchedItemID: item.ID,
		HouseholdID:   item.HouseholdID,
		Name:          item.Name,
		Category:      item.Category,
		Unit:          item.Unit,
		Location:      item.Location,
		BarcodeValue:  item.BarcodeValue,
		BarcodeFormat: item.BarcodeFormat,
		UpdatedAt:     item.UpdatedAt,
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
		Tags:               normalizePantryTags(req.Tags),
		Quantity:           normalizePantryQuantity(req.Quantity),
		Unit:               normalizePantryUnit(req.Unit),
		Location:           normalizePantryLocation(req.Location),
		ExpiresAt:          expiresAt,
		OpenedAt:           normalizePantryDate(req.OpenedAt),
		Note:               strings.TrimSpace(req.Note),
		ImageURL:           strings.TrimSpace(req.ImageURL),
		ThumbnailURL:       strings.TrimSpace(req.ThumbnailURL),
		BarcodeValue:       normalizePantryBarcodeValue(req.BarcodeValue),
		BarcodeFormat:      normalizePantryBarcodeFormat(req.BarcodeFormat),
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
	writePantryTrace(userID, item, pantryTraceOptions{
		Action:              "created",
		TargetHouseholdName: householdCtx.Household.Name,
	})

	evaluateAchievementsQuietly(userID)
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
		"tags":                 normalizePantryTags(req.Tags),
		"quantity":             normalizePantryQuantity(req.Quantity),
		"unit":                 normalizePantryUnit(req.Unit),
		"location":             normalizePantryLocation(req.Location),
		"expires_at":           expiresAt,
		"opened_at":            normalizePantryDate(req.OpenedAt),
		"note":                 strings.TrimSpace(req.Note),
		"image_url":            strings.TrimSpace(req.ImageURL),
		"thumbnail_url":        strings.TrimSpace(req.ThumbnailURL),
		"barcode_value":        normalizePantryBarcodeValue(req.BarcodeValue),
		"barcode_format":       normalizePantryBarcodeFormat(req.BarcodeFormat),
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
	writePantryTrace(userID, item, pantryTraceOptions{
		Action:              "edited",
		TargetHouseholdName: householdCtx.Household.Name,
	})
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
		writePantryTrace(userID, item, pantryTraceOptions{
			Action:              status,
			TargetHouseholdName: householdCtx.Household.Name,
		})
	}

	evaluateAchievementsQuietly(userID)
	success(c, item)
}

func normalizePantryConsumeAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "used", "discarded":
		return strings.ToLower(strings.TrimSpace(action))
	default:
		return ""
	}
}

func (h *Handler) ConsumePantryItem(c *gin.Context) {
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
	if item.Status == "used-up" || item.Status == "discarded" {
		fail(c, http.StatusBadRequest, "库存已处理")
		return
	}

	var req consumePantryItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	action := normalizePantryConsumeAction(req.Action)
	if action == "" || req.Quantity <= 0 {
		fail(c, http.StatusBadRequest, "处理数量无效")
		return
	}

	currentQuantity := normalizePantryQuantity(item.Quantity)
	consumeQuantity := req.Quantity
	if consumeQuantity >= currentQuantity {
		status := "used-up"
		if action == "discarded" {
			status = "discarded"
		}
		if err := database.GetDB().Model(&item).Updates(map[string]interface{}{
			"status":     status,
			"updated_by": userID,
		}).Error; err != nil {
			fail(c, http.StatusInternalServerError, "更新库存失败")
			return
		}
		resetPantryReminderDeliveries(nil, item.ID)
		if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
			fail(c, http.StatusInternalServerError, "读取库存失败")
			return
		}
		writePantryTrace(userID, item, pantryTraceOptions{
			Action:              status,
			TargetHouseholdName: householdCtx.Household.Name,
		})
		evaluateAchievementsQuietly(userID)
		success(c, item)
		return
	}

	remainingQuantity := currentQuantity - consumeQuantity
	if err := database.GetDB().Model(&item).Updates(map[string]interface{}{
		"quantity":   remainingQuantity,
		"status":     "normal",
		"updated_by": userID,
	}).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新库存失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取库存失败")
		return
	}

	traceAction := "used"
	if action == "discarded" {
		traceAction = "discarded-partial"
	}
	writePantryTrace(userID, item, pantryTraceOptions{
		Action:              traceAction,
		QuantityDelta:       consumeQuantity,
		TargetHouseholdName: householdCtx.Household.Name,
	})
	evaluateAchievementsQuietly(userID)
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

func findAccessiblePantryItem(
	id string,
	userID model.Int64String,
) (model.LifeTracePantryItem, householdContext, bool) {
	if _, _, err := ensurePersonalHousehold(userID); err != nil {
		return model.LifeTracePantryItem{}, householdContext{}, false
	}

	var item model.LifeTracePantryItem
	err := database.GetDB().
		First(&item, "id = ?", strings.TrimSpace(id)).Error
	if err != nil {
		return model.LifeTracePantryItem{}, householdContext{}, false
	}

	ctx, err := resolveAccessibleHouseholdContext(userID, item.HouseholdID)
	if err != nil {
		return model.LifeTracePantryItem{}, householdContext{}, false
	}

	return item, ctx, true
}

func resetPantryReminderDeliveries(tx *gorm.DB, pantryItemID model.Int64String) {
	if tx == nil {
		tx = database.GetDB()
	}
	_ = tx.Unscoped().
		Where("pantry_item_id = ?", pantryItemID).
		Delete(&model.LifeTracePantryReminderDelivery{}).Error
}
