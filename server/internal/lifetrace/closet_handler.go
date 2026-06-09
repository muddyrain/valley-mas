package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type closetItemRequest struct {
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Color       string   `json:"color"`
	Material    string   `json:"material"`
	WarmthLevel string   `json:"warmthLevel"`
	Seasons     []string `json:"seasons"`
	SceneTags   []string `json:"sceneTags"`
	Status      string   `json:"status"`
	ImageURL    string   `json:"imageUrl"`
	Shared      bool     `json:"shared"`
	Note        string   `json:"note"`
}

type outfitRequest struct {
	Title       string   `json:"title"`
	ItemIDs     []string `json:"itemIds"`
	Scene       string   `json:"scene"`
	WeatherText string   `json:"weatherText"`
	MinTemp     int      `json:"minTemp"`
	MaxTemp     int      `json:"maxTemp"`
	PlanID      string   `json:"planId"`
	WornDate    string   `json:"wornDate"`
	Rating      int      `json:"rating"`
	Note        string   `json:"note"`
	ImageURL    string   `json:"imageUrl"`
	Shared      bool     `json:"shared"`
	Status      string   `json:"status"`
}

type outfitStatusRequest struct {
	Status   string `json:"status"`
	WornDate string `json:"wornDate"`
	Rating   int    `json:"rating"`
	Note     string `json:"note"`
}

type clothingPhotoAnalysisRequest struct {
	ImageURL    string `json:"imageUrl"`
	ImageBase64 string `json:"imageBase64"`
	HouseholdID string `json:"householdId"`
	Hint        string `json:"hint"`
}

type outfitSuggestionsRequest struct {
	HouseholdID  string   `json:"householdId"`
	WeatherText  string   `json:"weatherText"`
	Temperature  int      `json:"temperature"`
	LowTemp      int      `json:"lowTemp"`
	HighTemp     int      `json:"highTemp"`
	Precip       string   `json:"precip"`
	PlanType     string   `json:"planType"`
	Scene        string   `json:"scene"`
	PlanTitle    string   `json:"planTitle"`
	ExcludeIDs   []string `json:"excludeIds"`
	PreferShared bool     `json:"preferShared"`
}

type clothingPhotoAnalysisAIResponse struct {
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Color       string   `json:"color"`
	Material    string   `json:"material"`
	WarmthLevel string   `json:"warmthLevel"`
	Seasons     []string `json:"seasons"`
	SceneTags   []string `json:"sceneTags"`
	Summary     string   `json:"summary"`
	Confidence  float64  `json:"confidence"`
	Warnings    []string `json:"warnings"`
}

type outfitSuggestion struct {
	Title       string                      `json:"title"`
	Summary     string                      `json:"summary"`
	ItemIDs     []model.Int64String         `json:"itemIds"`
	Items       []model.LifeTraceClosetItem `json:"items"`
	Scene       string                      `json:"scene"`
	WeatherText string                      `json:"weatherText,omitempty"`
	Score       int                         `json:"score"`
	Source      string                      `json:"source"`
	Model       string                      `json:"model,omitempty"`
}

type outfitSuggestionAIResponse struct {
	Suggestions []struct {
		Title   string   `json:"title"`
		Summary string   `json:"summary"`
		ItemIDs []string `json:"itemIds"`
	} `json:"suggestions"`
}

var validClosetCategories = map[string]bool{
	"上装": true,
	"下装": true,
	"外套": true,
	"鞋履": true,
	"配饰": true,
	"包袋": true,
	"套装": true,
	"其他": true,
}

var validClosetWarmthLevels = map[string]bool{
	"轻薄": true,
	"常规": true,
	"保暖": true,
	"厚重": true,
}

var validClosetSeasons = map[string]bool{
	"春":  true,
	"夏":  true,
	"秋":  true,
	"冬":  true,
	"四季": true,
}

var validClosetStatuses = map[string]bool{
	"active":   true,
	"laundry":  true,
	"archived": true,
}

var validOutfitStatuses = map[string]bool{
	"planned": true,
	"worn":    true,
	"saved":   true,
}

func normalizeClosetCategory(value string) string {
	value = strings.TrimSpace(value)
	if !validClosetCategories[value] {
		return "上装"
	}
	return value
}

func normalizeClosetColor(value string) string {
	value = trimRunes(strings.TrimSpace(value), 12)
	if value == "" {
		return "未标注"
	}
	return value
}

