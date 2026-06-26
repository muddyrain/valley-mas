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

type recurringReminderPayload struct {
	Enabled      bool     `json:"enabled"`
	UseDefault   bool     `json:"useDefault"`
	Rules        []string `json:"rules"`
	ReminderTime string   `json:"reminderTime"`
}

type recurringPaymentRequest struct {
	Name      string                   `json:"name"`
	Category  string                   `json:"category"`
	Amount    float64                  `json:"amount"`
	Currency  string                   `json:"currency"`
	Direction string                   `json:"direction"`
	Merchant  string                   `json:"merchant"`
	Note      string                   `json:"note"`
	ImageURL  string                   `json:"imageUrl"`
	Frequency string                   `json:"frequency"`
	Interval  int                      `json:"interval"`
	StartedAt string                   `json:"startedAt"`
	EndAt     string                   `json:"endAt"`
	Reminder  recurringReminderPayload `json:"reminder"`
}

type recurringPaymentResponse struct {
	model.LifeTraceRecurringPayment
	Amount float64 `json:"amount"`
}

type recurringPaymentSummary struct {
	Total            int64 `json:"total"`
	ActiveCount      int64 `json:"activeCount"`
	OverdueCount     int64 `json:"overdueCount"`
	UpcomingCount    int64 `json:"upcomingCount"`
	MonthlyExpense   int64 `json:"monthlyExpenseCents"`
	UpcomingDays     int   `json:"upcomingDays"`
}

var validRecurringFrequencies = map[string]bool{
	"daily":     true,
	"weekly":    true,
	"monthly":   true,
	"quarterly": true,
	"half_year": true,
	"yearly":    true,
}

var validRecurringDirections = map[string]bool{
	"支出": true,
	"收入": true,
}

func recurringPaymentToResponse(item model.LifeTraceRecurringPayment) recurringPaymentResponse {
	return recurringPaymentResponse{
		LifeTraceRecurringPayment: item,
		Amount:                    centsToAmount(item.AmountCents),
	}
}

func normalizeRecurringFrequency(value string) string {
	value = strings.TrimSpace(value)
	if !validRecurringFrequencies[value] {
		return "monthly"
	}
	return value
}

func sanitizeRecurringInterval(value int) int {
	if value <= 0 {
		return 1
	}
	if value > 60 {
		return 60
	}
	return value
}

func sanitizeRecurringEndAt(raw string) (*string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	if _, err := time.Parse("2006-01-02", raw); err != nil {
		return nil, false
	}
	return &raw, true
}

func nextRecurringDueDate(frequency string, interval int, base string) (string, bool) {
	if base == "" {
		return "", false
	}
	t, err := time.Parse("2006-01-02", base)
	if err != nil {
		return "", false
	}
	if interval <= 0 {
		interval = 1
	}
	switch frequency {
	case "daily":
		t = t.AddDate(0, 0, interval)
	case "weekly":
		t = t.AddDate(0, 0, 7*interval)
	case "monthly":
		t = t.AddDate(0, interval, 0)
	case "quarterly":
		t = t.AddDate(0, 3*interval, 0)
	case "half_year":
		t = t.AddDate(0, 6*interval, 0)
	case "yearly":
		t = t.AddDate(interval, 0, 0)
	default:
		return "", false
	}
	return t.Format("2006-01-02"), true
}

func resolveInitialNextDue(startedAt string, frequency string, interval int, now time.Time) string {
	if startedAt == "" {
		return now.Format("2006-01-02")
	}
	due := startedAt
	today := now.Format("2006-01-02")
	for due < today {
		next, ok := nextRecurringDueDate(frequency, interval, due)
		if !ok {
			return due
		}
		due = next
	}
	return due
}

