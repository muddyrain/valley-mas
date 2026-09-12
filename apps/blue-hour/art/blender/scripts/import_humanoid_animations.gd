extends SceneTree
## Cook the Blender animation source into one shared library and reference skeleton.

const INPUT := "res://art/blender/animations/bh_humanoid_animations_v1.glb"
const OUTPUT := "res://assets/animations/humanoid/locomotion/"

func _initialize() -> void:
	call_deferred("run")

func find_type(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var found := find_type(child, type_name)
		if found != null:
			return found
	return null

func own_children(node: Node, scene: Node) -> void:
	for child in node.get_children():
		child.owner = scene
		own_children(child, scene)

func run() -> void:
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	assert(document.append_from_file(INPUT, state) == OK)
	var imported := document.generate_scene(state, 60.0, false, false)
	var skeleton := find_type(imported, "Skeleton3D") as Skeleton3D
	var player := find_type(imported, "AnimationPlayer") as AnimationPlayer
	assert(skeleton != null and skeleton.get_bone_count() == 23)
	assert(player != null)
	var metadata: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://art/blender/animations/bh_humanoid_animations_v1.json"))
	var library := AnimationLibrary.new()
	for name in player.get_animation_list():
		var clip := String(name).get_slice("/", String(name).get_slice_count("/") - 1)
		assert(clip in ["Idle", "Walk", "Run"], "Unexpected Blender action: " + clip)
		var animation := player.get_animation(name)
		for track in range(animation.get_track_count() - 1, -1, -1):
			var path := animation.track_get_path(track)
			var bone := String(path.get_subname(0)) if path.get_subname_count() > 0 else ""
			var type := animation.track_get_type(track)
			if skeleton.find_bone(bone) < 0 or type == Animation.TYPE_SCALE_3D or (type == Animation.TYPE_POSITION_3D and bone not in ["Root", "Hips"]):
				animation.remove_track(track)
				continue
			animation.track_set_path(track, NodePath("Skeleton3D:" + bone))
		animation.loop_mode = Animation.LOOP_LINEAR
		animation.set_meta("nominal_speed", metadata["clips"][clip]["nominal_speed"])
		animation.set_meta("rig_spec", "BH_Humanoid_Rig_v1")
		assert(library.add_animation(clip, animation) == OK)
	assert(library.get_animation_list().size() == 3)
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	assert(ResourceSaver.save(library, OUTPUT + "bh_humanoid_animations_v1.tres") == OK)
	# Transfer the imported skeleton, never create or rename its bones in Godot.
	var reference := Node3D.new()
	reference.name = "HumanoidReference"
	skeleton.owner = null
	skeleton.get_parent().remove_child(skeleton)
	reference.add_child(skeleton)
	skeleton.name = "Skeleton3D"
	for child in skeleton.get_children():
		child.free()
	skeleton.reset_bone_poses()
	own_children(reference, reference)
	var packed := PackedScene.new()
	assert(packed.pack(reference) == OK)
	assert(ResourceSaver.save(packed, OUTPUT + "bh_humanoid_reference.tscn") == OK)
	var machine := AnimationNodeStateMachine.new()
	var names: Array[String] = ["Idle", "Walk", "Run"]
	for i in names.size():
		var node := AnimationNodeAnimation.new()
		node.animation = "Humanoid/" + names[i]
		machine.add_node(names[i], node, Vector2(i * 180, 100))
	for from in names:
		for to in names:
			if from == to:
				continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = .18
			machine.add_transition(from, to, transition)
	var tree := AnimationNodeBlendTree.new()
	tree.add_node("Locomotion", machine, Vector2(0, 100))
	tree.add_node("Rate", AnimationNodeTimeScale.new(), Vector2(220, 100))
	tree.connect_node("Rate", 0, "Locomotion")
	tree.connect_node("output", 0, "Rate")
	assert(ResourceSaver.save(tree, OUTPUT + "bh_humanoid_locomotion_tree.tres") == OK)
	print("SHARED LIBRARY COOKED: ", library.get_animation_list(), "; reference bones=", skeleton.get_bone_count())
	reference.free()
	imported.free()
	quit()
