package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

type imageAnalysisRequest struct {
	ImageURL    string `json:"imageUrl"`
	ImageBase64 string `json:"imageBase64"`
	Kind        string `json:"kind"`
}

type pantryPhotoAnalysisRequest struct {
	ImageURL      string `json:"imageUrl"`
	ImageBase64   string `json:"imageBase64"`
	HouseholdID   string `json:"householdId"`
	Hint          string `json:"hint"`
	BarcodeValue  string `json:"barcodeValue"`
	BarcodeFormat string `json:"barcodeFormat"`
	BarcodeSource string `json:"barcodeSource"`
}

type imageAnalysisSchedule struct {
	DateOption string `json:"dateOption"`
	Time       string `json:"time"`
}

type imageCropBox struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type imageAnalysisAIResponse struct {
	Title    string                `json:"title"`
	Summary  string                `json:"summary"`
	PlanType string                `json:"planType"`
	Mood     string                `json:"mood"`
	Tags     []string              `json:"tags"`
	Schedule imageAnalysisSchedule `json:"schedule"`
}

type pantryPhotoAnalysisAIResponse struct {
	pantryPhotoDetectedItem
	MultiItemDetected bool                      `json:"multiItemDetected"`
	DetectedItems     []pantryPhotoDetectedItem `json:"detectedItems"`
	OCRHints          []pantryPhotoOCRHint      `json:"ocrHints"`
	Tags              []string                  `json:"tags"`
	Summary           string                    `json:"summary"`
}

type pantryPhotoDetectedItem struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	Category        string       `json:"category"`
	Brand           string       `json:"brand"`
	Spec            string       `json:"spec"`
	Quantity        int          `json:"quantity"`
	Unit            string       `json:"unit"`
	StorageLocation string       `json:"storageLocation"`
	ExpiresAt       string       `json:"expiresAt"`
	ProductionDate  string       `json:"productionDate"`
	PurchaseDate    string       `json:"purchaseDate"`
	ShelfLifeDays   int          `json:"shelfLifeDays"`
	BarcodeValue    string       `json:"barcodeValue"`
	BarcodeFormat   string       `json:"barcodeFormat"`
	Confidence      float64      `json:"confidence"`
	Warnings        []string     `json:"warnings"`
	CropBox         imageCropBox `json:"cropBox"`
}

type pantryPhotoOCRHint struct {
	Kind            string       `json:"kind"`
	Text            string       `json:"text"`
	NormalizedValue string       `json:"normalizedValue"`
	Confidence      float64      `json:"confidence"`
	SourceRegion    imageCropBox `json:"sourceRegion"`
}

type lifeTraceImageAIConfig struct {
	APIKey    string
	BaseURL   string
	Model     string
	Timeout   time.Duration
	UseVision bool
}

const lifeTraceImageAnalysisMaxTokens = 900

var imageAnalysisDefaults = map[string]imageAnalysisAIResponse{
	"电影海报": {
		Title:    "周末看一部电影",
		Summary:  "这张图适合作为电影计划封面，建议安排在周末晚上，并在观影后生成一条观影踪迹。",
		PlanType: "电影",
		Mood:     "期待",
		Tags:     []string{"电影", "周末", "放松"},
		Schedule: imageAnalysisSchedule{DateOption: "周六", Time: "20:00"},
	},
	"美食照片": {
		Title:    "安排一次放松晚餐",
		Summary:  "这张图更像一顿值得期待的晚餐，可以记录为吃饭计划，完成后沉淀成美食踪迹。",
		PlanType: "吃饭",
		Mood:     "满足",
		Tags:     []string{"美食", "晚餐", "生活奖励"},
		Schedule: imageAnalysisSchedule{DateOption: "周五", Time: "19:30"},
	},
	"生活照片": {
		Title:    "记录一个生活瞬间",
		Summary:  "这张图适合作为日常生活踪迹，建议补充地点、心情和一句回忆。",
		PlanType: "普通事项",
		Mood:     "平静",
		Tags:     []string{"日常", "生活", "记录"},
		Schedule: imageAnalysisSchedule{DateOption: "今天", Time: "21:00"},
	},
}