func normalizeClosetWarmthLevel(value string) string {
	value = strings.TrimSpace(value)
	if !validClosetWarmthLevels[value] {
		return "常规"
	}
	return value
}

func normalizeClosetSeasons(values []string) model.StringList {
	result := make([]string, 0, 4)
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if !validClosetSeasons[value] || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
		if len(result) >= 4 {
			break
		}
	}
	if len(result) == 0 {
		result = append(result, "四季")
	}
	return model.StringList(result)
}

func normalizeClosetSceneTags(values []string) model.StringList {
	result := make([]string, 0, 6)
	seen := map[string]bool{}
	for _, value := range values {
		value = trimRunes(strings.TrimSpace(value), 10)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
		if len(result) >= 6 {
			break
		}
	}
	if len(result) == 0 {
		result = append(result, "日常")
	}
	return model.StringList(result)
}

func normalizeClosetStatus(value string) string {
	value = strings.TrimSpace(value)
	if !validClosetStatuses[value] {
		return "active"
	}
	return value
}

func normalizeOutfitStatus(value string) string {
	value = strings.TrimSpace(value)
	if !validOutfitStatuses[value] {
		return "planned"
	}
	return value
}

func normalizeOutfitScene(value string) string {
	value = trimRunes(strings.TrimSpace(value), 16)
	if value == "" {
		return "日常"
	}
	return value
}

func normalizeClosetDate(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if _, err := time.Parse("2006-01-02", value); err != nil {
		return ""
	}
	return value
}

func normalizeClosetRating(value int) int {
	if value < 0 {
		return 0
	}
	if value > 5 {
		return 5
	}
	return value
}

func (h *Handler) ListClosetItems(c *gin.Context) {
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
	query := database.GetDB().Model(&model.LifeTraceClosetItem{}).
		Where("household_id = ?", householdCtx.Household.ID)
	if householdCtx.Household.Kind == householdKindPersonal {
		query = query.Where("user_id = ?", userID)
	} else {
		query = query.Where("shared = ?", true)
	}
	query = applyClosetItemFilters(query, c)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取衣橱失败")
		return
	}

	var items []model.LifeTraceClosetItem
	if err := query.Order("updated_at DESC").Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取衣橱失败")
		return
	}

	success(c, gin.H{
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"list":          items,
		"pagination":    buildListPagination(page, pageSize, total),
		"summary":       buildClosetItemSummary(items, total),
	})
}

func applyClosetItemFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	if category := strings.TrimSpace(c.Query("category")); validClosetCategories[category] {
		query = query.Where("category = ?", category)
	}
	status := strings.TrimSpace(c.Query("status"))
	if status == "" || status == "all" {
		query = query.Where("status = ?", "active")
	} else if validClosetStatuses[status] {
		query = query.Where("status = ?", status)
	}
	if shared := strings.TrimSpace(c.Query("shared")); shared == "true" {
		query = query.Where("shared = ?", true)
	} else if shared == "false" {
		query = query.Where("shared = ?", false)
	}
	if keyword := strings.TrimSpace(c.Query("q")); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(name LIKE ? OR color LIKE ? OR material LIKE ? OR note LIKE ?)", like, like, like, like)
	}
	return query
}

func buildClosetItemSummary(items []model.LifeTraceClosetItem, total int64) gin.H {
	active := 0
	shared := 0
	categories := map[string]int{}
	for _, item := range items {
		if item.Status == "active" {
			active++
		}
		if item.Shared {
			shared++
		}
		categories[item.Category]++
	}
	return gin.H{
		"total":      total,
		"active":     active,
		"shared":     shared,
		"categories": categories,
	}
}

func (h *Handler) GetClosetItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	item, householdCtx, found := findAccessibleClosetItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "衣物不存在")
		return
	}
	memberCount, err := activeHouseholdMemberCount(householdCtx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取衣物失败")
		return
	}
	success(c, gin.H{
		"item":      item,
		"household": householdSummaryFromContext(householdCtx, memberCount),
	})
}

func (h *Handler) CreateClosetItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	var req closetItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "衣物名称不能为空")
		return
	}
	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	shared := req.Shared && householdCtx.Household.Kind == householdKindShared
	item := model.LifeTraceClosetItem{
		UserID:      userID,
		HouseholdID: householdCtx.Household.ID,
		Name:        trimRunes(name, 160),
		Category:    normalizeClosetCategory(req.Category),
		Color:       normalizeClosetColor(req.Color),
		Material:    trimRunes(strings.TrimSpace(req.Material), 80),
		WarmthLevel: normalizeClosetWarmthLevel(req.WarmthLevel),
		Seasons:     normalizeClosetSeasons(req.Seasons),
		SceneTags:   normalizeClosetSceneTags(req.SceneTags),
		Status:      normalizeClosetStatus(req.Status),
		ImageURL:    strings.TrimSpace(req.ImageURL),
		Shared:      shared,
		Note:        strings.TrimSpace(req.Note),
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}
	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建衣物失败")
		return
	}
	success(c, item)
}

