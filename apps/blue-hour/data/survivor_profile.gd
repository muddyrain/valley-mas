class_name SurvivorProfile
extends Resource
## Narrative-only profile data shared by Camp, recruitment and future story systems.

@export var id: String = ""
@export var name: String = ""
@export var age: int = 0
@export var occupation: String = ""
@export var role: String = ""
@export_multiline var personality: String = ""
@export_multiline var background: String = ""
@export_multiline var before_apocalypse: String = ""
@export_multiline var after_apocalypse: String = ""
@export_multiline var trait_explanation: String = ""
@export var weapon_preference: String = ""
@export var mission_preference: String = ""
@export var story_tags: Array[String] = []

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	if id.is_empty():
		errors.append("Profile ID is empty")
	if name.is_empty() or occupation.is_empty() or role.is_empty():
		errors.append("Profile identity fields are incomplete: " + id)
	if background.is_empty() or before_apocalypse.is_empty() or after_apocalypse.is_empty():
		errors.append("Profile narrative fields are incomplete: " + id)
	if trait_explanation.is_empty() or weapon_preference.is_empty() or mission_preference.is_empty():
		errors.append("Profile gameplay context fields are incomplete: " + id)
	if story_tags.is_empty():
		errors.append("Profile story tags are empty: " + id)
	return errors
