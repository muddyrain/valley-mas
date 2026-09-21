extends "res://tests/expedition_minimap.gd"
## Deterministic native capture through the formal App, navigation, search and combat.
const Weapons = preload("res://data/weapon_registry.gd")
const PUBLIC = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
var character_id: String = "xia_zhiyao"
var view_name: String = "gameplay"
var capture_enabled: bool = false
var app: Node
var mission: Node3D
var member: Node3D
var frame_index: int = 0
var tick_index: int = 0
var samples: Array[Dictionary] = []
var phases: Dictionary = {}
var shots: int = 0
var sole_points: Dictionary = {}
var poses: Array[Transform3D] = []

func _arguments() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--character="):
			character_id = arg.trim_prefix("--character=")
		if arg.begins_with("--view="):
			view_name = arg.trim_prefix("--view=")
		if arg == "--capture":
			capture_enabled = true
	output_directory = "res://test-output/survivor-production/" + character_id + "/" + view_name
	DirAccess.make_dir_recursive_absolute(output_directory + "/frames")

func _snapshot(s: Skeleton3D) -> void:
	poses.clear()
	for b: int in s.get_bone_count():
		poses.append(s.global_transform * s.get_bone_global_pose(b))

func _sole_markers() -> void:
	var s: Skeleton3D = member.animation_controller.target
	var meshes: Array[Node] = member.rig.find_children("*", "MeshInstance3D", true, false)
	for node: Node in meshes:
		var mesh := node as MeshInstance3D
		if mesh.skin == null:
			continue
		var a: Array = mesh.mesh.surface_get_arrays(0)
		var v: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var w: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
		var j: PackedInt32Array = a[Mesh.ARRAY_BONES]
		var stride: int = w.size() / v.size()
		for side: String in ["Left", "Right"]:
			var low: float = INF
			var front: float = -INF
			var rear: float = INF
			var candidates: Array[int] = []
			for i: int in v.size():
				if v[i].y < .06 and (v[i].x > 0.0 if side == "Left" else v[i].x < 0.0):
					candidates.append(i)
					low = minf(low, v[i].y)
					front = maxf(front, v[i].z)
					rear = minf(rear, v[i].z)
			for part: String in ["Heel", "Forefoot"]:
				var indices: Array[int] = []
				var part_low: float = INF
				for i: int in candidates:
					if (v[i].z <= rear + .3 * (front - rear) if part == "Heel" else v[i].z >= rear + .7 * (front - rear)):
						indices.append(i)
						part_low = minf(part_low, v[i].y)
				var markers: Array[Dictionary] = []
				for i: int in indices:
					if v[i].y > part_low + .003:
						continue
					var influences: Array[Dictionary] = []
					for k: int in stride:
						var bind: int = j[i * stride + k]
						var bone: int = s.find_bone(mesh.skin.get_bind_name(bind))
						influences.append({"bone": bone, "weight": w[i * stride + k], "point": mesh.skin.get_bind_pose(bind) * v[i]})
					markers.append({"influences": influences})
				sole_points[side + part] = markers
		return

func _feet() -> Dictionary:
	var result: Dictionary = {}
	for key: String in sole_points:
		var center := Vector3.ZERO
		var low: float = INF
		var high: float = -INF
		var points: Array = sole_points[key]
		for marker: Dictionary in points:
			var p := Vector3.ZERO
			for influence: Dictionary in marker.influences:
				p += (poses[influence.bone] * influence.point) * influence.weight
			center += p
			low = minf(low, p.y)
			high = maxf(high, p.y)
		center /= maxf(1.0, points.size())
		result[key] = {"centroid": [center.x, center.y, center.z], "low": low, "high": high, "vertices": points.size()}
	return result

func _camera() -> void:
	if view_name == "gameplay":
		mission.camera_controller.update(1.0 / 60.0)
	else:
		var aim: Vector3 = member.global_position + Vector3.UP * (.18 if view_name == "feet" else .83)
		mission.camera.position = aim + Vector3(3.8, 1.6, -4.5)
		mission.camera.look_at(aim)
		mission.camera.size = 1.0 if view_name == "feet" else 2.5

