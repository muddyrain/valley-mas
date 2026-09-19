extends SceneTree
## Evaluate baked playback on the unchanged production Mesh/Skin, including subkeys.

const MODEL: String = "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"
const CLIPS: String = "res://assets/characters/xia_zhiyao/animations/"
const OUT: String = "res://test-output/xia-zhiyao-locomotion/"

var failures: Array[String] = []
var checks: int = 0
var skeleton: Skeleton3D
var points: Array[Dictionary] = []
var binds: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition and message not in failures:
		failures.append(message)

func setup_skin(actor: Node3D) -> void:
	for node: Node in actor.find_children("*", "MeshInstance3D", true, false):
		var mesh: MeshInstance3D = node as MeshInstance3D
		check(mesh.get_node(mesh.skeleton) == skeleton, "Original Skin resolves")
		check(mesh.skin.get_bind_count() == 23, "23 bind poses")
		var bind_offset: int = binds.size()
		for bind: int in mesh.skin.get_bind_count():
			var bone: int = skeleton.find_bone(mesh.skin.get_bind_name(bind))
			check(bone >= 0, "All named binds resolve")
			binds.append({"bone": bone, "pose": mesh.skin.get_bind_pose(bind)})
		for surface: int in mesh.mesh.get_surface_count():
			var arrays: Array = mesh.mesh.surface_get_arrays(surface)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
			var influence_count: int = weights.size() / vertices.size()
			for vertex: int in vertices.size():
				var world: Vector3 = mesh.global_transform * vertices[vertex]
				if world.y >= 0.06:
					continue
				var vertex_binds: Array[int] = []
				var factors: Array[float] = []
				for influence: int in influence_count:
					var offset: int = vertex * influence_count + influence
					vertex_binds.append(indices[offset] + bind_offset)
					factors.append(weights[offset])
				points.append({"vertex": vertices[vertex], "rest": world, "side": "Left" if world.x > 0 else "Right", "binds": vertex_binds, "weights": factors})
	for side: String in ["Left", "Right"]:
		var minimum: float = INF
		var maximum: float = -INF
		for point: Dictionary in points:
			if point.side == side:
				minimum = minf(minimum, point.rest.z)
				maximum = maxf(maximum, point.rest.z)
		for point: Dictionary in points:
			if point.side == side:
				point["heel"] = point.rest.z <= lerpf(minimum, maximum, 0.3)
				point["forefoot"] = point.rest.z >= lerpf(minimum, maximum, 0.7)

func contact() -> Dictionary:
	var transforms: Array[Transform3D] = []
	for bind: Dictionary in binds:
		transforms.append(skeleton.global_transform * skeleton.get_bone_global_pose(bind.bone) * bind.pose)
	var result: Dictionary = {"Left": {"sole": INF, "heel": INF, "forefoot": INF}, "Right": {"sole": INF, "heel": INF, "forefoot": INF}}
	for point: Dictionary in points:
		var position: Vector3 = Vector3.ZERO
		for influence: int in point.binds.size():
			position += (transforms[point.binds[influence]] * point.vertex) * point.weights[influence]
		result[point.side].sole = minf(result[point.side].sole, position.y)
		for part: String in ["heel", "forefoot"]:
			if point[part]:
				result[point.side][part] = minf(result[point.side][part], position.y)
	return result

