class_name WeaponVisualController
extends Node3D
## Presentation only. Combat remains valid with no skeleton or model.
signal weapon_changed
const PoseModifier = preload("res://weapons/weapon_pose_modifier.gd")
const MuzzleFlash = preload("res://vfx/muzzle_flash.gd")
const RIGHT_HAND: StringName = &"RightHand"
const SOCKET_NAME: StringName = &"WeaponSocket_R"
const GRIP_RIGHT: NodePath = ^"GripPoint_R"
const GRIP_LEFT: NodePath = ^"GripPoint_L"
const MUZZLE: NodePath = ^"MuzzlePoint"
const PROFILES: Array[WeaponPoseProfile] = [
	preload("res://data/weapon_poses/melee_short.tres"),
	preload("res://data/weapon_poses/sidearm.tres"),
	preload("res://data/weapon_poses/long_gun.tres")
]

var definition: Resource
var socket: BoneAttachment3D
var model: Node3D
var pose_modifier: SkeletonModifier3D
var muzzle_flash: MeshInstance3D

func initialize(skeleton: Skeleton3D) -> void:
	# The caller supplies the skinned target after retargeting has moved its nodes.
	if is_instance_valid(socket):
		return
	if skeleton == null or skeleton.find_bone(RIGHT_HAND) < 0:
		return
	socket = BoneAttachment3D.new()
	socket.name = SOCKET_NAME
	socket.bone_name = RIGHT_HAND
	skeleton.add_child(socket)
	pose_modifier = PoseModifier.new()
	pose_modifier.name = "WeaponReadyPose"
	skeleton.add_child(pose_modifier)
	attach_weapon_visual()

func set_weapon(value: Resource) -> void:
	definition = value
	attach_weapon_visual()
	weapon_changed.emit()

func attach_weapon_visual() -> void:
	muzzle_flash = null
	if is_instance_valid(model):
		model.get_parent().remove_child(model)
		model.queue_free()
	model = null
	if is_instance_valid(pose_modifier):
		pose_modifier.profile = null
	if not is_instance_valid(socket) or definition == null or definition.model_path.is_empty():
		return
	if not ResourceLoader.exists(definition.model_path, "PackedScene"):
		return
	var scene := load(definition.model_path) as PackedScene
	if scene == null:
		return
	var instance := scene.instantiate() as Node3D
	if instance == null:
		return
	# Godot adds a filename root around Blender's explicit WeaponRoot.
	if instance.name != &"WeaponRoot":
		var weapon_root := instance.get_node_or_null(^"WeaponRoot") as Node3D
		if weapon_root == null:
			instance.free()
			return
		instance.remove_child(weapon_root)
		instance.free()
		instance = weapon_root
	var grip := instance.get_node_or_null(GRIP_RIGHT) as Node3D
	if grip == null:
		instance.free()
		return
	var index: int = definition.animation_profile
	if index < 0 or index >= PROFILES.size():
		instance.free()
		return
	var profile := PROFILES[index]
	model = instance
	socket.add_child(model)
	model.transform = profile.attachment_transform() * grip.transform.affine_inverse()
	# Long guns now use the shared upper-body AnimationTree layer.
	pose_modifier.profile = profile if index != WeaponDefinition.WeaponType.LONG_GUN else null
	var muzzle := get_muzzle_point()
	if index == WeaponDefinition.WeaponType.LONG_GUN and muzzle != null:
		muzzle_flash = MuzzleFlash.new()
		muzzle_flash.name = "MuzzleFlash"
		muzzle.add_child(muzzle_flash)

func flash_muzzle() -> void:
	if is_instance_valid(muzzle_flash):
		muzzle_flash.trigger()

func advance_flash(delta: float) -> void:
	if is_instance_valid(muzzle_flash):
		muzzle_flash.advance(delta)

func get_muzzle_point() -> Node3D:
	return model.get_node_or_null(MUZZLE) as Node3D if is_instance_valid(model) else null

func get_support_grip() -> Node3D:
	return model.get_node_or_null(GRIP_LEFT) as Node3D if is_instance_valid(model) else null

func get_marker_transform(marker: Node3D, skeleton: Skeleton3D) -> Transform3D:
	# Resolve through the one formal socket while its bone is being modified.
	var hand_pose := skeleton.get_bone_global_pose(socket.bone_idx)
	return skeleton.global_transform * hand_pose * model.transform * marker.transform

func _exit_tree() -> void:
	# Sockets live under the rig, so disposing this controller also removes its output.
	if is_instance_valid(socket) and not socket.is_queued_for_deletion():
		socket.queue_free()
	if is_instance_valid(pose_modifier) and not pose_modifier.is_queued_for_deletion():
		pose_modifier.queue_free()