func _frame(label: String) -> void:
	mission._physics_process(1.0 / 60.0)
	_camera()
	await process_frame
	if tick_index % 2 == 0:
		var c: Node3D = member.animation_controller
		if not phases.has(label):
			phases[label] = frame_index / 30.0
		samples.append({"frame": frame_index, "time": tick_index / 60.0, "phase": label,
			"position": [member.position.x, member.position.y, member.position.z],
			"velocity": [member.actual_velocity.x, member.actual_velocity.y, member.actual_velocity.z],
			"speed": Vector2(member.actual_velocity.x, member.actual_velocity.z).length(),
			"state": str(c.current_state), "rate": c.playback_rate, "clip_time": c.playback.get_current_play_position(),
			"yaw": member.rig.rotation.y, "feet": _feet() if not poses.is_empty() else {},
			"visible": member.visible, "searching": member.searching})
		if capture_enabled:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_jpg(output_directory + "/frames/%05d.jpg" % frame_index, .93)
		frame_index += 1
	tick_index += 1

func _seconds(seconds: float, label: String) -> void:
	for i: int in ceili(seconds * 60.0):
		await _frame(label)

func _move(target: Vector3, label: String, timeout: float = 20.0) -> void:
	check(mission.command_move(target), character_id + " navigation accepts " + label)
	var assigned_target: Vector3 = member.path[-1] if not member.path.is_empty() else member.position
	for i: int in ceili(timeout * 60.0):
		await _frame(label)
		if i > 15 and member.path.is_empty() and member.current_speed < .01:
			check(member.position.distance_to(assigned_target) < .1, label + " reaches assigned formation slot")
			await _seconds(.35, label + " arrival")
			return
	check(false, label + " timed out")

func _screenshot(name: String) -> void:
	if not capture_enabled:
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output_directory + "/" + name + ".png")

func _search() -> void:
	var id: String = ""
	var distance: float = INF
	for site_id: String in mission.search_registry.building_searchables:
		var site: Dictionary = mission.city.sites[site_id]
		var d: float = member.position.distance_to(site.spec.entry)
		if site.spec.search_status == "RESOLVED_REACHABLE" and d < distance:
			id = site_id
			distance = d
	check(not id.is_empty(), "Production town has searchable building")
	if id.is_empty():
		return
	await _move(mission.city.sites[id].spec.entry, "Approach building", 60.0)
	app.hud.inspect_member(member, false)
	mission.command_search(id)
	check(mission.search_tasks.has(id), "Selected formal character gets search task")
	await _seconds(2.0, "Search building")
	check(member.searching, "Character searches building")
	var before: float = mission.city.sites[id].progress
	mission.command_move(mission.city.navigation.nearest(member.position + Vector3(3, 0, 2)))
	await _seconds(.5, "Ground command during search")
	check(mission.search_tasks.has(id) and mission.city.sites[id].progress > before, "Existing started-search movement semantics preserved")
	mission.command_recall(id)
	await _seconds(.8, "Cancel search")
	check(member.visible and not member.inside_building and not mission.search_tasks.has(id), "Search cancel restores character and navigation")

func _weapon() -> void:
	member.equip(app.catalog.by_id(app.catalog.weapons, Weapons.A21))
	member.combat.fired.connect(func(_pellets: Array) -> void: shots += 1)
	await _seconds(.6, "Weapon mounted")
	var s: Skeleton3D = member.animation_controller.target
	check(member.weapon_visual.socket.bone_name == &"RightHand", "WeaponSocket_R binds RightHand")
	check(member.weapon_visual.get_muzzle_point() != null, "Weapon scene provides MuzzlePoint")
	check(member.weapon_visual.socket.global_position.distance_to(poses[s.find_bone("RightHand")].origin) < .002, "Socket follows final posed hand")
	await _screenshot("weapon-socket")
	var point: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0, 0, -3))
	var enemy: Node3D = mission.spawn_enemy(mission.catalog.enemies[0].id, point)
	check(enemy != null, "Combat creates existing infected target")
	if enemy == null:
		return
	enemy.hp = 10000.0
	var hp_before: float = enemy.hp
	var ammo_before: int = member.ammo
	await _seconds(2.0, "Automatic attack")
	check(shots > 0 and enemy.hp < hp_before, "Automatic target selection attacks and damages")
	check(member.ammo < ammo_before, "Gameplay ammunition consumed")
	mission.debug_clear_enemies()
	await _seconds(.5, "Combat stop")

