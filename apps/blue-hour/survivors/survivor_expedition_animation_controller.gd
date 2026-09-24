extends "res://survivors/survivor_animation_pipeline.gd"
## Xia's Expedition presentation uses the existing eleven-clip library on the formal rig.

const PublicLibrary: AnimationLibrary = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const AimModifier = preload("res://survivors/survivor_expedition_aim_modifier.gd")
const GripModifier = preload("res://survivors/survivor_expedition_grip_modifier.gd")
const MOVE_THRESHOLD: float = 0.08
const HIT_DURATION: float = 0.32
const SHOT_DURATION: float = 0.18

class CombatState:
	extends Node
	enum VisualState { EXPLORATION, READY, AIM, SHOOT }
	var visual_state: VisualState = VisualState.EXPLORATION
	var combat_weight: float = 0.0
	var aim_direction: Vector3 = Vector3.ZERO
	var aiming: bool = false
	var in_combat: bool = false
	var reloading: bool = false
	var shoot_requests: int = 0
	var visual: WeaponVisualController
	var combat: WeaponCombatController

	func _init(weapon_visual: WeaponVisualController, weapon_combat: WeaponCombatController) -> void:
		visual = weapon_visual
		combat = weapon_combat

	func uses_long_gun() -> bool:
		return visual.definition != null and visual.model != null and visual.definition.animation_profile == WeaponDefinition.WeaponType.LONG_GUN

	func uses_knife() -> bool:
		return visual.definition != null and visual.definition.melee and visual.model != null

	func set_gameplay_state(combat_active: bool, has_aim: bool, target_point: Vector3, actor_position: Vector3) -> void:
		in_combat = combat_active
		aiming = combat_active and has_aim
		aim_direction = target_point - actor_position if aiming else Vector3.ZERO
		aim_direction.y = 0.0
		aim_direction = aim_direction.normalized()
		combat_weight = 1.0 if uses_long_gun() and in_combat else 0.0

var source: Skeleton3D
var combat_bridge: CombatState
var aim_modifier: SkeletonModifier3D
var grip_modifier: SkeletonModifier3D
var playback_rate: float = 1.0
var transition_count: int = 0
var active_state: StringName = &"IDLE"
var _render_actor: Node3D
var _render_mission: Node3D
var _motion_speed: float = 0.0
var _motion_base: float = 2.8
var _camp_style: bool = false
var _hit_left: float = 0.0
var _shot_left: float = 0.0
var _knife_left: float = 0.0
var _death_started: bool = false
var _pending_shot: bool = false

func _process(delta: float) -> void:
	if _render_mission == null or _render_actor == null:
		return
	if (not _render_mission.active and not _death_started) or _render_actor.boarding:
		return
	if not _render_mission.is_physics_processing() and not _death_started:
		return
	_advance_runtime(_motion_speed, delta if _death_started and not _render_mission.active else delta * _render_mission.time_scale)

func initialize(model: Node3D) -> bool:
	if not super.initialize(model):
		return false
	source = target
	player.add_animation_library(&"Public", PublicLibrary)
	_configure_runtime_graph()
	current_state = &"Idle"
	return true

func bind_weapon(visual: WeaponVisualController, combat: WeaponCombatController) -> void:
	if combat_bridge != null:
		return
	combat_bridge = CombatState.new(visual, combat)
	combat_bridge.name = "ExpeditionCombatState"
	add_child(combat_bridge)
	aim_modifier = AimModifier.new()
	aim_modifier.name = "ExpeditionAimModifier"
	aim_modifier.bridge = combat_bridge
	target.add_child(aim_modifier)
	aim_modifier.initialize()
	grip_modifier = GripModifier.new()
	grip_modifier.name = "ExpeditionSupportGrip"
	grip_modifier.bridge = combat_bridge
	grip_modifier.visual = visual
	target.add_child(grip_modifier)
	grip_modifier.initialize()
	combat.fired.connect(_on_fired)
	combat.reload_started.connect(_on_reload_started)
	combat.reload_finished.connect(_on_reload_finished)
	visual.weapon_changed.connect(_on_weapon_changed)
	_on_weapon_changed()

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
		_advance_runtime(horizontal_speed, delta)

