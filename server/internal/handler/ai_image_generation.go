package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxAIImagePromptRunes         = service.MaxAIImagePromptRunes
	maxAIImageReferences          = service.MaxAIImageReferences
	maxAIImageReferenceBytes      = service.MaxAIImageReferenceBytes
	aiImageQuickSampleCount       = 3
	aiImageQuickSampleTimeout     = 20 * time.Second
	aiImageQuickSampleMaxExcluded = 12
)

type aiImagePreset struct {
	ID                string   `json:"id"`
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	PromptContent     string   `json:"promptContent"`
	SamplePrompts     []string `json:"samplePrompts"`
	RequiresReference bool     `json:"requiresReference"`
	RecommendedAspect string   `json:"recommendedAspect"`
}

var aiImagePresets = []aiImagePreset{
	{
		ID:            "free",
		Name:          "自由创作",
		Description:   "按描述生成高质壁纸",
		PromptContent: "根据用户的画面描述，生成一张完整、精致且风格统一的图片。默认输出可直接用于桌面/手机壁纸的构图，强调视觉中心明确、层次分明、材质清晰。",
		SamplePrompts: []string{
			"4K高清二次元风格桌面风景，云海中的城市夜景，主视觉清晰，建筑线条简洁，层次分明，色彩高级克制，适合长宽比1:1",
			"4K超清抽象科技壁纸，流动的光带与几何纹理组成主视觉，边缘细节清晰，留有中等留白，适合手机或桌面显示",
			"4K自然系极简壁纸，湖面倒映月光，远景群山与前景树影形成深远透视，细节纹理细腻无噪点",
		},
		RecommendedAspect: "1:1",
	},
	{
		ID:            "anime",
		Name:          "二次元壁纸",
		Description:   "日系动漫质感的高清壁纸",
		PromptContent: "生成二次元动漫风高清壁纸，主视觉保持清爽大气，角色与场景比例协调，色彩可爱但有高级质感，突出光影层次、空气感和边缘细节。",
		SamplePrompts: []string{
			"4K 高清日系二次元壁纸，清澈蓝天下的校园天台，主角站位居中，裙摆随风轻扬，景深柔和，氛围明亮高级",
			"4K 动漫风森林冒险场景，角色与精灵互动，树叶和光斑细节丰富，构图统一，主体层次清晰，画面稳定",
			"4K 清新雨后街景二次元壁纸，湿润路面反射霓虹，角色回头微笑，雨滴和街景细节可辨识，情绪浪漫",
		},
		RecommendedAspect: "16:9",
	},
	{
		ID:            "ip-wallpaper",
		Name:          "动画IP壁纸",
		Description:   "具备动画IP氛围的精致壁纸",
		PromptContent: "生成具有动画IP场景感的壁纸级画面，延续明快叙事线条与角色气质，强调统一世界观视觉语言、清晰主角关系和戏剧化光照。",
		SamplePrompts: []string{
			"4K 动画IP风格世界观壁纸，主角色位于繁华都市高空走廊，角色关系清晰，戏剧化逆光塑造体积感，构图有强烈故事性",
			"4K 水彩质感的动画IP横版壁纸，角色与配角同框，背景延续统一色调与透视，前景有轻微动态模糊表现运动",
			"4K 宽幅动画IP海报感图像，角色三联动构图，统一角色比例与明暗关系，保持留白与视觉中心平衡",
		},
		RecommendedAspect: "16:9",
	},
	{
		ID:            "landscape",
		Name:          "风景壁纸",
		Description:   "电影感自然景观与空间感",
		PromptContent: "生成富有电影质感的风景壁纸，突出远景层次、真实天空与地表关系、景深与环境光；保持画面完整度，适合高清长宽比使用。",
		SamplePrompts: []string{
			"4K 电影感雪山风景壁纸，清晨薄雾与层层山脊形成纵深，远景明暗分离，前景松林有细节层次与真实纹理",
			"4K 热带海岸线风景壁纸，浪花卷起的体积感强，海面反光明晰，阳光穿透云层形成光束，构图稳定",
			"4K 森林瀑布壁纸，远景水汽与石壁形成空间纵深，树叶和水雾细节自然，整体清新高对比",
		},
		RecommendedAspect: "16:9",
	},
	{
		ID:            "sketch",
		Name:          "草图成图",
		Description:   "保留构图，把线稿发展成完整画面",
		PromptContent: "将参考草图发展为完整画面。保留主要构图、主体位置和姿态，同时补充连贯的材质、光线和细节。",
		SamplePrompts: []string{
			"将当前草图转成电影级真实场景，保留构图与姿态，补充光照和材质细节，画面清晰可读",
			"将参考线稿转成二次元插画风格，保持主体比例不变，增强背景氛围与色彩统一",
		},
		RequiresReference: true,
		RecommendedAspect: "4:3",
	},
	{
		ID:            "cover",
		Name:          "文章封面",
		Description:   "生成清晰、克制的主题封面",
		PromptContent: "生成一张清晰克制的主题封面，保留一个明确视觉焦点、均衡的留白，并且不要出现可见文字。整体风格偏向高级排版友好，便于添加标题。",
		SamplePrompts: []string{
			"高级杂志封面风格壁纸，主体在黄金分割点，整体克制，留白适中，色彩统一，适配后续加标题",
			"4K 清晰主题封面构图，单一焦点+渐变背景，边缘干净，构图稳定，支持标题排版",
			"简约科技封面风壁纸，冷暖过渡光照，前景图形醒目，底部有视觉留白便于放文字",
		},
		RecommendedAspect: "16:9",
	},
	{
		ID:            "product",
		Name:          "产品展示",
		Description:   "生成干净的产品视觉图",
		PromptContent: "生成一张高品质的产品展示图，准确呈现主体形态，使用克制的棚拍光线与干净构图，不要添加额外产品。",
		SamplePrompts: []string{
			"高端电子产品棚拍，主产品居中，柔和顶光与环境光相结合，金属与玻璃纹理清晰，背景干净低噪",
			"4K 商品展示图，深色背景下产品局部高光突出，角度稳固，构图留白以突出产品形态",
		},
		RecommendedAspect: "4:3",
	},
	{
		ID:            "avatar",
		Name:          "角色头像",
		Description:   "生成单角色方形头像",
		PromptContent: "生成一张适合头像使用的方形图片，只呈现一个清晰角色，使用简洁背景并保持容易辨识的轮廓。",
		SamplePrompts: []string{
			"1:1 角色头像，单人物居中，清晰可辨识面部表情，背景简洁渐变，光影突出颧骨和轮廓",
			"动漫风单人头像，面部细节丰富，头部占比适中，背景纯色柔和，不出现多余元素",
		},
		RecommendedAspect: "1:1",
	},
	{
		ID:            "felt",
		Name:          "毛毡玩具",
		Description:   "转成柔软的手作毛毡质感",
		PromptContent: "将主体渲染为手作毛毡玩具场景，呈现柔软纤维、圆润形体、细微缝线和温暖棚拍光线。",
		SamplePrompts: []string{
			"毛毡玩具风格森林插画，圆润毛绒熊为主角，纤维质感清晰，缝线细节自然，背景温暖柔和",
			"毛毡工艺场景，桌面摆放多个小人偶，柔软体积边缘真实可触感，色彩温馨，光线明亮舒适",
		},
		RecommendedAspect: "1:1",
	},
}

