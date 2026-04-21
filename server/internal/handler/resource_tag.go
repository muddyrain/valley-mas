package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
	"unicode"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────
//  包级 ARK 客户端单例（避免每次请求重建 HTTP 连接）
// ─────────────────────────────────────────────

var (
	arkClientOnce sync.Once
	arkClient     *arkruntime.Client
)

// ─────────────────────────────────────────────
//  管理端 - 标签 CRUD
// ─────────────────────────────────────────────

// ListResourceTags 获取所有资源标签（支持关键词搜索 + 分页）
// GET /admin/resource-tags  或  GET /public/resource-tags
func ListResourceTags(c *gin.Context) {
	db := database.GetDB()
	keyword := strings.TrimSpace(c.Query("keyword"))
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 50)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	query := db.Model(&model.ResourceTag{})
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR description LIKE ?", like, like)
	}

	var total int64
	query.Count(&total)

	var tags []model.ResourceTag
	query.Order("resource_count DESC, created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&tags)

	Success(c, gin.H{
		"list":     tags,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// CreateResourceTag 创建资源标签（管理员 / 创作者）
// POST /admin/resource-tags  body: { name, description? }
func CreateResourceTag(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 30 {
		Error(c, 400, "标签名称不能为空且不超过 30 个字符")
		return
	}

	db := database.GetDB()

	// 重名检测
	var count int64
	db.Model(&model.ResourceTag{}).Where("name = ?", name).Count(&count)
	if count > 0 {
		Error(c, 400, "标签名称已存在")
		return
	}

	tag := model.ResourceTag{
		ID:          model.Int64String(utils.GenerateID()),
		Name:        name,
		Description: strings.TrimSpace(req.Description),
	}
	if err := db.Create(&tag).Error; err != nil {
		Error(c, 500, "创建标签失败："+err.Error())
		return
	}

	Success(c, tag)
}

// UpdateResourceTag 更新资源标签（管理员 / 创作者）
// PATCH /admin/resource-tags/:id  body: { name?, description? }
func UpdateResourceTag(c *gin.Context) {
	id := c.Param("id")
	db := database.GetDB()

	var tag model.ResourceTag
	if err := db.First(&tag, "id = ?", id).Error; err != nil {
		Error(c, 404, "标签不存在")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}

	updates := map[string]interface{}{}
	if name := strings.TrimSpace(req.Name); name != "" && name != tag.Name {
		if len([]rune(name)) > 30 {
			Error(c, 400, "标签名称不超过 30 个字符")
			return
		}
		var count int64
		db.Model(&model.ResourceTag{}).Where("name = ? AND id != ?", name, tag.ID).Count(&count)
		if count > 0 {
			Error(c, 400, "标签名称已存在")
			return
		}
		updates["name"] = name
	}
	if desc := strings.TrimSpace(req.Description); desc != tag.Description {
		updates["description"] = desc
	}

	if len(updates) == 0 {
		Success(c, tag)
		return
	}
	if err := db.Model(&tag).Updates(updates).Error; err != nil {
		Error(c, 500, "更新失败："+err.Error())
		return
	}
	db.First(&tag, "id = ?", id)
	Success(c, tag)
}

// DeleteResourceTag 删除资源标签（管理员）
// DELETE /admin/resource-tags/:id
func DeleteResourceTag(c *gin.Context) {
	id := c.Param("id")
	db := database.GetDB()

	var tag model.ResourceTag
	if err := db.First(&tag, "id = ?", id).Error; err != nil {
		Error(c, 404, "标签不存在")
		return
	}

	// 先清除关联，再删标签
	if err := db.Where("tag_id = ?", tag.ID).Delete(&model.ResourceTagRelation{}).Error; err != nil {
		Error(c, 500, "清理关联失败："+err.Error())
		return
	}
	if err := db.Delete(&tag).Error; err != nil {
		Error(c, 500, "删除失败："+err.Error())
		return
	}
	Success(c, nil)
}

// ─────────────────────────────────────────────
//  资源 <-> 标签 绑定
// ─────────────────────────────────────────────

// GetResourceTags 获取单个资源的标签列表
// GET /creator/resources/:id/tags
func GetResourceTags(c *gin.Context) {
	resourceID := c.Param("id")
	db := database.GetDB()

	var resource model.Resource
	if err := db.First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}

	// 权限：创作者只能查看自己的
	if err := assertResourceOwner(c, resource); err != nil {
		Error(c, 403, err.Error())
		return
	}

	var tags []model.ResourceTag
	db.Joins("JOIN resource_tag_relations rtr ON rtr.tag_id = resource_tags.id AND rtr.resource_id = ?", resource.ID).
		Where("resource_tags.deleted_at IS NULL").
		Order("resource_tags.name ASC").
		Find(&tags)

	Success(c, tags)
}

// SetResourceTags 全量设置资源标签（覆盖，非追加）
// PUT /creator/resources/:id/tags  body: { tagIds: ["id1","id2",...] }
func SetResourceTags(c *gin.Context) {
	resourceID := c.Param("id")
	db := database.GetDB()

	var resource model.Resource
	if err := db.First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}
	if err := assertResourceOwner(c, resource); err != nil {
		Error(c, 403, err.Error())
		return
	}

	var req struct {
		TagIDs []string `json:"tagIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误："+err.Error())
		return
	}
	if len(req.TagIDs) > 10 {
		Error(c, 400, "每个资源最多绑定 10 个标签")
		return
	}

	// 校验 tagIds 均存在
	var tags []model.ResourceTag
	if len(req.TagIDs) > 0 {
		if err := db.Where("id IN ? AND deleted_at IS NULL", req.TagIDs).Find(&tags).Error; err != nil {
			Error(c, 500, "查询标签失败")
			return
		}
		if len(tags) != len(req.TagIDs) {
			Error(c, 400, "部分标签不存在，请刷新后重试")
			return
		}
	}

	// 事务：先删旧关联，再写新关联，最后更新计数
	err := db.Transaction(func(tx *gorm.DB) error {
		// 1. 查询旧的 tagIds
		var oldRelations []model.ResourceTagRelation
		tx.Where("resource_id = ?", resource.ID).Find(&oldRelations)
		oldTagIDs := make([]model.Int64String, 0, len(oldRelations))
		for _, r := range oldRelations {
			oldTagIDs = append(oldTagIDs, r.TagID)
		}

		// 2. 删除所有旧关联
		if len(oldRelations) > 0 {
			if err := tx.Where("resource_id = ?", resource.ID).
				Delete(&model.ResourceTagRelation{}).Error; err != nil {
				return err
			}
			// 旧 tag 计数 -1
			if len(oldTagIDs) > 0 {
				tx.Model(&model.ResourceTag{}).
					Where("id IN ?", oldTagIDs).
					UpdateColumn("resource_count", gorm.Expr("GREATEST(resource_count - 1, 0)"))
			}
		}

		// 3. 写入新关联
		for _, tag := range tags {
			rel := model.ResourceTagRelation{
				ResourceID: resource.ID,
				TagID:      tag.ID,
			}
			if err := tx.Create(&rel).Error; err != nil {
				return err
			}
		}
		// 新 tag 计数 +1
		if len(tags) > 0 {
			newTagIDs := make([]model.Int64String, 0, len(tags))
			for _, t := range tags {
				newTagIDs = append(newTagIDs, t.ID)
			}
			tx.Model(&model.ResourceTag{}).
				Where("id IN ?", newTagIDs).
				UpdateColumn("resource_count", gorm.Expr("resource_count + 1"))
		}
		return nil
	})
	if err != nil {
		Error(c, 500, "更新标签失败："+err.Error())
		return
	}

	// 重新查询最新标签列表返回
	var result []model.ResourceTag
	if len(tags) > 0 {
		newTagIDs := make([]model.Int64String, 0, len(tags))
		for _, t := range tags {
			newTagIDs = append(newTagIDs, t.ID)
		}
		db.Where("id IN ?", newTagIDs).Find(&result)
	}
	invalidatePublicResourceListCache()
	Success(c, result)
}

// ─────────────────────────────────────────────
//  AI 自动匹配标签
// ─────────────────────────────────────────────

// AIMatchResourceTags 使用视觉 AI 根据图片 + 标题自动推荐已有标签
// POST /creator/resources/:id/tags/ai-match
// Body: {} （无需传图片，后端直接使用资源 URL）
//
// 工作流：
//  1. 加载系统中已有的全部标签名
//  2. 把图片 URL + 标题 + 标签候选列表发给视觉/文本模型（SSE 流式输出）
//  3. 收集完整文本后匹配到已有标签，写入 DB，通过 SSE 返回结果
func AIMatchResourceTags(c *gin.Context) {
	resourceID := c.Param("id")
	db := database.GetDB()

	var resource model.Resource
	if err := db.First(&resource, "id = ?", resourceID).Error; err != nil {
		Error(c, 404, "资源不存在")
		return
	}
	if err := assertResourceOwner(c, resource); err != nil {
		Error(c, 403, err.Error())
		return
	}

	// 读取 AI 配置
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	if apiKey == "" {
		Error(c, 503, "AI 功能未配置（缺少 ARK_API_KEY）")
		return
	}
	visionModel := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	hasImage := strings.HasPrefix(resource.URL, "http")
	useVision := hasImage && strings.HasPrefix(visionModel, "ep-")
	useText := !useVision && strings.HasPrefix(textModel, "ep-")
	if !useVision && !useText {
		Error(c, 503, "AI 功能未配置（ARK_VISION_MODEL 或 ARK_TEXT_MODEL 须以 ep- 开头）")
		return
	}
	activeModel := visionModel
	if !useVision {
		activeModel = textModel
	}

	// 读取系统全量标签（只取名称，减少 prompt token 数）
	var allTags []model.ResourceTag
	if err := db.Where("deleted_at IS NULL").Order("resource_count DESC").Find(&allTags).Error; err != nil {
		Error(c, 500, "获取标签列表失败")
		return
	}

	// 只传标签名，去掉描述，减少 prompt 长度
	tagNames := make([]string, 0, len(allTags))
	for _, t := range allTags {
		tagNames = append(tagNames, t.Name)
	}

	resourceType := map[string]string{
		"wallpaper": "壁纸",
		"avatar":    "头像",
	}[resource.Type]
	if resourceType == "" {
		resourceType = resource.Type
	}

	titleHint := ""
	if resource.Title != "" {
		titleHint = fmt.Sprintf("标题：%s。", resource.Title)
	}
	descHint := ""
	if resource.Description != "" {
		descHint = fmt.Sprintf("描述：%s。", resource.Description)
	}

	var prompt string
	if len(tagNames) > 0 {
		candidateStr := strings.Join(tagNames, "\n")
		prompt = fmt.Sprintf(
			"你是图片标签专家。%s%s类型：%s。\n"+
				"优先从以下候选标签中选 1-5 个最匹配的；若候选标签不够准确，可额外补充 1-2 个新标签（每个不超过 6 字）。\n"+
				"只输出标签名，每行一个，不要编号，不要解释，不要输出候选列表以外的多余文字。\n"+
				"候选标签（每行一个）：\n%s",
			titleHint, descHint, resourceType, candidateStr,
		)
	} else {
		prompt = fmt.Sprintf(
			"你是图片标签专家。%s%s类型：%s。\n"+
				"为该资源生成 1-5 个最合适的标签（每个不超过 6 字）。\n"+
				"只输出标签名，每行一个，不要编号，不要解释。",
			titleHint, descHint, resourceType,
		)
	}

	// 获取/初始化单例 client
	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	arkClientOnce.Do(func() {
		arkClient = arkruntime.NewClientWithApiKey(
			apiKey,
			arkruntime.WithBaseUrl(arkBaseURL),
			arkruntime.WithTimeout(60*time.Second),
		)
	})
	client := arkClient

	// 调用 Chat Completions Stream（流式读取，收集完整输出后匹配）
	rawText, aiErr := callChatStream(client, activeModel, resource.URL, prompt, useVision)
	if aiErr != nil {
		Error(c, 502, "AI 服务请求失败："+aiErr.Error())
		return
	}

	// 解析 AI 返回：匹配已有标签，对不存在的标签名自动创建
	matchedTags, newTagNames := parseAndMatchTagsWithNew(rawText, allTags)

	// 自动创建不存在的新标签
	for _, name := range newTagNames {
		newTag := model.ResourceTag{
			ID:   model.Int64String(utils.GenerateID()),
			Name: name,
		}
		if err := db.Create(&newTag).Error; err != nil {
			// 若并发重名，尝试查出已有的
			var existing model.ResourceTag
			if db.Where("name = ? AND deleted_at IS NULL", name).First(&existing).Error == nil {
				matchedTags = append(matchedTags, existing)
			}
		} else {
			matchedTags = append(matchedTags, newTag)
		}
	}

	if len(matchedTags) == 0 {
		Error(c, 200, "AI 未能匹配或生成合适的标签，请手动选择")
		return
	}

	// 写入绑定
	err := db.Transaction(func(tx *gorm.DB) error {
		var oldRelations []model.ResourceTagRelation
		tx.Where("resource_id = ?", resource.ID).Find(&oldRelations)
		oldTagIDs := make([]model.Int64String, 0, len(oldRelations))
		for _, r := range oldRelations {
			oldTagIDs = append(oldTagIDs, r.TagID)
		}
		if len(oldRelations) > 0 {
			if err := tx.Where("resource_id = ?", resource.ID).
				Delete(&model.ResourceTagRelation{}).Error; err != nil {
				return err
			}
			if len(oldTagIDs) > 0 {
				tx.Model(&model.ResourceTag{}).
					Where("id IN ?", oldTagIDs).
					UpdateColumn("resource_count", gorm.Expr("GREATEST(resource_count - 1, 0)"))
			}
		}
		newTagIDs := make([]model.Int64String, 0, len(matchedTags))
		for _, tag := range matchedTags {
			rel := model.ResourceTagRelation{ResourceID: resource.ID, TagID: tag.ID}
			if err := tx.Create(&rel).Error; err != nil {
				return err
			}
			newTagIDs = append(newTagIDs, tag.ID)
		}
		if len(newTagIDs) > 0 {
			tx.Model(&model.ResourceTag{}).
				Where("id IN ?", newTagIDs).
				UpdateColumn("resource_count", gorm.Expr("resource_count + 1"))
		}
		return nil
	})
	if err != nil {
		Error(c, 500, "保存标签失败："+err.Error())
		return
	}

	Success(c, gin.H{
		"tags":  matchedTags,
		"model": activeModel,
	})
}

// ─────────────────────────────────────────────
//  公开接口 - 按标签筛选资源
// ─────────────────────────────────────────────

// GetResourcesByTag 按标签 ID 获取公开资源列表
// GET /public/resource-tags/:slug/resources
func GetResourcesByTag(c *gin.Context) {
	tagID := c.Param("slug") // 路由参数名暂保持兼容，实际传 id
	page := GetIntQuery(c, "page", 1)
	pageSize := GetIntQuery(c, "pageSize", 20)
	if pageSize > 50 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	db := database.GetDB()

	var tag model.ResourceTag
	if err := db.Where("id = ? AND deleted_at IS NULL", tagID).First(&tag).Error; err != nil {
		Error(c, 404, "标签不存在")
		return
	}

	query := db.Model(&model.Resource{}).
		Joins("JOIN resource_tag_relations rtr ON rtr.resource_id = resources.id AND rtr.tag_id = ?", tag.ID).
		Where("resources.deleted_at IS NULL").
		Where(publicVisibilityWhere)

	var total int64
	query.Count(&total)

	var resources []model.Resource
	query.Order("resources.download_count DESC, resources.created_at DESC").
		Limit(pageSize).Offset(offset).
		Find(&resources)
	fillResourceThumbnails(resources)

	Success(c, gin.H{
		"tag":      tag,
		"list":     resources,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// ─────────────────────────────────────────────
//  内部工具函数
// ─────────────────────────────────────────────

// assertResourceOwner 检查当前用户是否有权操作该资源（管理员可操作全部）
func assertResourceOwner(c *gin.Context, resource model.Resource) error {
	roleAny, _ := c.Get("userRole")
	role, _ := roleAny.(string)
	if role == "admin" {
		return nil
	}
	userIDAny, exists := c.Get("userId")
	if !exists {
		return fmt.Errorf("未登录")
	}
	userID, _ := userIDAny.(int64)
	if int64(resource.UserID) != userID {
		return fmt.Errorf("无权限操作他人资源")
	}
	return nil
}

// callChatStream 使用 Chat Completions Stream API 调用 ARK 模型。
// useVision=true 时在消息中附带图片 URL（low detail，减少 token 消耗）。
// 函数阻塞直到流结束，返回完整拼接的文本。
func callChatStream(client *arkruntime.Client, modelID, imageURL, prompt string, useVision bool) (string, error) {
	maxTokens := 200 // 标签输出，留足余量避免截断

	var content *arkmodel.ChatCompletionMessageContent
	if useVision {
		if !strings.HasPrefix(imageURL, "http") && !strings.HasPrefix(imageURL, "data:") {
			imageURL = "data:image/jpeg;base64," + imageURL
		}
		content = &arkmodel.ChatCompletionMessageContent{
			ListValue: []*arkmodel.ChatCompletionMessageContentPart{
				{
					Type: arkmodel.ChatCompletionMessageContentPartTypeImageURL,
					ImageURL: &arkmodel.ChatMessageImageURL{
						URL:    imageURL,
						Detail: arkmodel.ImageURLDetailLow, // low detail：更快，足够分辨图片内容
					},
				},
				{
					Type: arkmodel.ChatCompletionMessageContentPartTypeText,
					Text: prompt,
				},
			},
		}
	} else {
		strVal := prompt
		content = &arkmodel.ChatCompletionMessageContent{StringValue: &strVal}
	}

	stream, err := client.CreateChatCompletionStream(
		context.Background(),
		arkmodel.CreateChatCompletionRequest{
			Model: modelID,
			Messages: []*arkmodel.ChatCompletionMessage{
				{Role: "user", Content: content},
			},
			MaxTokens: &maxTokens,
		},
	)
	if err != nil {
		return "", err
	}
	defer stream.Close()

	var sb strings.Builder
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", err
		}
		for _, choice := range resp.Choices {
			sb.WriteString(choice.Delta.Content)
		}
	}
	return sb.String(), nil
}

// parseAndMatchTagsWithNew 解析 AI 输出的每行标签名：
//   - 与已有标签精确匹配 → 放入 matched
//   - 有效但不存在的标签名 → 放入 newNames（调用方负责创建）
func parseAndMatchTagsWithNew(rawText string, allTags []model.ResourceTag) (matched []model.ResourceTag, newNames []string) {
	nameIndex := make(map[string]model.ResourceTag, len(allTags))
	for _, t := range allTags {
		nameIndex[strings.ToLower(t.Name)] = t
	}

	lines := strings.Split(rawText, "\n")
	seenKey := map[string]bool{}
	total := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// 安全地裁剪行首的序号/符号（逐 rune 处理，不误伤汉字）
		runes := []rune(line)
		start := 0
		for start < len(runes) {
			r := runes[start]
			if unicode.IsDigit(r) || r == '.' || r == '、' || r == '·' || r == '•' || r == '-' || r == '*' || r == ' ' || r == '\t' {
				start++
			} else {
				break
			}
		}
		line = strings.TrimSpace(string(runes[start:]))
		if line == "" {
			continue
		}
		// 去掉括号及其后内容（注释说明）
		for _, sep := range []string{"（", "(", "【", " -", " —"} {
			if idx := strings.Index(line, sep); idx > 0 {
				line = strings.TrimSpace(line[:idx])
			}
		}
		if line == "" {
			continue
		}
		// 超过 10 个字的大概率是 AI 废话，跳过
		if len([]rune(line)) > 10 {
			continue
		}
		key := strings.ToLower(line)
		if seenKey[key] {
			continue
		}
		seenKey[key] = true

		if t, ok := nameIndex[key]; ok {
			matched = append(matched, t)
		} else {
			newNames = append(newNames, line)
		}
		total++
		if total >= 5 {
			break
		}
	}
	return
}

// parseAndMatchTags 解析 AI 输出的每行标签名，与已有标签列表做精确匹配（兼容旧调用）
func parseAndMatchTags(rawText string, allTags []model.ResourceTag) []model.ResourceTag {
	matched, _ := parseAndMatchTagsWithNew(rawText, allTags)
	return matched
}
