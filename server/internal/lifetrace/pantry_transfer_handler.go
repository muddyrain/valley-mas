package lifetrace

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	pantryTransferModeCopy     = "copy"
	pantryTransferModeMove     = "move"
	pantryTransferPolicyMerge  = "merge"
	pantryTransferPolicyKeep   = "keep-both"
	pantryTransferActionCreate = "created"
	pantryTransferActionMerge  = "merged"
)

type pantryTransferRequest struct {
	SourceHouseholdID string   `json:"sourceHouseholdId"`
	TargetHouseholdID string   `json:"targetHouseholdId"`
	ItemIDs           []string `json:"itemIds"`
	Mode              string   `json:"mode"`
	ConflictPolicy    string   `json:"conflictPolicy"`
}

type pantryTransferItemSummary struct {
	ID        model.Int64String `json:"id"`
	Name      string            `json:"name"`
	Quantity  int               `json:"quantity"`
	Unit      string            `json:"unit"`
	Location  string            `json:"location"`
	ExpiresAt string            `json:"expiresAt,omitempty"`
	OpenedAt  string            `json:"openedAt,omitempty"`
}

type pantryTransferConflict struct {
	SourceItem pantryTransferItemSummary `json:"sourceItem"`
	TargetItem pantryTransferItemSummary `json:"targetItem"`
	Reason     string                   `json:"reason"`
}

type pantryTransferPreviewResponse struct {
	SourceHouseholdID   model.Int64String           `json:"sourceHouseholdId"`
	SourceHouseholdName string                      `json:"sourceHouseholdName"`
	TargetHouseholdID   model.Int64String           `json:"targetHouseholdId"`
	TargetHouseholdName string                      `json:"targetHouseholdName"`
	Mode                string                      `json:"mode"`
	ItemCount           int                         `json:"itemCount"`
	ConflictCount       int                         `json:"conflictCount"`
	Items               []pantryTransferItemSummary `json:"items"`
	Conflicts           []pantryTransferConflict    `json:"conflicts"`
}

type pantryTransferResultItem struct {
	SourceItemID model.Int64String `json:"sourceItemId"`
	TargetItemID model.Int64String `json:"targetItemId"`
	Name         string            `json:"name"`
	Action       string            `json:"action"`
}

type pantryTransferResponse struct {
	SourceHouseholdID   model.Int64String           `json:"sourceHouseholdId"`
	SourceHouseholdName string                      `json:"sourceHouseholdName"`
	TargetHouseholdID   model.Int64String           `json:"targetHouseholdId"`
	TargetHouseholdName string                      `json:"targetHouseholdName"`
	Mode                string                      `json:"mode"`
	ConflictPolicy      string                      `json:"conflictPolicy,omitempty"`
	ProcessedCount      int                         `json:"processedCount"`
	CreatedCount        int                         `json:"createdCount"`
	MergedCount         int                         `json:"mergedCount"`
	DeletedSourceCount  int                         `json:"deletedSourceCount"`
	Items               []pantryTransferResultItem `json:"items"`
}

func (h *Handler) PreviewPantryTransfer(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	req, sourceCtx, targetCtx, sourceItems, conflicts, ok := readPantryTransferPreview(c, userID)
	if !ok {
		return
	}

	success(c, pantryTransferPreviewResponse{
		SourceHouseholdID:   sourceCtx.Household.ID,
		SourceHouseholdName: sourceCtx.Household.Name,
		TargetHouseholdID:   targetCtx.Household.ID,
		TargetHouseholdName: targetCtx.Household.Name,
		Mode:                req.Mode,
		ItemCount:           len(sourceItems),
		ConflictCount:       len(conflicts),
		Items:               sourceItems,
		Conflicts:           conflicts,
	})
}

