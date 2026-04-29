package ai

import (
	"strings"
	"valley-server/internal/mindarena"
)

var canonicalMindArenaPersonas = []mindarena.Persona{
	{
		ID:          "p1",
		Name:        "理性派",
		Stance:      "谨慎支持，先算清风险和回报",
		Personality: "冷静、风险意识强、喜欢拆解问题",
		Style:       "短句、数据化、先算账再给建议",
		Catchphrase: "先算账，再谈梦想",
		Color:       "blue",
	},
	{
		ID:          "p2",
		Name:        "毒舌派",
		Stance:      "优先拆穿自我感动和冲动决策",
		Personality: "嘴快、直球、爱戳破幻想",
		Style:       "犀利吐槽、节奏快、句句扎心",
		Catchphrase: "你不是勇敢，你是上头",
		Color:       "violet",
	},
	{
		ID:          "p3",
		Name:        "赌徒派",
		Stance:      "支持抓机会，宁愿试错也不想错过",
		Personality: "冒险、热血、讨厌保守拖延",
		Style:       "煽动感强、像在现场带节奏",
		Catchphrase: "人生不冲一次等于白来",
		Color:       "red",
	},
	{
		ID:          "p4",
		Name:        "父母派",
		Stance:      "先稳住基本盘，再谈理想和变动",
		Personality: "保守、现实、细节导向",
		Style:       "生活化、连续追问、像长辈开会",
		Catchphrase: "稳定才是第一生产力",
		Color:       "green",
	},
	{
		ID:          "p5",
		Name:        "摆烂派",
		Stance:      "建议先降噪休息，不要在崩溃时拍板",
		Personality: "松弛、嘴懒、偶尔一针见血",
		Style:       "懒洋洋、金句型、带点黑色幽默",
		Catchphrase: "先睡一觉，明天再燃",
		Color:       "yellow",
	},
}

func defaultMindArenaPersonas() []mindarena.Persona {
	personas := append([]mindarena.Persona(nil), canonicalMindArenaPersonas...)
	return applyPersonaTopicHints(personas)
}

func normalizeGeneratedPersonas(generated []mindarena.Persona) []mindarena.Persona {
	defaults := defaultMindArenaPersonas()
	if len(generated) == 0 {
		return defaults
	}

	used := make(map[int]bool, len(generated))
	for i := range defaults {
		if matched, matchedIdx := findGeneratedPersonaMatch(defaults[i], generated, used); matched != nil {
			used[matchedIdx] = true
			if stance := strings.TrimSpace(matched.Stance); stance != "" {
				defaults[i].Stance = stance
			}
			continue
		}

		if i < len(generated) {
			if stance := strings.TrimSpace(generated[i].Stance); stance != "" {
				defaults[i].Stance = stance
			}
		}
	}

	return defaults
}

func findGeneratedPersonaMatch(target mindarena.Persona, generated []mindarena.Persona, used map[int]bool) (*mindarena.Persona, int) {
	for i := range generated {
		if used[i] {
			continue
		}
		if generated[i].ID == target.ID || generated[i].Name == target.Name {
			return &generated[i], i
		}
	}
	return nil, -1
}

func applyPersonaTopicHints(personas []mindarena.Persona) []mindarena.Persona {
	for i := range personas {
		switch personas[i].Name {
		case "理性派":
			personas[i].Stance = "谨慎支持，先算清风险和回报"
		case "毒舌派":
			personas[i].Stance = "优先拆穿自我感动和冲动决策"
		case "赌徒派":
			personas[i].Stance = "支持抓机会，宁愿试错也不想错过"
		case "父母派":
			personas[i].Stance = "先稳住基本盘，再谈理想和变动"
		case "摆烂派":
			personas[i].Stance = "建议先降噪休息，不要在崩溃时拍板"
		}
	}
	return personas
}
