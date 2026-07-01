package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/aiusage"
	lifeai "valley-server/internal/lifetrace/ai"
	"valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

const httpStatusClientClosedRequest = 499

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

type imageAnalysisSchedule = prompts.ImageAnalysisSchedule

type imageCropBox struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type imageAnalysisAIResponse = prompts.ImageAnalysisOutput

type pantryPhotoAnalysisAIResponse struct {
	pantryPhotoDetectedItem
	MultiItemDetected bool                      `json:"multiItemDetected"`
	DetectedItems     []pantryPhotoDetectedItem `json:"detectedItems"`
	DateHints         []pantryPhotoDateHint     `json:"dateHints"`
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

type pantryPhotoDateHint struct {
	Kind            string       `json:"kind"`
	Text            string       `json:"text"`
	NormalizedValue string       `json:"normalizedValue"`
	Confidence      float64      `json:"confidence"`
	SourceRegion    imageCropBox `json:"sourceRegion"`
}

type lifeTraceImageAIConfig = lifeai.ImageConfig

const (
	lifeTraceImageAnalysisMaxTokens       = 900
	lifeTracePantryPhotoAnalysisMaxTokens = prompts.PantryPhotoAnalysisMaxTokens
)

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
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-image", userID.String())
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

	aiCfg, errMsg := readLifeTracePantryPhotoAIConfig()
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
	aiCtx = aiusage.WithAudit(aiCtx, "life-trace-pantry-photo", userID.String())
	defer cancel()

	raw, modelName, err := callLifeTraceImageAIWithMaxTokens(aiCtx, aiCfg, imageInput, prompt, lifeTracePantryPhotoAnalysisMaxTokens)
	if err != nil {
		if isLifeTraceAIRequestCanceled(err) {
			if errors.Is(err, context.Canceled) {
				c.JSON(httpStatusClientClosedRequest, apiResponse{
					Code:    httpStatusClientClosedRequest,
					Message: "商品分析已取消",
				})
				return
			}
			c.JSON(http.StatusGatewayTimeout, apiResponse{
				Code:    http.StatusGatewayTimeout,
				Message: "AI 商品分析超时，请稍后重试",
			})
			return
		}
		logger.Error(c, "LifeTrace pantry photo AI call failed", err, logrus.Fields{
			"source": aiCfg.Source,
			"model":  aiCfg.Model,
		})
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 商品分析失败：" + err.Error()})
		return
	}

	parsed, err := parsePantryPhotoAnalysisAIResponse(raw)
	if err != nil {
		logger.Error(c, "LifeTrace pantry photo AI response parse failed", err, logrus.Fields{
			"source":     aiCfg.Source,
			"model":      modelName,
			"rawPreview": trimRunes(strings.TrimSpace(raw), 240),
		})
		c.JSON(http.StatusBadGateway, apiResponse{Code: http.StatusBadGateway, Message: "AI 商品分析解析失败：" + err.Error()})
		return
	}
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = aiCfg.Model
	}
	modelTag := buildAIModelTag(aiCfg.Source, modelName)

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
		"householdId":       householdCtx.Household.ID,
		"householdName":     householdCtx.Household.Name,
		"source":            aiCfg.Source,
		"model":             modelName,
		"modelTag":          modelTag,
	})
}

func readLifeTraceImageAIConfig() (lifeTraceImageAIConfig, string) {
	return lifeai.ReadImageConfig(lifeTraceTodayAdviceDefaultTimeout)
}

func readLifeTracePantryPhotoAIConfig() (lifeTraceImageAIConfig, string) {
	return lifeai.ReadPantryPhotoConfig(lifeTraceTodayAdviceDefaultTimeout)
}

func buildAIModelTag(source string, modelName string) string {
	source = strings.TrimSpace(strings.ToLower(source))
	modelName = strings.TrimSpace(modelName)
	label := strings.ToUpper(source)
	switch source {
	case "gemini":
		label = "Gemini"
	case "ark":
		label = "ARK"
	case "openai":
		label = "OpenAI"
	}
	if modelName == "" {
		return label
	}
	if label == "" {
		return modelName
	}
	return label + " · " + modelName
}

func buildImageAnalysisPrompt(kind string, useVision bool) string {
	return prompts.BuildImageAnalysisPrompt(prompts.ImageAnalysisInput{
		Kind:      kind,
		UseVision: useVision,
	})
}

