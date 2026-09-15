extends SceneTree

const TEMPLATE := preload("res://assets/characters/survivor_animation_template/survivor_animation_template.tscn")
const STATES: Array[StringName] = [&"idle_relaxed", &"walk_forward", &"jog_forward", &"run_forward", &"jog_forward", &"idle_relaxed"]

func _init() -> void:
	var instance := TEMPLATE.instantiate()
	root.add_child(instance)
	await process_frame
	var player := _find_player(instance)
	if player == null:
		printerr("SEQUENCE_FAIL: AnimationPlayer missing")
		quit(1)
		return
	var library := player.get_animation_library(&"")
	for animation_name: StringName in STATES:
		if not library.has_animation(animation_name):
			printerr("SEQUENCE_FAIL missing ", animation_name)
			quit(1)
			return
		var animation := library.get_animation(animation_name)
		print("ANIMATION ", animation_name, " length=", animation.length, " loop=", animation.loop_mode)
		player.play(animation_name, 0.18)
		await process_frame
	print("SEQUENCE_OK ", STATES)
	quit(0)

func _find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found := _find_player(child)
		if found != null:
			return found
	return null
