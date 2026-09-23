extends SceneTree

const CLIPS: Array[String] = [
	"res://assets/characters/survivors/animations/locomotion/survivor_idle.glb",
	"res://assets/characters/survivors/animations/combat/rifle_shoot.glb",
]

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	for path: String in CLIPS:
		var packed: PackedScene = load(path)
		var root_node: Node = packed.instantiate()
		root.add_child(root_node)
		var player: AnimationPlayer = _find_animation_player(root_node)
		print("CLIP ", path, " player=", player)
		if player != null:
			for library_name: StringName in player.get_animation_library_list():
				var library := player.get_animation_library(library_name)
				for clip_name: StringName in library.get_animation_list():
					var clip := library.get_animation(clip_name)
					print("  ", clip_name, " length=", clip.length, " tracks=", clip.get_track_count())
					for track: int in mini(clip.get_track_count(), 3):
						print("    ", clip.track_get_path(track))
		root_node.queue_free()
	await process_frame
	quit()

func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var result := _find_animation_player(child)
		if result != null:
			return result
	return null
