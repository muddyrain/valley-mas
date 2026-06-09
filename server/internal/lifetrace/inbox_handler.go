package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type inboxItemRequest struct {
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	ItemType string   `json:"itemType"`
	LinkURL  string   `json:"linkUrl"`
	ImageURL string   `json:"imageUrl"`
	Tags     []string `json:"tags"`
}

type updateInboxStatusRequest struct {
	Status string `json:"status"`
}

type convertInboxItemRequest struct {
	ConvertedType string `json:"convertedType"`
	ConvertedID   string `json:"convertedId"`
}

var validInboxItemTypes = map[string]bool{
	"text":  true,
	"link":  true,
	"image": true,
}

var validInboxStatuses = map[string]bool{
	"inbox":     true,
	"converted": true,
	"archived":  true,
}

var validInboxConvertedTypes = map[string]bool{
	"plan":   true,
	"trace":  true,
	"ledger": true,
}

var validInboxAISuggestedTypes = map[string]bool{
	"plan":  true,
	"trace": true,
}

func normalizeInboxItemType(itemType string) string {
	itemType = strings.TrimSpace(itemType)
	if !validInboxItemTypes[itemType] {
		return "text"
	}
	return itemType
}

func normalizeInboxTags(tags []string) model.StringList {
	seen := map[string]bool{}
	result := model.StringList{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
	}
	return result
}

func isValidInboxLink(linkURL string) bool {
	linkURL = strings.TrimSpace(linkURL)
	return strings.HasPrefix(linkURL, "http://") || strings.HasPrefix(linkURL, "https://")
}

func isValidInboxImageURL(imageURL string) bool {
	return isValidInboxLink(imageURL)
}

func buildInboxItemFromRequest(req inboxItemRequest, userID model.Int64String) (model.LifeTraceInboxItem, string, bool) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return model.LifeTraceInboxItem{}, "标题不能为空", false
	}

	itemType := normalizeInboxItemType(req.ItemType)
	linkURL := strings.TrimSpace(req.LinkURL)
	imageURL := strings.TrimSpace(req.ImageURL)
	if itemType == "link" && !isValidInboxLink(linkURL) {
		return model.LifeTraceInboxItem{}, "链接格式不正确", false
	}
	if itemType != "link" {
		linkURL = ""
	}
	if itemType == "image" && !isValidInboxImageURL(imageURL) {
		return model.LifeTraceInboxItem{}, "图片不能为空", false
	}
	if itemType != "image" {
		imageURL = ""
	}

	return model.LifeTraceInboxItem{
		UserID:   userID,
		Title:    title,
		Content:  strings.TrimSpace(req.Content),
		ItemType: itemType,
		LinkURL:  linkURL,
		ImageURL: imageURL,
		Tags:     normalizeInboxTags(req.Tags),
		Status:   "inbox",
	}, "", true
}

func applyInboxListFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && validInboxStatuses[status] {
		query = query.Where("status = ?", status)
	}

	itemType := strings.TrimSpace(c.Query("type"))
	if itemType != "" && validInboxItemTypes[itemType] {
		query = query.Where("item_type = ?", itemType)
	}

	keyword := strings.TrimSpace(c.Query("q"))
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR content LIKE ? OR link_url LIKE ?)", like, like, like)
	}

	return query
}

func (h *Handler) ListInboxItems(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	page, pageSize := parseListPagination(c)
	offset := (page - 1) * pageSize
	baseQuery := database.GetDB().
		Model(&model.LifeTraceInboxItem{}).
		Where("user_id = ?", userID)
	baseQuery = applyInboxListFilters(baseQuery, c)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取 Inbox 失败")
		return
	}

	var items []model.LifeTraceInboxItem
	if err := baseQuery.
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&items).Error; err != nil {
		fail(c, http.StatusInternalServerError, "获取 Inbox 失败")
		return
	}

	success(c, gin.H{
		"list":       items,
		"pagination": buildListPagination(page, pageSize, total),
	})
}

