package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type shoppingListItemRequest struct {
	Name               string             `json:"name"`
	Quantity           int                `json:"quantity"`
	Unit               string             `json:"unit"`
	Category           string             `json:"category"`
	Source             string             `json:"source"`
	SourcePantryItemID *model.Int64String `json:"sourcePantryItemId,omitempty"`
	Note               string             `json:"note"`
}

type checkShoppingListItemRequest struct {
	Checked bool `json:"checked"`
}

var validShoppingSources = map[string]bool{
	"manual":          true,
	"pantry_used_up":  true,
	"pantry_low":      true,
	"pantry_discard":  true,
	"recipe":          true,
}

func normalizeShoppingSource(source string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return "manual"
	}
	if !validShoppingSources[source] {
		return "manual"
	}
	return source
}

func normalizeShoppingQuantity(q int) int {
	if q <= 0 {
		return 1
	}
	if q > 9999 {
		return 9999
	}
	return q
}

func normalizeShoppingName(name string) string {
	name = strings.TrimSpace(name)
	if len([]rune(name)) > 80 {
		name = string([]rune(name)[:80])
	}
	return name
}

func normalizeShoppingNote(note string) string {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 500 {
		note = string([]rune(note)[:500])
	}
	return note
}

func normalizeShoppingCategory(category string) string {
	category = strings.TrimSpace(category)
	if category == "" {
		return "食品"
	}
	if len([]rune(category)) > 20 {
		category = string([]rune(category)[:20])
	}
	return category
}

func normalizeShoppingUnit(unit string) string {
	unit = strings.TrimSpace(unit)
	if unit == "" {
		return "件"
	}
	if len([]rune(unit)) > 10 {
		unit = string([]rune(unit)[:10])
	}
	return unit
}

func findShoppingListItem(id string, householdID model.Int64String) (model.LifeTraceShoppingListItem, bool) {
	var item model.LifeTraceShoppingListItem
	err := database.GetDB().First(&item, "id = ? AND household_id = ?", id, householdID).Error
	if err == nil {
		return item, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, false
	}
	return item, false
}

func (h *Handler) ListShoppingListItems(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	query := database.GetDB().
		Model(&model.LifeTraceShoppingListItem{}).
		Where("household_id = ?", householdCtx.Household.ID)

	status := strings.TrimSpace(c.Query("status"))
	switch status {
	case "open":
		query = query.Where("checked_at IS NULL")
	case "checked":
		query = query.Where("checked_at IS NOT NULL")
	}

	var items []model.LifeTraceShoppingListItem
	if err := query.
		Order("created_at DESC").
		Limit(500).
		Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取采购清单失败")
		return
	}

	var openCount int64
	if err := database.GetDB().
		Model(&model.LifeTraceShoppingListItem{}).
		Where("household_id = ? AND checked_at IS NULL", householdCtx.Household.ID).
		Count(&openCount).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取采购清单失败")
		return
	}

	success(c, gin.H{
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"list":          items,
		"summary": gin.H{
			"openCount": openCount,
		},
	})
}

func (h *Handler) CreateShoppingListItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	var req shoppingListItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := normalizeShoppingName(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "请填写商品名称")
		return
	}

	item := model.LifeTraceShoppingListItem{
		UserID:             userID,
		HouseholdID:        householdCtx.Household.ID,
		Name:               name,
		Quantity:           normalizeShoppingQuantity(req.Quantity),
		Unit:               normalizeShoppingUnit(req.Unit),
		Category:           normalizeShoppingCategory(req.Category),
		Source:             normalizeShoppingSource(req.Source),
		SourcePantryItemID: req.SourcePantryItemID,
		Note:               normalizeShoppingNote(req.Note),
		CreatedBy:          userID,
		UpdatedBy:          userID,
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建采购清单失败")
		return
	}

	success(c, item)
}

func (h *Handler) UpdateShoppingListItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findShoppingListItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "采购清单条目不存在")
		return
	}

	var req shoppingListItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := normalizeShoppingName(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "请填写商品名称")
		return
	}

	updates := map[string]interface{}{
		"name":       name,
		"quantity":   normalizeShoppingQuantity(req.Quantity),
		"unit":       normalizeShoppingUnit(req.Unit),
		"category":   normalizeShoppingCategory(req.Category),
		"note":       normalizeShoppingNote(req.Note),
		"updated_by": userID,
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新采购清单失败")
		return
	}

	if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取采购清单失败")
		return
	}

	success(c, item)
}

func (h *Handler) CheckShoppingListItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findShoppingListItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "采购清单条目不存在")
		return
	}

	var req checkShoppingListItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	updates := map[string]interface{}{
		"updated_by": userID,
	}
	if req.Checked {
		now := time.Now()
		updates["checked_at"] = &now
	} else {
		updates["checked_at"] = nil
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新采购清单失败")
		return
	}

	if err := database.GetDB().First(&item, "id = ? AND household_id = ?", item.ID, householdCtx.Household.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取采购清单失败")
		return
	}

	success(c, item)
}

func (h *Handler) DeleteShoppingListItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	item, found := findShoppingListItem(c.Param("id"), householdCtx.Household.ID)
	if !found {
		fail(c, http.StatusNotFound, "采购清单条目不存在")
		return
	}

	if err := database.GetDB().Delete(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除采购清单失败")
		return
	}

	success(c, gin.H{"id": item.ID})
}
