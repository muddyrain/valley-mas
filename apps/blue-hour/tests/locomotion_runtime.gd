extends SceneTree
## Real mission/city/camera, with deterministic input and isolated test resources.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
var mission: Node3D
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func advance(frames: int, phase: String) -> void:
	for frame in frames:
		mission._physics_process(1.0 / 60)
		await process_frame
		if frame % 12 == 0:
			for member in mission.survivors:
				check(member.rig.position.is_equal_approx(Vector3.ZERO), phase + ": no model bob")
				check(member.animation_controller.target.get_bone_global_pose(0).origin.length() < .001, phase + ": no root motion")
		if frame % 6 == 0 and frame < 60:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png("res://test-output/locomotion/game-%s-%02d.png" % [phase, frame])

func capture(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/locomotion/" + name + ".png")

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion")
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres"), load("res://data/survivors/su_wanxing.tres")]
	mission = Mission.new()
	root.add_child(mission)
	# Resolve logical loadout names through the catalogue so this test also runs
	# before the parallel weapon-registry migration has been committed.
	var weapons: Array[String] = [catalog.by_id(catalog.weapons, "pistol").id, catalog.by_id(catalog.weapons, "smg").id]
	mission.setup(catalog, Ledger.new(), weapons, 7312)
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	mission.debug_clear_enemies()
	for i in mission.survivors.size():
		mission.survivors[i].position = mission.city.nearest_open(Vector3(0, 0, 6) + mission.formation(i))
	mission.center_squad()
	await advance(60, "Idle")
	await capture("game-default-camera")
	var default_camera_size: float = mission.camera.size
	# Only the test view zooms in; retain the actual mission camera angle/rendering.
	mission.camera.size = 14
	mission.effects.set_source("test_slow", {"move_speed": .30})
	mission.command_move(Vector3(0, 0, -9))
	await advance(90, "Walk")
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Walk", "Live debuff selects shared Walk")
	mission.center_squad()
	await capture("game-walk")
	mission.effects.remove_source("test_slow")
	await advance(90, "Run")
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Run", "Live base speed selects shared Run")
	mission.center_squad()
	await capture("game-run")
	mission.command_stop()
	await advance(30, "Stopped")
	for member in mission.survivors:
		check(member.animation_controller.playback.get_current_node() == &"Idle", "Live stop returns to shared Idle")
	await capture("game-stopped")
	var report := {"checks": checks, "failures": failures, "default_camera_size": default_camera_size, "detail_camera_size": 14, "actual_mission_renderer": true}
	FileAccess.open("res://test-output/locomotion/runtime-validation.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("LOCOMOTION RUNTIME: ", report)
	mission.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