var validImageAnalysisPlanTypes = map[string]bool{
	"电影":   true,
	"吃饭":   true,
	"运动":   true,
	"阅读":   true,
	"聚会":   true,
	"普通事项": true,
}

var validImageAnalysisDateOptions = map[string]bool{
	"今天": true,
	"明天": true,
	"周五": true,
	"周六": true,
	"周日": true,
}

var (
	imageAnalysisClockPattern   = regexp.MustCompile(`^\d{1,2}:\d{2}$`)
	pantryShelfLifeWordPattern  = regexp.MustCompile(`(?i)(保质期|赏味期|最佳食用期|有效期|到期|食用期限|请在.*内食用|建议在.*内食用)`)
	pantryShelfLifeValuePattern = regexp.MustCompile(`\d+\s*(天|日|周|星期|个月|月|年|小时)`)
)

func (h *Handler) AnalyzeImage(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req imageAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	imageInput := strings.TrimSpace(req.ImageBase64)
	if imageInput == "" {
		imageInput = strings.TrimSpace(req.ImageURL)
	}
	if imageInput == "" {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请先提供要分析的图片"})
		return
	}

	aiCfg, errMsg := readLifeTraceImageAIConfig()
	if errMsg != "" {
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	prompt := buildImageAnalysisPrompt(req.Kind, aiCfg.UseVision)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	defer cancel()

	raw, modelName, err := callLifeTraceImageAI(aiCtx, aiCfg, imageInput, prompt)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 图片分析失败：" + err.Error()})
		return
	}

	parsed, err := parseImageAnalysisAIResponse(raw, req.Kind)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 图片分析解析失败：" + err.Error()})
		return
	}
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}

	success(c, gin.H{
		"title":    parsed.Title,
		"summary":  parsed.Summary,
		"planType": parsed.PlanType,
		"mood":     parsed.Mood,
		"tags":     parsed.Tags,
		"schedule": parsed.Schedule,
		"source":   "ark",
		"model":    modelName,
	})
}

func (h *Handler) AnalyzePantryPhoto(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req pantryPhotoAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	imageInput := strings.TrimSpace(req.ImageBase64)
	if imageInput == "" {
		imageInput = strings.TrimSpace(req.ImageURL)
	}
	if imageInput == "" {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请先提供要分析的商品图片"})
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
		c.JSON(http.StatusServiceUnavailable, apiResponse{Code: http.StatusServiceUnavailable, Message: errMsg})
		return
	}

	prompt := buildPantryPhotoAnalysisPrompt(
		req.Hint,
		householdCtx.Household.Name,
		aiCfg.UseVision,
		normalizePantryBarcodeValue(req.BarcodeValue),
		normalizePantryBarcodeFormat(req.BarcodeFormat),
		strings.TrimSpace(req.BarcodeSource),
	)
	aiCtx, cancel := context.WithTimeout(c.Request.Context(), aiCfg.Timeout)
	defer cancel()

	raw, modelName, err := callLifeTraceImageAI(aiCtx, aiCfg, imageInput, prompt)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 商品分析失败：" + err.Error()})
		return
	}

	parsed, err := parsePantryPhotoAnalysisAIResponse(raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 商品分析解析失败：" + err.Error()})
		return
	}
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}

	success(c, gin.H{
		"name":              parsed.Name,
		"category":          parsed.Category,
		"brand":             parsed.Brand,
		"spec":              parsed.Spec,
		"quantity":          parsed.Quantity,
		"unit":              parsed.Unit,
		"storageLocation":   parsed.StorageLocation,
		"expiresAt":         parsed.ExpiresAt,
		"productionDate":    parsed.ProductionDate,
		"purchaseDate":      parsed.PurchaseDate,
		"shelfLifeDays":     parsed.ShelfLifeDays,
		"barcodeValue":      parsed.BarcodeValue,
		"barcodeFormat":     parsed.BarcodeFormat,
		"tags":              parsed.Tags,
		"confidence":        parsed.Confidence,
		"warnings":          parsed.Warnings,
		"cropBox":           parsed.CropBox,
		"summary":           parsed.Summary,
		"multiItemDetected": parsed.MultiItemDetected,
		"detectedItems":     parsed.DetectedItems,
		"ocrHints":          parsed.OCRHints,
		"householdId":       householdCtx.Household.ID,
		"householdName":     householdCtx.Household.Name,
		"source":            "ark",
		"model":             modelName,
	})
}

