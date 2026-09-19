extends RefCounted
## Presentation fixtures, deliberately independent of Campaign and its resources.

const SU: Texture2D = preload("res://assets/ui/expedition/portraits/portrait_su_wanxing.png")
const XIA: Texture2D = preload("res://assets/ui/expedition/portraits/portrait_xia_zhiyao.png")
const ROWS := [
	["su_wanxing", "苏晚星", "SU WANXING", "补给整备师", "后勤 · 资源收益", "只要还有人需要我，\n我就会一直向前。", "制式步枪", "突击步枪", "17.6", [18, 14, 22, 12], "物资统筹", "整理补给，为队伍提供可靠支援。"],
	["xia_zhiyao", "夏知遥", "XIA ZHIYAO", "侦察员", "侦察 · 灵活机动", "前方的路，\n让我先去看看。", "轻型冲锋枪", "冲锋枪", "16.2", [15, 18, 10, 24], "先行探路", "观察周围环境，寻找安全的路线。"],
	["support_fixture", "林澄", "LIN CHENG", "医疗支援", "医疗 · 团队保障", "休息一下，\n我们一起继续走。", "轻型手枪", "手枪", "12.8", [22, 10, 24, 14], "应急照护", "及时关注同伴状态，协助恢复。"],
	["guard_fixture", "乔安", "QIAO AN", "营地守卫", "防守 · 火力掩护", "别担心，\n我会守住这里。", "防卫霰弹枪", "霰弹枪", "19.4", [20, 25, 12, 10], "坚守阵地", "稳定防线，为同伴争取行动空间。"],
]

static func get_survivor(index: int) -> Dictionary:
	if index < 0 or index >= ROWS.size():
		return {}
	var row: Array = ROWS[index]
	return {"id": row[0], "name": row[1], "name_en": row[2], "role": row[3],
		"tags": row[4], "quote": row[5], "weapon": row[6], "weapon_type": row[7],
		"power": row[8], "attributes": row[9], "trait": row[10], "trait_description": row[11],
		"portrait": SU if index % 2 == 0 else XIA}