func (h *Handler) UpdateClosetItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	item, householdCtx, found := findAccessibleClosetItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "衣物不存在")
		return
	}
	if householdCtx.Household.Status != householdStatusActive {
		fail(c, http.StatusForbidden, "共享空间已归档")
		return
	}
	if item.UserID != userID && householdCtx.Member.Role == householdRoleMember {
		fail(c, http.StatusForbidden, "无权编辑这件衣物")
		return
	}
	var req closetItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "衣物名称不能为空")
		return
	}
	shared := req.Shared && householdCtx.Household.Kind == householdKindShared
	updates := map[string]interface{}{
		"name":         trimRunes(name, 160),
		"category":     normalizeClosetCategory(req.Category),
		"color":        normalizeClosetColor(req.Color),
		"material":     trimRunes(strings.TrimSpace(req.Material), 80),
		"warmth_level": normalizeClosetWarmthLevel(req.WarmthLevel),
		"seasons":      normalizeClosetSeasons(req.Seasons),
		"scene_tags":   normalizeClosetSceneTags(req.SceneTags),
		"status":       normalizeClosetStatus(req.Status),
		"image_url":    strings.TrimSpace(req.ImageURL),
		"shared":       shared,
		"note":         strings.TrimSpace(req.Note),
		"updated_by":   userID,
	}
	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新衣物失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ?", item.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取衣物失败")
		return
	}
	success(c, item)
}

func (h *Handler) DeleteClosetItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	item, householdCtx, found := findAccessibleClosetItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "衣物不存在")
		return
	}
	if item.UserID != userID && householdCtx.Member.Role == householdRoleMember {
		fail(c, http.StatusForbidden, "无权删除这件衣物")
		return
	}
	if err := database.GetDB().Delete(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除衣物失败")
		return
	}
	success(c, gin.H{"id": item.ID})
}

func (h *Handler) ListOutfits(c *gin.Context) {
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
	query := database.GetDB().Model(&model.LifeTraceOutfit{}).Where("household_id = ?", householdCtx.Household.ID)
	if householdCtx.Household.Kind == householdKindPersonal {
		query = query.Where("user_id = ?", userID)
	} else {
		query = query.Where("shared = ?", true)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" && status != "all" && validOutfitStatuses[status] {
		query = query.Where("status = ?", status)
	}
	if scene := strings.TrimSpace(c.Query("scene")); scene != "" {
		query = query.Where("scene = ?", scene)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取穿搭失败")
		return
	}
	var outfits []model.LifeTraceOutfit
	if err := query.Order("updated_at DESC").Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&outfits).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取穿搭失败")
		return
	}
	success(c, gin.H{
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"list":          outfits,
		"pagination":    buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) GetOutfit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	outfit, householdCtx, found := findAccessibleOutfit(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "穿搭不存在")
		return
	}
	items, err := loadAccessibleClosetItemsByIDs(userID, householdCtx, parseOutfitItemIDs(outfit.ItemIDs))
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取穿搭失败")
		return
	}
	memberCount, err := activeHouseholdMemberCount(householdCtx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取穿搭失败")
		return
	}
	success(c, gin.H{
		"outfit":    outfit,
		"items":     items,
		"household": householdSummaryFromContext(householdCtx, memberCount),
	})
}

func (h *Handler) CreateOutfit(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	var req outfitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	outfit, errMsg := buildOutfitFromRequest(req, userID, householdCtx)
	if errMsg != "" {
		fail(c, http.StatusBadRequest, errMsg)
		return
	}
	if err := database.GetDB().Create(&outfit).Error; err != nil {
		fail(c, http.StatusInternalServerError, "保存穿搭失败")
		return
	}
	success(c, outfit)
}