func run() -> void:
	_arguments()
	app = SeededApp.new()
	app.fixture_seed = 4101
	# Let the isolated missing save initialize through the production starter pool.
	# The requested candidate is installed immediately afterward and exercised in Camp.
	app.fresh_test_run = false
	app.save_path = "user://test-runs/survivor-production-%s-%d.json" % [character_id, OS.get_process_id()]
	root.add_child(app)
	await process_frame
	app.campaign.new_run(4101, "", [character_id])
	app.show_shelter()
	await process_frame
	check(app.camp_view.members.has(character_id), "Formal Camp spawns candidate")
	check(app.campaign.member_template(character_id).id == character_id, "Camp candidate keeps SurvivorDefinition identity")
	app.random_mission_counter = 0
	app.start_mission()
	mission = app.mission
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	member = mission.survivors[0]
	member.equip(null)
	check(member.data.id == character_id, "Formal campaign identity")
	check(mission.runtime_data != null, "Real Expedition town")
	check(member.animation_controller.player.get_animation_library(&"Public") == PUBLIC, "Same production public library")
	if view_name != "gameplay":
		app.hud.hide()
	member.animation_controller.target.skeleton_updated.connect(_snapshot.bind(member.animation_controller.target))
	_sole_markers()
	await process_frame
	await physics_frame
	await _seconds(5.0, "Idle 5 seconds")
	await _screenshot("idle")
	# Use the actual arrival street and navigation projection for this fixed town seed.
	var start: Vector3 = member.position
	var direction := Vector3.FORWARD
	for candidate: Vector3 in [Vector3.FORWARD, Vector3.RIGHT, Vector3.BACK, Vector3.LEFT]:
		if mission.city.navigation.segment_clear(start, start + candidate * 12.0):
			direction = candidate
			break
	await _move(mission.city.navigation.nearest(start + direction * 2.0), "Short move")
	await _move(mission.city.navigation.nearest(start + direction * 12.0), "Long straight")
	var diagonal := direction.rotated(Vector3.UP, PI / 4.0)
	await _move(mission.city.navigation.nearest(member.position + diagonal * 5.0), "45 degree turn")
	var perpendicular := diagonal.rotated(Vector3.UP, PI / 2.0)
	await _move(mission.city.navigation.nearest(member.position + perpendicular * 5.0), "90 degree turn")
	for offset: Vector3 in [direction * 5.0, -diagonal * 4.0, -direction * 4.0]:
		mission.command_move(mission.city.navigation.nearest(member.position + offset))
		await _seconds(.6, "Repeated move commands")
	mission.command_stop()
	await _seconds(1.5, "Run Stop Idle")
	check(member.animation_controller.current_state == &"Idle", "Stop settles to Idle")
	mission.effects.set_source("production_walk_review", {"move_speed": .45})
	await _move(mission.city.navigation.nearest(member.position + direction * 2.0), "Low speed Walk")
	mission.effects.remove_source("production_walk_review")
	await _search()
	await _weapon()
	var report := {"character": character_id, "view": view_name, "fps": 30, "frames": frame_index,
		"checks": checks, "failures": failures, "speed": member.data.move_speed, "phase_times": phases,
		"normal_camera_size": 25.0, "samples": samples, "shots": shots, "test_control": "formal App; deterministic 60Hz Mission ticks; real Navigation and command API; isolated save"}
	FileAccess.open(output_directory + "/runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report))
	print("SURVIVOR PRODUCTION GAMEPLAY ", character_id, "/", view_name, ": ", checks, " checks; ", failures, "; ", frame_index, " frames")
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
