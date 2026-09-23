extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const EXPECTED_STATS: Array[String] = ["survival", "combat", "search", "mobility"]
const ALLOWED_ROLE_TAGS: Array[String] = ["explorer", "combat", "support", "scavenger", "medic", "leader"]

var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func _check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		printerr(message)

func run() -> void:
	var catalog := Catalog.new()
	_check(catalog.validate().is_empty(), "Catalog validates survivor references")
	_check(catalog.survivors.size() == 12, "Catalog contains twelve formal survivors")
	var definitions_by_id: Dictionary = {}
	for definition: Resource in catalog.survivors:
		_check(definition is SurvivorDefinition, "Resource is a SurvivorDefinition: " + definition.id)
		_check(not definition.survivor_id.is_empty(), "Survivor ID exists: " + definition.id)
		_check(not definition.display_name.is_empty(), "Name exists: " + definition.survivor_id)
		_check(not definition.portrait_path.is_empty() and ResourceLoader.exists(definition.portrait_path), "Portrait resolves: " + definition.survivor_id)
		_check(definition.starting_trait != null and definition.starting_trait == catalog.by_id(catalog.traits, definition.trait_id), "TraitData binding matches ID: " + definition.survivor_id)
		_check(definition.starting_equipment != null and catalog.by_id(catalog.weapons, definition.starting_equipment.id) == definition.starting_equipment, "Starting equipment reference resolves: " + definition.survivor_id)
		_check(definition.base_stats.size() == EXPECTED_STATS.size(), "Exactly four base stats exist: " + definition.survivor_id)
		for stat: String in EXPECTED_STATS:
			var value: Variant = definition.base_stats.get(stat)
			_check((value is int or value is float) and float(value) >= 1.0 and float(value) <= 100.0, "Base stat is in range: " + definition.survivor_id + "/" + stat)
		for role_tag: String in definition.role_tags:
			_check(role_tag in ALLOWED_ROLE_TAGS, "Internal role tag is allowed: " + definition.survivor_id + "/" + role_tag)
		definitions_by_id[definition.survivor_id] = definition
	var expected_ids: Array[String] = []
	for index: int in range(1, 13):
		expected_ids.append("SUR_%03d" % index)
	_check(definitions_by_id.size() == 12, "Survivor IDs are unique")
	for survivor_id: String in expected_ids:
		_check(definitions_by_id.has(survivor_id), "SUR_ID resolves to a Definition: " + survivor_id)
		var definition: Resource = definitions_by_id.get(survivor_id)
		_check(definition.portrait_path.begins_with("res://assets/characters/"), "Definition points to the formal character portrait: " + survivor_id)
		_check(catalog.by_id(catalog.profiles, survivor_id) != null, "Profile joins through survivor_id: " + survivor_id)
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260923, "combat", ["xia_zhiyao", "su_wanxing"])
	for member_id: String in campaign.data.members:
		var definition: Resource = campaign.member_template(member_id)
		var weapon_uid: String = str(campaign.data.equipment[member_id])
		var weapon: Resource = catalog.by_id(catalog.weapons, campaign.weapon_inventory.get_weapon(weapon_uid).weapon_definition_id)
		_check(weapon == definition.starting_equipment, "Campaign uses Definition starting equipment: " + member_id)
	var report := {"checks": checks, "failures": failures}
	print("SURVIVOR DEFINITION DATA: ", report)
	quit(0 if failures.is_empty() else 1)
