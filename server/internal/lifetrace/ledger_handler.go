package lifetrace

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ledgerEntryRequest struct {
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Direction    string  `json:"direction"`
	Category     string  `json:"category"`
	OccurredAt   string  `json:"occurredAt"`
	Merchant     string  `json:"merchant"`
	Location     string  `json:"location"`
	Note         string  `json:"note"`
	ImageURL     string  `json:"imageUrl"`
	InboxItemID  string  `json:"inboxItemId"`
	PlanID       string  `json:"planId"`
	TraceID      string  `json:"traceId"`
	PantryItemID string  `json:"pantryItemId"`
}

type ledgerEntryResponse struct {
	model.LifeTraceLedgerEntry
	Amount float64 `json:"amount"`
}

type ledgerCategorySummary struct {
	Category    string  `json:"category"`
	AmountCents int64   `json:"amountCents"`
	Amount      float64 `json:"amount"`
	Count       int64   `json:"count"`
}

type ledgerSummary struct {
	Month        string                  `json:"month"`
	ExpenseCents int64                   `json:"expenseCents"`
	IncomeCents  int64                   `json:"incomeCents"`
	RefundCents  int64                   `json:"refundCents"`
	NetCents     int64                   `json:"netCents"`
	Expense      float64                 `json:"expense"`
	Income       float64                 `json:"income"`
	Refund       float64                 `json:"refund"`
	Net          float64                 `json:"net"`
	Categories   []ledgerCategorySummary `json:"categories"`
}

var validLedgerDirections = map[string]bool{
	"支出":   true,
	"收入":   true,
	"退款":   true,
	"转账备注": true,
}

var validLedgerCategories = map[string]bool{
	"吃饭":  true,
	"交通":  true,
	"购物":  true,
	"书影音": true,
	"订阅":  true,
	"家用":  true,
	"礼物":  true,
	"医疗":  true,
	"其他":  true,
}

func ledgerEntryToResponse(entry model.LifeTraceLedgerEntry) ledgerEntryResponse {
	return ledgerEntryResponse{
		LifeTraceLedgerEntry: entry,
		Amount:               centsToAmount(entry.AmountCents),
	}
}

func centsToAmount(cents int64) float64 {
	return float64(cents) / 100
}

func amountToCents(amount float64) int64 {
	return int64(math.Round(amount * 100))
}

func normalizeLedgerCurrency(currency string) string {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		return "CNY"
	}
	if len(currency) > 8 {
		return currency[:8]
	}
	return currency
}

func parseLedgerMonth(raw string) (string, time.Time, time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		now := time.Now()
		raw = now.Format("2006-01")
	}
	start, err := time.ParseInLocation("2006-01", raw, time.Local)
	if err != nil {
		return "", time.Time{}, time.Time{}, false
	}
	return raw, start, start.AddDate(0, 1, 0), true
}

func parseLedgerTime(raw string) (time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now(), true
	}
	value, err := time.Parse(time.RFC3339, raw)
	if err == nil {
		return value, true
	}
	value, err = time.ParseInLocation("2006-01-02 15:04", raw, time.Local)
	if err == nil {
		return value, true
	}
	value, err = time.ParseInLocation("2006-01-02", raw, time.Local)
	return value, err == nil
}

func parseOptionalLedgerID(raw string) (*model.Int64String, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, false
	}
	value := model.Int64String(id)
	return &value, true
}

func buildLedgerEntryFromRequest(req ledgerEntryRequest, userID model.Int64String) (model.LifeTraceLedgerEntry, string, bool) {
	amountCents := amountToCents(req.Amount)
	if amountCents <= 0 {
		return model.LifeTraceLedgerEntry{}, "账目金额不正确", false
	}
	if amountCents > 999999999999 {
		return model.LifeTraceLedgerEntry{}, "账目金额过大", false
	}

	direction := strings.TrimSpace(req.Direction)
	if !validLedgerDirections[direction] {
		return model.LifeTraceLedgerEntry{}, "账目方向不正确", false
	}

	category := strings.TrimSpace(req.Category)
	if !validLedgerCategories[category] {
		return model.LifeTraceLedgerEntry{}, "账目分类不正确", false
	}

	occurredAt, ok := parseLedgerTime(req.OccurredAt)
	if !ok {
		return model.LifeTraceLedgerEntry{}, "账目时间不正确", false
	}

	inboxItemID, ok := parseOptionalLedgerID(req.InboxItemID)
	if !ok {
		return model.LifeTraceLedgerEntry{}, "Inbox 关联不正确", false
	}
	planID, ok := parseOptionalLedgerID(req.PlanID)
	if !ok {
		return model.LifeTraceLedgerEntry{}, "计划关联不正确", false
	}
	traceID, ok := parseOptionalLedgerID(req.TraceID)
	if !ok {
		return model.LifeTraceLedgerEntry{}, "踪迹关联不正确", false
	}
	pantryItemID, ok := parseOptionalLedgerID(req.PantryItemID)
	if !ok {
		return model.LifeTraceLedgerEntry{}, "库存关联不正确", false
	}

	return model.LifeTraceLedgerEntry{
		UserID:       userID,
		AmountCents:  amountCents,
		Currency:     normalizeLedgerCurrency(req.Currency),
		Direction:    direction,
		Category:     category,
		OccurredAt:   occurredAt,
		Merchant:     strings.TrimSpace(req.Merchant),
		Location:     strings.TrimSpace(req.Location),
		Note:         strings.TrimSpace(req.Note),
		ImageURL:     strings.TrimSpace(req.ImageURL),
		InboxItemID:  inboxItemID,
		PlanID:       planID,
		TraceID:      traceID,
		PantryItemID: pantryItemID,
	}, "", true
}

func applyLedgerListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	category := strings.TrimSpace(c.Query("category"))
	if category != "" && validLedgerCategories[category] {
		query = query.Where("category = ?", category)
	}
	direction := strings.TrimSpace(c.Query("direction"))
	if direction != "" && validLedgerDirections[direction] {
		query = query.Where("direction = ?", direction)
	}
	return query
}

func buildLedgerSummary(userID model.Int64String, month string, start time.Time, end time.Time) (ledgerSummary, error) {
	var rows []struct {
		Direction string
		Category  string
		Total     int64
		Count     int64
	}
	err := database.GetDB().
		Model(&model.LifeTraceLedgerEntry{}).
		Select("direction, category, COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS count").
		Where("user_id = ? AND occurred_at >= ? AND occurred_at < ?", userID, start, end).
		Group("direction, category").
		Scan(&rows).Error
	if err != nil {
		return ledgerSummary{}, err
	}

	summary := ledgerSummary{
		Month:      month,
		Categories: []ledgerCategorySummary{},
	}
	categoryTotals := map[string]ledgerCategorySummary{}
	for _, row := range rows {
		switch row.Direction {
		case "支出":
			summary.ExpenseCents += row.Total
			current := categoryTotals[row.Category]
			current.Category = row.Category
			current.AmountCents += row.Total
			current.Count += row.Count
			categoryTotals[row.Category] = current
		case "收入":
			summary.IncomeCents += row.Total
		case "退款":
			summary.RefundCents += row.Total
		}
	}
	summary.NetCents = summary.IncomeCents + summary.RefundCents - summary.ExpenseCents
	summary.Expense = centsToAmount(summary.ExpenseCents)
	summary.Income = centsToAmount(summary.IncomeCents)
	summary.Refund = centsToAmount(summary.RefundCents)
	summary.Net = centsToAmount(summary.NetCents)

	for _, category := range []string{"吃饭", "交通", "购物", "书影音", "订阅", "家用", "礼物", "医疗", "其他"} {
		item, ok := categoryTotals[category]
		if !ok {
			continue
		}
		item.Amount = centsToAmount(item.AmountCents)
		summary.Categories = append(summary.Categories, item)
	}
	return summary, nil
}

func (h *Handler) ListLedgerEntries(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	month, start, end, ok := parseLedgerMonth(c.Query("month"))
	if !ok {
		fail(c, http.StatusBadRequest, "账目月份不正确")
		return
	}
	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	baseQuery := database.GetDB().
		Model(&model.LifeTraceLedgerEntry{}).
		Where("user_id = ? AND occurred_at >= ? AND occurred_at < ?", userID, start, end)
	baseQuery = applyLedgerListFilters(baseQuery, c)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取账目失败")
		return
	}

	var entries []model.LifeTraceLedgerEntry
	if err := baseQuery.
		Order("occurred_at DESC, created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&entries).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取账目失败")
		return
	}

	summary, err := buildLedgerSummary(userID, month, start, end)
	if err != nil {
		fail(c, http.StatusInternalServerError, "获取账目摘要失败")
		return
	}

	list := make([]ledgerEntryResponse, 0, len(entries))
	for _, entry := range entries {
		list = append(list, ledgerEntryToResponse(entry))
	}

	success(c, gin.H{
		"list":       list,
		"summary":    summary,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreateLedgerEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req ledgerEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	entry, message, ok := buildLedgerEntryFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	if err := database.GetDB().Create(&entry).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建账目失败")
		return
	}
	success(c, ledgerEntryToResponse(entry))
}

func (h *Handler) UpdateLedgerEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	entry, found := findLedgerEntry(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "账目不存在")
		return
	}

	var req ledgerEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	nextEntry, message, ok := buildLedgerEntryFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	updates := map[string]interface{}{
		"amount_cents":   nextEntry.AmountCents,
		"currency":       nextEntry.Currency,
		"direction":      nextEntry.Direction,
		"category":       nextEntry.Category,
		"occurred_at":    nextEntry.OccurredAt,
		"merchant":       nextEntry.Merchant,
		"location":       nextEntry.Location,
		"note":           nextEntry.Note,
		"image_url":      nextEntry.ImageURL,
		"inbox_item_id":  nextEntry.InboxItemID,
		"plan_id":        nextEntry.PlanID,
		"trace_id":       nextEntry.TraceID,
		"pantry_item_id": nextEntry.PantryItemID,
	}
	if err := database.GetDB().Model(&entry).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新账目失败")
		return
	}
	if err := database.GetDB().First(&entry, "id = ? AND user_id = ?", entry.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取账目失败")
		return
	}
	success(c, ledgerEntryToResponse(entry))
}

func (h *Handler) DeleteLedgerEntry(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	entry, found := findLedgerEntry(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "账目不存在")
		return
	}

	if err := database.GetDB().Delete(&entry).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除账目失败")
		return
	}
	success(c, gin.H{"id": entry.ID})
}

func findLedgerEntry(id string, userID model.Int64String) (model.LifeTraceLedgerEntry, bool) {
	var entry model.LifeTraceLedgerEntry
	err := database.GetDB().First(&entry, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return entry, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entry, false
	}
	return entry, false
}
