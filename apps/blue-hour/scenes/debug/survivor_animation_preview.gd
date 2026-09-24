extends Node3D
## Debug-only weapon attachment for survivor pose calibration captures.

const CHARACTER_NAME: StringName = &"XiaZhiyao"
const RIGHT_HAND: StringName = &"RightHand"
const WEAPON_SCENE: PackedScene = preload("res://assets/generated/weapon_submachine_gun_model.glb")
const LONG_GUN_PROFILE: WeaponPoseProfile = preload("res://data/weapon_poses/long_gun.tres")
const PREVIEW_WEAPON_SCALE: float = 0.84

func _ready() -> void:
	call_deferred("_attach_preview_weapon")

func _attach_preview_weapon() -> void:
	var character := get_node_or_null(NodePath(String(CHARACTER_NAME))) as Node3D
	if character == null:
		push_error("Survivor preview character is missing")
		return
	var skeleton := _find_skeleton(character)
	if skeleton == null or skeleton.find_bone(RIGHT_HAND) < 0:
		push_error("Survivor preview skeleton or RightHand is missing")
		return
	var weapon_instance := WEAPON_SCENE.instantiate() as Node3D
	if weapon_instance == null:
		push_error("Preview SMG root is not a Node3D")
		return
	var weapon_root := _find_named_node(weapon_instance, &"WeaponRoot") as Node3D
	var owns_weapon_instance := weapon_root == null
	if owns_weapon_instance:
		weapon_root = weapon_instance
	var right_grip := _find_named_node(weapon_root, &"GripPoint_R") as Node3D
	var grip_transform := right_grip.transform if right_grip != null else Transform3D.IDENTITY
	var attachment := BoneAttachment3D.new()
	attachment.name = "PreviewSMGAttachment"
	attachment.bone_name = RIGHT_HAND
	skeleton.add_child(attachment)
	if not owns_weapon_instance:
		weapon_root.reparent(attachment, false)
		weapon_instance.free()
	else:
		attachment.add_child(weapon_root)
	weapon_root.transform = LONG_GUN_PROFILE.attachment_transform() * grip_transform.affine_inverse()
	weapon_root.scale = Vector3.ONE * PREVIEW_WEAPON_SCALE

func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child: Node in node.get_children():
		var result := _find_skeleton(child)
		if result != null:
			return result
	return null

func _find_named_node(node: Node, target_name: StringName) -> Node:
	if node.name == target_name:
		return node
	for child: Node in node.get_children():
		var result := _find_named_node(child, target_name)
		if result != null:
			return result
	return null
