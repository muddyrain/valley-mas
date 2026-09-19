extends SceneTree
## Sample only approved Animation resources and the unchanged production rig.

const OUT: String = "res://test-output/canonical-public-locomotion/"
const SOURCE: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template.fbx"
const CLIPS: String = "res://assets/characters/survivor_animation_template/animations/"

func _initialize() -> void:
	call_deferred("run")

func vector(value: Vector3) -> Array[float]:
	return [value.x, value.y, value.z]

func matrix(value: Transform3D) -> Array:
	return [[value.basis.x.x, value.basis.y.x, value.basis.z.x, value.origin.x],
		[value.basis.x.y, value.basis.y.y, value.basis.z.y, value.origin.y],
		[value.basis.x.z, value.basis.y.z, value.basis.z.z, value.origin.z], [0, 0, 0, 1]]

func describe(actor: Node3D) -> Dictionary:
	var skeleton: Skeleton3D = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	skeleton.reset_bone_poses()
	var bones: Array[Dictionary] = []
	for index: int in skeleton.get_bone_count():
		bones.append({"name": str(skeleton.get_bone_name(index)), "parent": skeleton.get_bone_parent(index), "rest": matrix(skeleton.get_bone_rest(index)), "world": matrix(skeleton.global_transform * skeleton.get_bone_global_rest(index))})
	var meshes: Array[Dictionary] = []
	for node: Node in actor.find_children("*", "MeshInstance3D", true, false):
		var mesh: MeshInstance3D = node as MeshInstance3D
		assert(mesh.skin != null and mesh.get_node(mesh.skeleton) == skeleton)
		var binds: Array[Dictionary] = []
		for bind: int in mesh.skin.get_bind_count():
			binds.append({"bone": skeleton.find_bone(mesh.skin.get_bind_name(bind)), "pose": matrix(mesh.skin.get_bind_pose(bind))})
		for surface: int in mesh.mesh.get_surface_count():
			var arrays: Array = mesh.mesh.surface_get_arrays(surface)
			var vertices: Array = []
			for vertex: Vector3 in arrays[Mesh.ARRAY_VERTEX]:
				vertices.append(vector(vertex))
			meshes.append({"name": str(mesh.name), "world": matrix(mesh.global_transform), "binds": binds, "vertices": vertices, "weights": Array(arrays[Mesh.ARRAY_WEIGHTS]), "indices": Array(arrays[Mesh.ARRAY_BONES])})
	return {"bones": bones, "skeleton_world": matrix(skeleton.global_transform), "skeleton_path": str(actor.get_path_to(skeleton)), "meshes": meshes}

func save_json(path: String, value: Dictionary) -> void:
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	assert(file != null)
	file.store_string(JSON.stringify(value))
	file.close()

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var source: Node3D = (load(SOURCE) as PackedScene).instantiate() as Node3D
	root.add_child(source)
	await process_frame
	save_json(OUT + "source-rig.json", {"source": describe(source)})
	var skeleton: Skeleton3D = source.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	var player: AnimationPlayer = AnimationPlayer.new()
	source.add_child(player)
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var library: AnimationLibrary = AnimationLibrary.new()
	player.add_animation_library("", library)
	for name: String in ["idle", "walking", "running"]:
		var clip: Animation = load(CLIPS + name + ".tres") as Animation
		library.add_animation(name, clip)
		player.play(name)
		player.advance(0.0)
		var samples: Array[Dictionary] = []
		for frame: int in int(round(clip.length * 120.0)) + 1:
			var time: float = minf(clip.length, frame / 120.0)
			player.seek(time, true)
			skeleton.force_update_all_bone_transforms()
			var poses: Array = []
			for bone: int in skeleton.get_bone_count():
				poses.append(matrix(skeleton.global_transform * skeleton.get_bone_global_pose(bone)))
			samples.append({"time": time, "poses": poses})
		save_json(OUT + name + "-source.json", {"name": name, "length": clip.length, "step": clip.step, "samples": samples, "source_sha256": FileAccess.get_sha256(CLIPS + name + ".tres")})
		print("EXPORTED ", name, ": ", samples.size(), " poses from approved .tres")
	source.queue_free()
	await process_frame
	quit()