func (h *Handler) UpdateOutfitStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	outfit, householdCtx, found := findAccessibleOutfit(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "穿搭不存在")
		return
	}
	var req outfitStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	status := normalizeOutfitStatus(req.Status)
	wornDate := normalizeClosetDate(req.WornDate)
	if status == "worn" && wornDate == "" {
		wornDate = time.Now().Format("2006-01-02")
	}
	updates := map[string]interface{}{
		"status":     status,
		"worn_date":  wornDate,
		"rating":     normalizeClosetRating(req.Rating),
		"note":       strings.TrimSpace(req.Note),
		"updated_by": userID,
	}
	if err := database.GetDB().Model(&outfit).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新穿搭失败")
		return
	}
	if err := database.GetDB().First(&outfit, "id = ?", outfit.ID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取穿搭失败")
		return
	}
	if status == "worn" {
		writeOutfitTrace(userID, outfit, householdCtx.Household.Name)
	}
	success(c, outfit)
}

func buildOutfitFromRequest(req outfitRequest, userID model.Int64String, householdCtx householdContext) (model.LifeTraceOutfit, string) {
	itemIDs, errMsg := normalizeOutfitItemIDs(req.ItemIDs)
	if errMsg != "" {
		return model.LifeTraceOutfit{}, errMsg
	}
	items, err := loadAccessibleClosetItemsByIDs(userID, householdCtx, itemIDs)
	if err != nil {
		return model.LifeTraceOutfit{}, "读取衣物失败"
	}
	if len(items) != len(itemIDs) {
		return model.LifeTraceOutfit{}, "穿搭包含不可访问的衣物"
	}
	shared := req.Shared && householdCtx.Household.Kind == householdKindShared
	if shared {
		for _, item := range items {
			if !item.Shared || item.HouseholdID != householdCtx.Household.ID {
				return model.LifeTraceOutfit{}, "共享穿搭只能使用共享衣物"
			}
		}
	}
	title := trimRunes(strings.TrimSpace(req.Title), 160)
	if title == "" {
		title = buildOutfitTitle(items)
	}
	return model.LifeTraceOutfit{
		UserID:      userID,
		HouseholdID: householdCtx.Household.ID,
		Title:       title,
		ItemIDs:     model.StringList(int64StringsToText(itemIDs)),
		Scene:       normalizeOutfitScene(req.Scene),
		WeatherText: trimRunes(strings.TrimSpace(req.WeatherText), 120),
		MinTemp:     req.MinTemp,
		MaxTemp:     req.MaxTemp,
		PlanID:      parseOptionalInt64String(req.PlanID),
		WornDate:    normalizeClosetDate(req.WornDate),
		Rating:      normalizeClosetRating(req.Rating),
		Note:        strings.TrimSpace(req.Note),
		ImageURL:    strings.TrimSpace(req.ImageURL),
		Shared:      shared,
		Status:      normalizeOutfitStatus(req.Status),
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}, ""
}

func normalizeOutfitItemIDs(values []string) ([]model.Int64String, string) {
	result := make([]model.Int64String, 0, len(values))
	seen := map[model.Int64String]bool{}
	for _, value := range values {
		id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil || id <= 0 {
			continue
		}
		modelID := model.Int64String(id)
		if seen[modelID] {
			continue
		}
		seen[modelID] = true
		result = append(result, modelID)
	}
	if len(result) == 0 {
		return nil, "请至少选择一件衣物"
	}
	return result, ""
}

func int64StringsToText(values []model.Int64String) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, value.String())
	}
	return result
}

func parseOptionalInt64String(value string) *model.Int64String {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil
	}
	modelID := model.Int64String(id)
	return &modelID
}

func parseOutfitItemIDs(values model.StringList) []model.Int64String {
	result := make([]model.Int64String, 0, len(values))
	for _, value := range values {
		id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err == nil && id > 0 {
			result = append(result, model.Int64String(id))
		}
	}
	return result
}

func buildOutfitTitle(items []model.LifeTraceClosetItem) string {
	parts := make([]string, 0, 3)
	for _, item := range items {
		parts = append(parts, item.Name)
		if len(parts) >= 3 {
			break
		}
	}
	if len(parts) == 0 {
		return "今日穿搭"
	}
	return trimRunes(strings.Join(parts, " + "), 160)
}