var aiImageSizes = service.AIImageSizes

type createAIImageGenerationRequest struct {
	ModelID               string   `json:"modelId"`
	PresetID              string   `json:"presetId"`
	SkillID               string   `json:"skillId"`
	Prompt                string   `json:"prompt"`
	AspectRatio           string   `json:"aspectRatio"`
	Quality               string   `json:"quality"`
	ReferenceRaw          []string `json:"references"`
	ReferenceGenerationID string   `json:"referenceGenerationId"`
}

type aiImageQuickSampleRequest struct {
	ExcludedPrompts []string `json:"excludedPrompts"`
}

func ListAIImagePresets(c *gin.Context) {
	Success(c, gin.H{
		"presets":      aiImagePresets,
		"aspectRatios": []string{"1:1", "4:3", "3:4", "16:9", "9:16"},
		"qualities":    []string{"1K", "2K"},
		"sizes":        aiImageSizes,
	})
}

// GenerateAIImagePresetSamples creates a small set of replaceable prompt
// examples. It intentionally uses the catalog's fastest text model policy so
// this lightweight interaction cannot accidentally consume a large-context
// model selected for a different workflow.
func GenerateAIImagePresetSamples(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload aiImageQuickSampleRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "快速示例参数错误")
		return
	}
	preset, ok := findAIImagePreset(c.Param("presetId"))
	if !ok {
		Error(c, http.StatusNotFound, "提示词模板不存在")
		return
	}

	excluded := normalizeAIImageQuickSamplePrompts(payload.ExcludedPrompts, aiImageQuickSampleMaxExcluded)
	systemPrompt, userPrompt := buildAIImageQuickSamplePrompt(preset, excluded)
	requestPrompt := systemPrompt + "\n" + userPrompt
	started := time.Now()
	invocation, err := aimodel.ResolveFastTextInvocation(database.GetDB(), aiImageQuickSampleTimeout)
	if err != nil {
		aiusage.Record(aiusage.Entry{
			Feature: "ai-image-quick-samples", Provider: "unknown", UserID: userID.String(),
			Status: aiusage.StatusFailed, PromptChars: aiusage.CharCount(requestPrompt),
			LatencyMs: aiusage.Since(started), ErrorMessage: err.Error(),
		})
		respondCatalogModelError(c, err)
		return
	}

	temperature := 0.95
	maxTokens := 480
	response, err := invocation.Client.Chat(c.Request.Context(), aiclient.CompatibleChatRequest{
		Model: invocation.Model.ModelID,
		Messages: []aiclient.CompatibleMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
	})
	if err != nil {
		aiusage.Record(aiusage.Entry{
			Feature: "ai-image-quick-samples", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
			UserID: userID.String(), Status: aiusage.StatusFailed, PromptChars: aiusage.CharCount(requestPrompt),
			LatencyMs: aiusage.Since(started), ErrorMessage: err.Error(),
		})
		Error(c, http.StatusBadGateway, "生成快速示例失败，请稍后重试")
		return
	}
	if len(response.Choices) == 0 {
		aiusage.Record(aiusage.Entry{
			Feature: "ai-image-quick-samples", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
			UserID: userID.String(), Status: aiusage.StatusFailed, PromptChars: aiusage.CharCount(requestPrompt),
			LatencyMs: aiusage.Since(started), ErrorMessage: "empty model response",
		})
		Error(c, http.StatusBadGateway, "生成快速示例失败，请稍后重试")
		return
	}

	raw := compatibleMessageText(response.Choices[0].Message.Content)
	samples := parseAIImageQuickSamples(raw, excluded)
	if len(samples) != aiImageQuickSampleCount {
		aiusage.Record(aiusage.Entry{
			Feature: "ai-image-quick-samples", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
			UserID: userID.String(), Status: aiusage.StatusFailed, PromptChars: aiusage.CharCount(requestPrompt),
			ResponseChars: aiusage.CharCount(raw), PromptTokens: response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens, TotalTokens: response.Usage.TotalTokens,
			LatencyMs: aiusage.Since(started), ErrorMessage: "invalid quick sample response",
		})
		Error(c, http.StatusBadGateway, "生成快速示例失败，请稍后重试")
		return
	}

	aiusage.Record(aiusage.Entry{
		Feature: "ai-image-quick-samples", Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
		UserID: userID.String(), Status: aiusage.StatusSuccess, PromptChars: aiusage.CharCount(requestPrompt),
		ResponseChars: aiusage.CharCount(raw), PromptTokens: response.Usage.PromptTokens,
		CompletionTokens: response.Usage.CompletionTokens, TotalTokens: response.Usage.TotalTokens,
		LatencyMs: aiusage.Since(started),
	})
	Success(c, gin.H{"list": samples, "model": modelNameOrFallback(response.Model, invocation.Model.ModelID)})
}

func CreateAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	// Three 5MB binary references expand to roughly 20MB after base64 encoding.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 22<<20)
	var payload createAIImageGenerationRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		Error(c, http.StatusBadRequest, "图片生成参数错误")
		return
	}
	preset, _, references, err := validateAIImageGenerationRequest(payload, nil)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	skill, err := loadOwnedAIImageSkill(userID, payload.SkillID)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	var skillID *model.Int64String
	if skill.ID > 0 {
		id := skill.ID
		skillID = &id
	}
	generation, err := service.NewAIImageGenerationService(database.GetDB()).Queue(
		c.Request.Context(),
		service.AIImageGenerationInput{
			UserID:                userID,
			ModelID:               payload.ModelID,
			PresetID:              preset.ID,
			PresetName:            preset.Name,
			PresetPrompt:          preset.PromptContent,
			SkillID:               skillID,
			SkillName:             skill.Name,
			SkillContent:          composeAIImageSkillContent(skill),
			Prompt:                payload.Prompt,
			AspectRatio:           payload.AspectRatio,
			Quality:               payload.Quality,
			References:            references,
			ReferenceGenerationID: payload.ReferenceGenerationID,
			RequiresReference:     preset.RequiresReference,
			Feature:               "ai-image-studio",
		},
	)
	if err != nil {
		var inputErr *service.AIImageGenerationInputError
		switch {
		case errors.As(err, &inputErr):
			Error(c, http.StatusBadRequest, inputErr.Error())
		case errors.Is(err, service.ErrAIImageStorageUnavailable):
			Error(c, http.StatusServiceUnavailable, err.Error())
		case errors.Is(err, aimodel.ErrModelNotAvailable),
			strings.Contains(err.Error(), "AI 服务未配置"),
			strings.Contains(err.Error(), "不支持的 AI Provider"):
			respondCatalogModelError(c, err)
		default:
			ErrorWithDetail(c, http.StatusInternalServerError, "创建图片生成任务失败", err)
		}
		return
	}
	Success(c, gin.H{"generation": generation})
}

