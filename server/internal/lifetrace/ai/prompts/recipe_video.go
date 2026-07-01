package prompts

import (
	"fmt"

	"valley-server/internal/lifetrace/ai"
)

type RecipeVideoInput struct {
	RecipeID string
}

var RecipeVideoContract = ai.PromptContract[RecipeVideoInput, string]{
	Name:        "life-trace-recipe-video",
	Version:     "v1",
	AuditScene:  "life-trace-recipe-video",
	BuildPrompt: BuildRecipeVideoHTMLPrompt,
}

func BuildRecipeVideoHTMLPrompt(input RecipeVideoInput) string {
	return fmt.Sprintf(`你是 Life Trace 菜谱视频生成器。把菜谱转换为 HyperFrames 风格的 HTML 视频。

要求：
1. 输出完整的 HTML 文档，包含 <!DOCTYPE html>
2. 视频时长 30 秒以内，9:16 竖屏比例（720x1280）
3. 每道菜展示菜名、推荐理由、所需食材
4. 步骤用大字体逐条展示，每条停留 5-8 秒
5. 使用 GSAP 做淡入/滑入动画，palette: #0a0a0a (bg), #fafafa (text), #10b981 (accent)`)
}
