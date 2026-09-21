extends SceneTree

const AuraRuntime = preload("res://core/aura_runtime.gd")
const Campaign = preload("res://core/campaign.gd")
const Catalog = preload("res://data/catalog.gd")
const Save = preload("res://core/save_store.gd")
const TraitRuntime = preload("res://core/trait_runtime.gd")
const TraitData = preload("res://data/trait_data.gd")
const Mission = preload("res://missions/mission.gd")
const Ledger = preload("res://core/run_ledger.gd")

const OUTPUT: String = "res://test-output/team-aura-runtime.json"

var checks: int = 0
var failures: Array[String] = []
var report: Dictionary = {}

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		printerr(label)

func near(actual: float, expected: float, label: String) -> void:
	check(absf(actual - expected) < 0.00001, "%s (%.6f / %.6f)" % [label, actual, expected])

func _member(trait_data: Resource, position: Vector3) -> Node3D:
	var member := preload("res://survivors/survivor.gd").new()
	member.talent = trait_data
	member.position = position
	return member

func run() -> void:
	var catalog := Catalog.new()
	check(catalog.validate().is_empty(), "Catalog accepts Aura contracts")
	var pace: Resource = catalog.by_id(catalog.traits, "set_the_pace")
	var line: Resource = catalog.by_id(catalog.traits, "hold_the_line")
	check(pace.modifier_hook == "aura" and line.modifier_hook == "aura", "Both Aura traits use the generic hook")
	check(str(pace.params.get("effect_type", "")) == AuraRuntime.EFFECT_TEAM_MOVE_SPEED, "Movement effect is data-driven")
	check(str(line.params.get("effect_type", "")) == AuraRuntime.EFFECT_INFECTED_DAMAGE_REDUCTION, "Damage effect is data-driven")
	var pace_provider := _member(pace.at_level(1), Vector3.ZERO)
	var line_provider := _member(line.at_level(1), Vector3(0, 0, 3))
	var target := _member(TraitData.new(), Vector3(0, 0, 4))
	var team: Array[Node3D] = [pace_provider, line_provider, target]
	near(AuraRuntime.movement_multiplier(target, team), 1.08, "SUR_006 Lv1 applies within 6m")
	near(AuraRuntime.infected_damage_multiplier(target, team, ["infected"]), 0.92, "SUR_011 Lv1 applies within 6m")
	near(AuraRuntime.movement_multiplier(pace_provider, team), 1.0, "SUR_006 excludes its provider")
	near(AuraRuntime.infected_damage_multiplier(line_provider, team, ["infected"]), 1.0, "SUR_011 excludes its provider")
	target.position = Vector3(0, 0, 6.1)
	near(AuraRuntime.movement_multiplier(target, [pace_provider]), 1.0, "SUR_006 expires beyond 6m")
	target.position = Vector3(0, 0, 9.1)
	near(AuraRuntime.infected_damage_multiplier(target, [line_provider], ["infected"]), 1.0, "SUR_011 expires beyond 6m")
	target.position = Vector3(0, 0, 1)
	var pace_lv5 := _member(pace.at_level(5), Vector3.ZERO)
	var pace_lv2 := _member(pace.at_level(2), Vector3(0, 0, 2))
	var line_lv5 := _member(line.at_level(5), Vector3(0, 0, 2))
	near(AuraRuntime.movement_multiplier(target, [pace_lv2, pace_lv5]), 1.16, "Same-type movement Auras use maximum")
	near(AuraRuntime.infected_damage_multiplier(target, [line_lv5], ["infected"]), 0.84, "SUR_011 Lv5 reads its level")
	near(AuraRuntime.infected_damage_multiplier(target, [line_lv5], ["environment"]), 1.0, "SUR_011 only reduces infected damage")
	_check_mission_hooks(catalog)
	pace_provider.queue_free()
	line_provider.queue_free()
	target.queue_free()
	pace_lv5.queue_free()
	pace_lv2.queue_free()
	line_lv5.queue_free()
	_check_save_load(catalog, pace, line)
	report = {"checks": checks, "failures": failures}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output"))
	FileAccess.open(OUTPUT, FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("TEAM AURA RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _check_save_load(catalog: RefCounted, pace: Resource, line: Resource) -> void:
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260921, "", ["tang_zhi", "he_linchuan"])
	var pace_id: String = campaign.data.members[0]
	var line_id: String = campaign.data.members[1]
	campaign.data.roster[pace_id].current_level = 5
	campaign.data.roster[pace_id].level = 5
	campaign.data.roster[pace_id].current_xp = 0
	campaign.data.roster[pace_id].total_xp = 18
	campaign.data.roster[pace_id].xp_to_next_level = 0
	campaign.data.roster[line_id].current_level = 5
	campaign.data.roster[line_id].level = 5
	campaign.data.roster[line_id].current_xp = 0
	campaign.data.roster[line_id].total_xp = 18
	campaign.data.roster[line_id].xp_to_next_level = 0
	var save := Save.new("user://test-runs/team-aura-runtime-%d.json" % OS.get_process_id())
	var save_error: String = save.write(campaign.data, campaign.valid_state)
	check(save_error.is_empty(), "Aura progression saves: " + save_error)
	var restored := Campaign.new(catalog)
	var loaded: Dictionary = save.read(restored.valid_state)
	var payload: Dictionary = loaded.get("data", {})
	check(loaded.get("ok", false) and payload.has("roster") and restored.restore(payload), "Aura progression loads")
	check(restored.member_trait_level(pace_id) == 5 and restored.member_trait_level(line_id) == 5, "Aura trait levels survive save/load")
	var provider := _member(restored.member_trait(pace_id), Vector3.ZERO)
	var target := _member(TraitData.new(), Vector3(0, 0, 6))
	near(AuraRuntime.movement_multiplier(target, [provider]), 1.16, "Saved SUR_006 level remains active")
	provider.talent = restored.member_trait(line_id)
	near(AuraRuntime.infected_damage_multiplier(target, [provider], ["infected"]), 0.84, "Saved SUR_011 level remains active")
	provider.queue_free()
	target.queue_free()

func _check_mission_hooks(catalog: RefCounted) -> void:
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260922, "", ["tang_zhi", "he_linchuan"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 20260922, campaign)
	var pace_member: Node3D = mission.survivors[0]
	var line_member: Node3D = mission.survivors[1]
	pace_member.position = Vector3.ZERO
	line_member.position = Vector3(0, 0, 3)
	var line_base_speed: float = line_member.data.move_speed * (1.0 + line_member.weapon.move_speed_modifier)
	near(mission.movement_speed(line_member, line_member.position + Vector3.FORWARD, 0.1), line_base_speed * 1.08, "Mission movement hook applies SUR_006 to teammate")
	pace_member.hp = 100.0
	var infected_tags: Array[String] = ["infected"]
	pace_member.take_damage(10.0, false, infected_tags)
	near(100.0 - pace_member.hp, 9.2, "Mission damage hook applies SUR_011 to infected damage")
	line_member.hp = 100.0
	line_member.take_damage(10.0, false, infected_tags)
	near(100.0 - line_member.hp, 10.0, "Mission damage hook excludes SUR_011 provider")
	mission.queue_free()
