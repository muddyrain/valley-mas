extends SceneTree
## Current production roster must load valid v4 saves authored with retired survivor templates.

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Store = preload("res://core/save_store.gd")
const PATH := "user://test-runs/save-catalog-compatibility.json"

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	_cleanup()
	var catalog := Catalog.new()
	var source := Campaign.new(catalog)
	source.new_run(772, "", ["lin_jianyue", "xia_zhiyao", "su_wanxing"])
	source.start_action("residential", source.data.members)
	_check(source.valid_state(source.data), "Production v5 source state is valid")
	var legacy: Dictionary = source.data.duplicate(true)
	legacy.version = 4
	var retired := {"lin_jianyue": "lin", "xia_zhiyao": "qiao", "su_wanxing": "yan"}
	var legacy_roster: Dictionary = {}
	var legacy_equipment: Dictionary = {}
	for id: String in legacy.roster:
		var legacy_id: String = retired[id]
		legacy_roster[legacy_id] = legacy.roster[id].duplicate(true)
		legacy_roster[legacy_id].template = legacy_id
		legacy_equipment[legacy_id] = legacy.equipment[id]
	legacy.roster = legacy_roster
	legacy.equipment = legacy_equipment
	legacy.members = legacy.members.map(func(id: String) -> String: return retired[id])
	legacy.selected_party = legacy.selected_party.map(func(id: String) -> String: return retired[id])
	var inventory_before: Array = legacy.inventory.duplicate(true)
	var equipment_before: Dictionary = legacy.equipment.duplicate(true)
	var store := Store.new(PATH)
	_check(store.write(legacy).is_empty(), "Legacy fixture is stored through the real envelope")
	var restored := Campaign.new(catalog)
	var stored: Dictionary = store.read(restored.valid_state)
	_check(stored.ok and not stored.recovered, "SaveStore validator accepts the legacy roster")
	_check(restored.restore(stored.data), "Campaign restores the legacy roster")
	_check(restored.data.status == "shelter", "Mid-mission save resumes at Camp")
	_check(_templates(restored.data.roster) == {"lin": "lin_jianyue", "qiao": "xia_zhiyao", "yan": "su_wanxing"}, "Retired templates map to the production roster without replacing member IDs")
	_check(restored.data.inventory == inventory_before and restored.data.equipment == equipment_before, "Migration preserves weapons and equipment ownership")
	_check(store.write(restored.data, restored.valid_state).is_empty(), "Migrated state saves normally")
	var backup: Dictionary = store._read_file(PATH + ".bak")
	_check(_templates(backup.roster) == {"lin": "lin", "qiao": "qiao", "yan": "yan"}, "Original v4 roster remains in the rotating backup")
	print("SAVE CATALOG COMPATIBILITY: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	_cleanup()
	quit(0 if failures.is_empty() else 1)

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var file := PATH + suffix
		if FileAccess.file_exists(file):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(file))

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)

func _templates(roster: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for id: Variant in roster:
		result[id] = roster[id].get("template", "")
	return result
