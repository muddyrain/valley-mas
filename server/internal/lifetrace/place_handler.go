package lifetrace

import (
	"errors"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	lifeTracePlaceStatusVisited = "visited"
	lifeTracePlaceStatusWant    = "want"
)

type placeCreateRequest struct {
	Name      string   `json:"name"`
	Status    string   `json:"status"`
	Favorite  bool     `json:"favorite"`
	City      string   `json:"city"`
	District  string   `json:"district"`
	Address   string   `json:"address"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Note      string   `json:"note"`
}

type placeUpdateRequest struct {
	Name             *string  `json:"name"`
	Status           *string  `json:"status"`
	Favorite         *bool    `json:"favorite"`
	Archived         *bool    `json:"archived"`
	City             *string  `json:"city"`
	District         *string  `json:"district"`
	Address          *string  `json:"address"`
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	ClearCoordinates *bool    `json:"clearCoordinates"`
	Note             *string  `json:"note"`
}

type placeRecordResponse struct {
	ID         model.Int64String `json:"id"`
	RecordType string            `json:"recordType"`
	Title      string            `json:"title"`
	TimeLabel  string            `json:"timeLabel,omitempty"`
	Location   string            `json:"location,omitempty"`
	ImageURL   string            `json:"imageUrl,omitempty"`
	Source     string            `json:"source,omitempty"`
	Completed  bool              `json:"completed,omitempty"`
	Mood       string            `json:"mood,omitempty"`
	Tags       model.StringList  `json:"tags,omitempty"`
	CreatedAt  time.Time         `json:"createdAt"`
}

type placeOccurrence struct {
	location  string
	createdAt time.Time
}

type placeRecordCandidate struct {
	record    placeRecordResponse
	location  string
	placeID   *model.Int64String
	createdAt time.Time
}

type lifeTracePlaceExport struct {
	ExportedAt time.Time                   `json:"exportedAt"`
	Places     []model.LifeTracePlace      `json:"places"`
	Records    []placeExportRecordResponse `json:"records"`
}

type placeExportRecordResponse struct {
	PlaceID model.Int64String   `json:"placeId"`
	Record  placeRecordResponse `json:"record"`
}

func normalizeLifeTracePlaceDisplayName(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func normalizeLifeTracePlaceStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", lifeTracePlaceStatusVisited:
		return lifeTracePlaceStatusVisited
	case lifeTracePlaceStatusWant:
		return lifeTracePlaceStatusWant
	default:
		return ""
	}
}

func validateLifeTraceCoordinates(latitude *float64, longitude *float64) bool {
	if latitude == nil && longitude == nil {
		return true
	}
	if latitude == nil || longitude == nil {
		return false
	}
	if math.IsNaN(*latitude) || math.IsInf(*latitude, 0) {
		return false
	}
	if math.IsNaN(*longitude) || math.IsInf(*longitude, 0) {
		return false
	}
	return *latitude >= -90 && *latitude <= 90 && *longitude >= -180 && *longitude <= 180
}

func normalizeLifeTracePlaceName(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range value {
		if unicode.IsSpace(r) {
			continue
		}
		switch r {
		case '·', '/', '|', ',', '，', '、', ';', '；', ':', '：', '-', '_':
			continue
		default:
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func normalizeOptionalPlaceID(raw string) (*model.Int64String, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	id, err := parseInt64String(raw)
	if err != nil || id <= 0 {
		return nil, false
	}
	return &id, true
}

func resolveLifeTracePlaceInput(
	userID model.Int64String,
	rawPlaceID string,
	rawLocation string,
) (*model.Int64String, string, bool) {
	placeID, ok := normalizeOptionalPlaceID(rawPlaceID)
	if !ok {
		return nil, "", false
	}
	location := normalizeLifeTracePlaceDisplayName(rawLocation)
	if placeID == nil {
		return nil, location, true
	}

	var place model.LifeTracePlace
	err := database.GetDB().First(&place, "id = ? AND user_id = ?", *placeID, userID).Error
	if err != nil {
		return nil, "", false
	}
	if location == "" {
		location = place.Name
	}
	return placeID, location, true
}

func parseInt64String(raw string) (model.Int64String, error) {
	value, err := parsePositiveInt64(raw)
	return model.Int64String(value), err
}

func parsePositiveInt64(raw string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, errors.New("empty id")
	}
	var value int64
	for _, r := range raw {
		if r < '0' || r > '9' {
			return 0, errors.New("invalid id")
		}
		value = value*10 + int64(r-'0')
	}
	if value <= 0 {
		return 0, errors.New("invalid id")
	}
	return value, nil
}

func findLifeTracePlace(id string, userID model.Int64String) (model.LifeTracePlace, bool) {
	var place model.LifeTracePlace
	err := database.GetDB().First(&place, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return place, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return place, false
	}
	return place, false
}

func ensureLifeTracePlace(userID model.Int64String, location string) (*model.LifeTracePlace, error) {
	displayName := normalizeLifeTracePlaceDisplayName(location)
	normalizedName := normalizeLifeTracePlaceName(displayName)
	if displayName == "" || normalizedName == "" {
		return nil, nil
	}

	var place model.LifeTracePlace
	err := database.GetDB().First(
		&place,
		"user_id = ? AND normalized_name = ?",
		userID,
		normalizedName,
	).Error
	if err == nil {
		return &place, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	place = model.LifeTracePlace{
		UserID:         userID,
		Name:           displayName,
		NormalizedName: normalizedName,
		Status:         lifeTracePlaceStatusVisited,
		VisitCount:     0,
	}
	if err := database.GetDB().Create(&place).Error; err != nil {
		return nil, err
	}
	return &place, nil
}

func placeIDChanged(current *model.Int64String, next *model.Int64String) bool {
	if current == nil && next == nil {
		return false
	}
	if current == nil || next == nil {
		return true
	}
	return *current != *next
}

func reconcilePlanPlace(plan *model.LifeTracePlan, previousLocation string) {
	place, err := resolveRecordPlace(plan.UserID, plan.PlaceID, plan.Location)
	if err != nil {
		logLifeTracePlaceError("ensure plan place failed", err, plan.UserID, plan.Location)
		return
	}

	var placeID *model.Int64String
	if place != nil {
		placeID = &place.ID
	}
	if placeIDChanged(plan.PlaceID, placeID) {
		if err := database.GetDB().Model(plan).Updates(map[string]interface{}{"place_id": placeID}).Error; err != nil {
			logLifeTracePlaceError("update plan place failed", err, plan.UserID, plan.Location)
		} else {
			plan.PlaceID = placeID
		}
	}

	recalculateTouchedPlaces(plan.UserID, previousLocation, plan.Location, place)
}

func reconcileTracePlace(trace *model.LifeTraceTrace, previousLocation string) {
	place, err := resolveRecordPlace(trace.UserID, trace.PlaceID, trace.Location)
	if err != nil {
		logLifeTracePlaceError("ensure trace place failed", err, trace.UserID, trace.Location)
		return
	}

	var placeID *model.Int64String
	if place != nil {
		placeID = &place.ID
	}
	if placeIDChanged(trace.PlaceID, placeID) {
		if err := database.GetDB().Model(trace).Updates(map[string]interface{}{"place_id": placeID}).Error; err != nil {
			logLifeTracePlaceError("update trace place failed", err, trace.UserID, trace.Location)
		} else {
			trace.PlaceID = placeID
		}
	}

	recalculateTouchedPlaces(trace.UserID, previousLocation, trace.Location, place)
}

func resolveRecordPlace(
	userID model.Int64String,
	placeID *model.Int64String,
	location string,
) (*model.LifeTracePlace, error) {
	if placeID != nil {
		var place model.LifeTracePlace
		err := database.GetDB().First(&place, "id = ? AND user_id = ?", *placeID, userID).Error
		if err == nil {
			return &place, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}
	return ensureLifeTracePlace(userID, location)
}

func recalculateTouchedPlaces(
	userID model.Int64String,
	previousLocation string,
	nextLocation string,
	nextPlace *model.LifeTracePlace,
) {
	seen := map[model.Int64String]bool{}
	if nextPlace != nil {
		seen[nextPlace.ID] = true
		recalculateLifeTracePlaceStats(nextPlace.ID, userID)
	}

	previousNormalized := normalizeLifeTracePlaceName(previousLocation)
	nextNormalized := normalizeLifeTracePlaceName(nextLocation)
	if previousNormalized == "" || previousNormalized == nextNormalized {
		return
	}

	var previousPlace model.LifeTracePlace
	err := database.GetDB().First(
		&previousPlace,
		"user_id = ? AND normalized_name = ?",
		userID,
		previousNormalized,
	).Error
	if err == nil && !seen[previousPlace.ID] {
		recalculateLifeTracePlaceStats(previousPlace.ID, userID)
	}
}

func recalculateLifeTracePlaceStats(placeID model.Int64String, userID model.Int64String) {
	var place model.LifeTracePlace
	if err := database.GetDB().First(&place, "id = ? AND user_id = ?", placeID, userID).Error; err != nil {
		return
	}

	records := collectLifeTracePlaceRecords(userID, place)
	var firstSeen *time.Time
	var lastSeen *time.Time
	for _, record := range records {
		seenAt := record.createdAt
		if firstSeen == nil || seenAt.Before(*firstSeen) {
			value := seenAt
			firstSeen = &value
		}
		if lastSeen == nil || seenAt.After(*lastSeen) {
			value := seenAt
			lastSeen = &value
		}
	}

	updates := map[string]interface{}{
		"visit_count":   len(records),
		"first_seen_at": firstSeen,
		"last_seen_at":  lastSeen,
	}
	if err := database.GetDB().Model(&place).Updates(updates).Error; err != nil {
		logLifeTracePlaceError("recalculate place stats failed", err, userID, place.Name)
	}
}

func syncLifeTracePlacesForUser(userID model.Int64String) {
	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ? AND location <> ''", userID).
		Find(&plans).Error; err == nil {
		for i := range plans {
			reconcilePlanPlace(&plans[i], "")
		}
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ? AND location <> ''", userID).
		Find(&traces).Error; err == nil {
		for i := range traces {
			reconcileTracePlace(&traces[i], "")
		}
	}
}

func collectLifeTracePlaceRecords(
	userID model.Int64String,
	place model.LifeTracePlace,
) []placeRecordCandidate {
	candidates := []placeRecordCandidate{}

	var plans []model.LifeTracePlan
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Find(&plans).Error; err == nil {
		for _, plan := range plans {
			if !isLifeTraceRecordForPlace(plan.PlaceID, plan.Location, place) {
				continue
			}
			candidates = append(candidates, placeRecordCandidate{
				location:  plan.Location,
				placeID:   plan.PlaceID,
				createdAt: plan.CreatedAt,
				record: placeRecordResponse{
					ID:         plan.ID,
					RecordType: "plan",
					Title:      plan.Title,
					TimeLabel:  plan.TimeLabel,
					Location:   plan.Location,
					ImageURL:   plan.ImageURL,
					Source:     plan.Source,
					Completed:  plan.Completed,
					CreatedAt:  plan.CreatedAt,
				},
			})
		}
	}

	var traces []model.LifeTraceTrace
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Find(&traces).Error; err == nil {
		for _, trace := range traces {
			if !isLifeTraceRecordForPlace(trace.PlaceID, trace.Location, place) {
				continue
			}
			candidates = append(candidates, placeRecordCandidate{
				location:  trace.Location,
				placeID:   trace.PlaceID,
				createdAt: trace.CreatedAt,
				record: placeRecordResponse{
					ID:         trace.ID,
					RecordType: "trace",
					Title:      trace.Title,
					TimeLabel:  trace.TimeLabel,
					Location:   trace.Location,
					ImageURL:   trace.ImageURL,
					Source:     trace.Source,
					Mood:       trace.Mood,
					Tags:       trace.Tags,
					CreatedAt:  trace.CreatedAt,
				},
			})
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].createdAt.After(candidates[j].createdAt)
	})
	return candidates
}

func isLifeTraceRecordForPlace(
	recordPlaceID *model.Int64String,
	location string,
	place model.LifeTracePlace,
) bool {
	if recordPlaceID != nil && *recordPlaceID == place.ID {
		return true
	}
	return normalizeLifeTracePlaceName(location) == place.NormalizedName
}

func logLifeTracePlaceError(message string, err error, userID model.Int64String, location string) {
	if logger.Log == nil {
		return
	}
	logger.Log.WithFields(map[string]interface{}{
		"userId":   userID.String(),
		"location": location,
	}).WithError(err).Warn(message)
}

func (h *Handler) ListPlaces(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	syncLifeTracePlacesForUser(userID)

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	query := database.GetDB().Model(&model.LifeTracePlace{}).Where("user_id = ?", userID)

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(name LIKE ? OR note LIKE ?)", like, like)
	}

	if favorite := strings.TrimSpace(c.Query("favorite")); favorite == "true" || favorite == "false" {
		query = query.Where("favorite = ?", favorite == "true")
	}

	if status := normalizeLifeTracePlaceStatus(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}

	archived := strings.TrimSpace(c.Query("archived"))
	if archived == "true" || archived == "false" {
		query = query.Where("archived = ?", archived == "true")
	} else {
		query = query.Where("archived = ?", false)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取地点失败")
		return
	}

	var places []model.LifeTracePlace
	if err := query.
		Order("favorite DESC, visit_count DESC, last_seen_at DESC, updated_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&places).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取地点失败")
		return
	}

	success(c, gin.H{
		"list":       places,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreatePlace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req placeCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := normalizeLifeTracePlaceDisplayName(req.Name)
	normalizedName := normalizeLifeTracePlaceName(name)
	if name == "" || normalizedName == "" {
		fail(c, http.StatusBadRequest, "地点名称不能为空")
		return
	}

	status := normalizeLifeTracePlaceStatus(req.Status)
	if status == "" {
		fail(c, http.StatusBadRequest, "地点状态无效")
		return
	}
	if !validateLifeTraceCoordinates(req.Latitude, req.Longitude) {
		fail(c, http.StatusBadRequest, "经纬度范围无效")
		return
	}

	var existing model.LifeTracePlace
	err := database.GetDB().First(
		&existing,
		"user_id = ? AND normalized_name = ?",
		userID,
		normalizedName,
	).Error
	if err == nil {
		fail(c, http.StatusBadRequest, "地点已存在")
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		fail(c, http.StatusInternalServerError, "检查地点失败")
		return
	}

	place := model.LifeTracePlace{
		UserID:         userID,
		Name:           name,
		NormalizedName: normalizedName,
		Status:         status,
		Favorite:       req.Favorite,
		City:           strings.TrimSpace(req.City),
		District:       strings.TrimSpace(req.District),
		Address:        strings.TrimSpace(req.Address),
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Note:           strings.TrimSpace(req.Note),
		VisitCount:     0,
	}
	if err := database.GetDB().Create(&place).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建地点失败")
		return
	}

	success(c, place)
}

func (h *Handler) GetPlace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	syncLifeTracePlacesForUser(userID)
	place, found := findLifeTracePlace(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "地点不存在")
		return
	}
	recalculateLifeTracePlaceStats(place.ID, userID)
	if err := database.GetDB().First(&place, "id = ? AND user_id = ?", place.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取地点失败")
		return
	}
	success(c, place)
}

func (h *Handler) UpdatePlace(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	place, found := findLifeTracePlace(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "地点不存在")
		return
	}

	var req placeUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		name := normalizeLifeTracePlaceDisplayName(*req.Name)
		normalizedName := normalizeLifeTracePlaceName(name)
		if name == "" || normalizedName == "" {
			fail(c, http.StatusBadRequest, "地点名称不能为空")
			return
		}
		var existing model.LifeTracePlace
		err := database.GetDB().First(
			&existing,
			"user_id = ? AND normalized_name = ? AND id <> ?",
			userID,
			normalizedName,
			place.ID,
		).Error
		if err == nil {
			fail(c, http.StatusBadRequest, "地点已存在")
			return
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			fail(c, http.StatusInternalServerError, "检查地点失败")
			return
		}
		updates["name"] = name
		updates["normalized_name"] = normalizedName
	}
	if req.Status != nil {
		status := normalizeLifeTracePlaceStatus(*req.Status)
		if status == "" {
			fail(c, http.StatusBadRequest, "地点状态无效")
			return
		}
		updates["status"] = status
	}
	if req.Favorite != nil {
		updates["favorite"] = *req.Favorite
	}
	if req.Archived != nil {
		updates["archived"] = *req.Archived
	}
	if req.City != nil {
		updates["city"] = strings.TrimSpace(*req.City)
	}
	if req.District != nil {
		updates["district"] = strings.TrimSpace(*req.District)
	}
	if req.Address != nil {
		updates["address"] = strings.TrimSpace(*req.Address)
	}
	if req.ClearCoordinates != nil && *req.ClearCoordinates {
		updates["latitude"] = nil
		updates["longitude"] = nil
	} else if req.Latitude != nil || req.Longitude != nil {
		if !validateLifeTraceCoordinates(req.Latitude, req.Longitude) {
			fail(c, http.StatusBadRequest, "经纬度范围无效")
			return
		}
		updates["latitude"] = req.Latitude
		updates["longitude"] = req.Longitude
	}
	if req.Note != nil {
		updates["note"] = strings.TrimSpace(*req.Note)
	}

	if len(updates) > 0 {
		if err := database.GetDB().Model(&place).Updates(updates).Error; err != nil {
			fail(c, http.StatusInternalServerError, "更新地点失败")
			return
		}
	}

	recalculateLifeTracePlaceStats(place.ID, userID)
	if err := database.GetDB().First(&place, "id = ? AND user_id = ?", place.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取地点失败")
		return
	}
	success(c, place)
}

func (h *Handler) ExportPlaces(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	syncLifeTracePlacesForUser(userID)

	var places []model.LifeTracePlace
	if err := database.GetDB().
		Where("user_id = ?", userID).
		Order("favorite DESC, status ASC, visit_count DESC, last_seen_at DESC, updated_at DESC").
		Find(&places).Error; err != nil {
		fail(c, http.StatusInternalServerError, "导出地点失败")
		return
	}

	records := []placeExportRecordResponse{}
	for _, place := range places {
		candidates := collectLifeTracePlaceRecords(userID, place)
		for _, candidate := range candidates {
			records = append(records, placeExportRecordResponse{
				PlaceID: place.ID,
				Record:  candidate.record,
			})
		}
	}

	success(c, lifeTracePlaceExport{
		ExportedAt: time.Now(),
		Places:     places,
		Records:    records,
	})
}

func (h *Handler) ListPlaceRecords(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	syncLifeTracePlacesForUser(userID)
	place, found := findLifeTracePlace(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "地点不存在")
		return
	}

	page, pageSize := parseListPagination(c)
	records := collectLifeTracePlaceRecords(userID, place)
	total := int64(len(records))
	start := (page - 1) * pageSize
	end := start + pageSize
	if start > len(records) {
		start = len(records)
	}
	if end > len(records) {
		end = len(records)
	}

	list := []placeRecordResponse{}
	for _, candidate := range records[start:end] {
		list = append(list, candidate.record)
	}

	success(c, gin.H{
		"list":       list,
		"pagination": buildListPagination(page, pageSize, total),
	})
}