func composeAIImageSkillContent(skill model.AISkill) string {
	content := strings.TrimSpace(skill.Content)
	references := strings.TrimSpace(skill.ReferenceContent)
	if references == "" {
		return content
	}
	return content + "\n\n以下是该技能随附的参考资料；仅在与当前创作任务相关时使用：\n" + references
}

func loadOwnedAIImageSkill(userID model.Int64String, rawID string) (model.AISkill, error) {
	rawID = strings.TrimSpace(rawID)
	if rawID == "" {
		return model.AISkill{}, nil
	}
	id, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || id <= 0 {
		return model.AISkill{}, errors.New("技能无效")
	}
	var skill model.AISkill
	if err := database.GetDB().Where(
		"id = ? AND user_id = ? AND archived_at IS NULL",
		id,
		userID,
	).First(&skill).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.AISkill{}, errors.New("技能不存在或不可用")
		}
		return model.AISkill{}, errors.New("读取技能失败")
	}
	return skill, nil
}

func ListAIImageGenerations(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	reconcileStaleAIImageGenerations(userID)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "24"))
	if limit < 1 {
		limit = 24
	}
	if limit > 50 {
		limit = 50
	}
	var generations []model.AIImageGeneration
	if err := database.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&generations).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		return
	}
	Success(c, gin.H{"list": generations})
}

func GetAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	reconcileStaleAIImageGenerations(userID)
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	Success(c, gin.H{"generation": generation})
}

type updateAIImageGenerationFavoriteRequest struct {
	Favorited *bool `json:"favorited"`
}

