extends SceneTree

const Periodic = preload("res://core/periodic_effect_runtime.gd")
const TraitData = preload("res://data/trait_data.gd")

const OUTPUT: String = "res://test-output/periodic-effect-runtime.json"

var checks: int = 0
var failures: Array[String] = []
var applied: Array[Dictionary] = []
var expired: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		printerr(label)

func _trait(effect: String, level: int = 1) -> Resource:
	var trait_data: Resource = TraitData.new()
	trait_data.id = effect
	trait_data.modifier_hook = "periodic_effect"
	trait_data.levels = PackedFloat32Array([0.05, 0.06, 0.07, 0.08, 0.10])
	trait_data.runtime_level = level
	trait_data.effect_type = effect
	trait_data.effect_interval = 2.0
	trait_data.effect_duration = 5.0
	trait_data.effect_radius = 6.0
	trait_data.effect_target_filter = Periodic.TARGET_LOWEST_HP_ALLY
	return trait_data

func _actor(position: Vector3, hp: float, dead: bool = false) -> Node3D:
	var actor := Node3D.new()
	actor.position = position
	actor.set_meta("hp", hp)
	actor.set_meta("dead", dead)
	return actor

func run() -> void:
	var provider := _actor(Vector3.ZERO, 100.0)
	var low := _actor(Vector3(0, 0, 2), 20.0)
	var high := _actor(Vector3(0, 0, 3), 80.0)
	var dead := _actor(Vector3(0, 0, 1), 1.0, true)
	var runtime := Periodic.new()
	runtime.effect_applied.connect(func(event: Dictionary) -> void: applied.append(event))
	runtime.effect_expired.connect(func(event: Dictionary) -> void: expired.append(event))
	check(runtime.register_provider(provider, _trait("heal", 1), "provider-a"), "Periodic provider registers")
	check(runtime.advance(1.99, [provider, low, high, dead]).is_empty(), "Interval does not tick early")
	var first: Array[Dictionary] = runtime.advance(0.01, [provider, low, high, dead])
	check(first.size() == 1 and first[0].target_id == str(low.get_instance_id()), "LOWEST_HP_ALLY selects lowest living ally")
	check(applied.size() == 1 and applied[0].effect_type == "heal", "Apply lifecycle emits")
	check(runtime.advance(0.5, [provider, low, high, dead]).is_empty(), "Scheduler is interval-driven, not per-frame")
	runtime.paused = true
	check(runtime.advance(5.0, [provider, low, high, dead]).is_empty(), "Paused runtime does not tick")
	runtime.paused = false
	var refreshed: Array[Dictionary] = runtime.advance(1.5, [provider, low, high, dead])
	check(refreshed.size() == 1 and bool(refreshed[0].get("refreshed", false)), "Same effect refreshes instead of stacking")
	check(runtime.to_state().active_effects.size() == 1, "Same effect has one active instance")
	provider.set_meta("dead", true)
	var expiry: Array[Dictionary] = runtime.advance(5.0, [provider, low, high, dead])
	check(expiry.size() == 1 and expired.size() == 1, "Duration expires and emits")
	provider.set_meta("dead", false)
	runtime.unregister_provider("provider-a")
	var all_team := _trait("shield", 5)
	all_team.effect_target_filter = Periodic.TARGET_ALL_TEAM
	check(runtime.register_provider(provider, all_team, "provider-b"), "Second periodic provider registers")
	var all_events: Array[Dictionary] = runtime.advance(2.0, [provider, low, high, dead])
	check(all_events.size() == 3, "ALL_TEAM selects living team members including provider")
	var saved: Dictionary = runtime.to_state()
	var restored := Periodic.new()
	var resolver := func(id: String) -> Node3D: return provider if id in ["provider-a", "provider-b"] else null
	var trait_resolver := func(id: String, level: int) -> Resource: return _trait(id, level)
	check(restored.restore_state(saved, resolver, trait_resolver), "Periodic provider state restores")
	check(restored.to_state().providers.size() == 1 and restored.to_state().providers[0].trait_level == 5, "Save/load preserves providers and trait levels")
	provider.free()
	low.free()
	high.free()
	dead.free()
	var report := {"checks": checks, "failures": failures, "applied": applied.size(), "expired": expired.size()}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output"))
	FileAccess.open(OUTPUT, FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("PERIODIC EFFECT RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
