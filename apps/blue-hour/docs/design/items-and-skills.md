# 道具与技能

被动道具和特殊技能由 `data/effect_data.gd`、`data/effects/` 与专精 Resource 定义。每个技能持有 `power_id`、`upgraded`、`used_today`、`active` 和剩余持续时间。

当前内容覆盖远程伤害、攻击速度、承伤、搜刮、资源倍率、白昼计时、移动、治疗、集火与蓝时延缓。战术暂停冻结持续时间；行动结束清理临时效果；每日统一重置使用次数。