func (h *Handler) AnalyzeClothingPhoto(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	var req clothingPhotoAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "请求内容不正确")
		return
	}
	imageInput := strings.TrimSpace(req.ImageBase64)
	if imageInput == "" {
		imageInput = strings.TrimSpace(req.ImageURL)
	}
	if imageInput == "" {
		fail(c, http.StatusBadRequest, "请先提供要识别的衣物图片")
		return
	}
	if strings.TrimSpace(req.HouseholdID) != "" {
		query := c.Request.URL.Query()
		query.Set("householdId", strings.TrimSpace(req.HouseholdID))
		c.Request.URL.RawQuery = query.Encode()
	}
	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	aiCfg, errMsg := readLifeTraceImageAIConfig()
	if errMsg != "" {
		fail(c, http.StatusServiceUnavailable, errMsg)
		return
	}
	prompt := buildClothingPhotoAnalysisPrompt(req.Hint, householdCtx.Household.Name, aiCfg.UseVision)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-clothing-photo", userID.String())
	defer cancel()
	raw, modelName, err := callLifeTraceImageAI(aiCtx, aiCfg, imageInput, prompt)
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 衣物识别失败："+err.Error())
		return
	}
	parsed, err := parseClothingPhotoAnalysisAIResponse(raw)
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 衣物识别解析失败："+err.Error())
		return
	}
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	success(c, gin.H{
		"name":          parsed.Name,
		"category":      parsed.Category,
		"color":         parsed.Color,
		"material":      parsed.Material,
		"warmthLevel":   parsed.WarmthLevel,
		"seasons":       parsed.Seasons,
		"sceneTags":     parsed.SceneTags,
		"summary":       parsed.Summary,
		"confidence":    parsed.Confidence,
		"warnings":      parsed.Warnings,
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"source":        "ark",
		"model":         modelName,
	})
}

func buildClothingPhotoAnalysisPrompt(hint string, householdName string, useVision bool) string {
	imageInstruction := "请直接观察图片中的衣物主体。"
	if !useVision {
		imageInstruction = "如果无法看到图片，只根据用户提示生成保守草稿。"
	}
	return strings.Join([]string{
		"你是 Life Trace 的衣橱识别 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"name\":\"衣物名称，24字以内\",\"category\":\"上装|下装|外套|鞋履|配饰|包袋|套装|其他\",\"color\":\"主色，12字以内\",\"material\":\"材质或面料，20字以内\",\"warmthLevel\":\"轻薄|常规|保暖|厚重\",\"seasons\":[\"春\"],\"sceneTags\":[\"通勤\"],\"summary\":\"识别摘要，60字以内\",\"confidence\":0.7,\"warnings\":[\"提醒\"]}",
		imageInstruction,
		"seasons 只能从 春、夏、秋、冬、四季 中选择 1-4 个；sceneTags 输出 1-4 个简体中文短标签。",
		"不要编造品牌、价格、尺码或用户没有提供的信息。",
		"",
		fmt.Sprintf("当前空间：%s", householdName),
		fmt.Sprintf("用户提示：%s", emptyInboxPromptText(hint)),
	}, "\n")
}

func parseClothingPhotoAnalysisAIResponse(raw string) (clothingPhotoAnalysisAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return clothingPhotoAnalysisAIResponse{}, errors.New("missing JSON object")
	}
	var parsed clothingPhotoAnalysisAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return clothingPhotoAnalysisAIResponse{}, err
	}
	parsed.Name = trimRunes(strings.TrimSpace(parsed.Name), 24)
	if parsed.Name == "" {
		parsed.Name = "未命名衣物"
	}
	parsed.Category = normalizeClosetCategory(parsed.Category)
	parsed.Color = normalizeClosetColor(parsed.Color)
	parsed.Material = trimRunes(strings.TrimSpace(parsed.Material), 20)
	parsed.WarmthLevel = normalizeClosetWarmthLevel(parsed.WarmthLevel)
	parsed.Seasons = normalizeClosetSeasons(parsed.Seasons)
	parsed.SceneTags = normalizeClosetSceneTags(parsed.SceneTags)
	parsed.Summary = trimRunes(strings.TrimSpace(parsed.Summary), 60)
	if parsed.Summary == "" {
		parsed.Summary = "已生成衣物草稿，保存前可以继续调整。"
	}
	parsed.Confidence = normalizePantryPhotoConfidence(parsed.Confidence)
	parsed.Warnings = normalizePantryPhotoWarnings(parsed.Warnings)
	return parsed, nil
}

