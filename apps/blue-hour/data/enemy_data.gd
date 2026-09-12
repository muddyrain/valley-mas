class_name EnemyDefinition
extends Resource
## Shared editable base values. Runtime scaling belongs to the existing mission clock.
@export var id: String = ""
@export var display_name: String = ""
@export_enum("COMMON") var enemy_type: String = "COMMON"
@export var scene: PackedScene
@export var max_hp: float = 0.0
@export var move_speed: float = 0.0
@export var attack_damage: float = 0.0
@export var attack_range: float = 0.0
@export var attack_cooldown: float = 0.0
@export var attack_windup: float = 0.0
@export var detection_range: float = 0.0
@export var lose_target_range: float = 0.0
@export var collision_radius: float = 0.0
@export_range(0, 1) var knockback_resistance: float = 0.0
@export var xp_reward: int = 0
# Retain the focus-fire selector's priority metadata without registering extra enemies.
@export_enum("Normal", "Elite", "Boss") var threat_rank: int = 0
@export var food_drop_chance: float = 0.08
@export var scrap_drop_chance: float = 0.18

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	if id.is_empty() or display_name.is_empty() or enemy_type != "COMMON" or scene == null:
		errors.append("Invalid enemy identity or scene: " + id)
	for value: float in [max_hp, move_speed, attack_damage, attack_range, attack_cooldown, detection_range, collision_radius]:
		if not is_finite(value) or value <= 0:
			errors.append("Invalid enemy combat parameter: " + id)
	if not is_finite(attack_windup) or attack_windup < 0 or attack_windup > attack_cooldown:
		errors.append("Invalid enemy windup: " + id)
	if not is_finite(lose_target_range) or lose_target_range < detection_range:
		errors.append("Invalid enemy detection hysteresis: " + id)
	for value: float in [knockback_resistance, food_drop_chance, scrap_drop_chance]:
		if not is_finite(value) or value < 0 or value > 1:
			errors.append("Invalid enemy resistance or drop probability: " + id)
	if xp_reward < 0:
		errors.append("Invalid enemy experience reward: " + id)
	return errors
