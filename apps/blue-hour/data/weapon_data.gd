class_name WeaponDefinition
extends Resource
## Shared template. Equipment derives a copy before applying instance modifiers.

enum WeaponType { MELEE_SHORT, SIDEARM, LONG_GUN }
enum Knockback { NONE, LIGHT, MEDIUM, HIGH }
enum Rarity { COMMON, UNCOMMON, RARE, SPECIAL }

@export var id: String = ""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var weapon_type: WeaponType = WeaponType.SIDEARM
@export_file("*.png") var icon_path: String = ""
@export_file("*.glb") var model_path: String = ""
@export var damage: float = 18.0
@export var attack_rate: float = 2.0
@export var range: float = 14.0
@export var magazine_size: int = 15
@export var reload_time: float = 1.5
@export_range(0, 1) var accuracy: float = 0.88
@export var move_speed_modifier: float = 0.0
@export var pellet_count: int = 1
## Full cone in degrees; accuracy narrows it for single-projectile weapons.
@export var spread_angle: float = 20.0
@export var penetration: int = 0
@export var penetration_damage_multiplier: float = 0.60
@export var knockback: Knockback = Knockback.NONE
@export var animation_profile: WeaponType = WeaponType.SIDEARM
@export var rarity: Rarity = Rarity.COMMON
@export var tags: Array[String] = []
@export var color: Color = Color(1, 0.8, 0.4)
@export var sound_pitch: float = 1.0

# Existing mission/HUD names are computed views, with one source of truth.
var cooldown: float:
	get: return 1.0 / attack_rate
	set(value): attack_rate = 1.0 / maxf(value, 0.001)
var attack_range: float:
	get: return range
	set(value): range = value
var magazine: int:
	get: return magazine_size
	set(value): magazine_size = value
var reload_seconds: float:
	get: return reload_time
	set(value): reload_time = value
var melee: bool:
	get: return weapon_type == WeaponType.MELEE_SHORT

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	for value: float in [damage, attack_rate, range]:
		if not is_finite(value) or value <= 0:
			errors.append("Invalid weapon stat: " + id)
	for value: float in [reload_time, accuracy, spread_angle, move_speed_modifier, penetration_damage_multiplier]:
		if not is_finite(value):
			errors.append("Nonfinite weapon stat: " + id)
	if (melee and (magazine_size != 0 or reload_time != 0)) or (not melee and (magazine_size <= 0 or reload_time <= 0)):
		errors.append("Invalid weapon magazine/reload: " + id)
	if pellet_count < 1 or penetration < 0 or accuracy < 0 or accuracy > 1 or spread_angle < 0 or move_speed_modifier <= -1:
		errors.append("Invalid weapon mechanics: " + id)
	if penetration_damage_multiplier <= 0 or penetration_damage_multiplier > 1 or spread_angle > 180:
		errors.append("Invalid weapon spread/penetration: " + id)
	if icon_path.is_empty() or not ResourceLoader.exists(icon_path):
		errors.append("Missing weapon icon: " + id)
	return errors

func type_name() -> String:
	return ["短近战", "副武器", "长枪"][weapon_type]

func icon() -> Texture2D:
	return load(icon_path) as Texture2D if not icon_path.is_empty() else null