func (h *Handler) GenerateOutfitSuggestions(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}
	var req outfitSuggestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	if strings.TrimSpace(req.HouseholdID) != "" {
		query := c.Request.URL.Query()
		query.Set("householdId", strings.TrimSpace(req.HouseholdID))
		c.Request.URL.RawQuery = query.Encode()
	}
	householdCtx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	items, err := loadClosetSuggestionItems(userID, householdCtx, req)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取衣橱失败")
		return
	}
	suggestions := buildRuleOutfitSuggestions(items, req)
	modelName := ""
	if len(items) >= 2 {
		if aiSuggestions, aiModel := tryBuildAIOutfitSuggestions(c, userID, items, req, suggestions); len(aiSuggestions) > 0 {
			suggestions = aiSuggestions
			modelName = aiModel
		}
	}
	for index := range suggestions {
		if suggestions[index].Model == "" {
			suggestions[index].Model = modelName
		}
	}
	success(c, gin.H{
		"householdId":   householdCtx.Household.ID,
		"householdName": householdCtx.Household.Name,
		"suggestions":   suggestions,
		"source":        "rule-ai",
		"model":         modelName,
	})
}

func loadClosetSuggestionItems(userID model.Int64String, householdCtx householdContext, req outfitSuggestionsRequest) ([]model.LifeTraceClosetItem, error) {
	query := database.GetDB().Where("household_id = ? AND status = ?", householdCtx.Household.ID, "active")
	if householdCtx.Household.Kind == householdKindPersonal {
		query = query.Where("user_id = ?", userID)
	} else {
		query = query.Where("shared = ?", true)
	}
	if req.PreferShared {
		query = query.Where("shared = ?", true)
	}
	excluded := parseClosetIDSet(req.ExcludeIDs)
	if len(excluded) > 0 {
		ids := make([]model.Int64String, 0, len(excluded))
		for id := range excluded {
			ids = append(ids, id)
		}
		query = query.Where("id NOT IN ?", ids)
	}
	var items []model.LifeTraceClosetItem
	return items, query.Order("updated_at DESC").Limit(80).Find(&items).Error
}

func parseClosetIDSet(values []string) map[model.Int64String]bool {
	result := map[model.Int64String]bool{}
	for _, value := range values {
		id, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err == nil && id > 0 {
			result[model.Int64String(id)] = true
		}
	}
	return result
}

func buildRuleOutfitSuggestions(items []model.LifeTraceClosetItem, req outfitSuggestionsRequest) []outfitSuggestion {
	if len(items) == 0 {
		return []outfitSuggestion{}
	}
	scored := make([]struct {
		item  model.LifeTraceClosetItem
		score int
	}, 0, len(items))
	for _, item := range items {
		scored = append(scored, struct {
			item  model.LifeTraceClosetItem
			score int
		}{item: item, score: scoreClosetItemForSuggestion(item, req)})
	}
	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})
	picks := pickOutfitItems(scored)
	if len(picks) == 0 {
		return []outfitSuggestion{}
	}
	title := "今日轻量穿搭"
	if scene := normalizeOutfitScene(req.Scene); scene != "日常" {
		title = scene + "穿搭"
	}
	summary := buildRuleOutfitSummary(picks, req)
	score := 0
	for _, pick := range picks {
		score += scoreClosetItemForSuggestion(pick, req)
	}
	return []outfitSuggestion{{
		Title:       title,
		Summary:     summary,
		ItemIDs:     closetItemIDs(picks),
		Items:       picks,
		Scene:       normalizeOutfitScene(req.Scene),
		WeatherText: strings.TrimSpace(req.WeatherText),
		Score:       score,
		Source:      "rule",
	}}
}

func pickOutfitItems(scored []struct {
	item  model.LifeTraceClosetItem
	score int
}) []model.LifeTraceClosetItem {
	categories := []string{"上装", "下装", "外套", "鞋履", "套装", "配饰"}
	picks := make([]model.LifeTraceClosetItem, 0, 4)
	seen := map[model.Int64String]bool{}
	for _, category := range categories {
		for _, candidate := range scored {
			if candidate.item.Category != category || seen[candidate.item.ID] {
				continue
			}
			picks = append(picks, candidate.item)
			seen[candidate.item.ID] = true
			break
		}
		if len(picks) >= 4 {
			break
		}
	}
	if len(picks) == 0 && len(scored) > 0 {
		picks = append(picks, scored[0].item)
	}
	return picks
}