func readLifeTraceImageAIConfig() (lifeTraceImageAIConfig, string) {
	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	visionModel := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	textModel := strings.TrimSpace(os.Getenv("ARK_TEXT_MODEL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	if apiKey == "" {
		return lifeTraceImageAIConfig{}, "AI 未配置：缺少 ARK_API_KEY"
	}
	if strings.HasPrefix(visionModel, "ep-") {
		return lifeTraceImageAIConfig{
			APIKey:    apiKey,
			BaseURL:   arkBaseURL,
			Model:     visionModel,
			Timeout:   lifeTraceTodayAdviceDefaultTimeout,
			UseVision: true,
		}, ""
	}
	if strings.HasPrefix(textModel, "ep-") {
		return lifeTraceImageAIConfig{
			APIKey:    apiKey,
			BaseURL:   arkBaseURL,
			Model:     textModel,
			Timeout:   lifeTraceTodayAdviceDefaultTimeout,
			UseVision: false,
		}, ""
	}
	return lifeTraceImageAIConfig{}, "AI 未配置：ARK_VISION_MODEL 或 ARK_TEXT_MODEL 必须以 ep- 开头"
}

func buildImageAnalysisPrompt(kind string, useVision bool) string {
	kind = normalizeImageAnalysisKind(kind)
	visionInstruction := "请直接观察图片内容，结合画面主体、场景和生活用途给出建议。"
	if !useVision {
		visionInstruction = "视觉模型未配置时，请只基于用户选择的图片类型给出保守建议，不要声称看到了具体画面。"
	}

	return strings.Join([]string{
		"你是 Life Trace 的图片生活分析 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"title\":\"计划标题，16字以内\",\"summary\":\"分析和建议，60字以内\",\"planType\":\"电影|吃饭|运动|阅读|聚会|普通事项\",\"mood\":\"心情，6字以内\",\"tags\":[\"标签\"],\"schedule\":{\"dateOption\":\"今天|明天|周五|周六|周日\",\"time\":\"HH:MM\"}}",
		"tags 输出 2-4 个简体中文短标签。",
		visionInstruction,
		"图片类型提示：" + kind,
	}, "\n")
}

func buildPantryPhotoAnalysisPrompt(
	hint string,
	householdName string,
	useVision bool,
	barcodeValue string,
	barcodeFormat string,
	barcodeSource string,
) string {
	visionInstruction := "请直接观察图片内容，优先识别画面主体商品。"
	if !useVision {
		visionInstruction = "视觉模型未配置时，请只基于用户补充说明给出保守草稿，不要声称看到了具体画面。"
	}

	hint = trimRunes(strings.TrimSpace(hint), 80)
	if hint == "" {
		hint = "用户没有补充说明。"
	}
	householdName = trimRunes(strings.TrimSpace(householdName), 24)
	if householdName == "" {
		householdName = "当前库存空间"
	}
	barcodeValue = trimRunes(strings.TrimSpace(barcodeValue), 80)
	barcodeFormat = trimRunes(strings.TrimSpace(barcodeFormat), 24)
	barcodeSource = trimRunes(strings.TrimSpace(barcodeSource), 24)
	barcodeInstruction := "包装编码：无。"
	if barcodeValue != "" {
		if barcodeFormat == "" {
			barcodeFormat = "unknown"
		}
		if barcodeSource == "" {
			barcodeSource = "manual"
		}
		barcodeInstruction = "包装编码：" + barcodeValue + "；格式：" + barcodeFormat + "；来源：" + barcodeSource + "。"
	}

	return strings.Join([]string{
		"你是 Life Trace 的家庭库存商品识别 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"name\":\"商品名称\",\"category\":\"食品|日用品|药品|宠物|其他\",\"brand\":\"品牌或空字符串\",\"spec\":\"规格或空字符串\",\"quantity\":1,\"unit\":\"件|瓶|盒|袋|个|包|罐|支\",\"storageLocation\":\"冷藏|冷冻|厨房|储物柜|卫生间|玄关|其他\",\"expiresAt\":\"YYYY-MM-DD 或空字符串\",\"productionDate\":\"YYYY-MM-DD 或空字符串\",\"purchaseDate\":\"YYYY-MM-DD 或空字符串\",\"shelfLifeDays\":0,\"barcodeValue\":\"包装编码或空字符串\",\"barcodeFormat\":\"ean_13|ean_8|upc_a|upc_e|code_128|qr_code|unknown|空字符串\",\"tags\":[\"标签\"],\"confidence\":0.0,\"warnings\":[\"需要用户确认的事项\"],\"cropBox\":{\"x\":0.1,\"y\":0.1,\"width\":0.8,\"height\":0.8},\"multiItemDetected\":false,\"detectedItems\":[{\"id\":\"item-1\",\"name\":\"商品名称\",\"brand\":\"品牌或空字符串\",\"spec\":\"规格或空字符串\",\"category\":\"食品|日用品|药品|宠物|其他\",\"quantity\":1,\"unit\":\"件|瓶|盒|袋|个|包|罐|支\",\"storageLocation\":\"冷藏|冷冻|厨房|储物柜|卫生间|玄关|其他\",\"expiresAt\":\"YYYY-MM-DD 或空字符串\",\"productionDate\":\"YYYY-MM-DD 或空字符串\",\"shelfLifeDays\":0,\"barcodeValue\":\"包装编码或空字符串\",\"barcodeFormat\":\"ean_13|ean_8|upc_a|upc_e|code_128|qr_code|unknown|空字符串\",\"confidence\":0.0,\"warnings\":[\"需要用户确认的事项\"],\"cropBox\":{\"x\":0.1,\"y\":0.1,\"width\":0.8,\"height\":0.8}}],\"ocrHints\":[{\"kind\":\"production_date|expiry_date|shelf_life_days|shelf_life_text\",\"text\":\"原文\",\"normalizedValue\":\"YYYY-MM-DD 或 180\",\"confidence\":0.0,\"sourceRegion\":{\"x\":0.1,\"y\":0.1,\"width\":0.2,\"height\":0.1}}],\"summary\":\"60字以内说明\"}",
		"category 和 storageLocation 必须从候选值中选择。",
		"顶层字段仍然表示你判断的主商品，同时把主商品也放进 detectedItems[0]。",
		"detectedItems 最多返回 5 个候选，按 confidence 从高到低排序；如果只识别到 1 个商品，multiItemDetected 仍返回 false。",
		"cropBox 和 sourceRegion 使用 0-1 比例坐标；如果不确定，返回居中 0.1/0.1/0.8/0.8。",
		"如果识别到明确到期日，填写 expiresAt，并在 ocrHints 里追加 expiry_date。",
		"如果包装或用户补充中同时出现生产日期和 180天/90天/7天等保质期，填写 productionDate、shelfLifeDays，并计算 expiresAt；同时把生产日期和保质期文本都写入 ocrHints。",
		"如果只看到保质期天数但没有生产日期，expiresAt 返回空字符串，并在 warnings 提示缺少生产日期，无法计算到期日；ocrHints 仍保留保质期线索。",
		"如果看到多个日期且无法确认哪一个是到期日，不要自动填写 expiresAt，只在 warnings 和 ocrHints 里说明冲突。",
		"如果保质期和生产日期都没有出现，不要提示缺少保质期，expiresAt、productionDate 和 shelfLifeDays 返回空值或 0。",
		"不要编造看不清的品牌、规格、生产日期或保质期。",
		"包装编码只能作为线索；不要因为有编码就编造商品名、品牌或规格。图片和编码冲突时，把编码放入 barcodeValue/barcodeFormat，并在 warnings 提示用户确认。",
		"如果图片中有多个商品，返回主商品和多候选列表，但不要自动假设用户要批量入库。",
		"药品、保健品、婴幼儿食品等敏感品类只做库存记录，不给医疗、安全或食用建议。",
		"tags 输出 2-5 个简体中文短标签。",
		visionInstruction,
		"当前库存空间：" + householdName,
		barcodeInstruction,
		"用户补充说明：" + hint,
	}, "\n")
}

func callLifeTraceImageAI(
	ctx context.Context,
	cfg lifeTraceImageAIConfig,
	imageInput string,
	prompt string,
) (string, string, error) {
	client := ensureLifeTraceArkClient(cfg.APIKey, cfg.BaseURL)
	content := &arkmodel.ChatCompletionMessageContent{}
	if cfg.UseVision {
		imageURL := normalizeLifeTraceImageInput(imageInput)
		content.ListValue = []*arkmodel.ChatCompletionMessageContentPart{
			{
				Type: arkmodel.ChatCompletionMessageContentPartTypeImageURL,
				ImageURL: &arkmodel.ChatMessageImageURL{
					URL:    imageURL,
					Detail: arkmodel.ImageURLDetailLow,
				},
			},
			{
				Type: arkmodel.ChatCompletionMessageContentPartTypeText,
				Text: prompt,
			},
		}
	} else {
		content.StringValue = &prompt
	}

	temperature := float32(0.3)
	maxTokens := lifeTraceImageAnalysisMaxTokens
	resp, err := client.CreateChatCompletion(ctx, arkmodel.CreateChatCompletionRequest{
		Model: cfg.Model,
		Messages: []*arkmodel.ChatCompletionMessage{
			{Role: arkmodel.ChatMessageRoleUser, Content: content},
		},
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		return "", "", err
	}
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", resp.Model, errors.New("empty AI response")
	}

	raw := ""
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw = *contentValue.StringValue
	} else {
		parts := make([]string, 0, len(contentValue.ListValue))
		for _, part := range contentValue.ListValue {
			if part != nil && strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
		raw = strings.Join(parts, "\n")
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", resp.Model, errors.New("empty AI content")
	}
	return raw, resp.Model, nil
}

func normalizeLifeTraceImageInput(raw string) string {
	imageURL := strings.TrimSpace(raw)
	lower := strings.ToLower(imageURL)
	if strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:") {
		return imageURL
	}
	return "data:image/jpeg;base64," + imageURL
}

