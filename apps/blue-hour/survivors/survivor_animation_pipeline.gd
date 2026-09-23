extends Node3D
## Shared Phase 1 animation graph for the frozen 23-bone survivor rig.

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
const LIBRARY: AnimationLibrary = preload("res://assets/characters/survivors/animations/survivor_animations.tres")

const STATES: Dictionary = {
	&"IDLE": &"survivor_idle",
	&"WALK": &"survivor_walk",
	&"RUN": &"survivor_run",
	&"RIFLE_IDLE": &"rifle_idle",
	&"RIFLE_RUN": &"rifle_run",
	&"ATTACK": &"knife_attack",
	&"KNIFE_IDLE": &"knife_idle",
	&"RIFLE_SHOOT": &"rifle_shoot",
	&"HIT": &"hit_reaction",
	&"DEATH": &"death",
}

var target: Skeleton3D
var player: AnimationPlayer
var tree: AnimationTree
var playback: AnimationNodeStateMachinePlayback
var library: AnimationLibrary
var current_state: StringName = &"IDLE"

func initialize(model: Node3D) -> bool:
	target = _find_skeleton(model)
	if target == null or target.get_bone_count() != 23:
		return false
	var required_bones: Array[StringName] = [&"Root", &"Hips", &"LeftHand", &"RightHand", &"Head"]
	for bone_name: StringName in required_bones:
		if target.find_bone(bone_name) < 0:
			return false
	player = AnimationPlayer.new()
	player.name = "AnimationPlayer"
	add_child(player)
	player.root_node = player.get_path_to(target.get_parent())
	library = LIBRARY
	if not library.has_animation(&"knife_attack"):
		return false
	for clip_name: StringName in CLIPS:
		if not library.has_animation(clip_name):
			return false
		var animation := library.get_animation(clip_name)
		for track_index: int in animation.get_track_count():
			var track_path := animation.track_get_path(track_index)
			if track_path.get_subname_count() > 0 and target.find_bone(track_path.get_subname(0)) < 0:
				return false
	player.add_animation_library(&"Survivor", library)
	var machine := AnimationNodeStateMachine.new()
	for state_name: StringName in STATES:
		var clip_node := AnimationNodeAnimation.new()
		clip_node.animation = &"Survivor/" + STATES[state_name]
		machine.add_node(state_name, clip_node)
	for source: StringName in STATES:
		for destination: StringName in STATES:
			if source == destination:
				continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = 0.14 if destination in [&"IDLE", &"RIFLE_IDLE"] else 0.10
			machine.add_transition(source, destination, transition)
	var graph := AnimationNodeBlendTree.new()
	graph.add_node(&"Locomotion", machine)
	graph.connect_node(&"output", 0, &"Locomotion")
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	tree.tree_root = graph
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.root_node = tree.get_path_to(target.get_parent())
	tree.active = true
	playback = tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"IDLE")
	tree.advance(0.0)
	return true

func play_state(state_name: StringName, restart: bool = false) -> bool:
	if not STATES.has(state_name) or playback == null:
		return false
	current_state = state_name
	if restart:
		playback.start(state_name)
	else:
		playback.travel(state_name)
	return true

func advance(delta: float) -> void:
	if tree != null:
		tree.advance(delta)

func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child: Node in node.get_children():
		var result := _find_skeleton(child)
		if result != null:
			return result
	return null
