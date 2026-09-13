extends SceneTree

const SOURCE := preload("res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion.glb")
const OUTPUT := "res://assets/characters/infected_basic_a/runtime/ENM_001_locomotion.tres"

func _initialize() -> void:
	call_deferred("run")

func find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var result := find_player(child)
		if result != null:
			return result
	return null

func run() -> void:
	var model := SOURCE.instantiate() as Node3D
	root.add_child(model)
	await process_frame
	var player := find_player(model)
	assert(player != null)
	var source_library := player.get_animation_library(&"")
	var library := AnimationLibrary.new()
	for clip_name in [&"Zombie_Idle", &"Zombie_Walk", &"Zombie_Chase"]:
		var animation := source_library.get_animation(clip_name).duplicate(true) as Animation
		animation.loop_mode = Animation.LOOP_LINEAR
		assert(library.add_animation(clip_name, animation) == OK)
	assert(ResourceSaver.save(library, OUTPUT) == OK)
	print("Saved looping ENM_001 library: ", library.get_animation_list())
	quit(0)