func parseImageAnalysisAIResponse(raw string, kind string) (imageAnalysisAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return imageAnalysisAIResponse{}, errors.New("missing JSON object")
	}

	var parsed imageAnalysisAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return imageAnalysisAIResponse{}, err
	}

	fallback := imageAnalysisDefaultForKind(kind)
	parsed.Title = trimRunes(parsed.Title, 20)
	if parsed.Title == "" {
		parsed.Title = fallback.Title
	}
	parsed.Summary = trimRunes(parsed.Summary, 72)
	if parsed.Summary == "" {
		parsed.Summary = fallback.Summary
	}
	parsed.PlanType = strings.TrimSpace(parsed.PlanType)
	if !validImageAnalysisPlanTypes[parsed.PlanType] {
		parsed.PlanType = fallback.PlanType
	}
	parsed.Mood = trimRunes(parsed.Mood, 6)
	if parsed.Mood == "" {
		parsed.Mood = fallback.Mood
	}
	parsed.Tags = normalizeImageAnalysisTags(parsed.Tags, fallback.Tags)
	if !isValidImageAnalysisSchedule(parsed.Schedule) {
		parsed.Schedule = fallback.Schedule
	}
	return parsed, nil
}

func parsePantryPhotoAnalysisAIResponse(raw string) (pantryPhotoAnalysisAIResponse, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return pantryPhotoAnalysisAIResponse{}, errors.New("missing JSON object")
	}

	var parsed pantryPhotoAnalysisAIResponse
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return pantryPhotoAnalysisAIResponse{}, err
	}

	primaryItem := normalizePantryPhotoDetectedItem(parsed.pantryPhotoDetectedItem, "item-1")
	detectedItems := normalizePantryPhotoDetectedItems(parsed.DetectedItems)
	if len(detectedItems) == 0 {
		detectedItems = []pantryPhotoDetectedItem{primaryItem}
	} else {
		primaryItem = mergePrimaryPantryPhotoDetectedItem(primaryItem, detectedItems[0])
		detectedItems[0] = primaryItem
	}
	ocrHints := normalizePantryPhotoOCRHints(parsed.OCRHints)
	primaryItem, ocrHints = applyOCRRulesToPantryPhotoItem(primaryItem, ocrHints)

	parsed.Name = primaryItem.Name
	parsed.Category = primaryItem.Category
	parsed.Brand = primaryItem.Brand
	parsed.Spec = primaryItem.Spec
	parsed.Quantity = primaryItem.Quantity
	parsed.Unit = primaryItem.Unit
	parsed.StorageLocation = primaryItem.StorageLocation
	parsed.ExpiresAt = primaryItem.ExpiresAt
	parsed.ProductionDate = primaryItem.ProductionDate
	parsed.PurchaseDate = primaryItem.PurchaseDate
	parsed.ShelfLifeDays = primaryItem.ShelfLifeDays
	parsed.BarcodeValue = primaryItem.BarcodeValue
	parsed.BarcodeFormat = primaryItem.BarcodeFormat
	parsed.Confidence = primaryItem.Confidence
	parsed.Warnings = primaryItem.Warnings
	parsed.CropBox = primaryItem.CropBox
	parsed.DetectedItems = detectedItems
	parsed.MultiItemDetected = parsed.MultiItemDetected || len(parsed.DetectedItems) > 1
	parsed.OCRHints = ocrHints
	parsed.Tags = normalizePantryPhotoTags(parsed.Tags)
	parsed.Summary = trimRunes(strings.TrimSpace(parsed.Summary), 80)
	if parsed.Summary == "" {
		parsed.Summary = "已生成商品入库草稿，请确认名称、数量和保质期后再入库。"
	}
	return parsed, nil
}

