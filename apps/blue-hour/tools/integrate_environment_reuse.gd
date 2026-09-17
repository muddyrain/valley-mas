extends SceneTree
## Offline wrapper assembly. Existing render resources remain shared; sources are never saved.

const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Dressing = preload("res://camp/camp_dressing.gd")
const Definition = preload("res://data/world_asset_data.gd")
const Wrapper = preload("res://maps/world/world_asset.gd")
const ITEMS: Array[Array] = [
	["PRP_003_park_bench", "park/park_bench", "environment_bench_model", PI, 1.0],
	["PRP_004_pallet", "industrial/pallet", "environment_pallet_model", 0.0, 1.0],
	["PRP_005_wood_crate", "industrial/wood_crate", "environment_wood_crate_model", PI, 0.2],
	["PRP_006_metal_crate", "industrial/metal_crate", "environment_metal_crate_model", PI, 1.0],
	["PRP_008_direction_sign", "street/direction_sign", "environment_road_sign_model", PI, 0.5],
	["PRP_009_vending_machine", "street/vending_machine", "environment_vending_machine_model", PI, 0.5],
	["PRP_011_planter", "street/planter", "camp_planter", 0.0, 0.1],
	["BAR_002_residential_low_fence", "residential_low_fence", "camp_low_fence", 0.0, 0.6],
	["BAR_003_concrete_barrier", "concrete_barrier", "environment_barrier_concrete_model", 0.0, 0.3],
	["BAR_004_metal_barricade", "metal_barricade", "environment_barricade_metal_model", 0.0, 0.1],
	["BAR_005_chainlink_damaged", "industrial_chainlink_damaged", "chainlink_damaged", 0.0, 0.1]
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for item: Array in ITEMS:
		var wrapper := Node3D.new()
		wrapper.name = "WorldAsset"
		wrapper.set_script(Wrapper)
		wrapper.set("asset_id", item[0])
		wrapper.add_to_group("world_assets", true)
		var visual := _visual(item[2])
		visual.name = "ModelRoot"
		wrapper.add_child(visual)
		if not visual.scene_file_path.is_empty():
			wrapper.set_editable_instance(visual, true)
		visual.rotation.y = item[3]
		var source_box := Geometry.bounds(wrapper)
		visual.position = -Vector3(source_box.get_center().x, source_box.position.y, source_box.get_center().z)
		var box := Geometry.bounds(wrapper)
		var collision_box := box
		if item[2] == "camp_planter":
			collision_box = AABB(Vector3(-0.3475, 0, -0.21), Vector3(0.695, 0.396, 0.42))
		elif item[2] == "environment_road_sign_model":
			collision_box = AABB(Vector3(-0.13, 0, -0.13), Vector3(0.26, 2.47, 0.26))
		var body := StaticBody3D.new()
		body.name = "Collision"
		wrapper.add_child(body)
		var shape := CollisionShape3D.new()
		shape.name = "Shape"
		shape.shape = BoxShape3D.new()
		shape.shape.size = collision_box.size
		shape.position = collision_box.get_center()
		body.add_child(shape)
		var anchors := Node3D.new()
		anchors.name = "Anchors"
		wrapper.add_child(anchors)
		for marker_name: String in ["GroundAnchor", "FrontMarker", "RoadAnchor"]:
			var marker := Marker3D.new()
			marker.name = marker_name
			marker.position = Vector3.ZERO if marker_name == "GroundAnchor" else Vector3(0, 0, -box.size.z * 0.5 - 0.4)
			anchors.add_child(marker)
		if item[2] == "camp_low_fence":
			for side: int in [-1, 1]:
				var end := Marker3D.new()
				end.name = "SegmentStart" if side == -1 else "SegmentEnd"
				end.position.x = side * box.size.x * 0.5
				anchors.add_child(end)
		_own(wrapper, wrapper)
		var scene := PackedScene.new()
		if scene.pack(wrapper) != OK:
			quit(1)
			return
		var folder := "barriers/" if String(item[0]).begins_with("BAR_") else "props/"
		var path: String = "res://scenes/world/" + folder + item[1] + ".tscn"
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
		if ResourceSaver.save(scene, path) != OK:
			quit(1)
			return
		var definition := Definition.new()
		definition.id = item[0]
		definition.scene = load(path)
		definition.category = "barrier" if folder == "barriers/" else String(item[1]).get_base_dir()
		definition.footprint = Vector2(box.size.x, box.size.z)
		definition.bounding_size = box.size
		definition.spawn_weight = item[4]
		definition.searchable = false
		definition.loot_profile = ""
		definition.enemy_profile = ""
		if ResourceSaver.save(definition, "res://data/world_assets/" + String(item[1]).get_file() + ".tres") != OK:
			quit(1)
			return
		print("REUSE WRAPPER " + item[0] + " " + str(box.size))
		wrapper.free()
	quit()

func _own(node: Node, owner_node: Node) -> void:
	for child: Node in node.get_children():
		child.owner = owner_node
		if child.scene_file_path.is_empty():
			_own(child, owner_node)

func _visual(source_id: String) -> Node3D:
	if source_id.begins_with("camp_"):
		return _camp_recipe(source_id)
	var path := "res://assets/generated/" + source_id + ".glb"
	if source_id == "chainlink_damaged":
		path = "res://assets/world/barriers/barrier_chainlink_source_model.glb"
	var source: Node3D = load(path).instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
	# Store instance overrides, retaining the imported scene and its shared resources.
	for shape: CollisionShape3D in source.find_children("*", "CollisionShape3D", true, false):
		shape.disabled = true
	return source

func _camp_recipe(id: String) -> Node3D:
	var dressing := Dressing.new()
	if id == "camp_planter":
		dressing._planter(Vector3.ZERO, 0.65)
	else:
		var source: Node3D = load("res://scenes/camp/camp_main.tscn").instantiate()
		var camp := Node3D.new()
		var navigation := Node3D.new()
		navigation.name = "NavigationSource"
		camp.add_child(navigation)
		var boundaries := Node3D.new()
		boundaries.name = "BoundaryBlockouts"
		navigation.add_child(boundaries)
		var body: Node3D = source.get_node("NavigationSource/BoundaryBlockouts/RearLeft").duplicate()
		body.position = Vector3(0, 0.225, 0)
		boundaries.add_child(body)
		dressing._camp = camp
		dressing._boundary_fences()
		camp.free()
		source.free()
	var visual := Node3D.new()
	for material_id: String in dressing._surfaces:
		if id == "camp_low_fence" and material_id == "warm":
			continue
		var mesh := MeshInstance3D.new()
		mesh.name = material_id
		mesh.mesh = dressing._surfaces[material_id].commit()
		visual.add_child(mesh)
	dressing.free()
	return visual
