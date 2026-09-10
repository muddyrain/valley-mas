extends Resource
@export var id := ""
@export var display_name := ""
@export_enum("ranged_damage", "weapon_copy", "day_extension", "burst", "speed", "heal") var effect := "ranged_damage"
@export var amount := 1.0
@export var duration := 0.0
@export var upgraded := false

func description() -> String:
	match effect:
		"ranged_damage": return "全队远程伤害 +%d%%" % roundi((amount - 1.0) * 100)
		"weapon_copy": return "成功归航时，%d%% 概率复制价值最高的一把武器（史诗武器除外）" % roundi(amount * 100)
		"day_extension": return "白昼延长 %d 秒" % roundi(amount)
		"burst": return "全队伤害 ×%.1f，持续 %d 秒" % [amount, duration]
		"speed": return "全队移速 ×%.1f，持续 %d 秒" % [amount, duration]
		"heal": return "恢复所有存活队员 %d%% 最大生命" % roundi(amount * 100)
	return ""

func upgrade_description() -> String:
	match effect:
		"ranged_damage": return "升级：全队远程伤害提高到 +50%%"
		"weapon_copy": return "升级：增加复制几率"
		"burst": return "升级：全队伤害增加到 ×3.0"
		"speed": return "升级：持续时间延长到 %d 秒" % int(duration * 1.5)
	return ""