func normalizePantryPhotoDetectedItem(item pantryPhotoDetectedItem, fallbackID string) pantryPhotoDetectedItem {
	item.ID = strings.TrimSpace(item.ID)
	if item.ID == "" {
		item.ID = fallbackID
	}
	item.Name = trimRunes(strings.TrimSpace(item.Name), 24)
	if item.Name == "" {
		item.Name = "未知商品"
		item.Warnings = append(item.Warnings, "商品名称识别不确定，请手动确认")
	}
	item.Category = normalizePantryCategory(item.Category)
	item.Brand = trimRunes(strings.TrimSpace(item.Brand), 24)
	item.Spec = trimRunes(strings.TrimSpace(item.Spec), 24)
	item.Quantity = normalizePantryQuantity(item.Quantity)
	item.Unit = trimRunes(normalizePantryUnit(item.Unit), 8)
	item.StorageLocation = normalizePantryLocation(item.StorageLocation)
	item.ExpiresAt = normalizePantryDate(item.ExpiresAt)
	item.ProductionDate = normalizePantryDate(item.ProductionDate)
	item.PurchaseDate = normalizePantryDate(item.PurchaseDate)
	item.ShelfLifeDays = normalizePantryShelfLifeDays(item.ShelfLifeDays)
	item.BarcodeValue = normalizePantryBarcodeValue(item.BarcodeValue)
	item.BarcodeFormat = normalizePantryBarcodeFormat(item.BarcodeFormat)
	item.Confidence = normalizePantryPhotoConfidence(item.Confidence)
	item.Warnings = normalizePantryPhotoWarnings(item.Warnings)
	item.CropBox = normalizeImageCropBox(item.CropBox)
	return item
}

