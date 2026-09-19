extends SceneTree
## Bake character-specific poses into Animation resources on the existing rig.

const INPUT: String = "res://test-output/xia-zhiyao-locomotion/"
const OUTPUT: String = "res://assets/characters/xia_zhiyao/animations/"
const TARGET: String = "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"

func _initialize() -> void:
	call_deferred("run")

func matrix(rows: Array) -> Transform3D:
	return Transform3D(Basis(Vector3(rows[0][0], rows[1][0], rows[2][0]), Vector3(rows[0][1], rows[1][1], rows[2][1]), Vector3(rows[0][2], rows[1][2], rows[2][2])), Vector3(rows[0][3], rows[1][3], rows[2][3]))

func run() -> void:
	var actor: Node3D = (load(TARGET) as PackedScene).instantiate() as Node3D
	root.add_child(actor)
	await process_frame
	var skeleton: Skeleton3D = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	assert(skeleton.get_bone_count() == 23)
	var skeleton_path: String = str(actor.get_path_to(skeleton))
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var evidence: Dictionary = {}
	for name: String in ["idle", "walking", "running"]:
		var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(INPUT + name + "-baked.json"))
		assert(FileAccess.get_sha256(TARGET) == data.target_sha256)
		var source_path: String = "res://assets/characters/survivor_animation_template/animations/" + name + ".tres"
		assert(FileAccess.get_sha256(source_path) == data.source_sha256)
		var clip: Animation = Animation.new()
		clip.resource_name = name.capitalize()
		clip.length = data.length
		clip.step = data.step
		clip.loop_mode = Animation.LOOP_LINEAR
		clip.set_meta("source_animation", source_path)
		clip.set_meta("source_sha256", data.source_sha256)
		clip.set_meta("target_sha256", data.target_sha256)
		clip.set_meta("retarget_profile", "xia_zhiyao_locomotion")
		var position_track: int = clip.add_track(Animation.TYPE_POSITION_3D)
		clip.track_set_path(position_track, NodePath(skeleton_path + ":Hips"))
		for bone: int in skeleton.get_bone_count():
			assert(str(skeleton.get_bone_name(bone)) == data.target_names[bone])
			var track: int = clip.add_track(Animation.TYPE_ROTATION_3D)
			clip.track_set_path(track, NodePath(skeleton_path + ":" + str(skeleton.get_bone_name(bone))))
			clip.track_set_interpolation_type(track, Animation.INTERPOLATION_LINEAR)
		for sample: Dictionary in data.samples:
			var poses: Array[Transform3D] = []
			for rows: Array in sample.poses:
				poses.append(skeleton.global_transform.affine_inverse() * matrix(rows))
			for bone: int in skeleton.get_bone_count():
				var parent: int = skeleton.get_bone_parent(bone)
				var local_pose: Transform3D = poses[parent].affine_inverse() * poses[bone] if parent >= 0 else poses[bone]
				clip.rotation_track_insert_key(bone + 1, sample.time, local_pose.basis.orthonormalized().get_rotation_quaternion())
				if skeleton.get_bone_name(bone) == &"Hips":
					clip.position_track_insert_key(position_track, sample.time, local_pose.origin)
		assert(ResourceSaver.save(clip, OUTPUT + name + ".tres") == OK)
		evidence[name] = {"length": clip.length, "tracks": clip.get_track_count(), "samples": data.samples.size(), "source_sha256": data.source_sha256, "output": OUTPUT + name + ".tres"}
		print("RETARGET IMPORT ", name, ": ", evidence[name])
	var file: FileAccess = FileAccess.open(INPUT + "animation-export.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(evidence, "\t"))
	file.close()
	actor.queue_free()
	await process_frame
	quit()