func scoreClosetItemForSuggestion(item model.LifeTraceClosetItem, req outfitSuggestionsRequest) int {
	score := 10
	scene := normalizeOutfitScene(req.Scene)
	planType := strings.TrimSpace(req.PlanType)
	for _, tag := range item.SceneTags {
		if tag == scene || tag == planType {
			score += 8
		}
	}
	temp := req.Temperature
	if temp == 0 {
		temp = (req.LowTemp + req.HighTemp) / 2
	}
	switch item.WarmthLevel {
	case "轻薄":
		if temp >= 24 {
			score += 8
		}
	case "保暖":
		if temp <= 16 {
			score += 8
		}
	case "厚重":
		if temp <= 8 {
			score += 8
		}
	default:
		score += 4
	}
	if strings.Contains(req.WeatherText, "雨") && (item.Category == "外套" || item.Category == "鞋履") {
		score += 4
	}
	return score
}

func buildRuleOutfitSummary(items []model.LifeTraceClosetItem, req outfitSuggestionsRequest) string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.Name)
	}
	context := strings.TrimSpace(req.WeatherText)
	if context == "" && req.Temperature != 0 {
		context = fmt.Sprintf("%d°C", req.Temperature)
	}
	if context == "" {
		return "按衣物标签先搭这一套，适合日常出门。"
	}
	return trimRunes("按"+context+"搭配："+strings.Join(names, "、")+"。", 72)
}

func closetItemIDs(items []model.LifeTraceClosetItem) []model.Int64String {
	result := make([]model.Int64String, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func tryBuildAIOutfitSuggestions(c *gin.Context, userID model.Int64String, items []model.LifeTraceClosetItem, req outfitSuggestionsRequest, fallback []outfitSuggestion) ([]outfitSuggestion, string) {
	cfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		return nil, ""
	}
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), cfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-outfit-suggestions", userID.String())
	defer cancel()
	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, cfg, buildOutfitSuggestionPrompt(items, req), 520)
	if err != nil {
		return nil, ""
	}
	parsed, err := parseOutfitSuggestionAIResponse(raw, items, req, modelName)
	if err != nil || len(parsed) == 0 {
		return fallback, modelName
	}
	return parsed, modelName
}

func buildOutfitSuggestionPrompt(items []model.LifeTraceClosetItem, req outfitSuggestionsRequest) string {
	lines := make([]string, 0, len(items))
	for _, item := range items {
		lines = append(lines, fmt.Sprintf("- id=%s｜%s｜%s｜%s｜%s｜%s｜%s", item.ID.String(), item.Name, item.Category, item.Color, item.WarmthLevel, strings.Join(item.Seasons, "、"), strings.Join(item.SceneTags, "、")))
	}
	return strings.Join([]string{
		"你是 Life Trace 的穿搭建议 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"suggestions\":[{\"title\":\"标题，18字以内\",\"summary\":\"建议，60字以内\",\"itemIds\":[\"衣物id\"]}]}",
		"只从给定衣物 id 中选择；输出 1-3 套；每套 1-5 件。",
		"优先结合天气、温度、降水、计划类型和场景；不要编造新衣物。",
		"",
		fmt.Sprintf("天气：%s；温度：%d；低温：%d；高温：%d；降水：%s。", req.WeatherText, req.Temperature, req.LowTemp, req.HighTemp, req.Precip),
		fmt.Sprintf("计划：%s；场景：%s；标题：%s。", req.PlanType, req.Scene, req.PlanTitle),
		"",
		"衣物：",
		strings.Join(lines, "\n"),
	}, "\n")
}

func parseOutfitSuggestionAIResponse(raw string, items []model.LifeTraceClosetItem, req outfitSuggestionsRequest, modelName string) ([]outfitSuggestion, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return nil, errors.New("missing JSON object")
	}
	var parsed outfitSuggestionAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return nil, err
	}
	itemByID := map[string]model.LifeTraceClosetItem{}
	for _, item := range items {
		itemByID[item.ID.String()] = item
	}
	result := make([]outfitSuggestion, 0, 3)
	for _, suggestion := range parsed.Suggestions {
		picked := make([]model.LifeTraceClosetItem, 0, len(suggestion.ItemIDs))
		seen := map[string]bool{}
		for _, rawID := range suggestion.ItemIDs {
			rawID = strings.TrimSpace(rawID)
			if seen[rawID] {
				continue
			}
			if item, ok := itemByID[rawID]; ok {
				seen[rawID] = true
				picked = append(picked, item)
			}
		}
		if len(picked) == 0 {
			continue
		}
		title := trimRunes(strings.TrimSpace(suggestion.Title), 18)
		if title == "" {
			title = buildOutfitTitle(picked)
		}
		summary := trimRunes(strings.TrimSpace(suggestion.Summary), 60)
		if summary == "" {
			summary = buildRuleOutfitSummary(picked, req)
		}
		result = append(result, outfitSuggestion{
			Title:       title,
			Summary:     summary,
			ItemIDs:     closetItemIDs(picked),
			Items:       picked,
			Scene:       normalizeOutfitScene(req.Scene),
			WeatherText: strings.TrimSpace(req.WeatherText),
			Score:       80 - len(result),
			Source:      "ai",
			Model:       strings.TrimSpace(modelName),
		})
		if len(result) >= 3 {
			break
		}
	}
	return result, nil
}

