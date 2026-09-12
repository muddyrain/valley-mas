extends RefCounted
## Each entry names a stat operation; additional sources can use the same operations.

const RULES := {
	"DAMAGE_UP": {"label": "伤害 +12%", "stat": "damage", "factor": 1.12},
	"ATTACK_SPEED_UP": {"label": "攻击速度 +10%", "stat": "attack_rate", "factor": 1.10},
	"MAGAZINE_UP": {"label": "弹匣容量 +25%", "stat": "magazine_size", "factor": 1.25},
	"RELOAD_SPEED_UP": {"label": "换弹时间 −18%", "stat": "reload_time", "factor": 0.82},
	"ACCURACY_UP": {"label": "精准度 +8%", "stat": "accuracy", "factor": 1.08},
	"RANGE_UP": {"label": "射程 +12%", "stat": "range", "factor": 1.12}
}
const RARITY_NAMES := ["普通", "精良", "稀有", "特殊"]
const RARITY_COLORS := [Color("#97afbc"), Color("#87ba98"), Color("#78b8e2"), Color("#e8b36a")]

static func choices(melee: bool) -> Array[String]:
	var result: Array[String] = []
	for id: String in RULES:
		if not melee or id not in ["MAGAZINE_UP", "RELOAD_SPEED_UP", "ACCURACY_UP"]:
			result.append(id)
	return result

static func apply(weapon: Resource, ids: Array[String]) -> void:
	for id: String in ids:
		var rule: Dictionary = RULES[id]
		var value: float = float(weapon.get(rule.stat)) * float(rule.factor)
		if rule.stat == "magazine_size":
			weapon.set(rule.stat, ceili(value))
		elif rule.stat == "accuracy":
			weapon.set(rule.stat, clampf(value, 0.0, 1.0))
		else:
			weapon.set(rule.stat, value)
