extends SceneTree

const ASSET := preload("res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_locomotion.glb")
const LOOP_LIBRARY := preload("res://assets/characters/infected_basic_a/runtime/ENM_001_locomotion.tres")

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
	var model := ASSET.instantiate() as Node3D
	root.add_child(model)
	await process_frame
	var player := find_player(model)
	var result: Dictionary = {"animation_player": player != null, "clips": {}}
	if player == null:
		quit(1)
	for clip_name in [&"Zombie_Idle", &"Zombie_Walk", &"Zombie_Chase"]:
		var animation := LOOP_LIBRARY.get_animation(clip_name)
		result["clips"][clip_name] = {"length": animation.length, "loop": animation.loop_mode != Animation.LOOP_NONE}
		player.play(clip_name)
		await process_frame
		await process_frame
	var file := FileAccess.open("res://test-output/rigging/enm_001_locomotion_runtime.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(result, "  ") + "\n")
	print(JSON.stringify(result, "  "))
	quit(0)
