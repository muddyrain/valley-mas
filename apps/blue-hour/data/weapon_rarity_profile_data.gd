class_name WeaponRarityProfileData
extends Resource
## Immutable profile for one weapon rarity tier.

@export var id: String = ""
@export var display_name: String = ""
@export var color_key: String = ""
@export_range(0, 4, 1) var tier: int = 0
@export_range(0, 8, 1) var modifier_slots: int = 0
@export_range(0, 4, 1) var special_effect_slots: int = 0
@export var drop_weight: float = 1.0
@export var allowed_modifier_rarity: Array[String] = []

func color() -> Color:
	return Color.from_string(color_key, Color.WHITE)
