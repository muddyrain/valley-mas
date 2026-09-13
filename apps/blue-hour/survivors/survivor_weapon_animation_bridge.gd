extends Node
## Gameplay owns targets, ammunition and attacks. This node only consumes their output.
const LIBRARY = preload("res://assets/animations/humanoid/combat/bh_humanoid_long_gun.tres")
const Arm = preload("res://survivors/humanoid_arm_constraint.gd")
const Constraint = preload("res://survivors/survivor_combat_constraint.gd")
enum VisualState { EXPLORATION, READY, AIM, SHOOT }

var visual_state: VisualState = VisualState.EXPLORATION
var combat_weight: float = 0.0
var aim_weight: float = 0.0
var aim_direction := Vector3.ZERO
var aim_point := Vector3.ZERO
var aiming: bool = false
var in_combat: bool = true
var reloading: bool = false
var constraint: SkeletonModifier3D
var _visual: WeaponVisualController
var _combat: WeaponCombatController
var _tree: AnimationTree
var _source: Skeleton3D
var _shot_requested: bool = false
var shoot_requested_this_frame: bool = false
var shoot_requests: int = 0

func initialize(controller: Node3D, visual: WeaponVisualController, combat: WeaponCombatController) -> void:
	_visual = visual
	_combat = combat
	_tree = controller.tree
	_source = controller.source
	controller.player.add_animation_library(&"Combat", LIBRARY)
	# Preserve Locomotion and its independent playback rates exactly as authored.
	var graph := _tree.tree_root.duplicate(true) as AnimationNodeBlendTree
	var ready := AnimationNodeAnimation.new()
	ready.animation = &"Combat/long_gun_ready"
	var aim := AnimationNodeAnimation.new()
	aim.animation = &"Combat/long_gun_aim"
	var shoot := AnimationNodeAnimation.new()
	shoot.animation = &"Combat/long_gun_shoot"
	var aim_blend := AnimationNodeBlend2.new()
	var shot := AnimationNodeOneShot.new()
	shot.fadein_time = .018
	shot.fadeout_time = .075
	var layer := AnimationNodeBlend2.new()
	layer.filter_enabled = true
	for bone in Arm.upper_body_bones(_source):
		layer.set_filter_path(NodePath("Skeleton3D:" + _source.get_bone_name(bone)), true)
	graph.add_node(&"WeaponReady", ready)
	graph.add_node(&"WeaponAim", aim)
	graph.add_node(&"WeaponShoot", shoot)
	graph.add_node(&"AimBlend", aim_blend)
	graph.add_node(&"Shot", shot)
	graph.add_node(&"CombatLayer", layer)
	graph.connect_node(&"AimBlend", 0, &"WeaponReady")
	graph.connect_node(&"AimBlend", 1, &"WeaponAim")
	graph.connect_node(&"Shot", 0, &"AimBlend")
	graph.connect_node(&"Shot", 1, &"WeaponShoot")
	graph.disconnect_node(&"output", 0)
	graph.connect_node(&"CombatLayer", 0, &"Rate")
	graph.connect_node(&"CombatLayer", 1, &"Shot")
	graph.connect_node(&"output", 0, &"CombatLayer")
	_tree.tree_root = graph
	controller.playback = _tree.get("parameters/Locomotion/playback") as AnimationNodeStateMachinePlayback
	controller.playback.start(controller.current_state)
	constraint = Constraint.new()
	constraint.name = "HumanoidCombatConstraint"
	constraint.bridge = self
	constraint.visual = visual
	controller.target.add_child(constraint)
	constraint.initialize()
	combat.fired.connect(_on_fired)
	combat.reload_started.connect(_on_reload_started)
	combat.reload_finished.connect(_on_reload_finished)
	visual.weapon_changed.connect(_on_weapon_changed)
	_on_weapon_changed()

func uses_long_gun() -> bool:
	return _visual.definition != null and _visual.definition.animation_profile == WeaponDefinition.WeaponType.LONG_GUN

func set_gameplay_state(combat_active: bool, has_aim: bool, target_point: Vector3, actor_position: Vector3) -> void:
	in_combat = combat_active
	aiming = has_aim and combat_active
	aim_point = target_point
	aim_direction = (target_point - actor_position) if aiming else Vector3.ZERO
	aim_direction.y = 0.0
	aim_direction = aim_direction.normalized()

func advance(delta: float) -> void:
	if delta <= 0:
		return
	_visual.advance_flash(delta)
	var supported := uses_long_gun() and _visual.model != null
	var engaged := supported and in_combat
	combat_weight = move_toward(combat_weight, 1.0 if engaged else 0.0, delta / .16)
	aim_weight = move_toward(aim_weight, 1.0 if aiming and engaged else 0.0, delta / .12)
	_tree.set("parameters/CombatLayer/blend_amount", smoothstep(0.0, 1.0, combat_weight))
	_tree.set("parameters/AimBlend/blend_amount", smoothstep(0.0, 1.0, aim_weight))
	shoot_requested_this_frame = _shot_requested
	if _shot_requested:
		_tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
		shoot_requests += 1
		_shot_requested = false
	constraint.update_aim(delta)
	if not engaged:
		visual_state = VisualState.EXPLORATION
	elif shoot_requested_this_frame or bool(_tree.get("parameters/Shot/active")):
		visual_state = VisualState.SHOOT
	else:
		visual_state = VisualState.AIM if aiming else VisualState.READY

func _on_fired(_pellets: Array) -> void:
	if uses_long_gun() and in_combat:
		_shot_requested = true
		_visual.flash_muzzle()

func _on_reload_started() -> void:
	reloading = true

func _on_reload_finished() -> void:
	reloading = false

func _on_weapon_changed() -> void:
	_shot_requested = false
	aiming = false
	aim_direction = Vector3.ZERO
	reloading = _combat.reload_left > 0.0
	_tree.set("parameters/Shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_ABORT)
	# Existing sidearm/melee stances are the explicit fallback; never overlap long_gun.
	if _visual.definition != null and not uses_long_gun():
		combat_weight = 0.0
		aim_weight = 0.0
		_tree.set("parameters/CombatLayer/blend_amount", 0.0)
		visual_state = VisualState.EXPLORATION

func _exit_tree() -> void:
	if is_instance_valid(constraint) and not constraint.is_queued_for_deletion():
		constraint.queue_free()