func UpdateAIImageGenerationFavorite(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	var payload updateAIImageGenerationFavoriteRequest
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Favorited == nil {
		Error(c, http.StatusBadRequest, "收藏参数错误")
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if err := database.GetDB().Model(&generation).Update("is_favorited", *payload.Favorited).Error; err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "更新图片收藏失败", err)
		return
	}
	generation.IsFavorited = *payload.Favorited
	Success(c, gin.H{"generation": generation})
}

func PauseAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if generation.Status != "queued" && generation.Status != "running" {
		Error(c, http.StatusConflict, "当前图片任务无法暂停")
		return
	}
	finished := time.Now()
	result := database.GetDB().Model(&model.AIImageGeneration{}).
		Where("id = ? AND user_id = ? AND status IN ?", generation.ID, userID, []string{"queued", "running"}).
		Updates(map[string]any{
			"status": "paused", "stage": "completed", "error_code": "GENERATION_PAUSED",
			"error_message": "已暂停生成", "finished_at": finished,
		})
	if result.Error != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "暂停图片生成失败", result.Error)
		return
	}
	if result.RowsAffected == 0 {
		Error(c, http.StatusConflict, "当前图片任务无法暂停")
		return
	}
	service.CancelAIImageGeneration(generation.ID)
	generation, found = findAIImageGeneration(c, userID)
	if !found {
		return
	}
	Success(c, gin.H{"generation": generation})
}

func DeleteAIImageGeneration(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generation, found := findAIImageGeneration(c, userID)
	if !found {
		return
	}
	if !isAIImageGenerationDeletable(generation.Status) {
		Error(c, http.StatusConflict, "图片正在生成，暂不能删除")
		return
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.AIImageConversationMessage{}).
			Where("generation_id = ?", generation.ID).
			Update("generation_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.AIImageGeneration{}).
			Where("parent_generation_id = ?", generation.ID).
			Update("parent_generation_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&generation).Error
	}); err != nil {
		ErrorWithDetail(c, http.StatusInternalServerError, "删除图片生成记录失败", err)
		return
	}
	deleteAIImageGenerationAssets(generation)
	Success(c, gin.H{"deleted": true})
}

func SaveAIImageGenerationResource(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generationID, valid := parsePositiveInt64(c.Param("generationId"))
	if !valid {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return
	}
	var payload struct {
		Visibility string `json:"visibility"`
	}
	if c.Request.ContentLength != 0 && c.ShouldBindJSON(&payload) != nil {
		Error(c, http.StatusBadRequest, "资源保存参数错误")
		return
	}
	result, err := newAIImageResourceSaver().Save(c.Request.Context(), service.SaveAIImageGenerationResourceInput{
		UserID:       userID,
		GenerationID: model.Int64String(generationID),
		Visibility:   payload.Visibility,
	})
	if errors.Is(err, service.ErrAIImageGenerationNotFound) {
		Error(c, http.StatusNotFound, "图片生成记录不存在")
		return
	}
	if errors.Is(err, service.ErrAIImageGenerationNotReady) {
		Error(c, http.StatusConflict, "图片尚未生成完成")
		return
	}
	if errors.Is(err, service.ErrAIImageAlreadySaved) {
		Error(c, http.StatusConflict, "图片已经保存到资源库")
		return
	}
	if err != nil {
		if strings.Contains(err.Error(), "文件过大") {
			Error(c, http.StatusRequestEntityTooLarge, "生成图片文件过大，最大支持 30MB")
			return
		}
		if strings.Contains(err.Error(), "当前没有已验证的可用视觉模型") {
			Error(c, http.StatusServiceUnavailable, "当前没有已验证的可用视觉模型，无法自动识别图片标题和标签")
			return
		}
		if strings.Contains(err.Error(), "generate image metadata") {
			ErrorWithDetail(c, http.StatusBadGateway, "AI 自动识别图片标题和标签失败，请稍后重试", err)
			return
		}
		if strings.Contains(err.Error(), "fetch generated image") {
			ErrorWithDetail(c, http.StatusBadGateway, "读取历史图片失败，请稍后重试", err)
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "保存到资源库失败", err)
		return
	}
	if result.Resource.Visibility == "public" {
		invalidatePublicResourceListCache()
	}
	Success(c, gin.H{"resource": result.Resource, "metadataModel": result.MetadataModel})
}

