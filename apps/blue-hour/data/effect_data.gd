extends Resource

const Modifiers = preload("res://core/effect_modifiers.gd")

@export var id: String = ""
@export var display_name: String = ""
@export_enum("passive", "power") var category: String = "passive"
@export var specialization: String = ""
@export var icon: Texture2D
@export var card_art: Texture2D
@export var short_description: String = ""
@export_multiline var flavor: String = ""
@export_multiline var normal_description: String = ""
@export_multiline var upgraded_description: String = ""
@export var normal_modifiers: Dictionary = {}
@export var upgraded_modifiers: Dictionary = {}
@export var duration: float = 0.0
@export var upgraded_duration: float = 0.0
@export var is_upgraded: bool = false

func at_upgrade(value: bool) -> Resource:
	var result: Resource = duplicate()
	result.is_upgraded = value
	return result

func modifiers() -> Dictionary:
	return upgraded_modifiers if is_upgraded else normal_modifiers

func active_duration() -> float:
	return upgraded_duration if is_upgraded else duration

func description() -> String:
	return upgraded_description if is_upgraded else normal_description

func upgrade_description() -> String:
	return "升级：" + upgraded_description

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	if id.is_empty() or display_name.is_empty() or normal_description.is_empty() or upgraded_description.is_empty() or icon == null:
		errors.append("Missing effect identity, text or icon: " + id)
	if category not in ["passive", "power"] or is_upgraded:
		errors.append("Catalog definitions must be normal passive/power templates: " + id)
	if not Modifiers.valid(normal_modifiers, category) or not Modifiers.valid(upgraded_modifiers, category):
		errors.append("Invalid effect modifiers: " + id)
	if not is_finite(duration) or not is_finite(upgraded_duration) or duration < 0 or upgraded_duration < 0:
		errors.append("Invalid effect duration: " + id)
	if category == "passive" and (duration != 0 or upgraded_duration != 0):
		errors.append("Passive cannot have an active duration: " + id)
	if category == "power":
		for values: Dictionary in [normal_modifiers, upgraded_modifiers]:
			var healing: bool = values.has("heal_fraction")
			if (healing and values.size() != 1) or (healing and (duration != 0 or upgraded_duration != 0)) or (not healing and (duration <= 0 or upgraded_duration <= 0)):
				errors.append("Healing is instant; other powers need a duration: " + id)
	return errors
