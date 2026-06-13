package lifetrace

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	defaultPantryPhotoOCRTimeout = 20 * time.Second
)

type pantryPhotoOCRConfig struct {
	Command string
	Timeout time.Duration
	Engine  string
}

type pantryPhotoOCRResult struct {
	RawText string
	Engine  string
}

var (
	pantryOCRExpiryDatePattern = regexp.MustCompile(`(?:保质期至|有效期至|到期日|过期日|截止日期|截止到)[^\d]{0,8}((?:20)?\d{2}[./\-年]\d{1,2}[./\-月]\d{1,2}日?)`)
	pantryOCRProductionPattern = regexp.MustCompile(`(?:生产日期|生产日|生产批号|制造日期)[^\d]{0,12}((?:20)?\d{2}[./\-年]\d{1,2}[./\-月]\d{1,2}日?)`)
	pantryOCRShelfLifePattern  = regexp.MustCompile(`(?:保质期|有效期|赏味期|最佳食用期)[^0-9]{0,10}(\d{1,4})\s*(天|日|个月|月|年)`)
)

func (h *Handler) analyzePantryPhotoWithOCR(
	c *gin.Context,
	householdCtx householdContext,
	req pantryPhotoAnalysisRequest,
	imageInput string,
) {
	cfg := readPantryPhotoOCRConfig()
	ctx, cancel := context.WithTimeout(c.Request.Context(), cfg.Timeout)
	defer cancel()

	imagePath, cleanup, err := preparePantryOCRImage(ctx, imageInput)
	if err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "OCR 图片读取失败：" + err.Error()})
		return
	}
	defer cleanup()

	ocrResult, err := runPantryPhotoOCRCommand(ctx, cfg, imagePath)
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, exec.ErrNotFound) || strings.Contains(err.Error(), "executable file not found") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, apiResponse{Code: status, Message: "OCR 分析失败：" + err.Error()})
		return
	}

	parsed := buildPantryPhotoOCRAnalysisResponse(ocrResult.RawText)
	modelTag := strings.TrimSpace(ocrResult.Engine)
	if modelTag == "" {
		modelTag = "PaddleOCR"
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
		"barcodeValue":      normalizePantryBarcodeValue(req.BarcodeValue),
		"barcodeFormat":     normalizePantryBarcodeFormat(req.BarcodeFormat),
		"tags":              parsed.Tags,
		"confidence":        parsed.Confidence,
		"warnings":          parsed.Warnings,
		"cropBox":           parsed.CropBox,
		"summary":           parsed.Summary,
		"multiItemDetected": false,
		"detectedItems":     parsed.DetectedItems,
		"ocrHints":          parsed.OCRHints,
		"householdId":       householdCtx.Household.ID,
		"householdName":     householdCtx.Household.Name,
		"source":            "ocr",
		"model":             modelTag,
		"modelTag":          modelTag,
		"rawText":           trimRunes(ocrResult.RawText, 800),
	})
}

func readPantryPhotoOCRConfig() pantryPhotoOCRConfig {
	command := strings.TrimSpace(os.Getenv("LIFE_TRACE_PANTRY_PHOTO_OCR_COMMAND"))
	if command == "" {
		command = resolveDefaultPantryPhotoOCRCommand()
	}
	engine := strings.TrimSpace(os.Getenv("LIFE_TRACE_PANTRY_PHOTO_OCR_ENGINE"))
	if engine == "" {
		engine = "PaddleOCR"
	}
	return pantryPhotoOCRConfig{
		Command: command,
		Timeout: parseDurationSeconds(
			os.Getenv("LIFE_TRACE_PANTRY_PHOTO_OCR_TIMEOUT_SECONDS"),
			defaultPantryPhotoOCRTimeout,
		),
		Engine: engine,
	}
}

func preparePantryOCRImage(ctx context.Context, imageInput string) (string, func(), error) {
	raw := strings.TrimSpace(imageInput)
	if raw == "" {
		return "", func() {}, errors.New("缺少图片")
	}

	var data []byte
	var err error
	if strings.HasPrefix(strings.ToLower(raw), "data:") || looksLikeBase64Image(raw) {
		data, err = decodePantryOCRImageBase64(raw)
	} else {
		data, err = fetchPantryOCRImage(ctx, raw)
	}
	if err != nil {
		return "", func() {}, err
	}
	if len(data) == 0 {
		return "", func() {}, errors.New("图片内容为空")
	}

	file, err := os.CreateTemp("", "life-trace-pantry-ocr-*.jpg")
	if err != nil {
		return "", func() {}, err
	}
	path := file.Name()
	cleanup := func() {
		_ = os.Remove(path)
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		cleanup()
		return "", func() {}, err
	}
	if err := file.Close(); err != nil {
		cleanup()
		return "", func() {}, err
	}
	return path, cleanup, nil
}

