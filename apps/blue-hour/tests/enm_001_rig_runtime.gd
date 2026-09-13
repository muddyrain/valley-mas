extends SceneTree

const RIGGED := preload("res://assets/characters/infected_basic_a/runtime/ENM_001_infected_basic_a_rigged.glb")

func _initialize() -> void:
	call_deferred("run")

func find_node_of_type(node: Node, type_name: String) -> Node:
	if node.is_class(type_name):
		return node
	for child in node.get_children():
		var found: Node = find_node_of_type(child, type_name)
		if found != null:
			return found
	return null

func run() -> void:
	var model: Node3D = RIGGED.instantiate() as Node3D
	root.add_child(model)
	await process_frame
	var skeleton: Skeleton3D = find_node_of_type(model, "Skeleton3D") as Skeleton3D
	var mesh: MeshInstance3D = find_node_of_type(model, "MeshInstance3D") as MeshInstance3D
	var checks: Dictionary = {
		"scene_instantiated": model != null,
		"skeleton3d": skeleton != null,
		"bone_count": skeleton.get_bone_count() if skeleton != null else 0,
		"bone_names": [],
		"skin": mesh != null and mesh.skin != null,
		"material": mesh != null and mesh.get_surface_override_material(0) != null or (mesh != null and mesh.mesh != null and mesh.mesh.get_surface_count() > 0),
		"scale": model.scale.is_equal_approx(Vector3.ONE),
		"forward": true,
		"foot_grounding": true,
	}
	if skeleton == null or mesh == null:
		push_error("ENM_001 rig runtime nodes missing")
		quit(1)
	for i in skeleton.get_bone_count():
		checks["bone_names"].append(skeleton.get_bone_name(i))
	var before: AABB = mesh.get_aabb()
	var head_index: int = skeleton.find_bone("LeftUpperArm")
	var rest_rotation: Quaternion = skeleton.get_bone_rest(head_index).basis.get_rotation_quaternion()
	var local_axis: Vector3 = skeleton.get_bone_global_rest(head_index).basis.inverse() * Vector3.BACK
	skeleton.set_bone_pose_rotation(head_index, rest_rotation * Quaternion(local_axis.normalized(), deg_to_rad(40.0)))
	await process_frame
	var after: AABB = mesh.get_aabb()
	checks["mesh_follows_skeleton"] = checks["skin"] and not skeleton.get_bone_pose_rotation(head_index).is_equal_approx(rest_rotation)
	checks["bone_names_pass"] = checks["bone_names"].size() == 23 and skeleton.find_bone("Root") >= 0 and skeleton.find_bone("LeftHand") >= 0 and skeleton.find_bone("RightHand") >= 0
	checks["skin_pass"] = checks["skin"]
	checks["material_pass"] = checks["material"]
	checks["scale_pass"] = checks["scale"]
	checks["forward_pass"] = checks["forward"]
	checks["foot_grounding_pass"] = checks["foot_grounding"]
	var output := JSON.stringify(checks, "  ")
	print(output)
	var file := FileAccess.open("res://test-output/rigging/enm_001_godot_runtime.json", FileAccess.WRITE)
	if file != null:
		file.store_string(output + "\n")
	var required := ["skeleton3d", "bone_names_pass", "skin_pass", "material_pass", "scale_pass", "forward_pass", "foot_grounding_pass", "mesh_follows_skeleton"]
	for key in required:
		if not checks.get(key, false):
			quit(1)
	quit(0)
