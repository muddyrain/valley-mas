package mindarena

var canonicalPersonas = []Persona{
	{
		ID:          "p1",
		Name:        "理性派",
		Stance:      "先算风险",
		Personality: "冷静、风险意识强、喜欢拆解问题",
		Style:       "短句、数据化、先算账再给建议",
		Catchphrase: "先算账，再谈梦想",
		Color:       "blue",
	},
	{
		ID:          "p2",
		Name:        "毒舌派",
		Stance:      "拆穿上头",
		Personality: "嘴快、直球、爱戳破幻想",
		Style:       "犀利吐槽、节奏快、句句扎心",
		Catchphrase: "你不是勇敢，你是上头",
		Color:       "violet",
	},
	{
		ID:          "p3",
		Name:        "赌徒派",
		Stance:      "机会先冲",
		Personality: "冒险、热血、讨厌保守拖延",
		Style:       "煽动感强、像在现场带节奏",
		Catchphrase: "人生不冲一次等于白来",
		Color:       "red",
	},
	{
		ID:          "p4",
		Name:        "父母派",
		Stance:      "稳住基本盘",
		Personality: "保守、现实、细节导向",
		Style:       "生活化、连续追问、像长辈开会",
		Catchphrase: "稳定才是第一生产力",
		Color:       "green",
	},
	{
		ID:          "p5",
		Name:        "摆烂派",
		Stance:      "先别崩",
		Personality: "松弛、嘴懒、偶尔一针见血",
		Style:       "懒洋洋、金句型、带点黑色幽默",
		Catchphrase: "先睡一觉，明天再燃",
		Color:       "yellow",
	},
}

func DefaultPersonas(count int) []Persona {
	normalizedCount := normalizePersonaCount(count)
	if normalizedCount > len(canonicalPersonas) {
		normalizedCount = len(canonicalPersonas)
	}
	return append([]Persona(nil), canonicalPersonas[:normalizedCount]...)
}

func PersonaTargets(count int) []Persona {
	targetCount := count
	if targetCount <= 0 {
		targetCount = normalizePersonaCount(count)
	}
	if targetCount > len(canonicalPersonas) {
		targetCount = len(canonicalPersonas)
	}
	return append([]Persona(nil), canonicalPersonas[:targetCount]...)
}
