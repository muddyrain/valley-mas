extends SceneTree
## Preserve the approved poses and measure the swing; the films decide appearance.
const V21 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
const TRANSITIONS = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions.tres")
const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const V22_PATH := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_2.tres"
const START_PATH := "res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions_v2_2.tres"
var checks: int = 0
var failures: Array[String] = []
var output_path: String = "res://test-output/locomotion-v2_2"

func _initialize() -> void:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--artifact-path="):
			output_path = argument.trim_prefix("--artifact-path=")
	call_deferred("run")

func run() -> void:
	check(ResourceLoader.exists(V22_PATH) and ResourceLoader.exists(START_PATH), "V2.2 has separate resources; V2.1 remains available")
	if not failures.is_empty():
		finish()
		return
	var after := (load(V22_PATH) as AnimationLibrary).get_animation(&"mission_jog")
	var before := V21.get_animation(&"mission_jog")
	check(after.length == before.length and after.loop_mode == before.loop_mode, "Same phase domain and looping")
	check(after.get_meta("nominal_speed") == before.get_meta("nominal_speed"), "Gameplay-to-contact speed calibration is unchanged")
	for track in before.get_track_count():
		var name := String(before.track_get_path(track).get_subname(0))
		var changed_leg := name.ends_with("UpperLeg") or name.ends_with("LowerLeg") or name.ends_with("Foot")
		if not changed_leg:
			check(track_signature(before, track) == track_signature(after, track), "Locked body/toes track: " + name)
		else:
			for frame in 401:
				var phase := float(frame) / 400.0
				var leg_phase := fposmod(phase + (.5 if name.begins_with("Right") else 0.0), 1.0)
				if leg_phase <= .38:
					check(before.rotation_track_interpolate(track, phase * .7).is_equal_approx(after.rotation_track_interpolate(track, phase * .7)), "Contact/compression/push off unchanged: " + name)
	var reference := Reference.instantiate()
	root.add_child(reference)
	var skeleton := reference.get_node("Skeleton3D") as Skeleton3D
	var metrics_before := measure(before, skeleton)
	var metrics_after := measure(after, skeleton)
	check(float(metrics_after.front_foot_lift) < float(metrics_before.front_foot_lift) - .045, "Forward swing is lower")
	check(float(metrics_after.rear_foot_lift) >= .20, "Rear heel recovery remains visible")
	check(float(metrics_after.rear_foot_lift) <= .225, "First-pass foot ceiling stays near 0.20-0.22m")
	check(float(metrics_after.max_thigh_angle) < float(metrics_before.max_thigh_angle) - 4.0, "Knee drive is less upward")
	check(float(metrics_after.min_swing_clearance) > -.01, "Swing does not sink through the ground")
	reference.free()
	var transitions := load(START_PATH) as AnimationLibrary
	for name: StringName in [&"jog_start", &"jog_stop_left", &"jog_stop_right"]:
		var old := TRANSITIONS.get_animation(name)
		var clip := transitions.get_animation(name)
		check(old.length == clip.length, "Transition duration retained: " + name)
		for track in old.get_track_count():
			var bone := String(old.track_get_path(track).get_subname(0))
			var leg := bone.ends_with("UpperLeg") or bone.ends_with("LowerLeg") or bone.ends_with("Foot")
			if name != &"jog_start" or not leg:
				check(track_signature(old, track) == track_signature(clip, track), "Stop and non-leg Start are locked: " + name + "/" + bone)
			else:
				for key in old.track_get_key_count(track):
					if old.track_get_key_time(track, key) <= .192:
						check(old.track_get_key_value(track, key) == clip.track_get_key_value(track, key), "Start changes only in its last 48ms")
				check(clip.rotation_track_interpolate(track, clip.length).is_equal_approx(after.rotation_track_interpolate(track, .35 * .7)), "Start endpoint aligns with V2.2: " + bone)
	await verify_runtime()
	var report := {"checks": checks, "failures": failures, "v2_1": metrics_before, "v2_2": metrics_after}
	DirAccess.make_dir_recursive_absolute(output_path)
	FileAccess.open(output_path.path_join("curve-checks.json"), FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("SWING METRICS: front lift ", metrics_before.front_foot_lift, " -> ", metrics_after.front_foot_lift, "; thigh ", metrics_before.max_thigh_angle, " -> ", metrics_after.max_thigh_angle, "; rear=", metrics_after.rear_foot_lift)
	finish()

func measure(clip: Animation, skeleton: Skeleton3D) -> Dictionary:
	var metrics := {"front_foot_lift": 0.0, "rear_foot_lift": 0.0, "max_thigh_angle": 0.0, "min_swing_clearance": 100.0}
	var samples: Array[Dictionary] = []
	for frame in 801:
		var phase := float(frame) / 800.0
		for track in clip.get_track_count():
			var bone := skeleton.find_bone(String(clip.track_get_path(track).get_subname(0)))
			if clip.track_get_type(track) == Animation.TYPE_ROTATION_3D:
				skeleton.set_bone_pose_rotation(bone, clip.rotation_track_interpolate(track, phase * .7))
			else:
				skeleton.set_bone_pose_position(bone, clip.position_track_interpolate(track, phase * .7))
		var foot := skeleton.get_bone_global_pose(skeleton.find_bone("LeftFoot")).origin
		var knee := skeleton.get_bone_global_pose(skeleton.find_bone("LeftLowerLeg")).origin
		var hip := skeleton.get_bone_global_pose(skeleton.find_bone("LeftUpperLeg")).origin
		var thigh := rad_to_deg(atan2(knee.z - hip.z, hip.y - knee.y))
		if phase > .38:
			var category := "front_foot_lift" if foot.z > 0 else "rear_foot_lift"
			metrics[category] = maxf(metrics[category], foot.y - .16)
			metrics.max_thigh_angle = maxf(metrics.max_thigh_angle, thigh)
			metrics.min_swing_clearance = minf(metrics.min_swing_clearance, foot.y - .16)
		samples.append({"phase": phase, "foot": [foot.x, foot.y, foot.z], "knee": [knee.x, knee.y, knee.z], "thigh_degrees": thigh})
	metrics.samples = samples
	return metrics

func verify_runtime() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	stage.set_physics_process(false)
	var actor := Survivor.new()
	stage.add_child(actor)
	var catalog := Catalog.new()
	var spec: Resource = load("res://data/survivors/xia_zhiyao.tres")
	actor.setup(spec, catalog.by_id(catalog.traits, spec.trait_id), null)
	actor.path = PackedVector3Array([Vector3(0, 0, -100)])
	actor.actual_velocity = Vector3.FORWARD * 4.2
	var controller: Node3D = actor.animation_controller
	controller.use_render_clock(actor, stage)
	controller.set_jog_cadence(&"natural")
	for frame in 90:
		controller.update_motion(4.2, 4.2, 1.0 / 60.0)
		await process_frame
	var layer: SkeletonModifier3D = controller.locomotion_layer
	for fps: int in [30, 60, 144]:
		var cycles := 0.0
		var elapsed := 0.0
		while elapsed < 5.1 - .000001:
			var delta := minf(1.0 / fps, 5.1 - elapsed)
			var old_phase: float = layer.locomotion_phase
			controller.update_motion(4.2, 4.2, delta)
			await process_frame
			cycles += fposmod(layer.locomotion_phase - old_phase, 1.0)
			elapsed += delta
		check(absf(cycles - 10.0) < .003, "C completes ten cycles in 5.1s at " + str(fps) + "fps")
	for profile: StringName in [&"polish", &"natural", &"current", &"natural"]:
		var phase: float = layer.locomotion_phase
		var starts: int = layer.start_count
		controller.set_jog_cadence(profile)
		controller.update_motion(4.2, 4.2, 1.0 / 60.0)
		await process_frame
		check(fposmod(layer.locomotion_phase - phase, 1.0) < .08 and layer.start_count == starts, "Cadence switch continues phase: " + profile)
	check(actor.position == Vector3.ZERO and actor.current_speed == 0, "C cannot move the gameplay body")
	actor.equip(catalog.weapons[0])
	for frame in 20:
		controller.update_motion(4.2, 4.2, 1.0 / 60.0)
		await process_frame
	check(not layer.presenting, "C bypasses equipped locomotion")
	stage.free()
	await process_frame

func track_signature(clip: Animation, track: int) -> String:
	var values: Array = [clip.track_get_path(track), clip.track_get_type(track), clip.track_get_interpolation_type(track)]
	for key in clip.track_get_key_count(track):
		values.append([clip.track_get_key_time(track, key), clip.track_get_key_value(track, key)])
	return var_to_bytes(values).hex_encode().sha256_text()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value and not failures.has(message):
		failures.append(message)
		push_error(message)

func finish() -> void:
	print("MISSION JOG V2.2: ", checks, " checks; failures=", failures)
	quit(0 if failures.is_empty() else 1)
