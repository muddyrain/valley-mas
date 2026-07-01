package prompts

import (
	"strings"

	"valley-server/internal/lifetrace/ai"
)

const PantryPhotoAnalysisMaxTokens = 2200

type PantryPhotoAnalysisInput struct {
	Hint          string
	HouseholdName string
	UseVision     bool
	BarcodeValue  string
	BarcodeFormat string
	BarcodeSource string
}

var PantryPhotoAnalysisContract = ai.PromptContract[PantryPhotoAnalysisInput, struct{}]{
	Name:        "life-trace-pantry-photo-analysis",
	Version:     "v1",
	AuditScene:  "life-trace-pantry-photo-analysis",
	MaxTokens:   PantryPhotoAnalysisMaxTokens,
	BuildPrompt: BuildPantryPhotoAnalysisPrompt,
}

func BuildPantryPhotoAnalysisPrompt(input PantryPhotoAnalysisInput) string {
	visionInstruction := "请直接观察图片内容，优先识别画面主体商品。"
	if !input.UseVision {
		visionInstruction = "视觉模型未配置时，请只基于用户补充说明给出保守草稿，不要声称看到了具体画面。"
	}

	hint := TrimRunes(strings.TrimSpace(input.Hint), 80)
	if hint == "" {
		hint = "用户没有补充说明。"
	}
	modeInstruction := "当前模式：AI 商品分析。优先识别商品名称、分类、数量、规格、存放位置，同时提取包装日期线索。"
	householdName := TrimRunes(strings.TrimSpace(input.HouseholdName), 24)
	if householdName == "" {
		householdName = "当前库存空间"
	}
	barcodeValue := TrimRunes(strings.TrimSpace(input.BarcodeValue), 80)
	barcodeFormat := TrimRunes(strings.TrimSpace(input.BarcodeFormat), 24)
	barcodeSource := TrimRunes(strings.TrimSpace(input.BarcodeSource), 24)
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
		"输出必须是严格合法 JSON：第一个字符必须是 {，最后一个字符必须是 }，不要使用 ```、注释、前后缀文本或自然语言说明。",
		"如果图片看不清或无法确定商品，也必须返回符合格式的 JSON，把 name 设为“待确认商品”，confidence 设为 0.2，并在 warnings 说明需要用户确认。",
		"JSON 格式：{\"name\":\"商品名称\",\"category\":\"食品|日用品|药品|宠物|其他\",\"brand\":\"品牌或空字符串\",\"spec\":\"规格或空字符串\",\"quantity\":1,\"unit\":\"件|瓶|盒|袋|个|包|罐|支\",\"storageLocation\":\"冷藏|冷冻|厨房|储物柜|卫生间|玄关|其他\",\"expiresAt\":\"YYYY-MM-DD 或空字符串\",\"productionDate\":\"YYYY-MM-DD 或空字符串\",\"purchaseDate\":\"YYYY-MM-DD 或空字符串\",\"shelfLifeDays\":0,\"barcodeValue\":\"包装编码或空字符串\",\"barcodeFormat\":\"ean_13|ean_8|upc_a|upc_e|code_128|qr_code|unknown|空字符串\",\"tags\":[\"标签\"],\"confidence\":0.0,\"warnings\":[\"需要用户确认的事项\"],\"cropBox\":{\"x\":0.1,\"y\":0.1,\"width\":0.8,\"height\":0.8},\"multiItemDetected\":false,\"detectedItems\":[{\"id\":\"item-1\",\"name\":\"商品名称\",\"brand\":\"品牌或空字符串\",\"spec\":\"规格或空字符串\",\"category\":\"食品|日用品|药品|宠物|其他\",\"quantity\":1,\"unit\":\"件|瓶|盒|袋|个|包|罐|支\",\"storageLocation\":\"冷藏|冷冻|厨房|储物柜|卫生间|玄关|其他\",\"expiresAt\":\"YYYY-MM-DD 或空字符串\",\"productionDate\":\"YYYY-MM-DD 或空字符串\",\"shelfLifeDays\":0,\"barcodeValue\":\"包装编码或空字符串\",\"barcodeFormat\":\"ean_13|ean_8|upc_a|upc_e|code_128|qr_code|unknown|空字符串\",\"confidence\":0.0,\"warnings\":[\"需要用户确认的事项\"],\"cropBox\":{\"x\":0.1,\"y\":0.1,\"width\":0.8,\"height\":0.8}}],\"dateHints\":[{\"kind\":\"production_date|expiry_date|shelf_life_days|shelf_life_text\",\"text\":\"原文\",\"normalizedValue\":\"YYYY-MM-DD 或 180\",\"confidence\":0.0,\"sourceRegion\":{\"x\":0.1,\"y\":0.1,\"width\":0.2,\"height\":0.1}}],\"summary\":\"60字以内说明\"}",
		"category 和 storageLocation 必须从候选值中选择。",
		"顶层字段仍然表示你判断的主商品，同时把主商品也放进 detectedItems[0]。",
		"detectedItems 最多返回 5 个候选，按 confidence 从高到低排序；如果只识别到 1 个商品，multiItemDetected 仍返回 false。",
		"cropBox 和 sourceRegion 使用 0-1 比例坐标；如果不确定，返回居中 0.1/0.1/0.8/0.8。",
		"如果识别到明确到期日，填写 expiresAt，并在 dateHints 里追加 expiry_date。",
		"如果包装或用户补充中同时出现生产日期和 180天/90天/7天等保质期，填写 productionDate、shelfLifeDays，并计算 expiresAt；同时把生产日期和保质期文本都写入 dateHints。",
		"如果只看到保质期天数但没有生产日期，expiresAt 返回空字符串，并在 warnings 提示缺少生产日期，无法计算到期日；dateHints 仍保留保质期线索。",
		"如果看到多个日期且无法确认哪一个是到期日，不要自动填写 expiresAt，只在 warnings 和 dateHints 里说明冲突。",
		"如果保质期和生产日期都没有出现，不要提示缺少保质期，expiresAt、productionDate 和 shelfLifeDays 返回空值或 0。",
		"不要编造看不清的品牌、规格、生产日期或保质期。",
		"包装编码只能作为线索；不要因为有编码就编造商品名、品牌或规格。图片和编码冲突时，把编码放入 barcodeValue/barcodeFormat，并在 warnings 提示用户确认。",
		"如果图片中有多个商品，返回主商品和多候选列表，但不要自动假设用户要批量入库。",
		"药品、保健品、婴幼儿食品等敏感品类只做库存记录，不给医疗、安全或食用建议。",
		"tags 输出 2-5 个简体中文短标签。",
		visionInstruction,
		modeInstruction,
		"当前库存空间：" + householdName,
		barcodeInstruction,
		"用户补充说明：" + hint,
	}, "\n")
}
