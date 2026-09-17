extends SceneTree
## Static bind/rest verification. No animation, retargeting or gameplay is evaluated.

const SCENE_PATH: String = "res://assets/characters/survivor_animation_template/survivor_animation_template.tscn"
const SOURCE_PATH: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template.fbx"
const OUT: String = "res://test-output/standard-survivor-baseline/"

var checks: int = 0
var failures: Array[String] = []
var checked_dependencies: Dictionary[String, bool] = {}
var actor: Node3D
var skeleton: Skeleton3D
var report: Dictionary = {}
var points: Array[Vector3] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func xyz(value: Vector3) -> Array[float]:
	return [value.x, value.y, value.z]

func transform_data(value: Transform3D) -> Dictionary:
	return {"origin": xyz(value.origin), "scale": xyz(value.basis.get_scale()), "x": xyz(value.basis.x), "y": xyz(value.basis.y), "z": xyz(value.basis.z)}

func inspect_dependencies(resource_path: String) -> void:
	if checked_dependencies.has(resource_path):
		return
	checked_dependencies[resource_path] = true
	check(ResourceLoader.exists(resource_path), "Resource exists: " + resource_path)
	for dependency: String in ResourceLoader.get_dependencies(resource_path):
		var fields: PackedStringArray = dependency.split("::")
		var resolved: String = fields[fields.size() - 1]
		if fields[0].begins_with("uid://"):
			var id: int = ResourceUID.text_to_id(fields[0])
			check(ResourceUID.has_id(id), "Registered dependency UID: " + fields[0])
			if ResourceUID.has_id(id):
				check(ResourceUID.get_id_path(id) == resolved, "UID matches resource path")
		inspect_dependencies(resolved)

func bone_world(name: String) -> Transform3D:
	var index: int = skeleton.find_bone("mixamorig_" + name)
	assert(index >= 0, name)
	return skeleton.global_transform * skeleton.get_bone_global_rest(index)

func inspect_mesh(mesh: MeshInstance3D) -> Dictionary:
	check(mesh.skin != null, "Skin exists")
	check(mesh.get_node_or_null(mesh.skeleton) == skeleton, "Mesh targets the template skeleton")
	check(mesh.global_transform.is_equal_approx(skeleton.global_transform), "Mesh and skeleton share the FBX unit transform")
	var scale: Vector3 = mesh.global_basis.get_scale()
	check(is_equal_approx(scale.x, scale.y) and is_equal_approx(scale.y, scale.z), "Uniform source units")
	var skin: Skin = mesh.skin
	var bind_bones: Array[int] = []
	for bind: int in skin.get_bind_count():
		var bone: int = skeleton.find_bone(skin.get_bind_name(bind)) if not skin.get_bind_name(bind).is_empty() else skin.get_bind_bone(bind)
		check(bone >= 0 and bone < skeleton.get_bone_count(), "Skin bind resolves")
		check(skin.get_bind_pose(bind).is_finite(), "Finite inverse bind")
		bind_bones.append(bone)
	var unweighted: int = 0
	var invalid: int = 0
	var max_influences: int = 0
	var min_sum: float = INF
	var max_sum: float = -INF
	var max_bind_error: float = 0.0
	var triangle_count: int = 0
	for surface: int in mesh.mesh.get_surface_count():
		var material: StandardMaterial3D = mesh.get_active_material(surface) as StandardMaterial3D
		check(material != null and material.albedo_texture != null, "Source albedo resolves")
		var arrays: Array = mesh.mesh.surface_get_arrays(surface)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
		var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
		triangle_count += indices.size() / 3
		var influences: int = weights.size() / vertices.size()
		check(influences in [4, 8] and bones.size() == weights.size(), "Valid skin arrays")
		for vertex: int in vertices.size():
			var world: Vector3 = mesh.global_transform * vertices[vertex]
			points.append(world)
			var total: float = 0.0
			var count: int = 0
			var skinned: Vector3 = Vector3.ZERO
			for influence: int in influences:
				var offset: int = vertex * influences + influence
				var weight: float = weights[offset]
				var bind: int = bones[offset]
				if not is_finite(weight) or weight < 0.0 or bind < 0 or bind >= bind_bones.size():
					invalid += 1
					continue
				if weight > 0.0:
					count += 1
					total += weight
					skinned += (skeleton.global_transform * skeleton.get_bone_global_rest(bind_bones[bind]) * skin.get_bind_pose(bind) * vertices[vertex]) * weight
			if count == 0:
				unweighted += 1
			max_influences = maxi(max_influences, count)
			min_sum = minf(min_sum, total)
			max_sum = maxf(max_sum, total)
			max_bind_error = maxf(max_bind_error, skinned.distance_to(world))
	check(unweighted == 0 and invalid == 0, "All vertices have valid skin weights")
	check(absf(min_sum - 1.0) < 0.0001 and absf(max_sum - 1.0) < 0.0001, "Weights normalized")
	check(max_bind_error < 0.0001, "Rest skin agrees with source mesh")
	return {"path": str(actor.get_path_to(mesh)), "transform": transform_data(mesh.global_transform), "skin_bind_count": skin.get_bind_count(), "unweighted_vertices": unweighted, "invalid_weights": invalid, "min_weight_sum": min_sum, "max_weight_sum": max_sum, "max_influences": max_influences, "max_rest_bind_error_m": max_bind_error, "triangles": triangle_count}

