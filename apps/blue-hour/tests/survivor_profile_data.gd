extends SceneTree
## Data-only acceptance for the Survivor Profile layer.

const Catalog = preload("res://data/catalog.gd")
const CharacterRegistry = preload("res://data/character_registry.gd")
const SurvivorDefinition = preload("res://data/survivor_definition.gd")
const SurvivorProfile = preload("res://data/survivor_profile.gd")
const Campaign = preload("res://core/campaign.gd")
const SaveStore = preload("res://core/save_store.gd")

const SAVE_PATH := "user://test-runs/survivor-profile-data.json"
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	var catalog := Catalog.new()
	_check(catalog.validate().is_empty(), "Catalog validates Profile resources")
	_check(catalog.profiles.size() == 12, "Twelve Survivor Profiles are registered")

	var ids: Array[String] = []
	for profile: Resource in catalog.profiles:
		_check(profile is SurvivorProfile, profile.resource_path + " uses SurvivorProfile")
		_check(not profile.id.is_empty() and not profile.id in ids, profile.id + " has a unique ID")
		ids.append(profile.id)
		_check(profile.validation_errors().is_empty(), profile.id + " has complete profile data")

	for definition: Resource in catalog.survivors:
		_check(definition is SurvivorDefinition, definition.id + " remains a SurvivorDefinition")
		var profile: Resource = catalog.by_id(catalog.profiles, definition.survivor_id)
		_check(profile != null and profile.name == definition.display_name, definition.id + " links to its profile")
		_check(CharacterRegistry.get_profile(definition.id) == profile, definition.id + " registry lookup by legacy ID")
		_check(CharacterRegistry.get_profile(definition.survivor_id) == profile, definition.id + " registry lookup by Survivor ID")

	_check(CharacterRegistry.all_profiles().size() == 12, "CharacterRegistry exposes all Profiles")
	_check(CharacterRegistry.get_profile("missing") == null, "Unknown Profile lookup returns null")

	var campaign := Campaign.new(catalog)
	campaign.new_run(9012, "", ["xia_zhiyao", "su_wanxing"])
	var store := SaveStore.new(SAVE_PATH)
	_check(store.write(campaign.data, campaign.valid_state).is_empty(), "Profile registration does not break Save")
	var restored := Campaign.new(catalog)
	var loaded: Dictionary = store.read(restored.valid_state)
	_check(loaded.ok and restored.restore(loaded.data), "Profile registration does not break Load")
	_check(restored.data.members == campaign.data.members, "Save/Load preserves Survivor membership")
	_cleanup()
	print("SURVIVOR PROFILE DATA: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var path := SAVE_PATH + suffix
		if FileAccess.file_exists(path):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