func normalizePantryPhotoDetectedItems(items []pantryPhotoDetectedItem) []pantryPhotoDetectedItem {
	result := make([]pantryPhotoDetectedItem, 0, 5)
	for index, item := range items {
		normalized := normalizePantryPhotoDetectedItem(item, "item-"+strconv.Itoa(index+1))
		result = append(result, normalized)
		if len(result) >= 5 {
			break
		}
	}
	return result
}

func mergePrimaryPantryPhotoDetectedItem(primary pantryPhotoDetectedItem, candidate pantryPhotoDetectedItem) pantryPhotoDetectedItem {
	if candidate.Name != "" && primary.Name == "" {
		primary.Name = candidate.Name
	}
	if primary.Name == "未知商品" && candidate.Name != "" {
		primary.Name = candidate.Name
	}
	if primary.Category == "" {
		primary.Category = candidate.Category
	}
	if primary.Brand == "" {
		primary.Brand = candidate.Brand
	}
	if primary.Spec == "" {
		primary.Spec = candidate.Spec
	}
	if primary.Quantity <= 0 {
		primary.Quantity = candidate.Quantity
	}
	if primary.Unit == "" {
		primary.Unit = candidate.Unit
	}
	if primary.StorageLocation == "" {
		primary.StorageLocation = candidate.StorageLocation
	}
	if primary.ExpiresAt == "" {
		primary.ExpiresAt = candidate.ExpiresAt
	}
	if primary.ProductionDate == "" {
		primary.ProductionDate = candidate.ProductionDate
	}
	if primary.PurchaseDate == "" {
		primary.PurchaseDate = candidate.PurchaseDate
	}
	if primary.ShelfLifeDays <= 0 {
		primary.ShelfLifeDays = candidate.ShelfLifeDays
	}
	if primary.BarcodeValue == "" {
		primary.BarcodeValue = candidate.BarcodeValue
	}
	if primary.BarcodeFormat == "" {
		primary.BarcodeFormat = candidate.BarcodeFormat
	}
	if primary.Confidence <= 0 {
		primary.Confidence = candidate.Confidence
	}
	if len(primary.Warnings) == 0 {
		primary.Warnings = candidate.Warnings
	}
	if primary.CropBox.Width <= 0 || primary.CropBox.Height <= 0 {
		primary.CropBox = candidate.CropBox
	}
	return normalizePantryPhotoDetectedItem(primary, primary.ID)
}