func inspect_foot(side: String, minimum: float) -> Dictionary:
	var foot: Vector3 = bone_world(side + "Foot").origin
	var toe: Vector3 = bone_world(side + "ToeBase").origin
	var end: Vector3 = bone_world(side + "Toe_End").origin
	var forward: Vector3 = Vector3(toe.x - foot.x, 0.0, toe.z - foot.z).normalized()
	var sole: Array[Vector3] = []
	var back: float = INF
	var front: float = -INF
	for point: Vector3 in points:
		if point.x * signf(foot.x) > 0.0 and point.y < minimum + 0.06:
			sole.append(point)
			back = minf(back, point.dot(forward))
			front = maxf(front, point.dot(forward))
	var heel_min: float = INF
	var forefoot_min: float = INF
	for point: Vector3 in sole:
		var depth: float = point.dot(forward)
		if depth <= lerpf(back, front, 0.3):
			heel_min = minf(heel_min, point.y)
		if depth >= lerpf(back, front, 0.7):
			forefoot_min = minf(forefoot_min, point.y)
	check(absf(heel_min) < 0.003 and absf(forefoot_min) < 0.003, side + " heel and forefoot near Y=0")
	check(toe.y < foot.y and absf(toe.y - end.y) < 0.002, side + " ankle/toe rest chain")
	return {"foot": xyz(foot), "toe_base": xyz(toe), "toe_end": xyz(end), "heel_min_y": heel_min, "forefoot_min_y": forefoot_min, "sole_vertices": sole.size(), "forward": xyz(forward)}

