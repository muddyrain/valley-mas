extends SceneTree
## A/B/C speed evidence. Changes only a duplicated runtime fixture resource.

const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Registry = preload("res://data/weapon_registry.gd")
const RUN_REFERENCE: float = 2.3065521202
const RUN_SOURCE_CADENCE: float = 180.0
const OUT: String = "res://test-output/xia-locomotion-speed-abc"

var mission: Node3D
var member: Node3D
var speed: float = 2.6
var view_name: String = "gameplay"
var capture_enabled: bool = false
var close_only: bool = false
var samples: Array[Dictionary] = []
var phase_times: Dictionary = {}
var frame_index: int = 0
var distance_total: float = 0.0
var movement_time: float = 0.0
var previous_position := Vector3.ZERO

func _initialize() -> void:
	call_deferred("run")

func _parse_arguments() -> void:
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--speed="):
			speed = float(argument.trim_prefix("--speed="))
		if argument.begins_with("--view="):
			view_name = argument.trim_prefix("--view=")
		if argument == "--capture":
			capture_enabled = true
		if argument == "--close-only":
			close_only = true

func _sample(label: String) -> void:
	var controller: Node3D = member.animation_controller
	var position: Vector3 = member.position
	var displacement: float = Vector2(position.x - previous_position.x, position.z - previous_position.z).length()
	distance_total += displacement
	if member.actual_velocity.length() > 0.01:
		movement_time += 1.0 / 60.0
	previous_position = position
	samples.append({
		"frame": frame_index,
		"phase": label,
		"position": [position.x, position.y, position.z],
		"speed": member.actual_velocity.length(),
		"state": String(controller.current_state),
		"playback_rate": controller.playback_rate,
		"clip_time": controller.character_locomotion.playback.get_current_play_position(),
		"yaw": member.rig.rotation.y
	})
	if capture_enabled:
		await RenderingServer.frame_post_draw
		var speed_tag: String = "%.1f" % speed
		var image: Image = root.get_texture().get_image()
		var gameplay_path: String = OUT + "/frames/" + speed_tag + "/gameplay"
		var close_path: String = OUT + "/frames/" + speed_tag + "/close"
		DirAccess.make_dir_recursive_absolute(gameplay_path)
		DirAccess.make_dir_recursive_absolute(close_path)
		if not close_only:
			image.save_png(gameplay_path + "/%05d.png" % frame_index)
		var crop_width: int = mini(180, image.get_width())
		var crop_height: int = mini(240, image.get_height())
		if view_name == "close":
			image.save_png(close_path + "/%05d.png" % frame_index)
		else:
			var screen_center: Vector2 = mission.camera.unproject_position(member.global_position + Vector3.UP * .8)
			var crop_x: int = clampi(int(screen_center.x - crop_width / 2), 0, image.get_width() - crop_width)
			var crop_y: int = clampi(int(screen_center.y - crop_height / 2), 0, image.get_height() - crop_height)
			var crop := image.get_region(Rect2i(crop_x, crop_y, crop_width, crop_height))
			crop.save_png(close_path + "/%05d.png" % frame_index)
	frame_index += 1

func _step(label: String, seconds: float) -> void:
	var frames: int = ceili(seconds * 60.0)
	for index: int in frames:
		mission._physics_process(1.0 / 60.0)
		await process_frame
		if index % 6 == 0:
			await _sample(label)

func _drive_to(target: Vector3, label: String, limit_seconds: float = 20.0) -> float:
	mission.command_move(target)
	var elapsed: float = 0.0
	var settled_frames: int = 0
	while elapsed < limit_seconds:
		mission._physics_process(1.0 / 60.0)
		await process_frame
		elapsed += 1.0 / 60.0
		if int(elapsed * 60.0) % 6 == 0:
			await _sample(label)
		if member.path.is_empty() and member.current_speed <= 0.001 and member.position.distance_to(target) < 0.10:
			settled_frames += 1
			if settled_frames >= 4:
				break
		else:
			settled_frames = 0
	return elapsed

func _median(values: Array[float]) -> float:
	if values.is_empty():
		return 0.0
	values.sort()
	return values[values.size() / 2]

