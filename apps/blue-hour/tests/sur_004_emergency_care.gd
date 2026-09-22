extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Mission = preload("res://missions/mission.gd")
const Periodic = preload("res://core/periodic_effect_runtime.gd")
const HealHandler = preload("res://core/heal_effect_handler.gd")
const Survivor = preload("res://survivors/survivor.gd")

const OUTPUT: String = "res://test-output/sur-004-emergency-care.json"

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		printerr(label)

func near(actual: float, expected: float, label: String) -> void:
	check(absf(actual - expected) < 0.00001, "%s (%.6f / %.6f)" % [label, actual, expected])

func _actor(definition: Resource, position: Vector3, hp: float, dead: bool = false) -> Node3D:
	var actor: Node3D = Survivor.new()
	actor.data = definition
	actor.position = position
	actor.hp = hp
	actor.dead = dead
	return actor

func run() -> void:
	var catalog := Catalog.new()
	var definition: Resource = catalog.by_id(catalog.survivors, "lu_qinghe")
	var base_trait: Resource = catalog.by_id(catalog.traits, "emergency_response")
	check(definition.trait_id == "emergency_response", "SUR_004 definition uses emergency_response")
	check(base_trait.modifier_hook == "periodic_effect", "SUR_004 uses Periodic Effect hook")
	check(float(base_trait.params.get("interval", 0.0)) == 10.0 and float(base_trait.params.get("radius", 0.0)) == 6.0, "SUR_004 interval and radius are data-driven")
	check(str(base_trait.params.get("condition", "")) == "hp_below_ratio" and is_equal_approx(float(base_trait.params.get("condition_value", 0.0)), 0.5), "SUR_004 below-half-health condition is data-driven")
	check(base_trait.levels == PackedFloat32Array([0.05, 0.06, 0.07, 0.08, 0.10]), "SUR_004 level table is exact")

	var provider := _actor(definition, Vector3.ZERO, 100.0)
	var low := _actor(definition, Vector3(0, 0, 2), 40.0)
	var high := _actor(definition, Vector3(0, 0, 3), 60.0)
	var dead := _actor(definition, Vector3(0, 0, 1), 10.0, true)
	var far := _actor(definition, Vector3(0, 0, 10), 1.0)
	var runtime := Periodic.new()
	var applied_events: int = 0
	runtime.effect_applied.connect(func(event: Dictionary) -> void:
		if event.effect_type == "heal":
			applied_events += 1
			for target: Node3D in [provider, low, high, dead]:
				if str(target.get_instance_id()) == str(event.target_id):
					HealHandler.apply(target, float(event.value))
	)
	runtime.register_provider(provider, base_trait.at_level(1), "lu-provider")
	check(runtime.advance(9.99, [provider, low, high, dead]).is_empty(), "SUR_004 does not tick before 10 seconds")
	runtime.advance(0.01, [provider, low, high, dead, far])
	near(low.hp, 45.0, "SUR_004 Lv1 heals lowest HP ally by 5%")
	near(high.hp, 60.0, "SUR_004 leaves higher HP ally unchanged")
	near(dead.hp, 10.0, "SUR_004 excludes dead ally")
	near(far.hp, 1.0, "SUR_004 excludes allies outside 6m")
	low.hp = 60.0
	high.hp = 70.0
	provider.hp = 40.0
	runtime.advance(10.0, [provider, low, high, dead, far])
	near(provider.hp, 45.0, "SUR_004 can heal itself when it is the lowest damaged team member")
	low.hp = 80.0
	high.hp = 90.0
	provider.hp = 80.0
	var applied_before_no_target: int = applied_events
	runtime.advance(10.0, [provider, low, high, dead, far])
	check(applied_events == applied_before_no_target, "SUR_004 does not trigger when every target is at or above half health")
	var cap := _actor(definition, Vector3.ZERO, 98.0)
	near(HealHandler.apply(cap, 0.10).amount, 2.0, "Lv5 heal amount is capped at missing HP")
	near(cap.hp, 100.0, "Heal never exceeds Max HP")
	near(HealHandler.apply(cap, 0.10).amount, 0.0, "Full HP does not heal")
	var lv5: Resource = base_trait.at_level(5)
	low.hp = 40.0
	near(HealHandler.apply(low, float(lv5.levels[4])).amount, 10.0, "SUR_004 Lv5 heals 10% Max HP")
	var state: Dictionary = runtime.to_state()
	var restored := Periodic.new()
	var provider_resolver := func(id: String) -> Node3D: return provider if id == "lu-provider" else null
	var trait_resolver := func(id: String, level: int) -> Resource: return base_trait.at_level(level) if id == "emergency_response" else null
	check(restored.restore_state(state, provider_resolver, trait_resolver), "SUR_004 periodic state restores")
	check(restored.to_state().providers[0].trait_level == 1, "SUR_004 provider level survives save/load")
	provider.free()
	low.free()
	high.free()
	dead.free()
	far.free()
	cap.free()
	_check_mission_integration(catalog)
	var report := {"checks": checks, "failures": failures}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output"))
	FileAccess.open(OUTPUT, FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("SUR_004 EMERGENCY CARE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _check_mission_integration(catalog: RefCounted) -> void:
	var campaign := Campaign.new(catalog)
	campaign.new_run(40404, "", ["lu_qinghe", "xia_zhiyao"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 40404, campaign)
	var healer: Node3D = mission.survivors[0]
	var target: Node3D = mission.survivors[1]
	healer.position = Vector3.ZERO
	target.position = Vector3(0, 0, 2)
	target.hp = 40.0
	mission._advance_world(9.99)
	near(target.hp, 40.0, "Mission integration waits for 10 second interval")
	mission._advance_world(0.01)
	near(target.hp, 45.0, "Mission integration applies SUR_004 heal")
	mission.queue_free()