func normalizePantryPhotoOCRHints(items []pantryPhotoOCRHint) []pantryPhotoOCRHint {
	result := make([]pantryPhotoOCRHint, 0, 6)
	seen := map[string]bool{}
	for _, item := range items {
		kind := strings.TrimSpace(item.Kind)
		if !isValidPantryOCRHintKind(kind) {
			continue
		}
		text := trimRunes(strings.TrimSpace(item.Text), 32)
		if text == "" {
			continue
		}
		normalizedValue := trimRunes(strings.TrimSpace(item.NormalizedValue), 20)
		if kind == "shelf_life_text" && !looksLikePantryShelfLifeText(text, normalizedValue) {
			continue
		}
		key := kind + ":" + text + ":" + normalizedValue
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, pantryPhotoOCRHint{
			Kind:            kind,
			Text:            text,
			NormalizedValue: normalizedValue,
			Confidence:      normalizePantryPhotoConfidence(item.Confidence),
			SourceRegion:    normalizeImageCropBox(item.SourceRegion),
		})
		if len(result) >= 6 {
			break
		}
	}
	return result
}

func looksLikePantryShelfLifeText(text string, normalizedValue string) bool {
	combined := strings.TrimSpace(text + " " + normalizedValue)
	if combined == "" {
		return false
	}
	if pantryShelfLifeWordPattern.MatchString(combined) {
		return true
	}
	return pantryShelfLifeValuePattern.MatchString(combined)
}

func isValidPantryOCRHintKind(kind string) bool {
	switch kind {
	case "production_date", "expiry_date", "shelf_life_days", "shelf_life_text":
		return true
	default:
		return false
	}
}