// GetAIImageGenerationImageData proxies an owned generated image as a data URL.
// Generated-image providers frequently omit browser CORS headers, while the
// resource metadata flow needs a browser-readable image input for vision APIs.
func GetAIImageGenerationImageData(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	generationID, valid := parsePositiveInt64(c.Param("generationId"))
	if !valid {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return
	}
	var generation model.AIImageGeneration
	if err := database.GetDB().Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "图片生成记录不存在")
			return
		}
		ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		return
	}
	if generation.Status != "succeeded" || generation.ResultURL == "" {
		Error(c, http.StatusConflict, "图片尚未生成完成")
		return
	}
	content, mimeType, err := fetchGeneratedAIImage(c.Request.Context(), generation.ResultURL)
	if err != nil {
		ErrorWithDetail(c, http.StatusBadGateway, "读取历史图片失败，请稍后重试", err)
		return
	}
	Success(c, gin.H{"imageBase64": aiImageReferenceDataURL(content, mimeType)})
}

func normalizeAIImageResourceVisibility(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "public") {
		return "public"
	}
	return "private"
}

func newAIImageResourceSaver() service.AIImageResourceSaver {
	return service.AIImageResourceSaver{
		DB:         database.GetDB(),
		FetchImage: fetchGeneratedAIImage,
		GenerateMetadata: func(ctx context.Context, generation model.AIImageGeneration, content []byte, mimeType, resourceType string) (service.AIImageResourceMetadata, error) {
			models, err := aimodel.ListEnabledModels(database.GetDB(), "vision")
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			if len(models) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("当前没有已验证的可用视觉模型，无法自动识别图片标题和标签")
			}
			modelID := models[0].ID.String()
			invocation, err := aimodel.ResolveInvocation(database.GetDB(), modelID, "vision", 60*time.Second)
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			typeName := "壁纸"
			if resourceType == "avatar" {
				typeName = "头像"
			}
			prompt := fmt.Sprintf("看图后完成资源整理。先为这张%s生成一个准确自然的中文标题（不超过20字），再生成5到8个中文标签（每个不超过6字）。标题必须反映画面的主体、场景或可识别角色；标签覆盖主题、风格、色彩或画面元素。严格只输出 JSON：{\"title\":\"...\",\"tags\":[\"...\"]}。", typeName)
			imageURL := aiImageReferenceDataURL(content, mimeType)
			response, err := invocation.Client.Chat(ctx, aiclient.CompatibleChatRequest{Model: invocation.Model.ModelID, Messages: []aiclient.CompatibleMessage{{
				Role: "user",
				Content: []map[string]any{
					{"type": "image_url", "image_url": map[string]string{"url": imageURL}},
					{"type": "text", "text": prompt},
				},
			}}})
			if err != nil {
				return service.AIImageResourceMetadata{}, err
			}
			if len(response.Choices) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回识别结果")
			}
			raw := compatibleMessageText(response.Choices[0].Message.Content)
			var parsed struct {
				Title string   `json:"title"`
				Tags  []string `json:"tags"`
			}
			if err := json.Unmarshal([]byte(aiclient.ExtractJSONObject(raw)), &parsed); err != nil {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回有效的标题和标签")
			}
			title := strings.TrimSpace(parsed.Title)
			tags := normalizeResourceTagNames(parsed.Tags)
			if title == "" || len(tags) == 0 {
				return service.AIImageResourceMetadata{}, errors.New("视觉模型未返回有效的标题和标签")
			}
			return service.AIImageResourceMetadata{
				Title: title,
				Tags:  tags,
				Model: modelNameOrFallback(response.Model, invocation.Model.ModelID),
			}, nil
		},
	}
}

func isAIImageGenerationDeletable(status string) bool {
	return status != "queued" && status != "running"
}