func buildPantryPhotoAnalysisPrompt(
	hint string,
	householdName string,
	useVision bool,
	barcodeValue string,
	barcodeFormat string,
	barcodeSource string,
) string {
	return prompts.BuildPantryPhotoAnalysisPrompt(prompts.PantryPhotoAnalysisInput{
		Hint:          hint,
		HouseholdName: householdName,
		UseVision:     useVision,
		BarcodeValue:  barcodeValue,
		BarcodeFormat: barcodeFormat,
		BarcodeSource: barcodeSource,
	})
}

func isLifeTraceAIRequestCanceled(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

func callLifeTraceImageAI(
	ctx context.Context,
	cfg lifeTraceImageAIConfig,
	imageInput string,
	prompt string,
) (string, string, error) {
	return callLifeTraceImageAIWithMaxTokens(ctx, cfg, imageInput, prompt, lifeTraceImageAnalysisMaxTokens)
}

func callLifeTraceImageAIWithMaxTokens(
	ctx context.Context,
	cfg lifeTraceImageAIConfig,
	imageInput string,
	prompt string,
	maxTokens int,
) (string, string, error) {
	result, err := lifeai.NewClient().GenerateVisionJSON(ctx, cfg, lifeai.VisionRequest{
		ImageInput: imageInput,
		Prompt:     prompt,
		MaxTokens:  maxTokens,
	})
	return result.Content, result.Model, err
}

func normalizeLifeTraceImageInput(raw string) string {
	return lifeai.NormalizeImageInput(raw)
}

func parseImageAnalysisAIResponse(raw string, kind string) (imageAnalysisAIResponse, error) {
	return prompts.ParseImageAnalysisOutput(raw, kind)
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
	dateHints := normalizePantryPhotoDateHints(parsed.DateHints)
	primaryItem, dateHints = applyDateRulesToPantryPhotoItem(primaryItem, dateHints)
	detectedItems[0] = primaryItem

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
	parsed.DateHints = dateHints
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

func normalizePantryPhotoDateHints(items []pantryPhotoDateHint) []pantryPhotoDateHint {
	result := make([]pantryPhotoDateHint, 0, 6)
	seen := map[string]bool{}
	for _, item := range items {
		kind := strings.TrimSpace(item.Kind)
		if !isValidPantryDateHintKind(kind) {
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
		result = append(result, pantryPhotoDateHint{
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

func isValidPantryDateHintKind(kind string) bool {
	switch kind {
	case "production_date", "expiry_date", "shelf_life_days", "shelf_life_text":
		return true
	default:
		return false
	}
}

func applyDateRulesToPantryPhotoItem(
	item pantryPhotoDetectedItem,
	dateHints []pantryPhotoDateHint,
) (pantryPhotoDetectedItem, []pantryPhotoDateHint) {
	expiryValues := make([]string, 0, 2)
	shelfLifeDays := item.ShelfLifeDays
	for _, hint := range dateHints {
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
			if shelfLifeDays <= 0 {
				if days, err := strconv.Atoi(strings.TrimSpace(hint.NormalizedValue)); err == nil {
					shelfLifeDays = normalizePantryShelfLifeDays(days)
				}
			}
		}
	}

	expiryValues = uniquePantryDateValues(expiryValues)
	if item.ProductionDate != "" && shelfLifeDays > 0 {
		item.ShelfLifeDays = shelfLifeDays
	}
	if len(expiryValues) > 1 {
		item.ExpiresAt = ""
		item.Warnings = append(item.Warnings, "识别到多个日期，暂不自动填写到期日")
	} else if len(expiryValues) == 1 {
		item.ExpiresAt = expiryValues[0]
	} else if item.ExpiresAt == "" && item.ProductionDate != "" && shelfLifeDays > 0 {
		item.ShelfLifeDays = shelfLifeDays
		item.ExpiresAt = addDaysToPantryDate(item.ProductionDate, item.ShelfLifeDays)
	}

	if item.ExpiresAt == "" && item.ProductionDate == "" && shelfLifeDays > 0 {
		item.ShelfLifeDays = 0
		item.Warnings = append(item.Warnings, "识别到保质期但缺少生产日期，无法计算到期日")
	}

	item.Warnings = normalizePantryPhotoWarnings(item.Warnings)
	return item, dateHints
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
