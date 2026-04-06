package handler

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model/responses"
	"gorm.io/gorm"
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
//  2. 把图片 URL + 标题 + 标签候选列表发给视觉模型
//  3. 模型从候选列表中选出最匹配的若干个（不会生成新标签）
//  4. 直接将选中的标签写入 resource_tag_relations（覆盖旧绑定）
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
	// 有图片 URL 且配置了视觉模型时使用视觉模型，否则退到文本模型
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

	// 读取系统全量标签
	var allTags []model.ResourceTag
	if err := db.Where("deleted_at IS NULL").Order("resource_count DESC").Find(&allTags).Error; err != nil {
		Error(c, 500, "获取标签列表失败")
		return
	}
	if len(allTags) == 0 {
		Error(c, 400, "系统暂无标签，请先创建标签")
		return
	}

	// 构造候选标签字符串（名称 + 描述，帮助 AI 更准确匹配）
	tagLines := make([]string, 0, len(allTags))
	for _, t := range allTags {
		if t.Description != "" {
			tagLines = append(tagLines, fmt.Sprintf("%s（%s）", t.Name, t.Description))
		} else {
			tagLines = append(tagLines, t.Name)
		}
	}
	candidateStr := strings.Join(tagLines, "\n")

	resourceType := map[string]string{
		"wallpaper": "壁纸",
		"avatar":    "头像",
	}[resource.Type]
	if resourceType == "" {
		resourceType = resource.Type
	}

	titleHint := ""
	if resource.Title != "" {
		titleHint = fmt.Sprintf("资源标题：《%s》\n", resource.Title)
	}
	descHint := ""
	if resource.Description != "" {
		descHint = fmt.Sprintf("资源描述：%s\n", resource.Description)
	}

	prompt := fmt.Sprintf(
		"你是一个图片标签专家。\n"+
			"%s%s"+
			"资源类型：%s\n"+
			"以下是系统中所有可用的标签（格式为【名称（描述）】），请从中选出最符合这张图片的 1-5 个，只输出标签名称，每行一个，不要带括号和描述，不要编号，不要额外解释，绝对不要创造候选列表以外的新标签。\n\n"+
			"候选标签：\n%s",
		titleHint, descHint, resourceType, candidateStr,
	)

	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}

	client := arkruntime.NewClientWithApiKey(
		apiKey,
		arkruntime.WithBaseUrl(arkBaseURL),
		arkruntime.WithTimeout(30*time.Second),
	)

	var rawText string
	var aiErr error

	if useVision {
		rawText, aiErr = callVisionModel(client, activeModel, resource.URL, prompt)
	} else {
		rawText, aiErr = callTextModel(client, activeModel, prompt)
	}

	if aiErr != nil {
		Error(c, 502, "AI 服务请求失败："+aiErr.Error())
		return
	}

	// 解析 AI 返回，匹配到已有标签
	matchedTags := parseAndMatchTags(rawText, allTags)
	if len(matchedTags) == 0 {
		Error(c, 200, "AI 未能从候选标签中匹配到合适的标签，请手动选择")
		return
	}

	// 写入绑定（复用 SetResourceTags 的事务逻辑）
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

