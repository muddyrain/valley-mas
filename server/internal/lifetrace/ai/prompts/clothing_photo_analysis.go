package prompts

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

type ClothingPhotoAnalysisInput struct {
	HouseholdName string
	Hint          string
	UseVision     bool
}

type ClothingPhotoAnalysisOutput struct {
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

var ClothingPhotoAnalysisContract = ai.PromptContract[ClothingPhotoAnalysisInput, ClothingPhotoAnalysisOutput]{
	Name:        "life-trace-clothing-photo-analysis",
	Version:     "v1",
	AuditScene:  "life-trace-clothing-photo-analysis",
	BuildPrompt: BuildClothingPhotoAnalysisPrompt,
}

func BuildClothingPhotoAnalysisPrompt(input ClothingPhotoAnalysisInput) string {
	imageInstruction := "请直接观察图片中的衣物主体。"
	if !input.UseVision {
		imageInstruction = "如果无法看到图片，只根据用户提示生成保守草稿。"
	}
	hintText := strings.TrimSpace(input.Hint)
	if hintText == "" {
		hintText = "无"
	}
	return strings.Join([]string{
		"你是 Life Trace 的衣橱识别 AI，只输出一个 JSON 对象，不要 Markdown，不要解释。",
		"JSON 格式：{\"name\":\"衣物名称，24字以内\",\"category\":\"上装|下装|外套|鞋履|配饰|包袋|套装|其他\",\"color\":\"主色，12字以内\",\"material\":\"材质或面料，20字以内\",\"warmthLevel\":\"轻薄|常规|保暖|厚重\",\"seasons\":[\"春\"],\"sceneTags\":[\"通勤\"],\"summary\":\"识别摘要，60字以内\",\"confidence\":0.7,\"warnings\":[\"提醒\"]}",
		imageInstruction,
		"seasons 只能从 春、夏、秋、冬、四季 中选择 1-4 个；sceneTags 输出 1-4 个简体中文短标签。",
		"不要编造品牌、价格、尺码或用户没有提供的信息。",
		"",
		fmt.Sprintf("当前空间：%s", input.HouseholdName),
		fmt.Sprintf("用户提示：%s", hintText),
	}, "\n")
}

func ParseClothingPhotoAnalysisOutput(raw string) (ClothingPhotoAnalysisOutput, error) {
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return ClothingPhotoAnalysisOutput{}, errors.New("missing JSON object")
	}
	var parsed ClothingPhotoAnalysisOutput
	if err := json.Unmarshal([]byte(raw[start:end+1]), &parsed); err != nil {
		return ClothingPhotoAnalysisOutput{}, err
	}
	return parsed, nil
}
