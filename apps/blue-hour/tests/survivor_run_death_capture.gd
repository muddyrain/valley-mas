extends SceneTree
## Captures the two remaining Survivor Animation checks in the formal Expedition.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Registry = preload("res://data/weapon_registry.gd")
const Provider = preload("res://maps/expedition/expedition_map_provider.gd")
const OUTPUT: String = "res://test-output/survivor-animation/expedition-runtime"

var checks: int = 0
var failures: Array[String] = []
var mission: Node3D
var member: Node3D
var camera_size: float = 0.0
var run_frames: int = 0
var run_max_hand_elevation: float = -INF
var death_final_hip_height: float = 0.0
var death_final_foot_heights: Array[float] = []
var death_final_foot_separation: float = 0.0
var capture_enabled: bool = false

func _initialize() -> void:
	capture_enabled = DisplayServer.get_name() != "headless"
	call_deferred("run")

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var catalog := Catalog.new()
	catalog.survivors = [load("res://data/survivors/xia_zhiyao.tres")]
	var loadout: Array[String] = [Registry.K9]
	var locked_party: Array[String] = []
	mission = Mission.new()
	root.add_child(mission)
	mission.setup(catalog, Ledger.new(), loadout, 4101, null, locked_party, {
		"map_provider": Provider.MEDIUM_TOWN_V1,
		"map_seed": 4101,
		"seed": 4101,
		"mission_type": "food_supply",
		"use_random_map": false,
	})
	var hud := HUD.new()
	root.add_child(hud)
	hud.setup(mission)
	mission.input_enabled = false
	mission.director_enabled = false
	mission.invincible = true
	for frame: int in 180:
		if mission.survivor_commands_enabled:
			break
		await process_frame
	check(mission.town_runtime_ready and mission.survivor_commands_enabled, "Formal Expedition is ready")
	if not mission.survivor_commands_enabled or mission.survivors.is_empty():
		_finish()
		return
	mission.set_physics_process(false)
	member = mission.survivors[0]
	check(member.data.survivor_id == "SUR_001", "Only Xia is captured")
	member.equip(null)
	camera_size = mission.camera.size
	check(is_equal_approx(camera_size, 23.0), "Formal Expedition camera size remains 23")
	var destination: Vector3 = mission.city.navigation.nearest(member.position + Vector3(0.0, 0.0, -13.0))
	check(mission.command_move(destination), "Formal navigation starts unarmed Run")
	var target: Skeleton3D = member.animation_controller.target
	var left_hand: int = target.find_bone("LeftHand")
	var right_hand: int = target.find_bone("RightHand")
	var left_shoulder: int = target.find_bone("LeftShoulder")
	var right_shoulder: int = target.find_bone("RightShoulder")
	for frame: int in 240:
		mission._physics_process(1.0 / 60.0)
		await process_frame
		if member.animation_controller.active_state == &"RUN":
			run_frames += 1
			if frame >= 20:
				run_max_hand_elevation = maxf(run_max_hand_elevation, maxf(
					target.get_bone_global_pose(left_hand).origin.y - target.get_bone_global_pose(left_shoulder).origin.y,
					target.get_bone_global_pose(right_hand).origin.y - target.get_bone_global_pose(right_shoulder).origin.y))
		if frame == 120 and capture_enabled:
			await _capture("expedition_run_final.png")
	check(run_frames >= 180, "Run loops under formal navigation")
	check(run_max_hand_elevation < 0.03, "Run hands do not rise above the shoulders")
	mission.command_stop()
	for frame: int in 20:
		mission._physics_process(1.0 / 60.0)
		await process_frame
	member.take_damage(10000.0)
	check(member.dead and member.animation_controller.active_state == &"DEATH", "Formal lethal damage starts Death")
	mission.active = false
	var death_length: float = member.animation_controller.library.get_animation(&"death").length
	for frame: int in ceili((death_length + 0.4) * 60.0):
		member.animation_controller._process(1.0 / 60.0)
		await process_frame
	check(member.animation_controller.active_state == &"DEATH", "Death remains terminal")
	check(member.animation_controller.playback.get_current_play_position() >= death_length - 0.05, "Full Death reaches the last frame")
	death_final_hip_height = target.get_bone_global_pose(target.find_bone("Hips")).origin.y
	death_final_foot_heights = [
		target.get_bone_global_pose(target.find_bone("LeftFoot")).origin.y,
		target.get_bone_global_pose(target.find_bone("RightFoot")).origin.y,
	]
	var left_foot: Vector3 = target.get_bone_global_pose(target.find_bone("LeftFoot")).origin
	var right_foot: Vector3 = target.get_bone_global_pose(target.find_bone("RightFoot")).origin
	death_final_foot_separation = Vector2(left_foot.x, left_foot.z).distance_to(Vector2(right_foot.x, right_foot.z))
	check(death_final_hip_height < 0.3, "Death pelvis reaches ground level")
	check(maxf(death_final_foot_heights[0], death_final_foot_heights[1]) < 0.3, "Both Death feet settle near ground")
	check(death_final_foot_separation < 0.5, "Death legs finish without a wide split")
	if capture_enabled:
		await _capture("expedition_death_final.png")
	_finish()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _capture(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	check(image != null and image.save_png(OUTPUT + "/" + file_name) == OK, "Native screenshot saved: " + file_name)

func _finish() -> void:
	if capture_enabled:
		for file_name: String in ["expedition_run_final.png", "expedition_death_final.png"]:
			check(FileAccess.file_exists(OUTPUT + "/" + file_name), "Native screenshot exists: " + file_name)
	FileAccess.open(OUTPUT + "/run_death_final_runtime.json", FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks,
		"failures": failures,
		"camera_size": camera_size,
		"run_frames": run_frames,
		"run_max_hand_elevation": run_max_hand_elevation,
		"death_final_hip_height": death_final_hip_height,
		"death_final_foot_heights": death_final_foot_heights,
		"death_final_foot_separation": death_final_foot_separation,
	}, "\t"))
	print("SURVIVOR RUN DEATH FINAL: %d checks; failures=%s" % [checks, failures])
	quit(0 if failures.is_empty() else 1)