func decodePantryOCRImageBase64(raw string) ([]byte, error) {
	value := strings.TrimSpace(raw)
	if strings.HasPrefix(strings.ToLower(value), "data:") {
		_, payload, ok := strings.Cut(value, ",")
		if !ok {
			return nil, errors.New("图片 data URL 不完整")
		}
		value = payload
	}
	data, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, errors.New("图片 base64 无法解析")
	}
	return data, nil
}

func fetchPantryOCRImage(ctx context.Context, imageURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := (&http.Client{Timeout: defaultPantryPhotoOCRTimeout}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("图片下载返回 %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 12<<20))
}

func runPantryPhotoOCRCommand(
	ctx context.Context,
	cfg pantryPhotoOCRConfig,
	imagePath string,
) (pantryPhotoOCRResult, error) {
	commandText := strings.TrimSpace(cfg.Command)
	if commandText == "" {
		return pantryPhotoOCRResult{}, errors.New("OCR 命令未配置")
	}
	commandText = strings.ReplaceAll(commandText, "{image}", shellQuote(imagePath))

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/C", commandText)
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", commandText)
	}
	cmd.Env = append(os.Environ(), "NO_PROXY=*", "no_proxy=*", "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True")
	output, err := cmd.CombinedOutput()
	if ctx.Err() != nil {
		return pantryPhotoOCRResult{}, fmt.Errorf("OCR 分析超时")
	}
	if err != nil {
		return pantryPhotoOCRResult{}, fmt.Errorf("%w: %s", err, trimRunes(strings.TrimSpace(string(output)), 240))
	}
	text := strings.TrimSpace(string(output))
	if text == "" {
		return pantryPhotoOCRResult{}, errors.New("OCR 未返回文本")
	}
	return pantryPhotoOCRResult{RawText: text, Engine: cfg.Engine}, nil
}

func resolveDefaultPantryPhotoOCRCommand() string {
	scriptPath := resolvePantryOCRWrapperPath()
	if scriptPath != "" {
		if pythonPath := resolvePantryOCRVenvPython(); pythonPath != "" {
			return shellQuote(pythonPath) + " " + shellQuote(scriptPath) + " {image}"
		}
		return "python " + shellQuote(scriptPath) + " {image}"
	}
	return "paddleocr ocr -i {image}"
}

func resolvePantryOCRWrapperPath() string {
	candidates := []string{
		filepath.Join("scripts", "paddle_ocr_text.py"),
		filepath.Join("server", "scripts", "paddle_ocr_text.py"),
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "scripts", "paddle_ocr_text.py"),
			filepath.Join(wd, "server", "scripts", "paddle_ocr_text.py"),
		)
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate
		}
	}
	return ""
}

func resolvePantryOCRVenvPython() string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ""
	}
	candidates := []string{
		filepath.Join(home, ".valley-mas", "ocr-paddle", "Scripts", "python.exe"),
		filepath.Join(home, ".valley-mas", "ocr-paddle", "bin", "python"),
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate
		}
	}
	return ""
}

