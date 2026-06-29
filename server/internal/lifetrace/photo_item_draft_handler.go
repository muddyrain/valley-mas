package lifetrace

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxPhotoItemDraftHistory = 8

type photoItemDraftSyncRequest struct {
	Items []map[string]interface{} `json:"items"`
}

func normalizePhotoItemDraftStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "saved":
		return "saved"
	default:
		return "draft"
	}
}

func photoItemDraftString(payload map[string]interface{}, key string) string {
	value, ok := payload[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func photoItemDraftTime(payload map[string]interface{}, key string, fallback time.Time) time.Time {
	value := photoItemDraftString(payload, key)
	if value == "" {
		return fallback
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return fallback
	}
	return parsed
}

func buildPhotoItemDraftRecord(
	userID model.Int64String,
	draftID string,
	payload map[string]interface{},
) (model.LifeTracePhotoItemDraft, bool) {
	draftID = strings.TrimSpace(draftID)
	if draftID == "" {
		return model.LifeTracePhotoItemDraft{}, false
	}
	if payloadID := photoItemDraftString(payload, "id"); payloadID != "" && payloadID != draftID {
		return model.LifeTracePhotoItemDraft{}, false
	}
	payload["id"] = draftID

	raw, err := json.Marshal(payload)
	if err != nil || !json.Valid(raw) {
		return model.LifeTracePhotoItemDraft{}, false
	}

	now := time.Now()
	createdAt := photoItemDraftTime(payload, "createdAt", now)
	updatedAt := photoItemDraftTime(payload, "updatedAt", createdAt)
	return model.LifeTracePhotoItemDraft{
		ID:          model.Int64String(utils.GenerateID()),
		UserID:      userID,
		DraftID:     draftID,
		ImageURL:    photoItemDraftString(payload, "imageUrl"),
		Status:      normalizePhotoItemDraftStatus(photoItemDraftString(payload, "status")),
		SavedItemID: photoItemDraftString(payload, "savedItemId"),
		Payload:     string(raw),
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, true
}

func upsertPhotoItemDraft(record model.LifeTracePhotoItemDraft) error {
	return database.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "draft_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"image_url",
			"status",
			"saved_item_id",
			"payload",
			"updated_at",
		}),
	}).Create(&record).Error
}

func trimPhotoItemDraftHistory(userID model.Int64String) {
	var records []model.LifeTracePhotoItemDraft
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("updated_at DESC").
		Order("created_at DESC").
		Find(&records).Error; err != nil {
		return
	}
	if len(records) <= maxPhotoItemDraftHistory {
		return
	}
	for _, record := range records[maxPhotoItemDraftHistory:] {
		_ = database.GetDB().Delete(&record).Error
	}
}

func (h *Handler) ListPhotoItemDrafts(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var records []model.LifeTracePhotoItemDraft
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("updated_at DESC").
		Order("created_at DESC").
		Limit(maxPhotoItemDraftHistory).
		Find(&records).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取库存草稿失败")
		return
	}

	list := make([]json.RawMessage, 0, len(records))
	for _, record := range records {
		raw := json.RawMessage(record.Payload)
		if json.Valid(raw) {
			list = append(list, raw)
		}
	}
	success(c, gin.H{"list": list})
}

func (h *Handler) UpsertPhotoItemDraft(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	record, valid := buildPhotoItemDraftRecord(userID, c.Param("draftId"), payload)
	if !valid {
		fail(c, http.StatusBadRequest, "草稿数据不完整")
		return
	}
	if err := upsertPhotoItemDraft(record); err != nil {
		fail(c, http.StatusInternalServerError, "保存库存草稿失败")
		return
	}
	trimPhotoItemDraftHistory(userID)

	success(c, json.RawMessage(record.Payload))
}

func (h *Handler) SyncPhotoItemDrafts(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req photoItemDraftSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	synced := 0
	for _, item := range req.Items {
		draftID := photoItemDraftString(item, "id")
		record, valid := buildPhotoItemDraftRecord(userID, draftID, item)
		if !valid {
			continue
		}
		if err := upsertPhotoItemDraft(record); err != nil {
			fail(c, http.StatusInternalServerError, "同步库存草稿失败")
			return
		}
		synced += 1
	}
	trimPhotoItemDraftHistory(userID)

	success(c, gin.H{"synced": synced})
}

func (h *Handler) DeletePhotoItemDraft(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	draftID := strings.TrimSpace(c.Param("draftId"))
	if draftID == "" {
		fail(c, http.StatusBadRequest, "草稿不存在")
		return
	}

	var record model.LifeTracePhotoItemDraft
	err := database.GetDB().
		Where("user_id = ? AND draft_id = ?", userID, draftID).
		First(&record).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			success(c, gin.H{"id": draftID})
			return
		}
		fail(c, http.StatusInternalServerError, "删除库存草稿失败")
		return
	}

	if err := database.GetDB().Delete(&record).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除库存草稿失败")
		return
	}

	success(c, gin.H{"id": draftID})
}
