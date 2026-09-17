extends SceneTree
## Convert Blender's baked poses to tracks on the unchanged source skeleton.

const SOURCE: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template.fbx"
const INPUT: String = "res://test-output/standard-survivor-walking-contact/baked-pose.json"
const OUTPUT: String = "res://assets/characters/survivor_animation_template/animations/walking.tres"
const EVIDENCE: String = "res://test-output/standard-survivor-walking-contact/animation-export.json"

func _initialize() -> void:
	call_deferred("run")

func matrix(rows: Array) -> Transform3D:
	return Transform3D(Basis(Vector3(rows[0][0], rows[1][0], rows[2][0]), Vector3(rows[0][1], rows[1][1], rows[2][1]), Vector3(rows[0][2], rows[1][2], rows[2][2])), Vector3(rows[0][3], rows[1][3], rows[2][3]))

func run() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(INPUT))
	assert(data.source_sha256 == FileAccess.get_sha256(SOURCE))
	assert(data.rest_unchanged and data.object_transforms_unchanged and data.constraints_remaining == 0)
	var document: FBXDocument = FBXDocument.new()
	var state: FBXState = FBXState.new()
	assert(document.append_from_file(SOURCE, state) == OK)
	var actor: Node3D = document.generate_scene(state, 24.0, true, false)
	root.add_child(actor)
	var skeleton: Skeleton3D = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
	var player: AnimationPlayer = actor.find_children("*", "AnimationPlayer", true, false)[0] as AnimationPlayer
	var original: Animation = player.get_animation("Walking")
	var result: Animation = original.duplicate() as Animation
	result.resource_name = "Walking"
	result.loop_mode = Animation.LOOP_LINEAR
	var coordinate: Transform3D = Transform3D(Basis(Vector3.RIGHT, Vector3(0, 0, -1), Vector3.UP), Vector3.ZERO)
	var inverse_skeleton: Transform3D = skeleton.global_transform.affine_inverse()
	var tracks: Dictionary = {}
	var changed_paths: Array[String] = []
	for track: int in result.get_track_count():
		var path: NodePath = result.track_get_path(track)
		if path.get_subname_count() == 0:
			continue
		var bone_name: String = str(path.get_subname(0)).trim_prefix("mixamorig_")
		var edited: bool = ("mixamorig:" + bone_name) in data.edited_bones
		if bone_name == "Hips" and result.track_get_type(track) == Animation.TYPE_POSITION_3D:
			edited = true
		if not edited:
			continue
		var bone: int = skeleton.find_bone("mixamorig_" + bone_name)
		assert(bone >= 0)
		tracks[track] = bone
		changed_paths.append(str(path) + ":" + str(result.track_get_type(track)))
		for key: int in range(result.track_get_key_count(track)-1, -1, -1):
			result.track_remove_key(track, key)
		result.track_set_interpolation_type(track, Animation.INTERPOLATION_LINEAR)
	for sample: Dictionary in data.samples:
		var poses: Array[Transform3D] = []
		for bone: int in skeleton.get_bone_count():
			var bone_name: String = skeleton.get_bone_name(bone).trim_prefix("mixamorig_")
			var deformation: Transform3D = matrix(sample.bones[bone_name]) * matrix(data.rest_world[bone_name]).affine_inverse()
			var world: Transform3D = coordinate * deformation * coordinate.affine_inverse() * skeleton.global_transform * skeleton.get_bone_global_rest(bone)
			poses.append(inverse_skeleton * world)
		for track: int in tracks:
			var bone: int = tracks[track]
			var parent: int = skeleton.get_bone_parent(bone)
			var local_pose: Transform3D = poses[parent].affine_inverse() * poses[bone] if parent >= 0 else poses[bone]
			match result.track_get_type(track):
				Animation.TYPE_POSITION_3D:
					result.position_track_insert_key(track, sample.time, local_pose.origin)
				Animation.TYPE_ROTATION_3D:
					result.rotation_track_insert_key(track, sample.time, local_pose.basis.get_rotation_quaternion())
				Animation.TYPE_SCALE_3D:
					result.scale_track_insert_key(track, sample.time, local_pose.basis.get_scale())
	var preserved: int = 0
	for track: int in original.get_track_count():
		if tracks.has(track):
			continue
		assert(original.track_get_key_count(track) == result.track_get_key_count(track))
		for key: int in original.track_get_key_count(track):
			assert(original.track_get_key_time(track, key) == result.track_get_key_time(track, key))
			assert(original.track_get_key_value(track, key) == result.track_get_key_value(track, key))
		preserved += 1
	assert(is_equal_approx(result.length, 25.0 / 24.0))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT.get_base_dir()))
	assert(ResourceSaver.save(result, OUTPUT) == OK)
	var evidence: Dictionary = {"duration": result.length, "tracks": result.get_track_count(), "changed_tracks": changed_paths, "unchanged_tracks": preserved, "frames_per_changed_track": data.samples.size(), "path": OUTPUT, "source_sha256": data.source_sha256}
	var file: FileAccess = FileAccess.open(EVIDENCE, FileAccess.WRITE)
	file.store_string(JSON.stringify(evidence, "\t"))
	file.close()
	print("WALKING EXPORT: ", evidence)
	actor.queue_free()
	await process_frame
	quit()