func (h *Handler) TransferPantryItems(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	req, sourceCtx, targetCtx, orderedIDs, ok := readPantryTransferRequest(c, userID)
	if !ok {
		return
	}

	result, err := executePantryTransfer(userID, sourceCtx, targetCtx, orderedIDs, req)
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			fail(c, http.StatusNotFound, "库存不存在")
		case strings.Contains(err.Error(), "conflict_policy_required"):
			fail(c, http.StatusConflict, "检测到重复库存，请先选择合并还是保留两条")
		case strings.Contains(err.Error(), "unsupported_source_household"):
			fail(c, http.StatusBadRequest, "当前只支持从个人空间转移到共享家庭")
		default:
			fail(c, http.StatusInternalServerError, "转移库存失败")
		}
		return
	}

	success(c, result)
}

func readPantryTransferPreview(
	c *gin.Context,
	userID model.Int64String,
) (pantryTransferRequest, householdContext, householdContext, []pantryTransferItemSummary, []pantryTransferConflict, bool) {
	req, sourceCtx, targetCtx, orderedIDs, ok := readPantryTransferRequest(c, userID)
	if !ok {
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, nil, false
	}

	sourceItems, conflicts, err := previewPantryTransfer(sourceCtx, targetCtx, orderedIDs)
	if err != nil {
		switch err.Error() {
		case "unsupported_source_household":
			fail(c, http.StatusBadRequest, "当前只支持从个人空间转移到共享家庭")
		case "target_household_invalid":
			fail(c, http.StatusBadRequest, "目标家庭必须是可访问的共享家庭")
		case "same_household":
			fail(c, http.StatusBadRequest, "源空间和目标家庭不能相同")
		case "missing_items":
			fail(c, http.StatusNotFound, "部分库存不存在或已不在当前空间")
		default:
			fail(c, http.StatusInternalServerError, "读取库存失败")
		}
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, nil, false
	}

	return req, sourceCtx, targetCtx, sourceItems, conflicts, true
}

func readPantryTransferRequest(
	c *gin.Context,
	userID model.Int64String,
) (pantryTransferRequest, householdContext, householdContext, []model.Int64String, bool) {
	var req pantryTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	req.Mode = strings.TrimSpace(req.Mode)
	if req.Mode != pantryTransferModeCopy && req.Mode != pantryTransferModeMove {
		fail(c, http.StatusBadRequest, "只支持复制或移动库存")
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	req.ConflictPolicy = strings.TrimSpace(req.ConflictPolicy)
	if req.ConflictPolicy != "" &&
		req.ConflictPolicy != pantryTransferPolicyMerge &&
		req.ConflictPolicy != pantryTransferPolicyKeep {
		fail(c, http.StatusBadRequest, "冲突处理方式不支持")
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	orderedIDs, err := parsePantryTransferItemIDs(req.ItemIDs)
	if err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	sourceCtx, err := resolvePantryTransferSourceContext(userID, req.SourceHouseholdID)
	if err != nil {
		if errors.Is(err, errHouseholdNotAccessible) {
			fail(c, http.StatusForbidden, "源空间不存在或不可访问")
		} else {
			fail(c, http.StatusInternalServerError, "读取源空间失败")
		}
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	targetCtx, err := resolvePantryTransferTargetContext(userID, req.TargetHouseholdID)
	if err != nil {
		if errors.Is(err, errHouseholdNotAccessible) {
			fail(c, http.StatusForbidden, "目标家庭不存在或不可访问")
		} else {
			fail(c, http.StatusInternalServerError, "读取目标家庭失败")
		}
		return pantryTransferRequest{}, householdContext{}, householdContext{}, nil, false
	}

	return req, sourceCtx, targetCtx, orderedIDs, true
}

func resolvePantryTransferSourceContext(
	userID model.Int64String,
	rawHouseholdID string,
) (householdContext, error) {
	personalHousehold, personalMember, err := ensurePersonalHousehold(userID)
	if err != nil {
		return householdContext{}, err
	}

	rawHouseholdID = strings.TrimSpace(rawHouseholdID)
	if rawHouseholdID == "" {
		return householdContext{
			Household: personalHousehold,
			Member:    personalMember,
		}, nil
	}

	householdID, err := parsePositiveHouseholdID(rawHouseholdID)
	if err != nil {
		return householdContext{}, fmtHouseholdAccessibleError()
	}

	return resolveAccessibleHouseholdContext(userID, householdID)
}

func resolvePantryTransferTargetContext(
	userID model.Int64String,
	rawHouseholdID string,
) (householdContext, error) {
	householdID, err := parsePositiveHouseholdID(rawHouseholdID)
	if err != nil {
		return householdContext{}, fmtHouseholdAccessibleError()
	}

	ctx, err := resolveAccessibleHouseholdContext(userID, householdID)
	if err != nil {
		return householdContext{}, err
	}
	if ctx.Household.Kind != householdKindShared || ctx.Household.Status != householdStatusActive {
		return householdContext{}, errors.New("target_household_invalid")
	}
	return ctx, nil
}

func resolveAccessibleHouseholdContext(
	userID model.Int64String,
	householdID model.Int64String,
) (householdContext, error) {
	var household model.Household
	if err := database.GetDB().
		Where("id = ? AND status = ?", householdID, householdStatusActive).
		First(&household).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return householdContext{}, fmtHouseholdAccessibleError()
		}
		return householdContext{}, err
	}

	var member model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND user_id = ? AND status = ?", householdID, userID, householdMemberStatusActive).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return householdContext{}, fmtHouseholdAccessibleError()
		}
		return householdContext{}, err
	}

	return householdContext{
		Household: household,
		Member:    member,
	}, nil
}

