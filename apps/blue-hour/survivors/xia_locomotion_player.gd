extends Node
## Plays already-retargeted clips on Xia's real bones. Owns no movement or IK.

const MODEL: String = "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb"
const IDLE: Animation = preload("res://assets/characters/xia_zhiyao/animations/idle.tres")
const WALK: Animation = preload("res://assets/characters/xia_zhiyao/animations/walking.tres")
const RUN: Animation = preload("res://assets/characters/xia_zhiyao/animations/running.tres")
const WALK_SPEED: float = 1.2622571142
const RUN_SPEED: float = 2.3065521202
const MOVE_ENTER: float = 0.08
const MOVE_EXIT: float = 0.035
const RUN_ENTER: float = 1.85
const RUN_EXIT: float = 1.60

var tree: AnimationTree
var player: AnimationPlayer
var playback: AnimationNodeStateMachinePlayback
var current_state: StringName = &"Idle"
var playback_rate: float = 1.0
var walk_rate: float = 0.0
var run_rate: float = 0.0
var active: bool = false
var transition_count: int = 0

func initialize(target: Skeleton3D) -> void:
	player = AnimationPlayer.new()
	player.name = "AnimationPlayer"
	add_child(player)
	player.root_node = player.get_path_to(target)
	var library: AnimationLibrary = AnimationLibrary.new()
	for state: StringName in [&"Idle", &"Walk", &"Run"]:
		var original: Animation = IDLE if state == &"Idle" else WALK if state == &"Walk" else RUN
		var clip: Animation = original.duplicate() as Animation
		# Only binding paths are adapted to the controller's relocated target.
		# Resource timing and every authored key stay untouched.
		for track: int in clip.get_track_count():
			var bone: StringName = clip.track_get_path(track).get_subname(0)
			clip.track_set_path(track, NodePath(".:" + str(bone)))
		library.add_animation(state, clip)
	player.add_animation_library(&"", library)
	var machine: AnimationNodeStateMachine = AnimationNodeStateMachine.new()
	for state: StringName in [&"Idle", &"Walk", &"Run"]:
		var clip_node: AnimationNodeAnimation = AnimationNodeAnimation.new()
		clip_node.animation = state
		var node: AnimationNodeBlendTree = AnimationNodeBlendTree.new()
		node.add_node(&"Clip", clip_node)
		node.add_node(&"Seek", AnimationNodeTimeSeek.new())
		node.add_node(&"Rate", AnimationNodeTimeScale.new())
		node.connect_node(&"Seek", 0, &"Clip")
		node.connect_node(&"Rate", 0, &"Seek")
		node.connect_node(&"output", 0, &"Rate")
		machine.add_node(state, node)
	for from: StringName in [&"Idle", &"Walk", &"Run"]:
		for to: StringName in [&"Idle", &"Walk", &"Run"]:
			if from == to:
				continue
			var transition: AnimationNodeStateMachineTransition = AnimationNodeStateMachineTransition.new()
			transition.xfade_time = 0.16 if to == &"Idle" else 0.10 if from == &"Idle" else 0.12
			machine.add_transition(from, to, transition)
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.root_node = tree.get_path_to(target)
	tree.tree_root = machine
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = false
	playback = tree.get("parameters/playback") as AnimationNodeStateMachinePlayback

func set_active(value: bool) -> void:
	if active == value:
		return
	active = value
	tree.active = value
	if value:
		current_state = &"Idle"
		playback.start(&"Idle")
		tree.set("parameters/Idle/Rate/scale", 1.0)
		tree.advance(0.0)

func advance(speed: float, scale_factor: float, delta: float) -> void:
	var local_speed: float = maxf(0.0, speed) / maxf(scale_factor, 0.001)
	var desired: StringName = &"Idle"
	if local_speed > (MOVE_ENTER if current_state == &"Idle" else MOVE_EXIT):
		desired = &"Run" if local_speed > (RUN_EXIT if current_state == &"Run" else RUN_ENTER) else &"Walk"
	walk_rate = local_speed / WALK_SPEED
	run_rate = local_speed / RUN_SPEED
	tree.set("parameters/Idle/Rate/scale", 1.0)
	tree.set("parameters/Walk/Rate/scale", walk_rate)
	tree.set("parameters/Run/Rate/scale", run_rate)
	if desired != current_state:
		if current_state != &"Idle" and desired != &"Idle":
			var previous_clip: Animation = WALK if current_state == &"Walk" else RUN
			var next_clip: Animation = WALK if desired == &"Walk" else RUN
			var old_strike: float = 0.28 if current_state == &"Walk" else 0.275
			var new_strike: float = 0.28 if desired == &"Walk" else 0.275
			var phase: float = fposmod(playback.get_current_play_position() / previous_clip.length - old_strike + new_strike, 1.0)
			tree.set("parameters/" + str(desired) + "/Seek/seek_request", phase * next_clip.length)
		current_state = desired
		transition_count += 1
		playback.travel(desired)
	playback_rate = walk_rate if current_state == &"Walk" else run_rate if current_state == &"Run" else 1.0
	tree.advance(delta)
