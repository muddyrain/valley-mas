extends SceneTree

const Review = preload("res://debug/humanoid_rig_review.gd")
const Controller = preload("res://survivors/survivor_animation_controller.gd")
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion")
	var library: AnimationLibrary = Controller.LIBRARY
	var expected: Array[StringName] = [&"Idle", &"Run", &"Walk"]
	check(library.get_animation_list() == expected, "Exactly three shared clips")
	for clip in library.get_animation_list():
		var animation := library.get_animation(clip)
		check(animation.loop_mode == Animation.LOOP_LINEAR, clip + ": looping")
		for track in animation.get_track_count():
			var path := animation.track_get_path(track)
			check(String(path).begins_with("Skeleton3D:"), "Only reference bone tracks")
			var first: Variant = animation.track_get_key_value(track, 0)
			var last: Variant = animation.track_get_key_value(track, animation.track_get_key_count(track) - 1)
			if animation.track_get_type(track) == Animation.TYPE_ROTATION_3D:
				check((first as Quaternion).angle_to(last as Quaternion) < .001, clip + ": seamless rotation endpoint")
			elif animation.track_get_type(track) == Animation.TYPE_POSITION_3D:
				check(path.get_subname(0) in [&"Root", &"Hips"], "No proportions in shared position tracks")
				check((first as Vector3).distance_to(last as Vector3) < .00001, clip + ": seamless position endpoint")
				for key in animation.track_get_key_count(track):
					var value: Vector3 = animation.track_get_key_value(track, key)
					check(absf(value.x - first.x) < .00001 and absf(value.z - first.z) < .00001, clip + ": in-place root/hips")
	var review := Review.new()
	root.add_child(review)
	review.set_process(false)
	await process_frame
	review.source.free()
	var su_scene: PackedScene = Review.Catalog.CHARACTERS[1]["rigged"]
	var su := su_scene.instantiate() as Node3D
	su.position.x = -.65
	review.add_child(su)
	review.source = su
	var controllers: Array[Node3D] = []
	for model: Node3D in [review.model, su]:
		var controller := Controller.new()
		model.add_child(controller)
		check(controller.initialize(model), "Attach to imported character skeleton")
		controllers.append(controller)
	check(controllers[0].player.get_animation_library(&"Humanoid") == controllers[1].player.get_animation_library(&"Humanoid"), "Both players share the same AnimationLibrary instance")
	check(controllers[0].playback != controllers[1].playback, "Playback state is per survivor")
	var original: Array[Transform3D] = [review.model.transform, su.transform]
	var capture := "capture" in OS.get_cmdline_user_args()
	var evidence: Dictionary = {}
	for clip in library.get_animation_list():
		for controller in controllers:
			controller.preview(clip)
		var samples: Array = []
		for frame in 16:
			for controller in controllers:
				controller.advance_preview(library.get_animation(clip).length / 16.0)
			await process_frame
			await process_frame
			var poses: Array = []
			for controller in controllers:
				var skeleton: Skeleton3D = controller.target
				var hip := skeleton.get_bone_global_pose(skeleton.find_bone("Hips"))
				var knee := skeleton.get_bone_global_pose(skeleton.find_bone("LeftLowerLeg"))
				check(hip.is_finite() and knee.is_finite(), "Retargeted pose is finite")
				poses.append({"hips": str(hip.origin), "knee": str(knee.origin)})
			check(review.model.transform == original[0] and su.transform == original[1], "Animation never moves a character root")
			samples.append(poses)
			if capture and frame % 2 == 0:
				review.pose_label.text = "%s · 苏晚星 / 夏知遥" % clip
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png("res://test-output/locomotion/%s-%02d.png" % [clip, frame])
		evidence[clip] = samples
	for controller in controllers:
		controller.preview(&"Idle")
		for frame in 12:
			controller.update_motion(4.2, 4.2, .05)
			await process_frame
		check(controller.playback.get_current_node() == &"Run", "Full movement speed selects Run")
		for frame in 12:
			controller.update_motion(1.3, 4.2, .05)
			await process_frame
		check(controller.playback.get_current_node() == &"Walk", "Slow movement selects Walk")
		for frame in 12:
			controller.update_motion(0, 4.2, .05)
			await process_frame
		check(controller.playback.get_current_node() == &"Idle", "Stopping blends back to Idle")
	var report := {"checks": checks, "failures": failures, "shared_library_instance": library.get_instance_id(), "samples": evidence, "native_capture": capture}
	FileAccess.open("res://test-output/locomotion/validation.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("HUMANOID ANIMATIONS: ", checks, " checks; failures=", failures)
	review.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