func findAccessibleClosetItem(id string, userID model.Int64String) (model.LifeTraceClosetItem, householdContext, bool) {
	var item model.LifeTraceClosetItem
	if err := database.GetDB().First(&item, "id = ?", id).Error; err != nil {
		return item, householdContext{}, false
	}
	householdCtx, ok := closetHouseholdAccess(userID, item.HouseholdID)
	if !ok {
		return item, householdContext{}, false
	}
	if householdCtx.Household.Kind == householdKindPersonal && item.UserID != userID {
		return item, householdContext{}, false
	}
	if householdCtx.Household.Kind == householdKindShared && !item.Shared {
		return item, householdContext{}, false
	}
	return item, householdCtx, true
}

func findAccessibleOutfit(id string, userID model.Int64String) (model.LifeTraceOutfit, householdContext, bool) {
	var outfit model.LifeTraceOutfit
	if err := database.GetDB().First(&outfit, "id = ?", id).Error; err != nil {
		return outfit, householdContext{}, false
	}
	householdCtx, ok := closetHouseholdAccess(userID, outfit.HouseholdID)
	if !ok {
		return outfit, householdContext{}, false
	}
	if householdCtx.Household.Kind == householdKindPersonal && outfit.UserID != userID {
		return outfit, householdContext{}, false
	}
	if householdCtx.Household.Kind == householdKindShared && !outfit.Shared {
		return outfit, householdContext{}, false
	}
	return outfit, householdCtx, true
}

func closetHouseholdAccess(userID model.Int64String, householdID model.Int64String) (householdContext, bool) {
	personal, member, err := ensurePersonalHousehold(userID)
	if err != nil {
		return householdContext{}, false
	}
	if householdID == 0 || householdID == personal.ID {
		return householdContext{Household: personal, Member: member}, true
	}
	var household model.Household
	if err := database.GetDB().First(&household, "id = ?", householdID).Error; err != nil {
		return householdContext{}, false
	}
	var householdMember model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND user_id = ? AND status = ?", householdID, userID, householdMemberStatusActive).
		First(&householdMember).Error; err != nil {
		return householdContext{}, false
	}
	return householdContext{Household: household, Member: householdMember}, true
}

func loadAccessibleClosetItemsByIDs(userID model.Int64String, householdCtx householdContext, ids []model.Int64String) ([]model.LifeTraceClosetItem, error) {
	if len(ids) == 0 {
		return []model.LifeTraceClosetItem{}, nil
	}
	query := database.GetDB().Where("id IN ? AND household_id = ?", ids, householdCtx.Household.ID)
	if householdCtx.Household.Kind == householdKindPersonal {
		query = query.Where("user_id = ?", userID)
	} else {
		query = query.Where("shared = ?", true)
	}
	var items []model.LifeTraceClosetItem
	return items, query.Find(&items).Error
}

func writeOutfitTrace(userID model.Int64String, outfit model.LifeTraceOutfit, householdName string) {
	trace := model.LifeTraceTrace{
		UserID:    userID,
		OutfitID:  &outfit.ID,
		Title:     trimRunes("穿了："+outfit.Title, 160),
		Summary:   trimRunes("已记录「"+outfit.Title+"」穿搭，适合"+normalizeOutfitScene(outfit.Scene)+"。", 1000),
		TimeLabel: time.Now().Format("01/02 15:04"),
		ImageURL:  outfit.ImageURL,
		Mood:      "清爽",
		Tags:      normalizeTraceTags([]string{"穿搭", normalizeOutfitScene(outfit.Scene), householdName}),
		Source:    "穿搭",
	}
	if err := database.GetDB().Create(&trace).Error; err != nil && logger.Log != nil {
		logger.Log.WithFields(map[string]interface{}{
			"userId":   userID.String(),
			"outfitId": outfit.ID.String(),
		}).WithError(err).Warn("LifeTrace outfit trace journaling failed")
	}
}