func run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	inspect_dependencies(SCENE_PATH)
	var packed: PackedScene = load(SCENE_PATH) as PackedScene
	assert(packed != null)
	actor = packed.instantiate() as Node3D
	root.add_child(actor)
	await process_frame
	check(actor.transform.is_equal_approx(Transform3D.IDENTITY), "Template root identity")
	check((actor.get_node("Model") as Node3D).transform.is_equal_approx(Transform3D.IDENTITY), "No model offset or scale correction")
	check(actor.find_children("*", "AnimationPlayer", true, false).is_empty(), "No AnimationPlayer")
	check(actor.find_children("*", "AnimationTree", true, false).is_empty(), "No AnimationTree")
	var skeletons: Array[Node] = actor.find_children("*", "Skeleton3D", true, false)
	check(skeletons.size() == 1, "One template Skeleton3D")
	skeleton = skeletons[0] as Skeleton3D
	check(skeleton.get_bone_count() == 28, "28 source bones")
	var hierarchy: Array[Dictionary] = []
	for bone: int in skeleton.get_bone_count():
		var parent: int = skeleton.get_bone_parent(bone)
		var rest: Transform3D = skeleton.get_bone_rest(bone)
		check(rest.is_finite(), "Finite rest transform")
		check(skeleton.get_bone_pose(bone).is_equal_approx(rest), "Default pose equals rest: " + skeleton.get_bone_name(bone))
		hierarchy.append({"name": skeleton.get_bone_name(bone), "parent": skeleton.get_bone_name(parent) if parent >= 0 else "", "world_rest": transform_data(skeleton.global_transform * skeleton.get_bone_global_rest(bone))})
	check(skeleton.get_bone_parent(skeleton.find_bone("mixamorig_Hips")) == -1, "Hips is the root bone")
	for side: String in ["Left", "Right"]:
		var chain: Array[String] = ["Hips", side + "UpLeg", side + "Leg", side + "Foot", side + "ToeBase", side + "Toe_End"]
		for index: int in range(1, chain.size()):
			check(skeleton.get_bone_parent(skeleton.find_bone("mixamorig_" + chain[index])) == skeleton.find_bone("mixamorig_" + chain[index - 1]), "Correct leg hierarchy")
	var meshes: Array[Dictionary] = []
	for node: Node in actor.find_children("*", "MeshInstance3D", true, false):
		meshes.append(inspect_mesh(node as MeshInstance3D))
	check(meshes.size() == 1, "One source skinned mesh")
	var bounds: AABB = AABB(points[0], Vector3.ZERO)
	for point: Vector3 in points:
		bounds = bounds.expand(point)
	check(absf(bounds.size.y - 1.65) < 0.001, "Native height is 1.65m")
	check(absf(bounds.position.y) < 0.001, "Rest soles at Y=0 without correction")
	var source_uid: int = ResourceLoader.get_resource_uid(SOURCE_PATH)
	check(source_uid != ResourceUID.INVALID_ID and ResourceUID.has_id(source_uid), "Source UID registered")
	check(ResourceUID.get_id_path(source_uid) == SOURCE_PATH, "Source UID path matches")
	report = {"engine": Engine.get_version_info().string, "scene": SCENE_PATH, "source_uid": ResourceUID.id_to_text(source_uid), "height_m": bounds.size.y, "bounds_min": xyz(bounds.position), "bounds_max": xyz(bounds.end), "vertex_count": points.size(), "bone_count": skeleton.get_bone_count(), "skeleton_transform": transform_data(skeleton.global_transform), "bones": hierarchy, "meshes": meshes, "feet": {"left": inspect_foot("Left", bounds.position.y), "right": inspect_foot("Right", bounds.position.y)}, "dependencies": checked_dependencies.keys(), "checks": checks, "failures": failures}
	if "capture" in OS.get_cmdline_user_args():
		await capture()
	report["checks"] = checks
	report["failures"] = failures
	var output: FileAccess = FileAccess.open(OUT + "godot-audit.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	output.close()
	print("STANDARD SURVIVOR: ", checks, " checks; height=", bounds.size.y, "; bones=", skeleton.get_bone_count(), "; failures=", failures)
	actor.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)

func capture() -> void:
	var environment: WorldEnvironment = WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color(0.22, 0.25, 0.28)
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.65
	root.add_child(environment)
	var light: DirectionalLight3D = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45.0, -35.0, 0.0)
	light.light_energy = 1.0
	light.shadow_enabled = true
	root.add_child(light)
	var floor_mesh: MeshInstance3D = MeshInstance3D.new()
	var plane: PlaneMesh = PlaneMesh.new()
	plane.size = Vector2(6.0, 6.0)
	floor_mesh.mesh = plane
	var material: StandardMaterial3D = StandardMaterial3D.new()
	material.albedo_color = Color(0.42, 0.44, 0.46)
	material.roughness = 1.0
	floor_mesh.material_override = material
	root.add_child(floor_mesh)
	var camera: Camera3D = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	root.add_child(camera)
	camera.make_current()
	var views: Array[Dictionary] = [
		{"name": "front", "eye": Vector3(0, 0.85, 4), "target": Vector3(0, 0.85, 0), "size": 1.95},
		{"name": "left", "eye": Vector3(4, 0.85, 0), "target": Vector3(0, 0.85, 0), "size": 1.95},
		{"name": "right", "eye": Vector3(-4, 0.85, 0), "target": Vector3(0, 0.85, 0), "size": 1.95},
		{"name": "three_quarter", "eye": Vector3(3, 1.2, 4), "target": Vector3(0, 0.83, 0), "size": 1.95},
		{"name": "feet_front", "eye": Vector3(0, 0.14, 3), "target": Vector3(0, 0.11, 0), "size": 0.38},
		{"name": "feet_left", "eye": Vector3(3, 0.13, 0), "target": Vector3(0, 0.10, 0), "size": 0.32},
		{"name": "feet_right", "eye": Vector3(-3, 0.13, 0), "target": Vector3(0, 0.10, 0), "size": 0.32},
	]
	for view: Dictionary in views:
		camera.position = view.eye
		camera.look_at(view.target)
		camera.size = view.size
		for frame: int in 3:
			await process_frame
			await RenderingServer.frame_post_draw
		var screenshot: Image = root.get_texture().get_image()
		check(screenshot.save_png(OUT + view.name + ".png") == OK, "Save native capture")
	floor_mesh.queue_free()
	camera.queue_free()
	light.queue_free()
	environment.queue_free()
