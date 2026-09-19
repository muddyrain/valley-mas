extends Node3D
## Reads motion; never writes the survivor's world transform or navigation state.

const Reference = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn")
const LIBRARY = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres")
const GRAPH = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_locomotion_tree.tres")
const JOG = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog.tres")
const JOG_V2 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
const JOG_V22 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2_2.tres")
const ARMS_V2 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_unarmed_arms_v2.tres")
const TRANSITIONS_V22 = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_jog_transitions_v2_2.tres")
const CombatBridge = preload("res://survivors/survivor_weapon_animation_bridge.gd")
const LocomotionLayer = preload("res://survivors/survivor_locomotion_layer.gd")
const XiaLocomotion = preload("res://survivors/xia_locomotion_player.gd")

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
var _jog_rate: float = 1.0
var _jog_v2_weight: float = 0.0
var _camp_style: bool = false
var combat_bridge: Node
var locomotion_layer: SkeletonModifier3D
var jog_cadence: StringName = &"natural"
var _jog_v22_weight: float = 1.0
var arm_swing_v2_enabled: bool = true
var character_locomotion: Node

func set_jog_cadence(profile: StringName) -> void:
	assert(profile in [&"current", &"polish", &"natural"])
	# A/B retain V2.1; C selects the separate swing without restarting the clock.
	jog_cadence = profile

func bind_weapon(visual: WeaponVisualController, combat: WeaponCombatController) -> void:
	if combat_bridge != null:
		return
	combat_bridge = CombatBridge.new()
	combat_bridge.name = "WeaponAnimationBridge"
	add_child(combat_bridge)
	combat_bridge.initialize(self, visual, combat)

func use_render_clock(actor: Node3D, mission: Node3D) -> void:
	_render_actor = actor
	_render_mission = mission
	if mission != null:
		_camp_style = false