func buildRecurringPaymentFromRequest(req recurringPaymentRequest, userID model.Int64String) (model.LifeTraceRecurringPayment, string, bool) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return model.LifeTraceRecurringPayment{}, "订阅名称不能为空", false
	}
	if len([]rune(name)) > 80 {
		return model.LifeTraceRecurringPayment{}, "订阅名称过长", false
	}

	amountCents := int64(math.Round(req.Amount * 100))
	if amountCents <= 0 {
		return model.LifeTraceRecurringPayment{}, "订阅金额不正确", false
	}
	if amountCents > 999999999999 {
		return model.LifeTraceRecurringPayment{}, "订阅金额过大", false
	}

	direction := strings.TrimSpace(req.Direction)
	if direction == "" {
		direction = "支出"
	}
	if !validRecurringDirections[direction] {
		return model.LifeTraceRecurringPayment{}, "订阅方向不正确", false
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "订阅"
	}
	if !validLedgerCategories[category] {
		return model.LifeTraceRecurringPayment{}, "订阅分类不正确", false
	}

	startedAt := strings.TrimSpace(req.StartedAt)
	if startedAt == "" {
		startedAt = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", startedAt); err != nil {
		return model.LifeTraceRecurringPayment{}, "开始日期格式错误", false
	}

	endAt, ok := sanitizeRecurringEndAt(req.EndAt)
	if !ok {
		return model.LifeTraceRecurringPayment{}, "结束日期格式错误", false
	}
	if endAt != nil && *endAt < startedAt {
		return model.LifeTraceRecurringPayment{}, "结束日期不能早于开始日期", false
	}

	frequency := normalizeRecurringFrequency(req.Frequency)
	interval := sanitizeRecurringInterval(req.Interval)
	nextDueAt := resolveInitialNextDue(startedAt, frequency, interval, time.Now())

	reminderEnabled := req.Reminder.Enabled
	reminderUseDefault := req.Reminder.UseDefault
	reminderRules := normalizeSubscriptionReminderRules(req.Reminder.Rules)
	reminderTime := normalizeTimeText(req.Reminder.ReminderTime, "09:00")

	return model.LifeTraceRecurringPayment{
		UserID:             userID,
		Name:               name,
		Category:           category,
		AmountCents:        amountCents,
		Currency:           normalizeLedgerCurrency(req.Currency),
		Direction:          direction,
		Merchant:           strings.TrimSpace(req.Merchant),
		Note:               strings.TrimSpace(req.Note),
		ImageURL:           strings.TrimSpace(req.ImageURL),
		Frequency:          frequency,
		Interval:           interval,
		StartedAt:          startedAt,
		NextDueAt:          nextDueAt,
		EndAt:              endAt,
		ReminderEnabled:    reminderEnabled,
		ReminderUseDefault: reminderUseDefault,
		ReminderRules:      reminderRules,
		ReminderTime:       reminderTime,
	}, "", true
}

func parseRecurringPaymentID(raw string) (model.Int64String, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return model.Int64String(id), true
}

func findRecurringPayment(idText string, userID model.Int64String) (model.LifeTraceRecurringPayment, bool) {
	id, ok := parseRecurringPaymentID(idText)
	if !ok {
		return model.LifeTraceRecurringPayment{}, false
	}
	var item model.LifeTraceRecurringPayment
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		return model.LifeTraceRecurringPayment{}, false
	}
	return item, true
}

func applyRecurringListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	status := strings.TrimSpace(c.Query("status"))
	switch status {
	case "active":
		query = query.Where("archived = ?", false)
	case "archived":
		query = query.Where("archived = ?", true)
	default:
		query = query.Where("archived = ?", false)
	}

	category := strings.TrimSpace(c.Query("category"))
	if category != "" && validLedgerCategories[category] {
		query = query.Where("category = ?", category)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(name LIKE ? OR merchant LIKE ? OR note LIKE ?)", like, like, like)
	}
	return query
}

func buildRecurringPaymentSummary(userID model.Int64String, now time.Time) (recurringPaymentSummary, error) {
	const upcomingDays = 7
	today := now.Format("2006-01-02")
	upcoming := now.AddDate(0, 0, upcomingDays).Format("2006-01-02")

	var summary recurringPaymentSummary
	summary.UpcomingDays = upcomingDays

	err := database.GetDB().
		Model(&model.LifeTraceRecurringPayment{}).
		Where("user_id = ? AND archived = ?", userID, false).
		Select(`
COUNT(*) AS total,
COUNT(*) AS active_count,
COUNT(CASE WHEN next_due_at <> '' AND next_due_at < ? THEN 1 END) AS overdue_count,
COUNT(CASE WHEN next_due_at <> '' AND next_due_at >= ? AND next_due_at <= ? THEN 1 END) AS upcoming_count
`, today, today, upcoming).
		Scan(&summary).Error
	if err != nil {
		return recurringPaymentSummary{}, err
	}

	var monthlyTotalCents int64
	rows, err := database.GetDB().
		Model(&model.LifeTraceRecurringPayment{}).
		Where("user_id = ? AND archived = ? AND direction = ?", userID, false, "支出").
		Select("amount_cents, frequency, interval").
		Rows()
	if err != nil {
		return recurringPaymentSummary{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var amount int64
		var frequency string
		var interval int
		if err := rows.Scan(&amount, &frequency, &interval); err != nil {
			return recurringPaymentSummary{}, err
		}
		if interval <= 0 {
			interval = 1
		}
		switch frequency {
		case "daily":
			monthlyTotalCents += amount * int64(30/interval)
		case "weekly":
			monthlyTotalCents += amount * int64(4/interval)
		case "monthly":
			monthlyTotalCents += amount / int64(interval)
		case "quarterly":
			monthlyTotalCents += amount / int64(3*interval)
		case "half_year":
			monthlyTotalCents += amount / int64(6*interval)
		case "yearly":
			monthlyTotalCents += amount / int64(12*interval)
		}
	}
	summary.MonthlyExpense = monthlyTotalCents
	return summary, nil
}

func (h *Handler) ListRecurringPayments(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize

	baseQuery := database.GetDB().
		Model(&model.LifeTraceRecurringPayment{}).
		Where("user_id = ?", userID)
	baseQuery = applyRecurringListFilters(baseQuery, c)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取订阅失败")
		return
	}

	var items []model.LifeTraceRecurringPayment
	if err := baseQuery.
		Order("archived ASC").
		Order("next_due_at ASC").
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取订阅失败")
		return
	}

	responses := make([]recurringPaymentResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, recurringPaymentToResponse(item))
	}

	summary, err := buildRecurringPaymentSummary(userID, time.Now())
	if err != nil {
		fail(c, http.StatusInternalServerError, "获取订阅汇总失败")
		return
	}

	success(c, gin.H{
		"list":       responses,
		"pagination": buildListPagination(page, pageSize, total),
		"summary":    summary,
	})
}