func run() -> void:
	var actor: Node3D = (load(MODEL) as PackedScene).instantiate() as Node3D
	root.add_child(actor)
	await process_frame
	skeleton = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	check(skeleton.get_bone_count() == 23, "Original 23 bones")
	check(actor.transform.is_equal_approx(Transform3D.IDENTITY), "Original model identity")
	var rests: Array[Transform3D] = []
	for bone: int in skeleton.get_bone_count():
		rests.append(skeleton.get_bone_rest(bone))
	setup_skin(actor)
	var player: AnimationPlayer = AnimationPlayer.new()
	actor.add_child(player)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var library: AnimationLibrary = AnimationLibrary.new()
	player.add_animation_library("", library)
	var reports: Dictionary = {}
	for name: String in ["idle", "walking", "running"]:
		var expected: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OUT + name + "-baked.json"))
		var clip: Animation = load(CLIPS + name + ".tres") as Animation
		check(is_equal_approx(clip.length, expected.length), name + " unchanged duration")
		check(clip.loop_mode == Animation.LOOP_LINEAR, name + " loop resource")
		check(FileAccess.get_sha256(MODEL) == expected.target_sha256, "Production model unchanged")
		check(FileAccess.get_sha256(clip.get_meta("source_animation")) == expected.source_sha256, name + " source unchanged")
		for track: int in clip.get_track_count():
			var path: NodePath = clip.track_get_path(track)
			check(path.get_subname_count() == 1 and skeleton.find_bone(path.get_subname(0)) >= 0, name + " all target tracks resolve")
			check(clip.track_get_type(track) != Animation.TYPE_SCALE_3D, name + " no scaling")
			if clip.track_get_type(track) == Animation.TYPE_POSITION_3D:
				check(path.get_subname(0) == &"Hips", name + " only Hips translation")
			var first: Variant = clip.track_get_key_value(track, 0)
			var last: Variant = clip.track_get_key_value(track, clip.track_get_key_count(track) - 1)
			check(first.is_equal_approx(last), name + " endpoint tracks close")
		var playback: Animation = clip.duplicate() as Animation
		playback.loop_mode = Animation.LOOP_NONE
		library.add_animation(name, playback)
		player.play(name)
		player.advance(0.0)
		var samples: Array[Dictionary] = []
		var max_joint_error: float = 0.0
		var max_contact_error: float = 0.0
		var minimum: float = INF
		for frame: int in int(round(clip.length * 240)) + 1:
			var time: float = minf(clip.length, frame / 240.0)
			player.seek(time, true)
			skeleton.force_update_all_bone_transforms()
			var feet: Dictionary = contact()
			for side: String in ["Left", "Right"]:
				minimum = minf(minimum, feet[side].sole)
				check(feet[side].sole >= -0.003, name + " under 3mm penetration including subkeys")
				if name == "idle":
					check(feet[side].heel < 0.008 and feet[side].forefoot < 0.008, "Idle both soles contact")
				else:
					var strike: float = (7.0 / 24.0 if name == "walking" else 22.0 / 120.0) + (clip.length / 2.0 if side == "Right" else 0.0)
					var stance: float = 13.0 / 24.0 if name == "walking" else 28.0 / 120.0
					var landing: float = 2.0 / 24.0 if name == "walking" else 5.0 / 120.0
					var push: float = 3.0 / 24.0 if name == "walking" else 9.0 / 120.0
					var phase: float = fposmod(time - strike, clip.length)
					if phase <= stance - push + 0.00001:
						check(feet[side].heel < 0.008, name + " landing and flat heel contact")
					if phase >= landing - 0.00001 and phase <= stance + 0.00001:
						check(feet[side].forefoot < 0.008, name + " flat and push forefoot contact")
			if frame % 2 == 0:
				var sample: Dictionary = expected.samples[frame / 2]
				for bone: int in skeleton.get_bone_count():
					var position: Vector3 = (skeleton.global_transform * skeleton.get_bone_global_pose(bone)).origin
					var matrix_rows: Array = sample.poses[bone]
					var desired: Vector3 = Vector3(matrix_rows[0][3], matrix_rows[1][3], matrix_rows[2][3])
					max_joint_error = maxf(max_joint_error, position.distance_to(desired))
				for side: String in ["Left", "Right"]:
					for part: String in ["heel", "forefoot", "sole"]:
						max_contact_error = maxf(max_contact_error, absf(feet[side][part] - sample.feet[side][part]))
			check(skeleton.get_bone_pose(skeleton.find_bone("Root")).is_equal_approx(rests[skeleton.find_bone("Root")]), name + " Root fixed")
			samples.append({"time": time, "feet": feet})
		check(max_joint_error < 0.0002, name + " runtime joints match bake within 0.2mm")
		check(max_contact_error < 0.0002, name + " actual Skin matches bake within 0.2mm")
		reports[name] = {"max_joint_error_mm": max_joint_error * 1000, "max_skin_height_error_mm": max_contact_error * 1000, "minimum_sole_mm": minimum * 1000, "samples": samples}
		print(name, " runtime: joint=", max_joint_error * 1000, "mm; sole=", minimum * 1000, "mm")
	for bone: int in skeleton.get_bone_count():
		check(rests[bone].is_equal_approx(skeleton.get_bone_rest(bone)), "Rest preserved")
	for modifier: Node in actor.find_children("*", "SkeletonModifier3D", true, false):
		print("Imported modifier: ", modifier.get_class())
		check(not modifier.is_class("RetargetModifier3D") and not modifier.is_class("SkeletonIK3D") and not modifier.is_class("TwoBoneIK3D") and not modifier.is_class("ChainIK3D"), "No runtime retarget or IK")
	check(actor.transform.is_equal_approx(Transform3D.IDENTITY), "No model offset")
	var file: FileAccess = FileAccess.open(OUT + "runtime-validation.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks": checks, "failures": failures, "clips": reports}, "\t"))
	file.close()
	print("XIA LOCOMOTION: ", checks, " checks; failures=", failures)
	actor.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