func deleteAIImageGenerationAssets(generation model.AIImageGeneration) {
	uploader := service.NewUploadService()
	for _, key := range []string{generation.ResultStorageKey, generation.CanvasSnapshotStorageKey} {
		if key == "" {
			continue
		}
		if err := uploader.DeleteByKey(key); err != nil {
			log.Printf("[WARN] clean up AI image generation asset failed: id=%s key=%s err=%v", generation.ID.String(), key, err)
		}
	}
}

func validateAIImageGenerationRequest(
	payload createAIImageGenerationRequest,
	availableQualities []string,
) (aiImagePreset, string, []string, error) {
	preset, ok := findAIImagePreset(payload.PresetID)
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的提示词模板")
	}
	prompt := strings.TrimSpace(payload.Prompt)
	if prompt == "" {
		return aiImagePreset{}, "", nil, errors.New("请输入画面描述")
	}
	if utf8.RuneCountInString(prompt) > maxAIImagePromptRunes {
		return aiImagePreset{}, "", nil, fmt.Errorf("画面描述不能超过 %d 个字符", maxAIImagePromptRunes)
	}
	qualityMap, ok := aiImageSizes[payload.AspectRatio]
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的画面比例")
	}
	size, ok := qualityMap[payload.Quality]
	if !ok {
		return aiImagePreset{}, "", nil, errors.New("请选择有效的目标分辨率")
	}
	if len(availableQualities) > 0 && !slices.Contains(availableQualities, payload.Quality) {
		return aiImagePreset{}, "", nil, errors.New("所选图片模型不支持该目标分辨率")
	}
	if len(payload.ReferenceRaw) > maxAIImageReferences {
		return aiImagePreset{}, "", nil, fmt.Errorf("最多支持 %d 张参考图", maxAIImageReferences)
	}
	references := make([]string, 0, len(payload.ReferenceRaw))
	for _, raw := range payload.ReferenceRaw {
		normalized, err := normalizeAIImageReference(raw)
		if err != nil {
			return aiImagePreset{}, "", nil, err
		}
		references = append(references, normalized)
	}
	if preset.RequiresReference && len(references) == 0 && strings.TrimSpace(payload.ReferenceGenerationID) == "" {
		return aiImagePreset{}, "", nil, errors.New("当前模板需要先绘制草图或添加参考素材")
	}
	return preset, size, references, nil
}

func buildAIImageQuickSamplePrompt(preset aiImagePreset, excluded []string) (string, string) {
	systemPrompt := fmt.Sprintf(`你是 AI 图片创作工作台的灵感编辑。请为“%s”生成可直接提交给图片模型的中文画面描述。

严格只输出 JSON 字符串数组，必须恰好 %d 项；不要 Markdown、编号、解释或代码块。每项都要具体描述主体、场景、构图、光影或色彩，且不超过 %d 个字符。不要使用知名人物、角色、商标或受版权保护的 IP 名称。`, preset.Name, aiImageQuickSampleCount, maxAIImagePromptRunes)
	excludedBlock := "无"
	if len(excluded) > 0 {
		excludedBlock = "- " + strings.Join(excluded, "\n- ")
	}
	userPrompt := fmt.Sprintf(`模板要求：%s

当前展示过的示例如下，生成内容不得重复或只做同义改写：
%s

本次变体标记：%d`, preset.PromptContent, excludedBlock, time.Now().UnixNano())
	return systemPrompt, userPrompt
}

func parseAIImageQuickSamples(raw string, excluded []string) []string {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "[")
	end := strings.LastIndex(raw, "]")
	if start < 0 || end <= start {
		return nil
	}
	var values []string
	if err := json.Unmarshal([]byte(raw[start:end+1]), &values); err != nil {
		return nil
	}
	excludedSet := make(map[string]struct{}, len(excluded))
	for _, value := range excluded {
		excludedSet[normalizeAIImageQuickSamplePrompt(value)] = struct{}{}
	}
	result := make([]string, 0, aiImageQuickSampleCount)
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := normalizeAIImageQuickSamplePrompt(value)
		if key == "" || utf8.RuneCountInString(value) > maxAIImagePromptRunes {
			continue
		}
		if _, ok := excludedSet[key]; ok {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
		if len(result) == aiImageQuickSampleCount {
			break
		}
	}
	return result
}