func (h *Handler) CreateRecurringPayment(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req recurringPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	item, message, ok := buildRecurringPaymentFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建订阅失败")
		return
	}

	success(c, recurringPaymentToResponse(item))
}

func (h *Handler) UpdateRecurringPayment(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	existing, found := findRecurringPayment(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "订阅不存在")
		return
	}

	var req recurringPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	updated, message, ok := buildRecurringPaymentFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	updates := map[string]interface{}{
		"name":                 updated.Name,
		"category":             updated.Category,
		"amount_cents":         updated.AmountCents,
		"currency":             updated.Currency,
		"direction":            updated.Direction,
		"merchant":             updated.Merchant,
		"note":                 updated.Note,
		"image_url":            updated.ImageURL,
		"frequency":            updated.Frequency,
		"interval":             updated.Interval,
		"started_at":           updated.StartedAt,
		"next_due_at":          updated.NextDueAt,
		"end_at":               updated.EndAt,
		"reminder_enabled":     updated.ReminderEnabled,
		"reminder_use_default": updated.ReminderUseDefault,
		"reminder_rules":       updated.ReminderRules,
		"reminder_time":        updated.ReminderTime,
	}
	if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新订阅失败")
		return
	}
	if err := database.GetDB().Model(&existing).UpdateColumn("reminder_enabled", updated.ReminderEnabled).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新订阅失败")
		return
	}

	if err := database.GetDB().First(&existing, "id = ? AND user_id = ?", existing.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取订阅失败")
		return
	}
	success(c, recurringPaymentToResponse(existing))
}

func (h *Handler) DeleteRecurringPayment(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	existing, found := findRecurringPayment(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "订阅不存在")
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"archived":    true,
		"canceled_at": &now,
	}
	if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "归档订阅失败")
		return
	}

	if err := database.GetDB().First(&existing, "id = ? AND user_id = ?", existing.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取订阅失败")
		return
	}
	success(c, recurringPaymentToResponse(existing))
}

func (h *Handler) AdvanceRecurringPayment(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	existing, found := findRecurringPayment(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "订阅不存在")
		return
	}

	if existing.Archived {
		fail(c, http.StatusBadRequest, "订阅已归档")
		return
	}

	base := strings.TrimSpace(existing.NextDueAt)
	if base == "" {
		base = time.Now().Format("2006-01-02")
	}
	next, ok := nextRecurringDueDate(existing.Frequency, existing.Interval, base)
	if !ok {
		fail(c, http.StatusBadRequest, "无法推进下一期，频率配置不正确")
		return
	}
	if existing.EndAt != nil && *existing.EndAt != "" && next > *existing.EndAt {
		now := time.Now()
		updates := map[string]interface{}{
			"archived":    true,
			"canceled_at": &now,
		}
		if err := database.GetDB().Model(&existing).Updates(updates).Error; err != nil {
			fail(c, http.StatusInternalServerError, "推进订阅失败")
			return
		}
	} else {
		if err := database.GetDB().Model(&existing).Update("next_due_at", next).Error; err != nil {
			fail(c, http.StatusInternalServerError, "推进订阅失败")
			return
		}
	}

	if err := resetRecurringPaymentDeliveries(database.GetDB(), existing.ID); err != nil {
		fail(c, http.StatusInternalServerError, "推进订阅失败")
		return
	}

	if err := database.GetDB().First(&existing, "id = ? AND user_id = ?", existing.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取订阅失败")
		return
	}
	success(c, recurringPaymentToResponse(existing))
}

func resetRecurringPaymentDeliveries(db *gorm.DB, recurringPaymentID model.Int64String) error {
	err := db.Where("recurring_payment_id = ?", recurringPaymentID).
		Delete(&model.LifeTraceRecurringPaymentDelivery{}).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return nil
}