func use_camp_style() -> void:
	_camp_style = true
	if combat_bridge != null:
		combat_bridge.set_gameplay_state(false, false, Vector3.ZERO, Vector3.ZERO)

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
	locomotion_layer = LocomotionLayer.new()
	locomotion_layer.name = "MissionLocomotionLayer"
	source.add_child(locomotion_layer)
	locomotion_layer.initialize()
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
	player.add_animation_library(&"Mission", JOG)
	player.add_animation_library(&"MissionV2", JOG_V2)
	player.add_animation_library(&"MissionV22", JOG_V22)
	player.add_animation_library(&"UnarmedArms", ARMS_V2)
	tree = AnimationTree.new()
	tree.name = "AnimationTree"
	add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.root_node = tree.get_path_to(reference)
	# Extend this instance so the original Walk/Run resource and Inspector remain intact.
	var graph := GRAPH.duplicate(true) as AnimationNodeBlendTree
	var locomotion := graph.get_node(&"Locomotion") as AnimationNodeStateMachine
	var jog_clip := AnimationNodeAnimation.new()
	jog_clip.animation = &"Mission/mission_jog"
	var jog_v2_clip := AnimationNodeAnimation.new()
	jog_v2_clip.animation = &"MissionV2/mission_jog"
	var jog_v22_clip := AnimationNodeAnimation.new()
	jog_v22_clip.animation = &"MissionV22/mission_jog"
	var swing_version := AnimationNodeBlend2.new()
	swing_version.sync = true
	var jog_version := AnimationNodeBlend2.new()
	jog_version.sync = true
	var jog_node := AnimationNodeBlendTree.new()
	jog_node.add_node(&"Clip", jog_clip)
	jog_node.add_node(&"V2", jog_v2_clip)
	jog_node.add_node(&"V22", jog_v22_clip)
	jog_node.add_node(&"Swing", swing_version)
	jog_node.add_node(&"Version", jog_version)
	var arms_clip := AnimationNodeAnimation.new()
	arms_clip.animation = &"UnarmedArms/unarmed_arms"
	var arms_blend := AnimationNodeBlend2.new()
	arms_blend.sync = true
	arms_blend.filter_enabled = true
	for bone: String in ["LeftUpperArm", "LeftLowerArm", "LeftHand", "RightUpperArm", "RightLowerArm", "RightHand"]:
		arms_blend.set_filter_path(NodePath("Skeleton3D:" + bone), true)
	jog_node.add_node(&"ArmsClip", arms_clip)
	jog_node.add_node(&"Arms", arms_blend)
	jog_node.add_node(&"Seek", AnimationNodeTimeSeek.new())
	jog_node.add_node(&"Rate", AnimationNodeTimeScale.new())
	jog_node.connect_node(&"Version", 0, &"Clip")
	jog_node.connect_node(&"Swing", 0, &"V2")
	jog_node.connect_node(&"Swing", 1, &"V22")
	jog_node.connect_node(&"Version", 1, &"Swing")
	jog_node.connect_node(&"Arms", 0, &"Version")
	jog_node.connect_node(&"Arms", 1, &"ArmsClip")
	jog_node.connect_node(&"Seek", 0, &"Arms")
	jog_node.connect_node(&"Rate", 0, &"Seek")
	jog_node.connect_node(&"output", 0, &"Rate")
	locomotion.add_node(&"mission_jog", jog_node)
	for state: StringName in [&"Idle", &"Walk", &"Run"]:
		var enter := AnimationNodeStateMachineTransition.new()
		enter.xfade_time = .18
		locomotion.add_transition(state, &"mission_jog", enter)
		var leave := AnimationNodeStateMachineTransition.new()
		leave.xfade_time = .20
		locomotion.add_transition(&"mission_jog", state, leave)
	tree.tree_root = graph
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	playback = tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"Idle")
	tree.set("parameters/Rate/scale", 1.0)
	tree.advance(0)
	if model.scene_file_path == XiaLocomotion.MODEL:
		character_locomotion = XiaLocomotion.new()
		character_locomotion.name = "XiaLocomotion"
		add_child(character_locomotion)
		character_locomotion.initialize(target)
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
	var character_active: bool = character_locomotion != null and _render_mission != null and _render_actor != null and _render_actor.weapon == null and not _camp_style
	if character_locomotion != null:
		if character_locomotion.active != character_active:
			# Baked target poses must have one owner. Preserve the existing armed
			# and Camp pipelines, including their original reference skeleton.
			tree.active = not character_active
			retarget.active = not character_active
			locomotion_layer.active = not character_active
			if combat_bridge != null:
				combat_bridge.constraint.active = not character_active
			character_locomotion.set_active(character_active)
			if not character_active:
				current_state = &"Idle"
				playback.start(current_state)
		if character_active:
			locomotion_layer.advance(speed, Vector3.ZERO, 0.0, false, delta, false)
			character_locomotion.advance(speed, visual_scale, delta)
			current_state = character_locomotion.current_state
			playback_rate = character_locomotion.playback_rate
			return
	var use_v2: bool = _render_mission != null and _render_actor != null and (_render_actor.weapon == null or (combat_bridge != null and combat_bridge.uses_long_gun()))
	var stopping := false
	var velocity := Vector3.ZERO
	var facing := 0.0
	if use_v2:
		velocity = _render_actor.actual_velocity
		facing = _render_actor.rig.rotation.y
		# Read arrival/brake intent so terrain and minor route corrections cannot
		# repeatedly trigger a stop. The path and speed integrator remain untouched.
		var brake_distance: float = _render_actor.current_speed * _render_actor.current_speed / (2.0 * _render_actor.DECELERATION)
		stopping = _render_actor._braking or _render_actor.path.is_empty() or _render_actor.remaining_distance() <= brake_distance + .06
	locomotion_layer.transitions = TRANSITIONS_V22 if jog_cadence == &"natural" else LocomotionLayer.TRANSITIONS
	locomotion_layer.arm_swing_v2_enabled = arm_swing_v2_enabled and use_v2
	locomotion_layer.advance(speed, velocity, facing, stopping, delta, use_v2)
	var desired: StringName = &"Idle"
	# Fixed physical thresholds give both models the same gait at the same speed.
	var moving_threshold := .08 if current_state == &"Idle" else .035
	if speed > moving_threshold:
		var run_threshold := 1.65 if current_state == &"Run" else 1.9
		desired = &"Run" if speed / visual_scale > run_threshold else &"Walk"
		if _render_mission != null:
			desired = &"mission_jog"
		elif _camp_style:
			desired = &"Walk"
	if use_v2 and locomotion_layer.state == &"JogStop":
		desired = &"Idle"
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
	var jog_nominal: float = JOG.get_animation(&"mission_jog").get_meta("nominal_speed")
	# Equipment never changes the approved Mission gait or its phase clock.
	_jog_v2_weight = move_toward(_jog_v2_weight, 1.0 if use_v2 else 0.0, delta / .16)
	jog_nominal = lerpf(jog_nominal, JOG_V2.get_animation(&"mission_jog").get_meta("nominal_speed"), _jog_v2_weight)
	tree.set("parameters/Locomotion/mission_jog/Version/blend_amount", _jog_v2_weight)
	_jog_v22_weight = move_toward(_jog_v22_weight, 1.0 if jog_cadence == &"natural" else 0.0, delta / .12)
	tree.set("parameters/Locomotion/mission_jog/Swing/blend_amount", _jog_v22_weight)
	tree.set("parameters/Locomotion/mission_jog/Arms/blend_amount", _jog_v2_weight if arm_swing_v2_enabled else 0.0)
	_jog_rate = lerpf(_jog_rate, clampf(speed / (jog_nominal * visual_scale), .55, 1.8), response)
	tree.set("parameters/Locomotion/Walk/Rate/scale", _walk_rate)
	tree.set("parameters/Locomotion/Run/Rate/scale", _run_rate)
	var freeze_jog: bool = use_v2 and locomotion_layer.state in [&"JogStop", &"Idle"]
	var visual_jog_rate := _jog_rate
	if use_v2 and jog_cadence == &"polish" and locomotion_layer.state == &"Jog":
		visual_jog_rate = _contact_matched_rate(_jog_rate, delta)
	elif use_v2 and jog_cadence == &"natural" and locomotion_layer.state == &"Jog":
		visual_jog_rate = _cadence_c_rate(_jog_rate, delta)
	tree.set("parameters/Locomotion/mission_jog/Rate/scale", 0.0 if freeze_jog else visual_jog_rate)
	if locomotion_layer.seek_phase >= 0:
		tree.set("parameters/Locomotion/mission_jog/Seek/seek_request", locomotion_layer.seek_phase * .7)
	playback_rate = _walk_rate if current_state == &"Walk" else (_run_rate if current_state == &"Run" else 1.0)
	if current_state == &"mission_jog":
		playback_rate = visual_jog_rate
	tree.set("parameters/Rate/scale", 1.0)
	if combat_bridge != null:
		combat_bridge.advance(delta)
		locomotion_layer.combat_weight = combat_bridge.combat_weight
		combat_bridge.constraint.secondary.advance(speed, locomotion_layer, delta, use_v2, combat_bridge.aim_weight, combat_bridge.shoot_requested_this_frame or bool(tree.get("parameters/Shot/active")))
	tree.advance(delta)
	locomotion_layer.update_phase(playback.get_current_play_position(), .7)
	if combat_bridge != null:
		combat_bridge.constraint.secondary.phase = locomotion_layer.locomotion_phase

