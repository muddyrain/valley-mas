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
	if not enabled or delta <= 0:
		return
	var speed := maxf(0, horizontal_speed)
	var reference_speed := maxf(.01, base_speed)
	var desired: StringName = &"Idle"
	if speed > .025:
		var run_ratio := .39 if current_state == &"Run" else .45
		desired = &"Run" if speed / reference_speed > run_ratio else &"Walk"
	if desired != current_state:
		current_state = desired
		playback.travel(desired)
	var rate := 1.0
	if current_state != &"Idle":
		var nominal: float = LIBRARY.get_animation(current_state).get_meta("nominal_speed")
		rate = clampf(speed / maxf(.01, nominal * visual_scale), .65, 1.65)
	playback_rate = lerpf(playback_rate, rate, 1.0 - exp(-delta * 10))
	tree.set("parameters/Rate/scale", playback_rate)
	tree.advance(delta)

func preview(clip: StringName) -> void:
	assert(LIBRARY.has_animation(clip))
	set_enabled(true)
	current_state = clip
	playback.start(clip)

func advance_preview(delta: float, rate: float = 1.0) -> void:
	if enabled:
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
