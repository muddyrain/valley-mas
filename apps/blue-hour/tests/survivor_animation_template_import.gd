extends SceneTree

const TEMPLATE := preload("res://assets/characters/survivor_animation_template/survivor_animation_template.tscn")

func _init() -> void:
	var instance := TEMPLATE.instantiate()
	root.add_child(instance)
	await process_frame
	var player := _find_player(instance)
	if player == null:
		printerr("TEMPLATE_IMPORT_FAIL: AnimationPlayer missing")
		quit(1)
		return
	var libraries := player.get_animation_library_list()
	print("TEMPLATE_IMPORT_OK libraries=", libraries)
	var found: Array[StringName] = []
	for library_name: StringName in libraries:
		var library := player.get_animation_library(library_name)
		for animation_name: StringName in library.get_animation_list():
			found.append(library_name + &"/" + animation_name)
	print("TEMPLATE_ANIMATIONS ", found)
	var required := [&"idle_relaxed", &"walk_forward", &"jog_forward", &"run_forward"]
	for animation_name: StringName in required:
		var exists := false
		for library_name: StringName in libraries:
			if player.get_animation_library(library_name).has_animation(animation_name):
				exists = true
		if not exists:
			printerr("MISSING_ANIMATION ", animation_name)
			quit(1)
			return
	print("TEMPLATE_REQUIRED_ANIMATIONS_OK")
	quit(0)

func _find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found := _find_player(child)
		if found != null:
			return found
	return null