func parsePositiveHouseholdID(raw string) (model.Int64String, error) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || value <= 0 {
		return 0, errors.New("invalid_household_id")
	}
	return model.Int64String(value), nil
}

func fmtHouseholdAccessibleError() error {
	return fmt.Errorf("%w: 家庭不存在或不可访问", errHouseholdNotAccessible)
}

func parsePantryTransferItemIDs(rawIDs []string) ([]model.Int64String, error) {
	if len(rawIDs) == 0 {
		return nil, errors.New("至少选择一条库存")
	}

	seen := make(map[model.Int64String]struct{}, len(rawIDs))
	ordered := make([]model.Int64String, 0, len(rawIDs))
	for _, rawID := range rawIDs {
		value, err := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
		if err != nil || value <= 0 {
			return nil, errors.New("库存条目不合法")
		}
		itemID := model.Int64String(value)
		if _, exists := seen[itemID]; exists {
			continue
		}
		seen[itemID] = struct{}{}
		ordered = append(ordered, itemID)
	}

	if len(ordered) == 0 {
		return nil, errors.New("至少选择一条库存")
	}
	return ordered, nil
}

func previewPantryTransfer(
	sourceCtx householdContext,
	targetCtx householdContext,
	orderedIDs []model.Int64String,
) ([]pantryTransferItemSummary, []pantryTransferConflict, error) {
	if sourceCtx.Household.Kind != householdKindPersonal {
		return nil, nil, errors.New("unsupported_source_household")
	}
	if targetCtx.Household.Kind != householdKindShared {
		return nil, nil, errors.New("target_household_invalid")
	}
	if sourceCtx.Household.ID == targetCtx.Household.ID {
		return nil, nil, errors.New("same_household")
	}

	sourceItems, err := loadPantryTransferSourceItems(database.GetDB(), sourceCtx.Household.ID, orderedIDs)
	if err != nil {
		return nil, nil, err
	}
	targetItems, err := loadPantryTransferTargetItems(database.GetDB(), targetCtx.Household.ID)
	if err != nil {
		return nil, nil, err
	}

	conflictIndex := buildPantryTransferConflictIndex(targetItems)
	summaries := make([]pantryTransferItemSummary, 0, len(sourceItems))
	conflicts := make([]pantryTransferConflict, 0)
	for _, item := range sourceItems {
		summaries = append(summaries, pantryTransferItemToSummary(item))
		if targetItem, exists := conflictIndex[buildPantryTransferMergeKey(item)]; exists {
			conflicts = append(conflicts, pantryTransferConflict{
				SourceItem: pantryTransferItemToSummary(item),
				TargetItem: pantryTransferItemToSummary(targetItem),
				Reason:     "名称、位置、单位和日期信息一致，可以选择合并数量或保留两条",
			})
		}
	}

	return summaries, conflicts, nil
}

