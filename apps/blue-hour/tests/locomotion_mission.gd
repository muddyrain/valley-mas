extends SceneTree
## Actual formal navigation, effects, camera and Mission; controlled simulation clock.
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
var mission: Node3D
var checks: int = 0
var failures: Array[String] = []
var legs: Array = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)

func advance(frames: int) -> void:
	for frame in frames:
		mission._physics_process(1.0 / 60)
		for member in mission.survivors:
			var cell: Vector2i = mission.city.cell_at(member.position)
			check(mission.city.grid.is_in_boundsv(cell) and not mission.city.grid.is_point_solid(cell), "Existing navigation keeps survivor out of blocked cells")
			check(absf(member.position.y) < .00001 and absf(member.rig.position.y) < .00001, "No world or visual Y bounce")
		if frame % 60 == 0:
			await process_frame

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion-polish")
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres"), load("res://data/survivors/su_wanxing.tres")]
	var weapon_id: String = catalog.by_id(catalog.weapons, "pistol").id
	var loadout: Array[String] = [weapon_id, weapon_id]
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), loadout, 7312)
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	for i in mission.survivors.size():
		mission.survivors[i].position = mission.city.nearest_open(Vector3(0, 0, 20) + mission.formation(i))
	mission.command_move(Vector3(0, 0, -20))
	await advance(90)
	mission.command_move(mission.squad_center() + Vector3(2, 0, -14))
	await advance(60)
	mission.command_move(mission.squad_center() + Vector3(14, 0, 0))
	await advance(60)
	mission.command_stop()
	await advance(30)
	for member in mission.survivors:
		check(member.path.is_empty() and member.current_speed == 0, "Mission player stop finishes within half second")
	for id: String in ["garage", "north_depot", "bus"]:
		var destination: Vector3 = catalog.map.bus_position if id == "bus" else mission.city.sites[id].spec.entry
		mission.command_move(destination)
		var seconds := 0.0
		while seconds < 120 and mission.survivors.any(func(member: Node3D) -> bool: return not member.path.is_empty()):
			await advance(60)
			seconds += 1
		check(seconds < 120, "Both characters complete multi-waypoint route: " + id)
		legs.append({"destination": id, "seconds": seconds})
		for member in mission.survivors:
			check(member.current_speed == 0, "Destination ends at zero speed")
	mission.command_move(Vector3(0, 0, 20))
	await advance(60)
	mission.input_enabled = true
	mission.command_aim(Vector3(0, 0, 0))
	var positions: Array = mission.survivors.map(func(member: Node3D) -> Vector3: return member.position)
	await advance(15)
	for i in mission.survivors.size():
		check(mission.survivors[i].position == positions[i], "Manual aim retains immediate gameplay stop")
	mission.manual_aim = false
	mission.command_move(Vector3(0, 0, 20))
	await advance(60)
	mission.time_scale = 0
	positions = mission.survivors.map(func(member: Node3D) -> Vector3: return member.position)
	await advance(30)
	for i in mission.survivors.size():
		check(mission.survivors[i].position == positions[i], "Tactical pause preserves world position")
	var result := {"checks": checks, "failures": failures, "legs": legs, "camera_size": mission.camera.size}
	FileAccess.open("res://test-output/locomotion-polish/mission.json", FileAccess.WRITE).store_string(JSON.stringify(result, "\t"))
	print("LOCOMOTION MISSION: ", result)
	mission.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
