extends SceneTree
## Safety contracts, not aesthetic thresholds: visual approval belongs to the film.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const V2 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
const BASELINE = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_0.tres")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var clip := V2.get_animation(&"mission_jog")
	var before := BASELINE.get_animation(&"mission_jog")
	check(is_equal_approx(clip.length, before.length), "Polish retains the V2 cycle duration")
	check(is_equal_approx(clip.get_meta("nominal_speed"), before.get_meta("nominal_speed")), "Polish retains the V2 cadence calculation")
	check(is_equal_approx(clip.get_meta("stance_ratio"), before.get_meta("stance_ratio")), "Polish retains the V2 stance ratio")
	check(clip.loop_mode == Animation.LOOP_LINEAR, "V2 loops")
	for track in clip.get_track_count():
		var bone := String(clip.track_get_path(track).get_subname(0))
		var kind := clip.track_get_type(track)
		check(kind in [Animation.TYPE_ROTATION_3D, Animation.TYPE_POSITION_3D], "No scale, root motion, or gameplay events")
		if kind == Animation.TYPE_POSITION_3D:
			check(bone == "Hips", "Only Hips can shift vertically")
			var first: Vector3 = clip.track_get_key_value(track, 0)
			var last: Vector3 = clip.track_get_key_value(track, clip.track_get_key_count(track) - 1)
			check(first.is_equal_approx(last), "Hips compression closes the loop without a jump")
			for key in clip.track_get_key_count(track):
				var position: Vector3 = clip.track_get_key_value(track, key)
				check(is_zero_approx(position.x) and is_zero_approx(position.z), "No horizontal bone travel")
		else:
			var first: Quaternion = clip.track_get_key_value(track, 0)
			var last: Quaternion = clip.track_get_key_value(track, clip.track_get_key_count(track) - 1)
			check(first.is_equal_approx(last), "Seamless rotation loop: " + bone)
			if bone == "Root":
				for key in clip.track_get_key_count(track):
					check((clip.track_get_key_value(track, key) as Quaternion).is_equal_approx(Quaternion.IDENTITY), "Root orientation stays fixed")
	var catalog := Catalog.new()
	var stage := Node3D.new()
	root.add_child(stage)
	stage.set_physics_process(false)
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var spec: Resource = load("res://data/survivors/" + id + ".tres")
		var actor := Survivor.new()
		stage.add_child(actor)
		actor.setup(spec, catalog.by_id(catalog.traits, spec.trait_id), null)
		var controller: Node3D = actor.animation_controller
		controller.use_render_clock(actor, stage)
		for frame in 30:
			controller.update_motion(4.2, 4.2, 1.0 / 60)
		check(controller.tree.get("parameters/Locomotion/mission_jog/Version/blend_amount") == 1.0, id + ": unarmed Mission uses V2")
		check(actor.position == Vector3.ZERO and actor.current_speed == 0.0, "Animation cannot drive gameplay")
		actor.equip(catalog.weapons[0])
		for frame in 30:
			controller.update_motion(4.2, 4.2, 1.0 / 60)
		check(controller.tree.get("parameters/Locomotion/mission_jog/Version/blend_amount") == 0.0, "Equipped Mission keeps V1")
		controller.use_render_clock(actor, null)
		controller.use_camp_style()
		for frame in 30:
			controller.update_motion(2.7, 4.2, 1.0 / 60)
		check(controller.current_state == &"Walk", "Camp retains Walk")
		actor.free()
	stage.free()
	print("MISSION JOG V2: ", checks, " checks, ", failures.size(), " failures")
	await process_frame
	quit(0 if failures.is_empty() else 1)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)
