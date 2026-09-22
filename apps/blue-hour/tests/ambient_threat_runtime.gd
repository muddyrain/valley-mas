extends SceneTree

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const AmbientThreat = preload("res://encounter/ambient_threat_runtime.gd")
const SquadCard = preload("res://ui/expedition/squad_card.gd")
const OUTPUT: String = "res://test-output/ambient-threat-v1/"

class FakeSearchTask extends RefCounted:
	enum Phase { SEARCHING_INSIDE, DEFEND }
	var site_id: String = ""
	var search_started: bool = true
	var worker: Node3D
	var phase: Phase = Phase.SEARCHING_INSIDE

	func action_label() -> String:
		return "搜索中"

	func _on_damage() -> void:
		pass

var mission: Node3D
var runtime: Node
var hud: Control
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func capture(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		await process_frame
		return
	else:
		await RenderingServer.frame_post_draw
	var viewport_texture: Texture2D = root.get_texture()
	if viewport_texture == null:
		return
	var image := viewport_texture.get_image()
	if image != null and not image.is_empty():
		image.save_png(OUTPUT + name + ".png")

func wait_frames(count: int) -> void:
	for i: int in count:
		await process_frame

func run() -> void:
	create_timer(90.0).timeout.connect(func() -> void: quit(2))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	root.size = Vector2i(1600, 900)
	mission = Mission.new()
	root.add_child(mission)
	var catalog := Catalog.new()
	var config := {"map_provider": "MEDIUM_TOWN_V1", "mission_type": "supply_search",
		"map_seed": 20260923, "seed": 20260923}
	var loadout: Array[String] = ["pistol", "smg"]
	var locked_party: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260923, null, locked_party, config)
	mission.set_physics_process(false)
	runtime = AmbientThreat.new()
	runtime.name = "AmbientThreatRuntime"
	mission.add_child(runtime)
	runtime.setup(mission)
	runtime.set_physics_process(false)
	for frame: int in 600:
		if mission.survivor_commands_enabled and runtime.runtime_ready:
			break
		await process_frame
	check(mission.survivor_commands_enabled and runtime.runtime_ready, "Medium Town navigation enables ambient threat runtime")
	check(mission.enemies.size() >= 8 and mission.enemies.size() <= 12,
		"Day 1 starts with 8-12 infected: %d" % mission.enemies.size())
	for enemy: Node3D in mission.enemies:
		check(enemy.get_meta("encounter_origin", "") == "ambient_day_one", "Initial infected uses ambient Day 1 origin")
		check(enemy.state_name() in ["IDLE", "WANDER"], "Initial infected begins idle or wandering")
		for member: Node3D in mission.survivors:
			check(enemy.position.distance_to(member.position) >= 25.0, "Initial infected stays at least 25m from survivors")
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	var population_center: Vector3 = mission.enemies[0].position
	mission.camera_controller.following = false
	mission.camera_center = population_center
	mission.camera_controller.apply()
	mission.exploration.refresh()
	hud.refresh()
	await wait_frames(4)
	await capture("01_expedition_infected_population")

	var site_id: String = _large_site_id()
	check(not site_id.is_empty(), "Medium Town exposes a large searchable target for Noise 12")
	var site: Dictionary = mission.city.sites[site_id]
	var worker: Node3D = mission.survivors[0]
	worker.position = site.spec.entry
	worker.inside_building = true
	mission.debug_clear_enemies()
	var listener_point: Vector3 = _listener_point(site.spec.entry, 8.0)
	var listener: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", listener_point)
	check(is_instance_valid(listener), "Noise listener spawns on Medium Town navigation")
	var task: RefCounted = _fake_search_task(worker)
	mission.search_tasks[site_id] = task
	runtime._physics_process(1.01)
	check(runtime.search_noise_events == 1 and runtime.last_search_event.type_name() == "SEARCH",
		"Active search emits one NoiseEvent per second")
	check(is_equal_approx(runtime.last_search_event.radius, 12.0), "Large building search uses Noise 12")
	check(listener.state_name() == "INVESTIGATE_NOISE", "Listening infected enters INVESTIGATE_NOISE")
	var before: float = listener.position.distance_to(site.spec.entry)
	for frame: int in 90:
		runtime._physics_process(1.0 / 30.0)
	check(listener.position.distance_to(site.spec.entry) < before, "Investigating infected approaches the search noise")
	worker.inside_building = false
	mission.camera_center = site.spec.entry
	mission.camera_controller.apply()
	mission.exploration.refresh()
	hud.refresh()
	await wait_frames(4)
	await capture("02_search_noise_investigation")

	var prior_events: int = mission.noise.total_emitted
	mission.search_completed.emit(site_id, worker.data.display_name, {"food": 2, "scrap": 1, "weapon": {}})
	check(mission.noise.total_emitted == prior_events + 1 and runtime.search_complete_events == 1,
		"Search completion emits one high NoiseEvent")
	check(runtime.last_search_event.type_name() == "SEARCH_COMPLETE" and is_equal_approx(runtime.last_search_event.radius, 18.0),
		"Large building completion raises Noise 12 to radius 18")
	mission.search_tasks.erase(site_id)
	mission.survivor_tasks.clear()
	var card := SquadCard.new()
	root.add_child(card)
	card.setup(worker, worker.data.id)
	listener.position = worker.position + Vector3(6, 0, 0)
	card.update_member(worker, mission)
	check(card.status.text == "警戒", "Nearby infected reuses the survivor card's lightweight danger state")
	card.hide()
	hud.refresh()
	await wait_frames(4)
	await capture("03_search_complete_high_noise")

	var perf_before: int = runtime.update_usec
	var updates_before: int = runtime.update_count
	for frame: int in 300:
		runtime._physics_process(1.0 / 60.0)
	var perf_ms: float = (runtime.update_usec - perf_before) / (1000.0 * maxi(1, runtime.update_count - updates_before))
	check(perf_ms < 8.0, "Ambient threat update stays below 8ms average: %.3fms" % perf_ms)
	FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks, "failures": failures, "population": runtime.initial_spawned,
		"search_noise_events": runtime.search_noise_events, "search_complete_events": runtime.search_complete_events,
		"average_update_ms": perf_ms, "runtime_performance": runtime.performance()}, "\t"))
	print("AMBIENT THREAT V1: %d checks, %d failures, %.3fms/update" % [checks, failures.size(), perf_ms])
	quit(0 if failures.is_empty() else 1)

func _large_site_id() -> String:
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		if str(site.spec.get("search_kind", "")) == "large" or str(site.spec.get("poi_type", "")) == "warehouse":
			return id
	return ""

func _listener_point(origin: Vector3, distance: float) -> Vector3:
	for direction: Vector3 in [Vector3.RIGHT, Vector3.LEFT, Vector3.FORWARD, Vector3.BACK]:
		var point: Vector3 = mission.city.nearest_open(origin + direction * distance)
		if point.is_finite() and point.distance_to(origin) <= 11.5 and point.distance_to(origin) >= 5.0:
			return point
	return mission.city.nearest_open(origin + Vector3.RIGHT * 6.0)

func _fake_search_task(worker: Node3D) -> RefCounted:
	var task := FakeSearchTask.new()
	task.site_id = _large_site_id()
	task.worker = worker
	return task