func loadPantryTransferSourceItems(
	db *gorm.DB,
	householdID model.Int64String,
	orderedIDs []model.Int64String,
) ([]model.LifeTracePantryItem, error) {
	var items []model.LifeTracePantryItem
	if err := db.
		Where("household_id = ? AND id IN ?", householdID, orderedIDs).
		Find(&items).Error; err != nil {
		return nil, err
	}
	if len(items) != len(orderedIDs) {
		return nil, errors.New("missing_items")
	}

	index := make(map[model.Int64String]model.LifeTracePantryItem, len(items))
	for _, item := range items {
		index[item.ID] = item
	}

	ordered := make([]model.LifeTracePantryItem, 0, len(orderedIDs))
	for _, itemID := range orderedIDs {
		item, exists := index[itemID]
		if !exists {
			return nil, errors.New("missing_items")
		}
		ordered = append(ordered, item)
	}

	return ordered, nil
}

func loadPantryTransferTargetItems(
	db *gorm.DB,
	householdID model.Int64String,
) ([]model.LifeTracePantryItem, error) {
	var items []model.LifeTracePantryItem
	if err := db.
		Where("household_id = ?", householdID).
		Order("updated_at DESC").
		Order("created_at DESC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func buildPantryTransferConflictIndex(items []model.LifeTracePantryItem) map[string]model.LifeTracePantryItem {
	index := make(map[string]model.LifeTracePantryItem, len(items))
	for _, item := range items {
		key := buildPantryTransferMergeKey(item)
		if _, exists := index[key]; exists {
			continue
		}
		index[key] = item
	}
	return index
}

func buildPantryTransferMergeKey(item model.LifeTracePantryItem) string {
	return strings.Join([]string{
		normalizePantryTransferText(item.Name),
		normalizePantryTransferText(item.Category),
		normalizePantryTransferText(item.Unit),
		normalizePantryTransferText(item.Location),
		normalizePantryTransferText(item.ExpiresAt),
		normalizePantryTransferText(item.OpenedAt),
	}, "|")
}

func normalizePantryTransferText(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func pantryTransferItemToSummary(item model.LifeTracePantryItem) pantryTransferItemSummary {
	return pantryTransferItemSummary{
		ID:        item.ID,
		Name:      item.Name,
		Quantity:  item.Quantity,
		Unit:      item.Unit,
		Location:  item.Location,
		ExpiresAt: item.ExpiresAt,
		OpenedAt:  item.OpenedAt,
	}
}

func executePantryTransfer(
	userID model.Int64String,
	sourceCtx householdContext,
	targetCtx householdContext,
	orderedIDs []model.Int64String,
	req pantryTransferRequest,
) (pantryTransferResponse, error) {
	if sourceCtx.Household.Kind != householdKindPersonal {
		return pantryTransferResponse{}, errors.New("unsupported_source_household")
	}

	result := pantryTransferResponse{
		SourceHouseholdID:   sourceCtx.Household.ID,
		SourceHouseholdName: sourceCtx.Household.Name,
		TargetHouseholdID:   targetCtx.Household.ID,
		TargetHouseholdName: targetCtx.Household.Name,
		Mode:                req.Mode,
		ConflictPolicy:      req.ConflictPolicy,
		Items:               make([]pantryTransferResultItem, 0, len(orderedIDs)),
	}

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		sourceItems, err := loadPantryTransferSourceItems(
			tx.Clauses(clause.Locking{Strength: "UPDATE"}),
			sourceCtx.Household.ID,
			orderedIDs,
		)
		if err != nil {
			return err
		}
		targetItems, err := loadPantryTransferTargetItems(
			tx.Clauses(clause.Locking{Strength: "UPDATE"}),
			targetCtx.Household.ID,
		)
		if err != nil {
			return err
		}

		conflictIndex := buildPantryTransferConflictIndex(targetItems)
		hasConflict := false
		for _, item := range sourceItems {
			if _, exists := conflictIndex[buildPantryTransferMergeKey(item)]; exists {
				hasConflict = true
				break
			}
		}
		if hasConflict && req.ConflictPolicy == "" {
			return errors.New("conflict_policy_required")
		}

		for _, sourceItem := range sourceItems {
			key := buildPantryTransferMergeKey(sourceItem)
			targetItem, hasTarget := conflictIndex[key]
			if hasTarget && req.ConflictPolicy == pantryTransferPolicyMerge {
				targetItem.Quantity += sourceItem.Quantity
				targetItem.Note = mergePantryTransferNote(targetItem.Note, sourceItem.Note)
				targetItem.ImageURL = pickPantryTransferAsset(targetItem.ImageURL, sourceItem.ImageURL)
				targetItem.ThumbnailURL = pickPantryTransferAsset(targetItem.ThumbnailURL, sourceItem.ThumbnailURL)
				conflictIndex[key] = targetItem
				updates := map[string]interface{}{
					"quantity":      targetItem.Quantity,
					"updated_by":    userID,
					"note":          targetItem.Note,
					"image_url":     targetItem.ImageURL,
					"thumbnail_url": targetItem.ThumbnailURL,
				}
				if err := tx.Model(&model.LifeTracePantryItem{}).
					Where("id = ?", targetItem.ID).
					Updates(updates).Error; err != nil {
					return err
				}
				resetPantryReminderDeliveries(tx, targetItem.ID)

				result.Items = append(result.Items, pantryTransferResultItem{
					SourceItemID: sourceItem.ID,
					TargetItemID: targetItem.ID,
					Name:         sourceItem.Name,
					Action:       pantryTransferActionMerge,
				})
				result.MergedCount++

				if req.Mode == pantryTransferModeMove {
					if err := tx.Delete(&model.LifeTracePantryItem{}, "id = ? AND household_id = ?", sourceItem.ID, sourceCtx.Household.ID).Error; err != nil {
						return err
					}
					resetPantryReminderDeliveries(tx, sourceItem.ID)
					result.DeletedSourceCount++
				}
				continue
			}

			newItem := sourceItem
			newItem.ID = 0
			newItem.HouseholdID = targetCtx.Household.ID
			newItem.CreatedBy = userID
			newItem.UpdatedBy = userID
			if err := tx.Create(&newItem).Error; err != nil {
				return err
			}
			if req.ConflictPolicy == pantryTransferPolicyMerge {
				conflictIndex[key] = newItem
			}

			result.Items = append(result.Items, pantryTransferResultItem{
				SourceItemID: sourceItem.ID,
				TargetItemID: newItem.ID,
				Name:         sourceItem.Name,
				Action:       pantryTransferActionCreate,
			})
			result.CreatedCount++

			if req.Mode == pantryTransferModeMove {
				if err := tx.Delete(&model.LifeTracePantryItem{}, "id = ? AND household_id = ?", sourceItem.ID, sourceCtx.Household.ID).Error; err != nil {
					return err
				}
				resetPantryReminderDeliveries(tx, sourceItem.ID)
				result.DeletedSourceCount++
			}
		}

		result.ProcessedCount = len(sourceItems)
		return nil
	})
	if err != nil {
		return pantryTransferResponse{}, err
	}

	return result, nil
}

func mergePantryTransferNote(current string, incoming string) string {
	current = strings.TrimSpace(current)
	incoming = strings.TrimSpace(incoming)
	if incoming == "" || strings.Contains(current, incoming) {
		return current
	}
	if current == "" {
		return incoming
	}
	return current + "\n转移补充：" + incoming
}

func pickPantryTransferAsset(current string, incoming string) string {
	current = strings.TrimSpace(current)
	if current != "" {
		return current
	}
	return strings.TrimSpace(incoming)
}