func (h *Handler) CreateInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req inboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	item, message, ok := buildInboxItemFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	if err := database.GetDB().Create(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) UpdateInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req inboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	nextItem, message, ok := buildInboxItemFromRequest(req, userID)
	if !ok {
		fail(c, http.StatusBadRequest, message)
		return
	}

	updates := map[string]interface{}{
		"title":     nextItem.Title,
		"content":   nextItem.Content,
		"item_type": nextItem.ItemType,
		"link_url":  nextItem.LinkURL,
		"image_url": nextItem.ImageURL,
		"tags":      nextItem.Tags,
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新 Inbox 失败")
		return
	}

	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) UpdateInboxItemStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req updateInboxStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	status := strings.TrimSpace(req.Status)
	if status == "" || !validInboxStatuses[status] {
		fail(c, http.StatusBadRequest, "状态不正确")
		return
	}

	updates := map[string]interface{}{"status": status}
	if status != "converted" {
		updates["converted_type"] = ""
		updates["converted_id"] = ""
		updates["converted_at"] = nil
	}

	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "更新 Inbox 失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func (h *Handler) ConvertInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	var req convertInboxItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	convertedType := strings.TrimSpace(req.ConvertedType)
	convertedID := strings.TrimSpace(req.ConvertedID)
	if !validInboxConvertedTypes[convertedType] || convertedID == "" {
		fail(c, http.StatusBadRequest, "转化目标不正确")
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":         "converted",
		"converted_type": convertedType,
		"converted_id":   convertedID,
		"converted_at":   &now,
	}
	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "转化 Inbox 失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

type inboxOrganizeAIResponse struct {
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Tags          []string `json:"tags"`
	SuggestedType string   `json:"suggestedType"`
	Reason        string   `json:"reason"`
}

func (h *Handler) OrganizeInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	raw, modelName, errMsg, err := organizeInboxWithAI(c.Request.Context(), userID, item)
	if errMsg != "" {
		fail(c, http.StatusServiceUnavailable, errMsg)
		return
	}
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 整理失败："+err.Error())
		return
	}

	parsed, err := parseInboxOrganizeAIResponse(raw, item)
	if err != nil {
		fail(c, http.StatusBadGateway, "AI 整理解析失败："+err.Error())
		return
	}
	now := time.Now()
	updates := map[string]interface{}{
		"ai_title":          parsed.Title,
		"ai_summary":        parsed.Summary,
		"ai_tags":           model.StringList(parsed.Tags),
		"ai_suggested_type": parsed.SuggestedType,
		"ai_reason":         parsed.Reason,
		"ai_model":          modelName,
		"ai_organized_at":   &now,
	}
	if err := database.GetDB().Model(&item).Updates(updates).Error; err != nil {
		fail(c, http.StatusInternalServerError, "保存 AI 整理失败")
		return
	}
	if err := database.GetDB().First(&item, "id = ? AND user_id = ?", item.ID, userID).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取 Inbox 失败")
		return
	}

	success(c, item)
}

func organizeInboxWithAI(ctx context.Context, userID model.Int64String, item model.LifeTraceInboxItem) (string, string, string, error) {
	prompt := buildInboxOrganizePrompt(item)
	if strings.TrimSpace(item.ImageURL) != "" {
		aiCfg, errMsg := readLifeTraceImageAIConfig()
		if errMsg != "" {
			return "", "", errMsg, nil
		}
		aiCtx, cancel := context.WithTimeout(ctx, aiCfg.Timeout)
		aiCtx = aiusage.WithAudit(aiCtx, "life-trace-inbox-organize", userID.String())
		defer cancel()

		raw, modelName, err := callLifeTraceImageAI(aiCtx, aiCfg, item.ImageURL, prompt)
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			modelName = aiCfg.Model
		}
		return raw, modelName, "", err
	}

	aiCfg, errMsg := readLifeTraceAIConfig()
	if errMsg != "" {
		return "", "", errMsg, nil
	}

	aiCtx, cancel := context.WithTimeout(ctx, aiCfg.Timeout)
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-inbox-organize", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceAIWithMaxTokens(aiCtx, aiCfg, prompt, 420)
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	return raw, modelName, "", err
}