func _metrics() -> Dictionary:
	var run_speeds: Array[float] = []
	var run_rates: Array[float] = []
	for sample: Dictionary in samples:
		if sample.state == "Run":
			run_speeds.append(float(sample.speed))
			run_rates.append(float(sample.playback_rate))
	var median_speed: float = _median(run_speeds)
	var median_rate: float = _median(run_rates)
	return {
		"actual_run_speed_mps": median_speed,
		"running_playback_multiplier": median_rate,
		"running_cadence_spm": RUN_SOURCE_CADENCE * median_rate,
		"formula_cadence_spm": RUN_SOURCE_CADENCE * speed / RUN_REFERENCE,
		"route_distance_m": distance_total,
		"moving_time_s": movement_time,
		"run_sample_count": run_speeds.size(),
		"walking_reference_mps": 1.2622571142,
		"running_reference_mps": RUN_REFERENCE
	}

func run() -> void:
	_parse_arguments()
	if not is_equal_approx(speed, 2.6) and not is_equal_approx(speed, 2.8) and not is_equal_approx(speed, 3.0):
		printerr("Speed must be 2.6, 2.8 or 3.0")
		quit(2)
		return
	create_timer(300).timeout.connect(func(): printerr("XIA SPEED A/B/C TIMEOUT"); quit(2))
	DirAccess.make_dir_recursive_absolute(OUT)
	var catalog := Catalog.new()
	mission = Mission.new()
	root.add_child(mission)
	var campaign := preload("res://core/campaign.gd").new(catalog)
	campaign.new_run(20260912, "scavenge", ["xia_zhiyao"])
	var loadout: Array[String] = [Registry.KNIFE]
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.set_physics_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	member = mission.survivors[0]
	member.data = member.data.duplicate(true)
	member.data.move_speed = speed
	member.equip(null)
	mission.camera.size = 14.0 if view_name == "gameplay" else 4.0
	mission.camera_controller.center_squad()
	await process_frame
	previous_position = member.position
	await _step("Idle 5s", 5.0)
	var start: Vector3 = member.position
	phase_times["short_move_s"] = await _drive_to(start + Vector3(2.0, 0, -1.0), "Short move")
	await _step("Arrive stop", .5)
	phase_times["long_straight_s"] = await _drive_to(start + Vector3(8.0, 0, -1.0), "Long straight")
	phase_times["90_degree_turn_s"] = await _drive_to(start + Vector3(8.0, 0, 4.0), "90 degree turn")
	phase_times["45_degree_turn_s"] = await _drive_to(start + Vector3(3.0, 0, 4.0), "45 degree turn")
	mission.command_move(start + Vector3(7.0, 0, 3.0))
	await _step("Continuous click 1", .55)
	mission.command_move(start + Vector3(4.0, 0, 1.0))
	await _step("Continuous click 2", .55)
	mission.command_move(start + Vector3(2.0, 0, 3.0))
	phase_times["continuous_click_s"] = await _drive_to(start + Vector3(2.0, 0, 3.0), "Continuous click 3")
	mission.command_stop()
	await _step("Run to Stop to Idle", 1.5)
	var report: Dictionary = {
		"speed_label": "A" if is_equal_approx(speed, 2.6) else "B" if is_equal_approx(speed, 2.8) else "C",
		"configured_base_speed_mps": speed,
		"approved_clips": ["idle.tres", "walking.tres", "running.tres"],
		"running_reference_mps": RUN_REFERENCE,
		"speed_formula": "actual_speed / animation_reference_speed",
		"phase_times_s": phase_times,
		"metrics": _metrics(),
		"same_distance_comparison": {"distance_m": 8.0, "expected_time_s": 8.0 / speed, "formula": "distance / actual_run_speed"},
		"final_state": String(member.animation_controller.current_state),
		"samples": samples
	}
	var tag: String = "%.1f" % speed
	var file := FileAccess.open(OUT + "/speed-" + tag + ".json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	file.close()
	print("XIA SPEED ", report.speed_label, ": ", JSON.stringify(report.metrics))
	mission.queue_free()
	await process_frame
	quit(0)
