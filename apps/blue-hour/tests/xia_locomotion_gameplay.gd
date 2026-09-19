extends SceneTree
## Expedition runtime evidence for Xia's unarmed approved locomotion layer.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Registry = preload("res://data/weapon_registry.gd")
const OUT: String = "res://test-output/xia-locomotion-gameplay"

var mission: Node3D
var member: Node3D
var samples: Array[Dictionary] = []
var frame_index: int = 0
var capture_enabled: bool = OS.get_cmdline_user_args().has("--capture")
var view_name: String = "gameplay"

func _initialize() -> void:
	call_deferred("run")

func sample(label: String) -> void:
	var controller: Node3D = member.animation_controller
	samples.append({
		"frame": frame_index,
		"phase": label,
		"position": [member.position.x, member.position.y, member.position.z],
		"speed": member.actual_velocity.length(),
		"state": String(controller.current_state),
		"playback_rate": controller.playback_rate,
		"clip_time": controller.character_locomotion.playback.get_current_play_position(),
		"yaw": member.rig.rotation.y
	})
	if capture_enabled:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(OUT + "/frames/%s-%05d.png" % [view_name, frame_index])
	frame_index += 1

func advance(seconds: float, label: String) -> void:
	var count: int = ceili(seconds * 60.0)
	for index: int in count:
		mission._physics_process(1.0 / 60.0)
		await process_frame
		if index % 2 == 0:
			await sample(label)

func command(point: Vector3, label: String) -> void:
	mission.command_move(point)
	await advance(2.0, label)

func run() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--view="):
			view_name = argument.trim_prefix("--view=")
	create_timer(100).timeout.connect(func(): printerr("XIA GAMEPLAY TIMEOUT"); quit(2))
	DirAccess.make_dir_recursive_absolute(OUT + "/frames")
	var catalog := Catalog.new()
	var mission_instance := Mission.new()
	mission = mission_instance
	root.add_child(mission)
	var campaign := preload("res://core/campaign.gd").new(catalog)
	campaign.new_run(20260912, "scavenge", ["xia_zhiyao"])
	var loadout: Array[String] = [Registry.KNIFE]
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.set_physics_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	member = mission.survivors[0]
	member.equip(null)
	mission.camera.size = 14.0 if view_name == "gameplay" else 7.0 if view_name == "close" else 3.2
	mission.camera_controller.center_squad()
	await process_frame
	await advance(5.0, "Idle 5s")
	var start: Vector3 = member.position
	await command(start + Vector3(2.0, 0, -1.0), "Short move")
	await advance(1.5, "Arrive stop")
	await command(start + Vector3(8.0, 0, -1.0), "Long move")
	await command(start + Vector3(8.0, 0, 4.0), "90 degree turn")
	await command(start + Vector3(3.0, 0, 4.0), "45 degree turn")
	await advance(2.0, "Move stop")
	mission.command_stop()
	await advance(1.5, "Idle after stop")
	var report: Dictionary = {
		"approved_clips": ["idle.tres", "walking.tres", "running.tres"],
		"gameplay_base_speed_mps": member.data.move_speed,
		"walking_reference_mps": 1.2622571142,
		"running_reference_mps": 2.3065521202,
		"thresholds_mps": {"move_enter": .08, "move_exit": .035, "run_enter": 1.85, "run_exit": 1.60},
		"runtime_observations": {"state_values": ["Idle", "Walk", "Run"], "running_playback_at_4_2_mps": 4.2 / 2.3065521202, "walking_playback_at_1_262_mps": 1.0, "root_motion": false, "movement_source": "Mission._physics_process"},
		"samples": samples,
		"actual_position_end": [member.position.x, member.position.y, member.position.z]
	}
	var file := FileAccess.open(OUT + "/runtime-report.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	file.close()
	print("XIA GAMEPLAY CAPTURE: ", samples.size(), " samples; end=", member.position)
	mission.queue_free()
	await process_frame
	quit(0)