func normalizeAIImageQuickSamplePrompts(values []string, limit int) []string {
	result := make([]string, 0, min(len(values), limit))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := normalizeAIImageQuickSamplePrompt(value)
		if key == "" || utf8.RuneCountInString(value) > maxAIImagePromptRunes {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, value)
		if len(result) == limit {
			break
		}
	}
	return result
}

func normalizeAIImageQuickSamplePrompt(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func normalizeAIImageReference(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	header, encoded, ok := strings.Cut(raw, ",")
	if !ok || !strings.HasPrefix(header, "data:image/") || !strings.HasSuffix(strings.ToLower(header), ";base64") {
		return "", errors.New("参考图必须是 JPG、PNG 或 WebP")
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(header), "data:"), ";base64")
	switch mimeType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return "", errors.New("参考图必须是 JPG、PNG 或 WebP")
	}
	content, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(content) == 0 {
		return "", errors.New("参考图内容无效")
	}
	if len(content) > maxAIImageReferenceBytes {
		return "", errors.New("单张参考图不能超过 5MB")
	}
	if detected := http.DetectContentType(content); detected != mimeType {
		return "", errors.New("参考图格式与内容不一致")
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content), nil
}

func aiImageReferenceDataURL(content []byte, mimeType string) string {
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content)
}

func buildAIImagePrompt(preset aiImagePreset, userPrompt string, hasReference bool) string {
	return service.BuildAIImagePrompt(preset.PromptContent, "", userPrompt, hasReference)
}

func summarizeAIImageError(cause error) string {
	return service.SummarizeAIImageError(cause)
}

func fetchGeneratedAIImage(ctx context.Context, source string) ([]byte, string, error) {
	return service.FetchAIImageSource(ctx, source)
}

func generatedAIImageDimensions(content []byte, mimeType string) (int, int, error) {
	return service.GeneratedAIImageDimensions(content, mimeType)
}

func reconcileStaleAIImageGenerations(userID model.Int64String) {
	cutoff := time.Now().Add(-10 * time.Minute)
	finished := time.Now()
	_ = database.GetDB().Model(&model.AIImageGeneration{}).
		Where("user_id = ? AND status IN ? AND updated_at < ?", userID, []string{"queued", "running"}, cutoff).
		Updates(map[string]any{
			"status": "failed", "stage": "completed", "error_code": "GENERATION_INTERRUPTED",
			"error_message": "生成任务已中断，请重新生成", "finished_at": finished,
		}).Error
}

func findAIImageGeneration(c *gin.Context, userID model.Int64String) (model.AIImageGeneration, bool) {
	generationID, ok := parsePositiveInt64(c.Param("generationId"))
	if !ok {
		Error(c, http.StatusBadRequest, "图片生成记录 ID 无效")
		return model.AIImageGeneration{}, false
	}
	var generation model.AIImageGeneration
	if err := database.GetDB().Where("id = ? AND user_id = ?", generationID, userID).First(&generation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Error(c, http.StatusNotFound, "图片生成记录不存在")
		} else {
			ErrorWithDetail(c, http.StatusInternalServerError, "读取图片生成记录失败", err)
		}
		return model.AIImageGeneration{}, false
	}
	return generation, true
}

func findAIImagePreset(id string) (aiImagePreset, bool) {
	for _, preset := range aiImagePresets {
		if preset.ID == strings.TrimSpace(id) {
			return preset, true
		}
	}
	return aiImagePreset{}, false
}

func parsePositiveInt64(raw string) (int64, bool) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	return value, err == nil && value > 0
}

func aiImageResourceTitle(prompt string) string {
	prompt = strings.Join(strings.Fields(prompt), " ")
	if utf8.RuneCountInString(prompt) <= 40 {
		return prompt
	}
	return string([]rune(prompt)[:40])
}