func (h *Handler) DeleteInboxItem(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	item, found := findInboxItem(c.Param("id"), userID)
	if !found {
		fail(c, http.StatusNotFound, "Inbox 不存在")
		return
	}

	if err := database.GetDB().Delete(&item).Error; err != nil {
		fail(c, http.StatusInternalServerError, "删除 Inbox 失败")
		return
	}

	success(c, gin.H{"id": item.ID})
}

func findInboxItem(id string, userID model.Int64String) (model.LifeTraceInboxItem, bool) {
	var item model.LifeTraceInboxItem
	err := database.GetDB().First(&item, "id = ? AND user_id = ?", id, userID).Error
	if err == nil {
		return item, true
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, false
	}
	return item, false
}

func buildInboxOrganizePrompt(item model.LifeTraceInboxItem) string {
	linkText := strings.TrimSpace(item.LinkURL)
	if linkText == "" {
		linkText = "无"
	}
	imageText := strings.TrimSpace(item.ImageURL)
	if imageText == "" {
		imageText = "无"
	}
	tags := strings.Join(item.Tags, "、")
	if tags == "" {
		tags = "无"
	}
	return strings.Join([]string{
		"你是 Life Trace 的 Inbox 整理 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"title\":\"整理后的标题，24字以内\",\"summary\":\"整理摘要，80字以内\",\"tags\":[\"标签\"],\"suggestedType\":\"plan|trace\",\"reason\":\"建议去向原因，40字以内\"}",
		"只根据用户已经收下的内容整理，不要编造没有出现的人名、地点、金额、日期或结论。",
		"如果像未来要做的事，suggestedType 返回 plan；如果像已经发生的记录，返回 trace。",
		"tags 输出 1-4 个简体中文短标签。",
		"",
		fmt.Sprintf("原始标题：%s", item.Title),
		fmt.Sprintf("内容：%s", emptyInboxPromptText(item.Content)),
		fmt.Sprintf("类型：%s", item.ItemType),
		fmt.Sprintf("链接：%s", linkText),
		fmt.Sprintf("图片：%s", imageText),
		fmt.Sprintf("原标签：%s", tags),
	}, "\n")
}

func emptyInboxPromptText(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return "无"
	}
	return text
}

func parseInboxOrganizeAIResponse(raw string, item model.LifeTraceInboxItem) (inboxOrganizeAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return inboxOrganizeAIResponse{}, errors.New("missing JSON object")
	}

	var parsed inboxOrganizeAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return inboxOrganizeAIResponse{}, err
	}

	parsed.Title = trimRunes(parsed.Title, 24)
	if parsed.Title == "" {
		parsed.Title = trimRunes(item.Title, 24)
	}
	parsed.Summary = trimRunes(parsed.Summary, 80)
	if parsed.Summary == "" {
		parsed.Summary = trimRunes(strings.Join([]string{item.Content, item.LinkURL, item.ImageURL}, " "), 80)
	}
	parsed.Tags = normalizeInboxAITags(parsed.Tags, item.Tags)
	parsed.SuggestedType = strings.TrimSpace(parsed.SuggestedType)
	if !validInboxAISuggestedTypes[parsed.SuggestedType] {
		parsed.SuggestedType = inferInboxSuggestedType(item)
	}
	parsed.Reason = trimRunes(parsed.Reason, 40)
	if parsed.Reason == "" {
		parsed.Reason = "已根据 Inbox 内容整理去向。"
	}
	return parsed, nil
}

func normalizeInboxAITags(tags []string, fallback model.StringList) []string {
	result := make([]string, 0, 4)
	seen := map[string]bool{}
	for _, tag := range tags {
		tag = trimRunes(tag, 10)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
		if len(result) >= 4 {
			break
		}
	}
	if len(result) > 0 {
		return result
	}
	for _, tag := range fallback {
		tag = trimRunes(tag, 10)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		result = append(result, tag)
		if len(result) >= 4 {
			break
		}
	}
	if len(result) == 0 {
		result = append(result, "生活迹")
	}
	return result
}

func inferInboxSuggestedType(item model.LifeTraceInboxItem) string {
	text := item.Title + " " + item.Content
	for _, keyword := range []string{"想", "要", "待办", "记得", "预约", "计划", "安排"} {
		if strings.Contains(text, keyword) {
			return "plan"
		}
	}
	return "trace"
}