// callVisionModel 调用火山方舟视觉模型
// imageURL 支持两种格式：
//   - HTTPS URL（如 https://cdn.example.com/img.jpg）—— 直接传给模型
//   - base64 data URI（如 data:image/jpeg;base64,...）—— 直接传给模型
func callVisionModel(client *arkruntime.Client, modelID, imageURL, prompt string) (string, error) {
	// HTTPS URL 直接使用；裸 base64 补全 data URI 前缀
	if !strings.HasPrefix(imageURL, "http") && !strings.HasPrefix(imageURL, "data:") {
		imageURL = "data:image/jpeg;base64," + imageURL
	}

	imgType := responses.ContentItemType_Enum(responses.ContentItemType_Enum_value["input_image"])
	txtType := responses.ContentItemType_Enum(responses.ContentItemType_Enum_value["input_text"])

	resp, err := client.CreateResponses(
		context.Background(),
		&responses.ResponsesRequest{
			Model: modelID,
			Input: &responses.ResponsesInput{
				Union: &responses.ResponsesInput_ListValue{
					ListValue: &responses.InputItemList{
						ListValue: []*responses.InputItem{
							{
								Union: &responses.InputItem_EasyMessage{
									EasyMessage: &responses.ItemEasyMessage{
										Role: responses.MessageRole_Enum(responses.MessageRole_Enum_value["user"]),
										Content: &responses.MessageContent{
											Union: &responses.MessageContent_ListValue{
												ListValue: &responses.ContentItemList{
													ListValue: []*responses.ContentItem{
														{
															Union: &responses.ContentItem_Image{
																Image: &responses.ContentItemImage{
																	Type:     imgType,
																	ImageUrl: &imageURL,
																},
															},
														},
														{
															Union: &responses.ContentItem_Text{
																Text: &responses.ContentItemText{
																	Type: txtType,
																	Text: prompt,
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)
	if err != nil {
		return "", err
	}

	var text string
	for _, item := range resp.Output {
		if msg := item.GetOutputMessage(); msg != nil {
			for _, ct := range msg.Content {
				if t := ct.GetText(); t != nil {
					text += t.Text
				}
			}
		}
	}
	return text, nil
}

// callTextModel 调用火山方舟纯文本模型（无图片时使用）
func callTextModel(client *arkruntime.Client, modelID, prompt string) (string, error) {
	txtType := responses.ContentItemType_Enum(responses.ContentItemType_Enum_value["input_text"])

	resp, err := client.CreateResponses(
		context.Background(),
		&responses.ResponsesRequest{
			Model: modelID,
			Input: &responses.ResponsesInput{
				Union: &responses.ResponsesInput_ListValue{
					ListValue: &responses.InputItemList{
						ListValue: []*responses.InputItem{
							{
								Union: &responses.InputItem_EasyMessage{
									EasyMessage: &responses.ItemEasyMessage{
										Role: responses.MessageRole_Enum(responses.MessageRole_Enum_value["user"]),
										Content: &responses.MessageContent{
											Union: &responses.MessageContent_ListValue{
												ListValue: &responses.ContentItemList{
													ListValue: []*responses.ContentItem{
														{
															Union: &responses.ContentItem_Text{
																Text: &responses.ContentItemText{
																	Type: txtType,
																	Text: prompt,
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)
	if err != nil {
		return "", err
	}

	var text string
	for _, item := range resp.Output {
		if msg := item.GetOutputMessage(); msg != nil {
			for _, ct := range msg.Content {
				if t := ct.GetText(); t != nil {
					text += t.Text
				}
			}
		}
	}
	return text, nil
}

// parseAndMatchTags 解析 AI 输出的每行标签名，与已有标签列表做精确/模糊匹配
func parseAndMatchTags(rawText string, allTags []model.ResourceTag) []model.ResourceTag {
	// 构建名称索引（大小写不敏感）
	nameIndex := make(map[string]model.ResourceTag, len(allTags))
	for _, t := range allTags {
		nameIndex[strings.ToLower(t.Name)] = t
	}

	lines := strings.Split(rawText, "\n")
	seen := map[string]bool{}
	var matched []model.ResourceTag

	for _, line := range lines {
		line = strings.TrimSpace(line)
		// 去掉常见前缀符号
		line = strings.TrimLeft(line, "·•-*1234567890.、 ")
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// 去掉括号及其后内容（AI 可能把描述也输出了，如 "少女（描述...）"）
		if idx := strings.IndexAny(line, "（(【"); idx > 0 {
			line = strings.TrimSpace(line[:idx])
		}
		if line == "" {
			continue
		}
		key := strings.ToLower(line)
		if t, ok := nameIndex[key]; ok {
			if !seen[key] {
				seen[key] = true
				matched = append(matched, t)
			}
		}
		if len(matched) >= 5 {
			break
		}
	}
	return matched
}
