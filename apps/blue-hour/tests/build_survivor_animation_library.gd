extends SceneTree

const CLIPS: Dictionary = {
	&"survivor_idle": "res://assets/characters/survivors/animations/locomotion/survivor_idle.glb",
	&"survivor_walk": "res://assets/characters/survivors/animations/locomotion/survivor_walk.glb",
	&"survivor_run": "res://assets/characters/survivors/animations/locomotion/survivor_run.glb",
	&"rifle_idle": "res://assets/characters/survivors/animations/combat/rifle_idle.glb",
	&"rifle_run": "res://assets/characters/survivors/animations/combat/rifle_run.glb",
	&"rifle_shoot": "res://assets/characters/survivors/animations/combat/rifle_shoot.glb",
	&"unarmed_idle": "res://assets/characters/survivors/animations/combat/unarmed_idle.glb",
	&"knife_idle": "res://assets/characters/survivors/animations/combat/knife_idle.glb",
	&"knife_attack": "res://assets/characters/survivors/animations/combat/knife_attack.glb",
	&"hit_reaction": "res://assets/characters/survivors/animations/reaction/hit_reaction.glb",
	&"death": "res://assets/characters/survivors/animations/reaction/death.glb",
}

func _initialize() -> void:
	var library := AnimationLibrary.new()
	for clip_name: StringName in CLIPS:
		var packed := load(CLIPS[clip_name]) as PackedScene
		var scene := packed.instantiate()
		var player := _find_player(scene)
		var imported: Animation = player.get_animation(String(player.get_animation_list()[0]))
		var animation := imported.duplicate() as Animation
		for track_index: int in animation.get_track_count():
			var track_path := animation.track_get_path(track_index)
			var bone_name := track_path.get_subname(0)
			animation.track_set_path(track_index, NodePath("Skeleton3D:" + String(bone_name)))
		var status := library.add_animation(clip_name, animation)
		assert(status == OK, "Could not add animation %s" % clip_name)
		scene.free()
	var save_status := ResourceSaver.save(library, "res://assets/characters/survivors/animations/survivor_animations.tres")
	assert(save_status == OK, "Could not save the survivor animation library")
	print("SURVIVOR ANIMATION LIBRARY: %d clips" % library.get_animation_list().size())
	quit()

func _find_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found := _find_player(child)
		if found != null:
			return found
	return null