func _contact_matched_rate(base_rate: float, delta: float) -> float:
	# Stretch the two airborne intervals, not the planted foot's travel. Invert the
	# piecewise clock across boundaries so this remains independent of frame rate.
	var clip := JOG_V2.get_animation(&"mission_jog")
	var stance: float = clip.get_meta("stance_ratio")
	var nominal: float = clip.get_meta("nominal_speed")
	var ratio := .50 / (clip.length * nominal / 4.2)
	var half_time := .5 * ratio
	var flight_stretch := (half_time - stance) / (.5 - stance)
	var phase: float = locomotion_layer.locomotion_phase
	var half := floorf(phase / .5)
	var local := fposmod(phase, .5)
	var clock_time := half * half_time + minf(local, stance) + maxf(0, local - stance) * flight_stretch
	clock_time += delta * base_rate / clip.length
	var next_half := floorf(clock_time / half_time)
	var next_local := fposmod(clock_time, half_time)
	var next_phase := next_half * .5 + minf(next_local, stance) + maxf(0, next_local - stance) / flight_stretch
	return (next_phase - phase) * clip.length / delta

func _cadence_c_rate(base_rate: float, delta: float) -> float:
	# Add time across late toe-off and the opposite leg's low forward extension.
	# Flat contact and the rear recovery peak retain their original clock speed.
	var clip := JOG_V22.get_animation(&"mission_jog")
	var nominal: float = clip.get_meta("nominal_speed")
	var ratio := .51 / (clip.length * nominal / 4.2)
	var extra := .5 * (ratio - 1.0)
	var half_time := .5 + extra
	var phase: float = locomotion_layer.locomotion_phase
	var half := floorf(phase / .5)
	var local := fposmod(phase, .5)
	var clock_time := half * half_time + local + extra * smoothstep(.24, .5, local)
	clock_time += delta * base_rate / clip.length
	var next_half := floorf(clock_time / half_time)
	var next_clock := fposmod(clock_time, half_time)
	# The smooth clock is strictly increasing. A bounded inversion crosses any
	# number of interval boundaries without accumulating frame-rate-dependent drift.
	var low := 0.0
	var high := .5
	for iteration in 24:
		var middle := (low + high) * .5
		if middle + extra * smoothstep(.24, .5, middle) < next_clock:
			low = middle
		else:
			high = middle
	var next_phase := next_half * .5 + (low + high) * .5
	return (next_phase - phase) * clip.length / delta

func preview(clip: StringName) -> void:
	assert(LIBRARY.has_animation(clip) or JOG.has_animation(clip))
	if character_locomotion != null:
		character_locomotion.set_active(false)
	set_enabled(true)
	current_state = clip
	playback.start(clip)

func advance_preview(delta: float, rate: float = 1.0) -> void:
	if enabled:
		tree.set("parameters/Locomotion/Walk/Rate/scale", 1.0)
		tree.set("parameters/Locomotion/Run/Rate/scale", 1.0)
		tree.set("parameters/Locomotion/mission_jog/Rate/scale", 1.0)
		tree.set("parameters/Rate/scale", rate)
		if combat_bridge != null:
			combat_bridge.advance(delta)
		tree.advance(delta)

func set_enabled(value: bool) -> void:
	enabled = value
	if character_locomotion != null and character_locomotion.active and not value:
		character_locomotion.set_active(false)
	var legacy_active: bool = value and (character_locomotion == null or not character_locomotion.active)
	if tree != null:
		tree.active = legacy_active
	if retarget != null:
		retarget.active = legacy_active
	if locomotion_layer != null:
		locomotion_layer.active = legacy_active
	if combat_bridge != null:
		combat_bridge.constraint.active = legacy_active

func _collect_skinned_meshes(node: Node, result: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D and (node as MeshInstance3D).skin != null:
		result.append(node as MeshInstance3D)
	for child in node.get_children():
		_collect_skinned_meshes(child, result)
