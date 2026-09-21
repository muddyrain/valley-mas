extends SceneTree
## Formal roster and real movement, with isolated campaign storage.

const App = preload("res://core/main.gd")
const Survivor = preload("res://survivors/survivor.gd")
const Provider = preload("res://maps/expedition/expedition_map_provider.gd")
const Navigation = preload("res://maps/expedition/town_navigation.gd")
const OUT: String = "res://test-output/expedition-integration-e01"
var failures: Array[String] = []
var checks: int = 0
var records: Array[Dictionary] = []
var signals_seen: int = 0

class SeededApp extends App:
	var fixture_seed: int = 4101
	func _mission_config(action_id: String) -> Dictionary:
		var config: Dictionary = super._mission_config(action_id)
		config.map_seed = fixture_seed
		config.seed = fixture_seed
		return config

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	verify_sealed_enclosure()
	for seed_value: int in [4101, 4102, 4103, 4104]:
		await verify_seed(seed_value)
	var parent: Node3D = Node3D.new()
	root.add_child(parent)
	var legacy: Dictionary = Provider.create_runtime(Provider.FIXED_LEGACY, "food_supply", 4101, load("res://data/maps/east_quay.tres").duplicate(true), parent)
	check(legacy.ok and not legacy.root.path(legacy.map.bus_position, Vector3.ZERO).is_empty(), "Legacy provider retains navigation")
	parent.queue_free()
	await process_frame
	FileAccess.open(OUT.path_join("report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "seeds": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("E01 NAVIGATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func create_app(seed_value: int) -> Node:
	var app: Node = SeededApp.new()
	app.fixture_seed = seed_value
	app.fresh_test_run = true
	app.save_path = "user://test-runs/expedition-navigation-%d-%d.json" % [seed_value, OS.get_process_id()]
	root.add_child(app)
	await process_frame
	app.campaign.new_run(seed_value, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue"])
	app.random_mission_counter = 0
	app.start_mission()
	return app

func verify_seed(seed_value: int) -> void:
	var app: Node = await create_app(seed_value)
	var mission: Node3D = app.mission
	mission.set_physics_process(false)
	mission.navigation_ready.connect(func() -> void: signals_seen += 1)
	check(not mission.command_move(Vector3.ZERO), "Commands rejected before navigation ready")
	check(mission.last_command_rejection == "NAVIGATION_NOT_READY", "Readiness rejection reason")
	await process_frame
	var city: Node3D = mission.city
	for category: String in ["building", "vehicle", "fence", "prop"]:
		check(city.navigation.obstacles.any(func(obstacle: Dictionary) -> bool: return obstacle.category == category), "Actual collision category included: " + category)
	print("E01 SEED %d: %s" % [seed_value, str(city.navigation.performance())])
	check(mission.runtime_data.seed == seed_value, "Formal deterministic seed handoff")
	check(signals_seen == records.size() + 1, "Navigation ready signal emitted once")
	check(city.lifecycle == ["town_runtime_ready", "navigation_build_started", "navigation_ready", "survivor_commands_enabled"], "Navigation lifecycle order")
	check(mission.runtime_data.get("navigation_available", false), "Navigation ready before accepting commands")
	for member: Node3D in mission.survivors:
		check(member.get_script() == Survivor, "Formal survivor factory used")
		check(city.navigation.point_clear(member.position), "Arrival survivor clears static collisions")
	check(mission.survivors[0].animation_controller != null and mission.survivors[1].animation_controller != null, "Imported roster models and animation controllers used")
	var rebuild: RefCounted = Navigation.new()
	rebuild.build(city, mission.runtime_data.town_bounds)
	check(rebuild.metrics.signature == city.navigation.metrics.signature, "Navigation build deterministic")
	var original_sources: Dictionary = mission.runtime_data.source_signatures.duplicate()
	var origins: Array[Vector3] = []
	for member: Node3D in mission.survivors:
		origins.append(member.position)
	var targets: Dictionary = city.navigation_targets.duplicate()
	targets["poi"] = mission.runtime_data.mission_poi
	check(targets.has_all(["commercial", "park", "residential", "poi"]), "All four route targets derive from Town data")
	var routes: Array[Dictionary] = []
	for key: String in targets:
		var target: Vector3 = targets[key]
		var route: PackedVector3Array = city.path(origins[0], target)
		print("E01 route %d %s %s: %d points" % [seed_value, key, target, route.size()])
		check(not route.is_empty(), "%d Arrival -> %s path exists" % [seed_value, key])
		check(route == city.path(origins[0], target), "Path query deterministic")
		check(route_safe(city, route), "Independent swept-body route check: " + key)
		routes.append({"target": key, "position": var_to_str(target), "points": route.size(), "length": path_length(route)})
		if seed_value == 4101 and not route.is_empty():
			# Each route begins at Arrival by actually walking back, never teleporting.
			if key != targets.keys()[0]:
				await walk(mission, city.navigation.nearest(mission.runtime_data.arrival_exit), "return_to_arrival")
			await walk(mission, target, key)
	var before: Vector3 = mission.rally_point
	check(not mission.command_move(Vector3(10000, 0, 10000)), "Out-of-bounds click rejected")
	check(not mission.command_move(Vector3.INF), "Nonfinite click rejected")
	check(mission.rally_point == before, "Rejected command preserves current order")
	for obstacle: Dictionary in city.navigation.obstacles:
		var center: Vector2 = obstacle.bounds.get_center()
		check(not mission.command_move(Vector3(center.x, 0, center.y)), "Blocked click rejected")
		break
	check(mission.runtime_data.source_signatures == original_sources, "Runtime navigation does not mutate generator output")
	records.append({"seed": seed_value, "town_generation_ms": mission.runtime_data.town_generation_ms, "navigation": city.navigation.performance(), "routes": routes, "sources": original_sources})
	app.queue_free()
	await process_frame

func verify_sealed_enclosure() -> void:
	var fixture: Node3D = Node3D.new()
	root.add_child(fixture)
	var floor_view := MeshInstance3D.new()
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(30, 30)
	floor_view.mesh = floor_mesh
	floor_view.set_meta(&"walkable_ground", true)
	fixture.add_child(floor_view)
	for i: int in 4:
		var body: StaticBody3D = StaticBody3D.new()
		var collision: CollisionShape3D = CollisionShape3D.new()
		var box: BoxShape3D = BoxShape3D.new()
		box.size = Vector3(10.3, 2.0, .3)
		collision.shape = box
		body.add_child(collision)
		fixture.add_child(body)
		body.position = Vector3(0, 1, 5).rotated(Vector3.UP, i * PI / 2.0)
		body.rotation.y = i * PI / 2.0
	var nav: RefCounted = Navigation.new()
	nav.build(fixture, Rect2(-12, -12, 24, 24))
	check(nav.point_clear(Vector3.ZERO), "Enclosure interior is geometrically open")
	check(nav.path(Vector3(0, .08, -9), Vector3.ZERO).is_empty(), "No path through a closed fence enclosure")
	check(not nav.segment_clear(Vector3(0, .08, -9), Vector3.ZERO), "Whole-segment check rejects fence crossing")
	check(not nav.path(Vector3(0, .08, -9), Vector3(9, .08, 0)).is_empty(), "Normal outside route around enclosure remains available")
	fixture.queue_free()

func walk(mission: Node3D, target: Vector3, label: String) -> void:
	var accepted: bool = mission.command_move(target)
	check(accepted, "Squad accepts " + label)
	if not accepted:
		return
	var endpoints: Array[Vector3] = []
	for member: Node3D in mission.survivors:
		check(route_safe(mission.city, member.path), "Real assigned path clears collisions: " + label)
		endpoints.append(member.path[-1])
	var frames: int = 0
	var safe: bool = true
	var min_separation: float = INF
	var minimum_detail: Dictionary = {}
	while frames < 18000:
		mission._physics_process(1.0 / 60.0)
		frames += 1
		for i: int in mission.survivors.size():
			var member: Node3D = mission.survivors[i]
			safe = safe and mission.city.navigation.point_clear(member.position)
			for j: int in range(i + 1, mission.survivors.size()):
				var distance: float = member.position.distance_to(mission.survivors[j].position)
				if distance < min_separation:
					min_separation = distance
					minimum_detail = {"frame": frames, "a": str(member.position), "b": str(mission.survivors[j].position), "path_a": str(member.path), "path_b": str(mission.survivors[j].path)}
		if mission.survivors.all(func(member: Node3D) -> bool: return member.path.is_empty()):
			break
		if frames % 600 == 0:
			await process_frame
	check(frames < 18000, "Squad actually completes " + label)
	if frames >= 18000:
		for actor: Node3D in mission.survivors:
			print("E01 blocked ", actor.data.id, " position=", actor.position, " speed=", actor.current_speed, " remaining=", actor.remaining_distance(), " path=", actor.path)
	check(safe, "Actual movement stays clear and in bounds: " + label)
	check(min_separation > 0.35, "Moving members do not collapse onto one point: " + label)
	for i: int in endpoints.size():
		check(mission.survivors[i].position.distance_to(endpoints[i]) < 0.1, "Survivor reaches assigned destination")
		for j: int in range(i + 1, endpoints.size()):
			check(endpoints[i].distance_to(endpoints[j]) >= 1.1, "Formation endpoint separation")
	print("E01 walked %s: %.2f seconds, minimum separation %.3f" % [label, frames / 60.0, min_separation])
	if min_separation < .35:
		print("E01 separation diagnostic: ", minimum_detail)

func path_length(route: PackedVector3Array) -> float:
	var length: float = 0.0
	for i: int in range(1, route.size()):
		length += route[i - 1].distance_to(route[i])
	return length

func route_safe(city: Node3D, route: PackedVector3Array) -> bool:
	if route.is_empty():
		return false
	# Independently intersect a body-radius swept rectangle in each collider's
	# local space; this does not call the navigation module's segment checker.
	for shape_node: Node in city.find_children("*", "CollisionShape3D", true, false):
		var collision: CollisionShape3D = shape_node as CollisionShape3D
		if collision.disabled or collision.shape == null or not collision.get_parent() is StaticBody3D:
			continue
		var box: AABB = collision.shape.get_debug_mesh().get_aabb()
		var transform: Transform3D = city.global_transform.affine_inverse() * collision.global_transform
		var world_box: AABB = transform * box
		if world_box.end.y <= .2 or world_box.position.y >= 2.03:
			continue
		var inverse: Transform3D = transform.affine_inverse()
		var margin: float = .35 / minf(transform.basis.x.length(), transform.basis.z.length())
		var rect: Rect2 = Rect2(Vector2(box.position.x, box.position.z), Vector2(box.size.x, box.size.z)).grow(margin)
		for i: int in range(1, route.size()):
			var a: Vector3 = inverse * route[i - 1]
			var b: Vector3 = inverse * route[i]
			var samples: int = maxi(1, ceili(a.distance_to(b) / .2))
			for step: int in range(samples + 1):
				var point: Vector3 = a.lerp(b, float(step) / samples)
				if rect.has_point(Vector2(point.x, point.z)):
					return false
	for point: Vector3 in route:
		if not city.runtime_data.town_bounds.grow(-.35).has_point(Vector2(point.x, point.z)):
			return false
	return true