func applyOCRRulesToPantryPhotoItem(
	item pantryPhotoDetectedItem,
	ocrHints []pantryPhotoOCRHint,
) (pantryPhotoDetectedItem, []pantryPhotoOCRHint) {
	expiryValues := make([]string, 0, 2)
	for _, hint := range ocrHints {
		switch hint.Kind {
		case "expiry_date":
			if date := normalizePantryDate(hint.NormalizedValue); date != "" {
				expiryValues = append(expiryValues, date)
			}
		case "production_date":
			if item.ProductionDate == "" {
				item.ProductionDate = normalizePantryDate(hint.NormalizedValue)
			}
		case "shelf_life_days":
			if item.ShelfLifeDays <= 0 {
				if days, err := strconv.Atoi(strings.TrimSpace(hint.NormalizedValue)); err == nil {
					item.ShelfLifeDays = normalizePantryShelfLifeDays(days)
				}
			}
		}
	}

	expiryValues = uniquePantryDateValues(expiryValues)
	if len(expiryValues) > 1 {
		item.ExpiresAt = ""
		item.Warnings = append(item.Warnings, "识别到多个日期，暂不自动填写到期日")
	} else if len(expiryValues) == 1 {
		item.ExpiresAt = expiryValues[0]
	} else if item.ExpiresAt == "" && item.ProductionDate != "" && item.ShelfLifeDays > 0 {
		item.ExpiresAt = addDaysToPantryDate(item.ProductionDate, item.ShelfLifeDays)
	}

	if item.ExpiresAt == "" && item.ProductionDate == "" && item.ShelfLifeDays > 0 {
		item.Warnings = append(item.Warnings, "识别到保质期但缺少生产日期，无法计算到期日")
	}

	item.Warnings = normalizePantryPhotoWarnings(item.Warnings)
	return item, ocrHints
}

func uniquePantryDateValues(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func normalizePantryShelfLifeDays(value int) int {
	if value <= 0 {
		return 0
	}
	if value > 3650 {
		return 3650
	}
	return value
}

func addDaysToPantryDate(dateText string, days int) string {
	base, err := time.Parse("2006-01-02", dateText)
	if err != nil || days <= 0 {
		return ""
	}
	return base.AddDate(0, 0, days).Format("2006-01-02")
}

func normalizePantryPhotoConfidence(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func normalizeImageCropBox(box imageCropBox) imageCropBox {
	if box.Width <= 0 || box.Height <= 0 {
		return imageCropBox{X: 0.1, Y: 0.1, Width: 0.8, Height: 0.8}
	}
	if box.X < 0 {
		box.X = 0
	}
	if box.Y < 0 {
		box.Y = 0
	}
	if box.Width > 1 {
		box.Width = 1
	}
	if box.Height > 1 {
		box.Height = 1
	}
	if box.X+box.Width > 1 {
		box.X = 1 - box.Width
	}
	if box.Y+box.Height > 1 {
		box.Y = 1 - box.Height
	}
	if box.X < 0 {
		box.X = 0
	}
	if box.Y < 0 {
		box.Y = 0
	}
	return box
}

func normalizePantryPhotoTags(items []string) []string {
	result := make([]string, 0, 5)
	seen := map[string]bool{}
	for _, item := range items {
		item = trimRunes(strings.TrimSpace(item), 8)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
		if len(result) >= 5 {
			break
		}
	}
	if len(result) == 0 {
		return []string{"AI识别", "待确认"}
	}
	return result
}

func normalizePantryPhotoWarnings(items []string) []string {
	result := make([]string, 0, 4)
	seen := map[string]bool{}
	for _, item := range items {
		item = trimRunes(strings.TrimSpace(item), 36)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
		if len(result) >= 4 {
			break
		}
	}
	return result
}

func normalizeImageAnalysisKind(kind string) string {
	kind = strings.TrimSpace(kind)
	if _, ok := imageAnalysisDefaults[kind]; ok {
		return kind
	}
	return "生活照片"
}

func imageAnalysisDefaultForKind(kind string) imageAnalysisAIResponse {
	return imageAnalysisDefaults[normalizeImageAnalysisKind(kind)]
}

func normalizeImageAnalysisTags(items []string, fallback []string) []string {
	result := make([]string, 0, 4)
	seen := map[string]bool{}
	for _, item := range items {
		item = trimRunes(item, 8)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
		if len(result) >= 4 {
			break
		}
	}
	if len(result) == 0 {
		return append([]string{}, fallback...)
	}
	return result
}

func isValidImageAnalysisSchedule(schedule imageAnalysisSchedule) bool {
	if !validImageAnalysisDateOptions[strings.TrimSpace(schedule.DateOption)] {
		return false
	}
	if !imageAnalysisClockPattern.MatchString(strings.TrimSpace(schedule.Time)) {
		return false
	}
	parts := strings.Split(schedule.Time, ":")
	if len(parts) != 2 {
		return false
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil {
		return false
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}
	return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}
