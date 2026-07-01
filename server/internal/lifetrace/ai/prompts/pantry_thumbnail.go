package prompts

import (
	"fmt"
	"strings"

	"valley-server/internal/lifetrace/ai"
)

type PantryThumbnailInput struct {
	Name     string
	Category string
	Location string
	Note     string
}

var PantryThumbnailContract = ai.PromptContract[PantryThumbnailInput, string]{
	Name:        "life-trace-pantry-thumbnail",
	Version:     "v1",
	AuditScene:  "life-trace-pantry-thumbnail",
	BuildPrompt: BuildPantryThumbnailPrompt,
}

func BuildPantryThumbnailPrompt(input PantryThumbnailInput) string {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "家庭库存商品"
	}
	category := strings.TrimSpace(input.Category)
	location := strings.TrimSpace(input.Location)
	note := TrimRunes(strings.TrimSpace(input.Note), 60)
	if note == "" {
		note = "适合放进 Life Trace 家庭库存列表的封面图。"
	}

	return strings.Join([]string{
		"为 Life Trace 家庭库存生成一张小尺寸缩略图，优先保证生成速度。",
		"主体必须清晰、居中、单一，不要拼贴，不要多件堆叠，不要人物，不要文字，不要水印，不要 logo。",
		"画面适合手机端库存列表封面，背景简洁，细节不用过多，像干净的商品小图。",
		fmt.Sprintf("商品名称：%s。", name),
		fmt.Sprintf("分类：%s。", category),
		fmt.Sprintf("存放位置：%s。", location),
		fmt.Sprintf("补充说明：%s", note),
	}, "\n")
}
