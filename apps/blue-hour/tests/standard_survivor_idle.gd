extends SceneTree
## Validate the baked clip using the canonical mesh, Skin and source rig.

const MODEL: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template.fbx"
const CLIP: String = "res://assets/characters/survivor_animation_template/animations/idle.tres"
const OUT: String = "res://test-output/standard-survivor-foot-contact/runtime-contact.json"

var failures: Array[String] = []
var checks: int = 0
var skeleton: Skeleton3D
var mesh: MeshInstance3D
var bind_bones: Array[int] = []
var points: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func xyz(value: Vector3) -> Array[float]:
	return [value.x, value.y, value.z]

func run() -> void:
	var actor: Node3D = (load(MODEL) as PackedScene).instantiate() as Node3D
	root.add_child(actor)
	await process_frame
	skeleton = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	mesh = actor.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D
	check(skeleton.get_bone_count() == 28, "Original 28 bones")
	check(actor.transform.is_equal_approx(Transform3D.IDENTITY), "Model root identity")
	check(mesh.get_node(mesh.skeleton) == skeleton, "Canonical Skin binding")
	var rests: Array[Transform3D] = []
	for bone: int in skeleton.get_bone_count():
		rests.append(skeleton.get_bone_rest(bone))
	for bind: int in mesh.skin.get_bind_count():
		bind_bones.append(skeleton.find_bone(mesh.skin.get_bind_name(bind)))
		check(bind_bones[-1] >= 0, "Bind resolves")
	var arrays: Array = mesh.mesh.surface_get_arrays(0)
	var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var indices: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
	var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
	var influences: int = weights.size() / vertices.size()
	var forward: Dictionary = {}
	var depth_limits: Dictionary = {"Left": [INF, -INF], "Right": [INF, -INF]}
	for side: String in ["Left", "Right"]:
		var foot: Vector3 = (skeleton.global_transform * skeleton.get_bone_global_rest(skeleton.find_bone("mixamorig_" + side + "Foot"))).origin
		var toe: Vector3 = (skeleton.global_transform * skeleton.get_bone_global_rest(skeleton.find_bone("mixamorig_" + side + "ToeBase"))).origin
		forward[side] = Vector3(toe.x-foot.x, 0, toe.z-foot.z).normalized()
	for vertex: int in vertices.size():
		var world: Vector3 = mesh.global_transform * vertices[vertex]
		if world.y >= 0.06:
			continue
		var side: String = "Left" if world.x > 0 else "Right"
		var depth: float = world.dot(forward[side])
		depth_limits[side][0] = minf(depth_limits[side][0], depth)
		depth_limits[side][1] = maxf(depth_limits[side][1], depth)
		var binds: Array[int] = []
		var factors: Array[float] = []
		for influence: int in influences:
			var offset: int = vertex * influences + influence
			binds.append(indices[offset])
			factors.append(weights[offset])
		points.append({"vertex": vertices[vertex], "side": side, "depth": depth, "binds": binds, "weights": factors})
	for point: Dictionary in points:
		var low: float = depth_limits[point.side][0]
		var high: float = depth_limits[point.side][1]
		point["heel"] = point.depth <= lerpf(low, high, 0.3)
		point["forefoot"] = point.depth >= lerpf(low, high, 0.7)
	var player: AnimationPlayer = AnimationPlayer.new()
	actor.add_child(player)
	var library: AnimationLibrary = AnimationLibrary.new()
	var clip: Animation = load(CLIP) as Animation
	library.add_animation("Idle_4", clip)
	player.add_animation_library("", library)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	player.play("Idle_4")
	player.advance(0.0)
	check(is_equal_approx(clip.length, 14.0), "14 second clip")
	var samples: Array[Dictionary] = []
	for frame: int in 841:
		player.seek(frame / 60.0, true)
		skeleton.force_update_all_bone_transforms()
		var transforms: Array[Transform3D] = []
		for bind: int in bind_bones.size():
			transforms.append(skeleton.global_transform * skeleton.get_bone_global_pose(bind_bones[bind]) * mesh.skin.get_bind_pose(bind))
		var feet: Dictionary = {"Left": {"heel": INF, "forefoot": INF, "sole": INF}, "Right": {"heel": INF, "forefoot": INF, "sole": INF}}
		for point: Dictionary in points:
			var position: Vector3 = Vector3.ZERO
			for influence: int in influences:
				position += (transforms[point.binds[influence]] * point.vertex) * point.weights[influence]
			feet[point.side].sole = minf(feet[point.side].sole, position.y)
			if point.heel:
				feet[point.side].heel = minf(feet[point.side].heel, position.y)
			if point.forefoot:
				feet[point.side].forefoot = minf(feet[point.side].forefoot, position.y)
		for side: String in ["Left", "Right"]:
			check(feet[side].heel >= -0.0001 and feet[side].heel <= 0.0031, side + " heel near floor")
			check(feet[side].forefoot >= -0.0001 and feet[side].forefoot <= 0.0031, side + " forefoot near floor")
			check(feet[side].sole >= -0.0001, side + " no sole penetration")
			var foot: int = skeleton.find_bone("mixamorig_" + side + "Foot")
			feet[side]["ankle"] = xyz((skeleton.global_transform * skeleton.get_bone_global_pose(foot)).origin)
		samples.append({"time": frame/60.0, "feet": feet})
		if frame % 240 == 0:
			print("CONTACT SAMPLE ", frame, "/840")
	for bone: int in skeleton.get_bone_count():
		check(rests[bone].is_equal_approx(skeleton.get_bone_rest(bone)), "Rest unchanged")
	check(actor.transform.is_equal_approx(Transform3D.IDENTITY), "No animated object offset")
	var report: Dictionary = {"checks": checks, "failures": failures, "samples": samples, "sole_vertex_count": points.size()}
	var file: FileAccess = FileAccess.open(OUT, FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	file.close()
	print("STANDARD IDLE CONTACT: ", checks, " checks; failures=", failures)
	actor.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
