extends Resource
@export var id := ""
@export var display_name := ""
@export_enum("ranged_damage", "weapon_copy", "day_extension", "burst", "speed", "heal") var effect := "ranged_damage"
@export var amount := 1.0
@export var duration := 0.0

func description() -> String:
	match effect:
		"ranged_damage": return "全队远程伤害 +%d%%" % roundi((amount - 1.0) * 100)
		"weapon_copy": return "成功归航时，%d%% 概率复制价值最高的一把武器" % roundi(amount * 100)
		"day_extension": return "白昼延长 %d 秒" % roundi(amount)
		"burst": return "全队伤害 ×%.1f，持续 %d 秒" % [amount, duration]
		"speed": return "全队移速 ×%.1f，持续 %d 秒" % [amount, duration]
		"heal": return "恢复所有存活队员 %d%% 最大生命" % roundi(amount * 100)
	return ""
