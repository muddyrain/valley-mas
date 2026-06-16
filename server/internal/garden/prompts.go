// server/internal/garden/prompts.go
package garden

import "fmt"

func PromptSeedBirth(concept, waterStyle string) string {
	return fmt.Sprintf(`你是「语种园」的种子精灵。用户写下了一个概念："%s"，使用浇水方式：%s。
请输出严格 JSON（不要包含解释、不要 Markdown 代码块）：
{
  "name_zh": "中二有梗的中文植物名（4-8 字）",
  "concept_en": "用于资产匹配的英文概念关键词（1-3 词，全小写）",
  "tags": ["匹配标签 5-10 个，描述外观/情绪/形态，全小写英文"],
  "rarity": "N | R | SR | SSR",
  "mood": "情绪词（中文，2-4 字）",
  "description": "卡片描述，30-50 字",
  "first_log": "首段成长日志，100-150 字，第一人称（植物自己说）"
}
风格基调（按 water_style）：
- water 普通中性、coffee 讽刺赛博、wine emo 诗意、potion 中二魔幻`, concept, waterStyle)
}

func PromptStageLog(plantName, mood, waterStyle string, stage, stageMax int, recentLogs string) string {
	return fmt.Sprintf(`植物档案：%s（情绪：%s，浇水方式：%s）
当前阶段：%d/%d
之前的成长日志（最近 3 段）：
%s

请用第一人称（植物自己写）输出 100-200 字的新日志，不要 JSON、不要标题、只要正文。`,
		plantName, mood, waterStyle, stage, stageMax, recentLogs)
}

func PromptWaterReply(plantName, mood, waterStyle string) string {
	return fmt.Sprintf(`植物 "%s"（情绪 %s，浇水风格 %s）刚被浇了一次水。
用第一人称写一句 30-50 字的回应，体现它的情绪与人格。`, plantName, mood, waterStyle)
}

func PromptChat(plantName, mood, waterStyle, userMsg string) string {
	return fmt.Sprintf(`你是植物 "%s"（情绪 %s，浇水风格 %s）。
用户对你说："%s"。
用第一人称回复 50-100 字，保持人格，不要破戒。`, plantName, mood, waterStyle, userMsg)
}

func PromptHarvest(plantName, mood, waterStyle string, allLogs string) string {
	return fmt.Sprintf(`植物 "%s" 即将被收获。情绪：%s，浇水风格：%s。
完整成长日志：
%s

请输出严格 JSON：
{
  "final_story": "完整故事总结，200-300 字，第三人称",
  "fruit_name": "趣味果实名（4-12 字）",
  "fruit_description": "果实属性，30-60 字，叙事性，无系统效果",
  "farewell_letter": "植物给用户的告别信，第一人称，150-300 字"
}`, plantName, mood, waterStyle, allLogs)
}
