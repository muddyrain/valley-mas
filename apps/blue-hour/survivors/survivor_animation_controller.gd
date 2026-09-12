extends Node3D
## Reads motion; never writes the survivor's world transform or navigation state.

const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const LIBRARY = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres")
const GRAPH = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_locomotion_tree.tres")

var target: Skeleton3D
var source: Skeleton3D
var player: AnimationPlayer
var tree: AnimationTree
var retarget: RetargetModifier3D
var playback: AnimationNodeStateMachinePlayback
var current_state: StringName = &"Idle"
var playback_rate: float = 1.0
var enabled: bool = false
var visual_scale: float = 1.0
var _render_actor: Node3D
var _render_mission: Node3D
var _motion_speed: float = 0.0
var _motion_base: float = 4.2
var _walk_rate: float = 1.0
var _run_rate: float = 1.0

func use_render_clock(actor: Node3D, mission: Node3D) -> void:
	_render_actor = actor
	_render_mission = mission

func _process(delta: float) -> void:
	if _render_mission == null or not _render_mission.is_physics_processing() or not _render_mission.active or _render_actor.dead or _render_actor.boarding:
		return
	_apply_motion(_motion_speed, _motion_base, delta * _render_mission.time_scale)

static func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := find_skeleton(child)
		if found != null:
			return found
	return null

func initialize(model: Node3D) -> bool:
	target = find_skeleton(model)
	if target == null or target.get_bone_count() != 23 or target.find_bone("LeftHand") < 0:
		return false
	visual_scale = model.global_basis.get_scale().y
	var reference := Reference.instantiate() as Node3D
	add_child(reference)
	source = find_skeleton(reference)
	retarget = RetargetModifier3D.new()
	retarget.name = "HumanoidRetarget"
	retarget.profile = SkeletonProfileHumanoid.new()
	retarget.use_global_pose = false
	retarget.set_scale_enabled(false)
	source.add_child(retarget)
	var meshes: Array[MeshInstance3D] = []
	_collect_skinned_meshes(model, meshes)
	# RetargetModifier3D requires a direct child Skeleton3D. Meshes retain their
	# transforms; refresh their paths after relocating the imported skeleton.
	target.reparent(retarget, true)
	for mesh in meshes:
		mesh.skeleton = mesh.get_path_to(target)
	player = AnimationPlayer.new()
	player.name = "AnimationPlayer"
	add_child(player)
	player.root_node = player.get_path_to(reference)
	player.add_animation_library(&"Humanoid", LIBRARY)
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.root_node = tree.get_path_to(reference)
	tree.tree_root = GRAPH
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	playback = tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"Idle")
	tree.set("parameters/Rate/scale", 1.0)
	tree.advance(0)
	enabled = true
	return true

func update_motion(horizontal_speed: float, base_speed: float, delta: float) -> void:
	_motion_speed = horizontal_speed
	_motion_base = base_speed
	# Camp and Inspector retain their explicit clock. Mission opts in independently.
	if _render_mission == null or not _render_mission.is_physics_processing():
		_apply_motion(horizontal_speed, base_speed, delta)

func _apply_motion(horizontal_speed: float, _base_speed: float, delta: float) -> void:
	if not enabled or delta <= 0:
		return
	var speed := maxf(0, horizontal_speed)
	var desired: StringName = &"Idle"
	# Fixed physical thresholds give both models the same gait at the same speed.
	var moving_threshold := .08 if current_state == &"Idle" else .035
	if speed > moving_threshold:
		var run_threshold := 1.65 if current_state == &"Run" else 1.9
		desired = &"Run" if speed / visual_scale > run_threshold else &"Walk"
	if desired != current_state:
		current_state = desired
		playback.travel(desired)
	# Each clip keeps its own cadence during the crossfade. Never accelerate Idle
	# or the outgoing Walk to the incoming Run's scale (or vice versa).
	var response := 1.0 - exp(-delta * 18)
	var walk_nominal: float = LIBRARY.get_animation(&"Walk").get_meta("nominal_speed")
	var run_nominal: float = LIBRARY.get_animation(&"Run").get_meta("nominal_speed")
	_walk_rate = lerpf(_walk_rate, clampf(speed / (walk_nominal * visual_scale), .8, 1.8), response)
	_run_rate = lerpf(_run_rate, clampf(speed / (run_nominal * visual_scale), .65, 1.55), response)
	tree.set("parameters/Locomotion/Walk/Rate/scale", _walk_rate)
	tree.set("parameters/Locomotion/Run/Rate/scale", _run_rate)
	playback_rate = _walk_rate if current_state == &"Walk" else (_run_rate if current_state == &"Run" else 1.0)
	tree.set("parameters/Rate/scale", 1.0)
	tree.advance(delta)

func preview(clip: StringName) -> void:
	assert(LIBRARY.has_animation(clip))
	set_enabled(true)
	current_state = clip
	playback.start(clip)

func advance_preview(delta: float, rate: float = 1.0) -> void:
	if enabled:
		tree.set("parameters/Locomotion/Walk/Rate/scale", 1.0)
		tree.set("parameters/Locomotion/Run/Rate/scale", 1.0)
		tree.set("parameters/Rate/scale", rate)
		tree.advance(delta)

func set_enabled(value: bool) -> void:
	enabled = value
	if tree != null:
		tree.active = value
	if retarget != null:
		retarget.active = value

func _collect_skinned_meshes(node: Node, result: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D and (node as MeshInstance3D).skin != null:
		result.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_skinned_meshes(child, result)
