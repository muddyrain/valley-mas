extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Periodic = preload("res://core/periodic_effect_runtime.gd")
const BuffHandler = preload("res://core/buff_effect_handler.gd")
const Campaign = preload("res://core/campaign.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Mission = preload("res://missions/mission.gd")

const OUTPUT: String = "res://test-output/sur-008-morale-boost.json"

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

func actor(position: Vector3, dead: bool = false) -> Node3D:
	var result := Node3D.new()
	result.position = position
	result.set_meta("dead", dead)
	return result

func run() -> void:
	var catalog := Catalog.new()
	var definition: Resource = catalog.by_id(catalog.survivors, "cheng_mo")
	var trait_data: Resource = catalog.by_id(catalog.traits, "morale_boost")
	check(definition.trait_id == "morale_boost", "SUR_008 definition uses morale_boost")
	check(trait_data.modifier_hook == "periodic_effect", "SUR_008 uses Periodic Effect hook")
	check(trait_data.effect_interval == 20.0 and trait_data.effect_duration == 6.0 and trait_data.effect_radius == 6.0, "SUR_008 timer data is exact")
	check(trait_data.effect_target_filter == Periodic.TARGET_ALL_TEAM, "SUR_008 targets ALL_TEAM")
	check(trait_data.levels == PackedFloat32Array([0.05, 0.07, 0.09, 0.11, 0.13]), "SUR_008 level table is exact")

	var provider := actor(Vector3.ZERO)
	var ally := actor(Vector3(0, 0, 4))
	var far := actor(Vector3(0, 0, 6.1))
	var runtime := Periodic.new()
	runtime.effect_applied.connect(func(event: Dictionary) -> void:
		for target: Node3D in [provider, ally, far]:
			if str(target.get_instance_id()) == str(event.target_id):
				BuffHandler.apply(target, str(event.effect_type), float(event.value), str(event.provider_id))
	)
	runtime.effect_expired.connect(func(event: Dictionary) -> void:
		for target: Node3D in [provider, ally, far]:
			if str(target.get_instance_id()) == str(event.target_id):
				BuffHandler.expire(target, str(event.effect_type), str(event.provider_id))
	)
	runtime.register_provider(provider, trait_data.at_level(1), "cheng-provider")
	check(runtime.advance(19.99, [provider, ally, far]).is_empty(), "SUR_008 does not tick before 20 seconds")
	runtime.advance(0.01, [provider, ally, far])
	near(BuffHandler.critical_chance(provider), 0.05, "Lv1 applies to provider")
	near(BuffHandler.critical_chance(ally), 0.05, "Lv1 applies to in-range ally")
	near(BuffHandler.critical_chance(far), 0.0, "6.1m ally is excluded")
	runtime.advance(5.99, [provider, ally, far])
	near(BuffHandler.critical_chance(ally), 0.05, "Buff remains active through 6 second duration")
	runtime.advance(0.01, [provider, ally, far])
	near(BuffHandler.critical_chance(provider), 0.0, "Provider buff expires after 6 seconds")
	near(BuffHandler.critical_chance(ally), 0.0, "Ally buff expires after 6 seconds")

	var refresh_trait: Resource = trait_data.at_level(5)
	refresh_trait.effect_interval = 2.0
	var refresh_runtime := Periodic.new()
	refresh_runtime.effect_applied.connect(func(event: Dictionary) -> void: BuffHandler.apply(provider, str(event.effect_type), float(event.value), str(event.provider_id)))
	refresh_runtime.register_provider(provider, refresh_trait, "refresh-provider")
	refresh_runtime.advance(2.0, [provider])
	refresh_runtime.advance(1.0, [provider])
	refresh_runtime.advance(1.0, [provider])
	near(BuffHandler.critical_chance(provider), 0.13, "Refresh keeps one non-stacking Lv5 modifier")
	check(refresh_runtime.to_state().active_effects.size() == 1, "Refresh keeps one active effect")
	BuffHandler.apply(provider, BuffHandler.EFFECT_CRIT_RATE, 0.07, "second-provider")
	near(BuffHandler.critical_chance(provider), 0.13, "Same-type sources use the strongest value without stacking")
	BuffHandler.expire(provider, BuffHandler.EFFECT_CRIT_RATE, "second-provider")
	near(BuffHandler.critical_chance(provider), 0.13, "Expiring a weaker source keeps the stronger source")

	var saved: Dictionary = refresh_runtime.to_state()
	var restored := Periodic.new()
	var provider_resolver := func(id: String) -> Node3D: return provider if id == "refresh-provider" else null
	var trait_resolver := func(id: String, level: int) -> Resource: return refresh_trait if id == "morale_boost" else null
	check(restored.restore_state(saved, provider_resolver, trait_resolver), "SUR_008 periodic state restores")
	check(BuffHandler.restore_state(provider, saved.active_effects.values()[0]), "Active buff state restores")
	near(BuffHandler.critical_chance(provider), 0.13, "Restored active buff keeps value")
	restored.effect_expired.connect(func(event: Dictionary) -> void: BuffHandler.expire(provider, str(event.effect_type), str(event.provider_id)))
	restored.advance(6.0, [provider])
	near(BuffHandler.critical_chance(provider), 0.0, "Restored buff expires normally")
	_check_mission_integration(catalog)

	var report := {"checks": checks, "failures": failures}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output"))
	FileAccess.open(OUTPUT, FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("SUR_008 MORALE BOOST: %d checks, %d failures" % [checks, failures.size()])
	provider.free()
	ally.free()
	far.free()
	quit(0 if failures.is_empty() else 1)

func _check_mission_integration(catalog: RefCounted) -> void:
	var campaign := Campaign.new(catalog)
	campaign.new_run(8008, "", ["cheng_mo", "xia_zhiyao"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	mission.setup(catalog, Ledger.new(), [], 8008, campaign)
	var provider: Node3D = mission.survivors[0]
	var ally: Node3D = mission.survivors[1]
	provider.position = Vector3.ZERO
	ally.position = Vector3(0, 0, 4)
	mission._advance_world(20.0)
	near(BuffHandler.critical_chance(provider), 0.05, "Mission applies SUR_008 to Cheng Mo")
	near(BuffHandler.critical_chance(ally), 0.05, "Mission applies SUR_008 to an in-range teammate")
	mission._advance_world(6.0)
	near(BuffHandler.critical_chance(provider), 0.0, "Mission expires SUR_008 on Cheng Mo")
	near(BuffHandler.critical_chance(ally), 0.0, "Mission expires SUR_008 on teammate")
	mission.queue_free()