func on_damage(lethal: bool) -> void:
	if lethal:
		_death_started = true
		_hit_left = 0.0
		_shot_left = 0.0
		_knife_left = 0.0
		_pending_shot = false
		combat_bridge.aiming = false
		combat_bridge.combat_weight = 0.0
		aim_modifier.active = false
		grip_modifier.active = false
		_transition(&"DEATH", true)
		tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_ABORT)
		tree.set("parameters/Hit/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_ABORT)
		tree.advance(0.0)
		return
	if _death_started:
		return
	_hit_left = HIT_DURATION
	tree.set("parameters/Hit/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)

func preview(clip: StringName) -> void:
	var mapped: StringName = {&"Idle": &"IDLE", &"Walk": &"WALK", &"Run": &"RUN"}.get(clip, clip)
	_transition(mapped, true)
	current_state = clip

func advance_preview(delta: float, rate: float = 1.0) -> void:
	playback_rate = rate
	tree.set("parameters/Rate/scale", rate)
	tree.advance(delta)

func set_enabled(value: bool) -> void:
	tree.active = value

func _configure_runtime_graph() -> void:
	var graph := tree.tree_root as AnimationNodeBlendTree
	var rate := AnimationNodeTimeScale.new()
	var shot_clip := AnimationNodeAnimation.new()
	shot_clip.animation = &"Survivor/rifle_shoot"
	var hit_clip := AnimationNodeAnimation.new()
	hit_clip.animation = &"Survivor/hit_reaction"
	var shot := AnimationNodeOneShot.new()
	shot.fadein_time = 0.02
	shot.fadeout_time = 0.08
	var hit := AnimationNodeOneShot.new()
	hit.fadein_time = 0.02
	hit.fadeout_time = 0.08
	shot.filter_enabled = true
	hit.filter_enabled = true
	for bone_name: StringName in [&"Spine", &"Chest", &"UpperChest"]:
		shot.set_filter_path(NodePath("Skeleton3D:" + bone_name), true)
	for bone_index: int in Arm.upper_body_bones(target):
		var bone_path := NodePath("Skeleton3D:" + target.get_bone_name(bone_index))
		hit.set_filter_path(bone_path, true)
	graph.add_node(&"Rate", rate)
	graph.add_node(&"RifleShoot", shot_clip)
	graph.add_node(&"HitReaction", hit_clip)
	graph.add_node(&"Shot", shot)
	graph.add_node(&"Hit", hit)
	graph.disconnect_node(&"output", 0)
	graph.connect_node(&"Rate", 0, &"Locomotion")
	graph.connect_node(&"Shot", 0, &"Rate")
	graph.connect_node(&"Shot", 1, &"RifleShoot")
	graph.connect_node(&"Hit", 0, &"Shot")
	graph.connect_node(&"Hit", 1, &"HitReaction")
	graph.connect_node(&"output", 0, &"Hit")
	tree.tree_root = graph
	playback = tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"IDLE")
	tree.set("parameters/Rate/scale", 1.0)
	tree.advance(0.0)

func _advance_runtime(speed: float, delta: float) -> void:
	if delta <= 0.0 or not tree.active:
		return
	if combat_bridge != null:
		combat_bridge.visual.advance_flash(delta)
		if is_instance_valid(aim_modifier):
			aim_modifier.update_aim(delta)
		if is_instance_valid(grip_modifier):
			grip_modifier.update_grip(delta, speed > MOVE_THRESHOLD)
	var previous_hit: float = _hit_left
	var previous_shot: float = _shot_left
	_hit_left = maxf(0.0, _hit_left - delta)
	_shot_left = maxf(0.0, _shot_left - delta)
	if previous_hit > 0.0 and _hit_left <= 0.0:
		tree.set("parameters/Hit/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	if previous_shot > 0.0 and _shot_left <= 0.0:
		tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	_knife_left = maxf(0.0, _knife_left - delta)
	var armed_rifle: bool = combat_bridge != null and combat_bridge.uses_long_gun() and combat_bridge.in_combat
	var armed_knife: bool = combat_bridge != null and combat_bridge.uses_knife() and combat_bridge.in_combat
	var moving: bool = speed > MOVE_THRESHOLD
	var desired: StringName = &"IDLE"
	if _death_started:
		desired = &"DEATH"
	elif _knife_left > 0.0:
		desired = &"ATTACK"
	elif armed_rifle:
		desired = &"RIFLE_RUN" if moving else &"RIFLE_IDLE"
	elif armed_knife and not moving:
		desired = &"KNIFE_IDLE"
	elif moving:
		desired = &"WALK" if _camp_style else &"RUN"
	if desired != active_state:
		_transition(desired, desired in [&"ATTACK", &"DEATH"])
	current_state = &"Walk" if desired == &"WALK" else &"Run" if moving and not _death_started else &"Idle"
	playback_rate = clampf(speed / maxf(_motion_base, 0.1), 0.55, 1.6) if moving else 1.0
	if desired in [&"ATTACK", &"DEATH"]:
		playback_rate = 1.0
	tree.set("parameters/Rate/scale", playback_rate)
	var can_shoot: bool = armed_rifle and not _death_started and _hit_left <= 0.0
	if _pending_shot and can_shoot:
		tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
		_shot_left = SHOT_DURATION
		combat_bridge.shoot_requests += 1
	_pending_shot = false
	tree.advance(delta)
	if combat_bridge != null:
		combat_bridge.visual_state = CombatState.VisualState.EXPLORATION
		if armed_rifle:
			combat_bridge.visual_state = CombatState.VisualState.SHOOT if bool(tree.get("parameters/Shot/active")) else CombatState.VisualState.AIM if combat_bridge.aiming else CombatState.VisualState.READY

func _transition(state_name: StringName, restart: bool = false) -> void:
	if not super.play_state(state_name, restart):
		return
	active_state = state_name
	transition_count += 1

func _on_fired(_pellets: Array) -> void:
	if combat_bridge == null or _death_started:
		return
	if combat_bridge.uses_long_gun():
		_pending_shot = true
	elif combat_bridge.uses_knife():
		_knife_left = library.get_animation(&"knife_attack").length
		_transition(&"ATTACK", true)

func _on_reload_started() -> void:
	combat_bridge.reloading = true

func _on_reload_finished() -> void:
	combat_bridge.reloading = false

func _on_weapon_changed() -> void:
	_pending_shot = false
	combat_bridge.aiming = false
	combat_bridge.aim_direction = Vector3.ZERO
	combat_bridge.reloading = combat_bridge.combat.reload_left > 0.0
	combat_bridge.combat_weight = 0.0
	combat_bridge.visual_state = CombatState.VisualState.EXPLORATION
	tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_ABORT)
