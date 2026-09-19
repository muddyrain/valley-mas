extends Node3D
## One public pose clock on the native canonical skeleton; movement remains gameplay-owned.

const LIBRARY = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
const CombatBridge = preload("res://survivors/survivor_weapon_animation_bridge.gd")
const CLIPS: Dictionary = {&"Idle": &"public_idle", &"Walk": &"public_walking", &"Run": &"public_running"}
const MOVE_ENTER: float = .08
const MOVE_EXIT: float = .035
const RUN_ENTER: float = 1.85
const RUN_EXIT: float = 1.60

var target: Skeleton3D
# The existing weapon bridge consumes source; native playback needs no second skeleton.
var source: Skeleton3D
var player: AnimationPlayer
var tree: AnimationTree
var playback: AnimationNodeStateMachinePlayback
var current_state: StringName = &"Idle"
var playback_rate: float = 1.0
var enabled: bool = false
var visual_scale: float = 1.0
var combat_bridge: Node
var transition_count: int = 0
var _render_actor: Node3D
var _render_mission: Node3D
var _motion_speed: float = 0.0
var _motion_base: float = 2.8
var _camp_style: bool = false

func _process(delta: float) -> void:
	if _render_mission == null or not _render_mission.is_physics_processing() or not _render_mission.active or _render_actor.dead or _render_actor.boarding:
		return
	_apply_motion(_motion_speed, delta * _render_mission.time_scale)

static func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child: Node in node.get_children():
		var found := find_skeleton(child)
		if found != null:
			return found
	return null

func initialize(model: Node3D) -> bool:
	target = find_skeleton(model)
	if target == null or target.get_bone_count() != 23 or target.find_bone("LeftHand") < 0:
		return false
	source = target
	visual_scale = model.global_basis.get_scale().y
	player = AnimationPlayer.new()
	player.name = "AnimationPlayer"
	add_child(player)
	# Shared tracks are Skeleton3D:Bone. Bind their root, never copy or rewrite clips.
	player.root_node = player.get_path_to(target.get_parent())
	player.add_animation_library(&"Public", LIBRARY)
	var machine := AnimationNodeStateMachine.new()
	for state: StringName in CLIPS:
		var clip := AnimationNodeAnimation.new()
		clip.animation = &"Public/" + CLIPS[state]
		var node := AnimationNodeBlendTree.new()
		node.add_node(&"Clip", clip)
		node.add_node(&"Seek", AnimationNodeTimeSeek.new())
		node.add_node(&"Rate", AnimationNodeTimeScale.new())
		node.connect_node(&"Seek", 0, &"Clip")
		node.connect_node(&"Rate", 0, &"Seek")
		node.connect_node(&"output", 0, &"Rate")
		machine.add_node(state, node)
	for from: StringName in CLIPS:
		for to: StringName in CLIPS:
			if from == to:
				continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = .16 if to == &"Idle" else .10 if from == &"Idle" else .12
			machine.add_transition(from, to, transition)
	var graph := AnimationNodeBlendTree.new()
	graph.add_node(&"Locomotion", machine)
	graph.add_node(&"Rate", AnimationNodeTimeScale.new())
	graph.connect_node(&"Rate", 0, &"Locomotion")
	graph.connect_node(&"output", 0, &"Rate")
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.root_node = tree.get_path_to(target.get_parent())
	tree.tree_root = graph
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	playback = tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"Idle")
	tree.set("parameters/Rate/scale", 1.0)
	tree.advance(0.0)
	enabled = true
	return true

func bind_weapon(visual: WeaponVisualController, combat: WeaponCombatController) -> void:
	if combat_bridge != null:
		return
	combat_bridge = CombatBridge.new()
	combat_bridge.name = "WeaponAnimationBridge"
	add_child(combat_bridge)
	combat_bridge.initialize(self, visual, combat)
	# Existing ready/aim/shoot and grip constraint remain. The retired mission-jog
	# secondary layer must not inject its old gait into canonical locomotion.
	combat_bridge.constraint.secondary.enabled = false

func use_render_clock(actor: Node3D, mission: Node3D) -> void:
	_render_actor = actor
	_render_mission = mission
	if mission != null:
		_camp_style = false

func use_camp_style() -> void:
	_camp_style = true
	if combat_bridge != null:
		combat_bridge.set_gameplay_state(false, false, Vector3.ZERO, Vector3.ZERO)

func update_motion(horizontal_speed: float, base_speed: float, delta: float) -> void:
	_motion_speed = horizontal_speed
	_motion_base = base_speed
	if _render_mission == null or not _render_mission.is_physics_processing():
		_apply_motion(horizontal_speed, delta)

func _apply_motion(horizontal_speed: float, delta: float) -> void:
	if not enabled or delta <= 0.0:
		return
	var speed := maxf(0.0, horizontal_speed)
	var desired: StringName = &"Idle"
	if speed > (MOVE_ENTER if current_state == &"Idle" else MOVE_EXIT):
		desired = &"Run" if speed > (RUN_EXIT if current_state == &"Run" else RUN_ENTER) else &"Walk"
		if _camp_style:
			desired = &"Walk"
	var walk_speed: float = LIBRARY.get_animation(&"public_walking").get_meta("nominal_speed")
	var run_speed: float = LIBRARY.get_animation(&"public_running").get_meta("nominal_speed")
	var walk_rate := speed / walk_speed
	var run_rate := speed / run_speed
	tree.set("parameters/Locomotion/Idle/Rate/scale", 1.0)
	tree.set("parameters/Locomotion/Walk/Rate/scale", walk_rate)
	tree.set("parameters/Locomotion/Run/Rate/scale", run_rate)
	tree.set("parameters/Rate/scale", 1.0)
	if desired != current_state:
		if current_state != &"Idle" and desired != &"Idle":
			var old_clip := LIBRARY.get_animation(CLIPS[current_state])
			var next_clip := LIBRARY.get_animation(CLIPS[desired])
			var old_strike := .28 if current_state == &"Walk" else .275
			var new_strike := .28 if desired == &"Walk" else .275
			var phase := fposmod(playback.get_current_play_position() / old_clip.length - old_strike + new_strike, 1.0)
			tree.set("parameters/Locomotion/" + str(desired) + "/Seek/seek_request", phase * next_clip.length)
		current_state = desired
		transition_count += 1
		playback.travel(desired)
	playback_rate = walk_rate if current_state == &"Walk" else run_rate if current_state == &"Run" else 1.0
	if combat_bridge != null:
		combat_bridge.advance(delta)
	tree.advance(delta)

func preview(clip: StringName) -> void:
	assert(CLIPS.has(clip))
	set_enabled(true)
	current_state = clip
	playback.start(clip)

func advance_preview(delta: float, rate: float = 1.0) -> void:
	if not enabled:
		return
	for state: StringName in CLIPS:
		tree.set("parameters/Locomotion/" + str(state) + "/Rate/scale", 1.0)
	tree.set("parameters/Rate/scale", rate)
	if combat_bridge != null:
		combat_bridge.advance(delta)
	tree.advance(delta)

func set_enabled(value: bool) -> void:
	enabled = value
	if tree != null:
		tree.active = value
	if combat_bridge != null:
		combat_bridge.constraint.active = value
