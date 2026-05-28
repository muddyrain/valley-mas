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

type imageAnalysisSchedule struct {
	DateOption string `json:"dateOption"`
	Time       string `json:"time"`
}

type imageAnalysisAIResponse struct {
	Title    string                `json:"title"`
	Summary  string                `json:"summary"`
	PlanType string                `json:"planType"`
	Mood     string                `json:"mood"`
	Tags     []string              `json:"tags"`
	Schedule imageAnalysisSchedule `json:"schedule"`
}

type lifeTraceImageAIConfig struct {
	APIKey    string
	BaseURL   string
	Model     string
	Timeout   time.Duration
	UseVision bool
}

const lifeTraceImageAnalysisMaxTokens = 360

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

var imageAnalysisClockPattern = regexp.MustCompile(`^\d{1,2}:\d{2}$`)

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