func fileExists(path string) bool {
	if strings.TrimSpace(path) == "" {
		return false
	}
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func buildPantryPhotoOCRAnalysisResponse(rawText string) pantryPhotoAnalysisAIResponse {
	rawText = strings.TrimSpace(rawText)
	ocrHints := extractPantryPhotoOCRHintsFromText(rawText)
	item := pantryPhotoDetectedItem{
		ID:              "item-1",
		Name:            "待确认商品",
		Category:        "食品",
		Quantity:        1,
		Unit:            "件",
		StorageLocation: "厨房",
		Confidence:      0.35,
		CropBox:         imageCropBox{X: 0.1, Y: 0.1, Width: 0.8, Height: 0.8},
	}
	if len(ocrHints) > 0 {
		item.Confidence = 0.72
	}
	item, ocrHints = applyOCRRulesToPantryPhotoItem(item, ocrHints)
	if len(ocrHints) == 0 {
		item.Warnings = append(item.Warnings, "未提取到日期线索，请调整角度后重试")
	}
	if item.ExpiresAt == "" && item.ProductionDate != "" && item.ShelfLifeDays == 0 {
		item.Warnings = append(item.Warnings, "已识别生产日期，请补充保质期")
	}
	item.Warnings = normalizePantryPhotoWarnings(item.Warnings)

	summary := "已提取包装日期线索，请确认后再入库。"
	if len(ocrHints) == 0 {
		summary = "未提取到清晰日期线索。"
	} else if item.ExpiresAt != "" {
		summary = "已提取日期线索并推导到期日。"
	}

	return pantryPhotoAnalysisAIResponse{
		pantryPhotoDetectedItem: item,
		DetectedItems:           []pantryPhotoDetectedItem{item},
		OCRHints:                ocrHints,
		Tags:                    []string{"OCR", "保质期"},
		Summary:                 summary,
	}
}

func extractPantryPhotoOCRHintsFromText(raw string) []pantryPhotoOCRHint {
	hints := make([]pantryPhotoOCRHint, 0, 6)
	add := func(kind string, text string, normalized string) {
		hints = append(hints, pantryPhotoOCRHint{
			Kind:            kind,
			Text:            trimRunes(strings.TrimSpace(text), 32),
			NormalizedValue: trimRunes(strings.TrimSpace(normalized), 20),
			Confidence:      0.72,
			SourceRegion:    imageCropBox{X: 0.1, Y: 0.1, Width: 0.8, Height: 0.8},
		})
	}

	for _, match := range pantryOCRExpiryDatePattern.FindAllStringSubmatch(raw, 4) {
		if len(match) > 1 {
			if date := normalizePantryOCRDate(match[1]); date != "" {
				add("expiry_date", match[0], date)
			}
		}
	}
	for _, match := range pantryOCRProductionPattern.FindAllStringSubmatch(raw, 4) {
		if len(match) > 1 {
			if date := normalizePantryOCRDate(match[1]); date != "" {
				add("production_date", match[0], date)
			}
		}
	}
	for _, match := range pantryOCRShelfLifePattern.FindAllStringSubmatch(raw, 4) {
		days := normalizePantryOCRShelfLifeMatch(match)
		if days > 0 {
			add("shelf_life_days", match[0], strconv.Itoa(days))
			add("shelf_life_text", match[0], match[0])
		}
	}

	return normalizePantryPhotoOCRHints(hints)
}

func normalizePantryOCRDate(raw string) string {
	value := strings.TrimSpace(raw)
	value = strings.TrimSuffix(value, "日")
	value = strings.ReplaceAll(value, "年", "-")
	value = strings.ReplaceAll(value, "月", "-")
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.ReplaceAll(value, ".", "-")
	parts := strings.Split(value, "-")
	if len(parts) != 3 {
		return ""
	}
	year, err := strconv.Atoi(parts[0])
	if err != nil {
		return ""
	}
	if year < 100 {
		year += 2000
	}
	month, err := strconv.Atoi(parts[1])
	if err != nil {
		return ""
	}
	day, err := strconv.Atoi(parts[2])
	if err != nil {
		return ""
	}
	date := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	return normalizePantryDate(date)
}

func normalizePantryOCRShelfLifeMatch(match []string) int {
	if len(match) < 3 {
		return 0
	}
	value := match[1]
	unit := match[2]
	amount, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || amount <= 0 {
		return 0
	}
	switch unit {
	case "年":
		return amount * 365
	case "个月", "月":
		return amount * 30
	case "天", "日":
		return amount
	default:
		return 0
	}
}

func parseDurationSeconds(raw string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(raw)
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func looksLikeBase64Image(raw string) bool {
	value := strings.TrimSpace(raw)
	if len(value) < 80 || strings.Contains(value, "://") {
		return false
	}
	for _, char := range value {
		if !(char >= 'A' && char <= 'Z') &&
			!(char >= 'a' && char <= 'z') &&
			!(char >= '0' && char <= '9') &&
			char != '+' && char != '/' && char != '=' && char != '\r' && char != '\n' {
			return false
		}
	}
	return true
}

func shellQuote(value string) string {
	if runtime.GOOS == "windows" {
		return `"` + strings.ReplaceAll(value, `"`, `\"`) + `"`
	}
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}
