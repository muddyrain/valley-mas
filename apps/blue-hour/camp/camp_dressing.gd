extends Node3D
## Restrained camp assembly from the existing kit. No gameplay or collision ownership.

const GeneratedAssets = preload("res://vfx/generated_assets.gd")
const WORKBENCH_SCENE = preload("res://scenes/camp/props/CAMP_PROP_001_workbench.tscn")
const STORAGE_SHELF_SCENE = preload("res://scenes/camp/props/CAMP_PROP_002_storage_shelf.tscn")
const NOTICE_BOARD_SCENE = preload("res://scenes/camp/props/CAMP_PROP_003_notice_board.tscn")
const GENERATOR_SCENE = preload("res://scenes/camp/props/CAMP_PROP_004_portable_generator.tscn")
const BUSH_SCENE = preload("res://scenes/world/vegetation/vegetation_bush_a.tscn")
const TREE_SCENE = preload("res://scenes/world/vegetation/vegetation_tree_broadleaf_a.tscn")
const SurfacePalette = preload("res://maps/world/surface_palette.gd")
const COLORS: Dictionary = {
	"roof": Color("637889"), "frame": Color("b1bab5"),
	"steel": Color("465969"), "wood": Color("a2947e"), "warm": Color("b18b5f"), "grass": Color("71836b"),
	"rubber": Color("303c43"), "paper": Color("d8d5c9"), "orange": Color("c66e37"),
	"glass": Color("779b9c"), "stone": Color("929e99"),
	"fence": Color("8f8878"), "fence_post": Color("425666"),
	"leaf_light": Color("81916e"), "flower": Color("cbbc94"),
	"BH_Plastic_Light": Color("bbbcae"), "BH_Concrete_Light": Color("a5aca7"),
	"BH_Concrete_Dark": Color("727c7b"), "BH_Metal_Mid": Color("607787"),
	"BH_Metal_Dark": Color("40505d"), "BH_Plastic_Dark": Color("3d4850"),
	"BH_Warm_Orange": Color("b18b5f"), "BH_Safety_Yellow": Color("c4ab72"),
}
static var _materials: Dictionary = {}
var _surfaces: Dictionary = {}
var _camp: Node3D

func configure(camp: Node3D) -> void:
	_camp = camp
	_workshop(camp.get_node("NavigationSource/Workshop"))
	_greenhouse(camp.get_node("NavigationSource/Greenhouse"))
	_living_area(camp.get_node("NavigationSource/CentralLivingArea"))
	_vehicle_berth(camp.get_node("NavigationSource/BlueHourBerth"))
	_main_entry(camp.get_node("NavigationSource/MainBuilding"))
	_storage_zone(camp.get_node("NavigationSource/Greenhouse"))
	_edge_details()
	_boundary_fences()
	for id: String in ["DecorationPlaceholder_CrateA", "DecorationPlaceholder_CrateB"]:
		var source: MeshInstance3D = camp.get_node("DecorationPlaceholders/" + id)
		# Consolidate the two loose foreground boxes against the greenhouse's solid side.
		_source_prop("BH_WoodCrate" if id.ends_with("A") else "BH_MetalCrate", Vector3(9.66, 0, -3.95) if id.ends_with("A") else Vector3(9.66, 0.38, -3.95), 0.0, 0.40 if id.ends_with("A") else 0.28)
		source.hide()
	# Low edging is traversable; the existing navigation collision remains authoritative.
	_box(Vector3(-3.60, 0.055, 5.74), Vector3(2.66, 0.10, 0.12), "stone")
	_box(Vector3(-3.60, 0.055, 1.56), Vector3(2.66, 0.10, 0.12), "stone")
	for key: String in _surfaces:
		var tool: SurfaceTool = _surfaces[key]
		var view := MeshInstance3D.new()
		view.name = key
		view.mesh = tool.commit()
		add_child(view)
	_surfaces.clear()

func _vehicle_berth(bus: Node3D) -> void:
	# Keep the driveway, side door marker, party assembly, and departure curve clear.
	_source_prop("BH_MetalCrate", bus.position + Vector3(-1.75, 0, -1.05), 0.12, 0.58)
	_source_prop("BH_WoodCrate", bus.position + Vector3(-1.95, 0, 1.35), -0.08, 0.62)
	_source_prop("BH_Pallet", bus.position + Vector3(1.95, 0, -1.25), 0, 0.58)
	_source_prop("BH_TrafficCone", bus.position + Vector3(2.25, 0, 1.15), 0, 0.72)
	_source_prop("BH_TrafficCone", bus.position + Vector3(2.25, 0, -0.65), 0, 0.72)
	# A compact cable reel and service strip read as maintenance without blocking the lane.
	_cylinder(bus.position + Vector3(-2.25, 0.34, -1.75), 0.34, 0.14, "steel", Vector3(0, 0, PI * 0.5))
	_cylinder(bus.position + Vector3(-2.25, 0.37, -1.75), 0.12, 0.18, "orange", Vector3(0, 0, PI * 0.5))
	_box(bus.position + Vector3(-2.25, 0.12, -1.75), Vector3(0.08, 0.24, 0.08), "steel")

func _main_entry(building: Node3D) -> void:
	var entry := building.global_position + Vector3(0, 0, 2.55)
	_source_prop("BH_WoodCrate", entry + Vector3(-3.85, 0, 0.70), 0.0, 0.55)
	_source_prop("BH_MetalCrate", entry + Vector3(3.15, 0, 0.45), 0.08, 0.52)
	_source_prop("BH_TrashBin_01", entry + Vector3(4.25, 0, 0.35), PI, 0.62)
	# Formal board anchors the management area; the doorway and stair remain clear.
	_core_prop(NOTICE_BOARD_SCENE, entry + Vector3(-2.30, 0, 0.08), deg_to_rad(8.0))
	_box(entry + Vector3(2.05, 2.40, -0.30), Vector3(0.18, 0.28, 0.18), "warm")
	_source_prop("BH_Bench_01", entry + Vector3(2.45, 0, 0.65), PI, 0.62)
	# Wall-side planters frame the information area without using its standing space.
	_planter(entry + Vector3(-3.20, 0, -0.24), 0.65)
	_planter(entry + Vector3(3.65, 0, -0.24), 0.65)
	_box(entry + Vector3(-2.95, 0.77, 0.08), Vector3(0.28, 0.20, 0.17), "roof")
	_box(entry + Vector3(-2.95, 0.82, 0.175), Vector3(0.21, 0.035, 0.025), "paper")

func _storage_zone(house: Node3D) -> void:
	var center := house.global_position + Vector3(2.15, 0, 0.65)
	_core_prop(STORAGE_SHELF_SCENE, center, 0.0)
	_source_prop("BH_MetalCrate", center + Vector3(-1.05, 0, 0.82), 0.0, 0.42)
	_source_prop("BH_WoodCrate", center + Vector3(1.00, 0, 0.70), 0.0, 0.42)
	_source_prop("BH_Pallet", center + Vector3(0.16, 0.10, 1.23), 0, 0.70)


func _edge_details() -> void:
	var planting := Node3D.new()
	planting.name = "BoundaryPlanting"
	add_child(planting)
	# The same six trees and twenty-one bushes form islands around fence turns.
	# Each tree's roots share a planted bed with three bushes; no lone tree row.
	for center: Vector3 in [Vector3(-13.05, -0.12, -6.9), Vector3(-13.05, -0.12, -1.2),
			Vector3(-7.3, -0.12, -10.5), Vector3(9.0, -0.12, -10.0),
			Vector3(13.05, -0.12, -3.3), Vector3(13.05, -0.12, 4.8)]:
		_vegetation(planting, TREE_SCENE, center, 0.78 if center.z < -8.0 else 0.72, center.x)
		var facing := -1.0 if center.x > 0.0 else 1.0
		for index: int in range(3):
			var offsets: Array[Vector3] = [Vector3(facing * 0.25, 0, 0.40), Vector3(facing * 0.65, 0, 1.15), Vector3(-facing * 0.28, 0, 1.0)]
			var offset := offsets[index]
			_vegetation(planting, BUSH_SCENE, center + offset, 1.0 - index * 0.16, index * 1.7)
			_grass_cluster(center + offset + Vector3(facing * 0.55, 0.13, 0.55))
	# Two foreground islands and the existing side fence footprint link the eastern edge.
	for center: Vector3 in [Vector3(4.2, 0.0, 8.65), Vector3(8.7, 0.0, 8.65), Vector3(11.7, 0.0, 1.25)]:
		_vegetation(planting, BUSH_SCENE, center, 0.62, center.x)
		_grass_cluster(center + Vector3(-0.70, 0.02, -0.10))
		_grass_cluster(center + Vector3(0.65, 0.02, -0.16))
	SurfacePalette.style_world(planting)
	# Ankle-high edge growth is traversable; larger plants never occupy ambient anchors.
	for point: Vector3 in [Vector3(3.80, 0.02, 3.40), Vector3(4.05, 0.02, 2.85),
			Vector3(9.65, 0.02, -4.50), Vector3(10.0, 0.02, -4.10)]:
		_grass_cluster(point)
	# Replace the lamp's slab cap with a supported, shielded lantern silhouette.
	var lamp: Node3D = _camp.get_node("DecorationPlaceholders/DecorationPlaceholder_LightPost")
	lamp.hide()
	var base := lamp.position
	_cylinder(base + Vector3(0, 0.1, 0), 0.18, 0.20, "stone")
	_cylinder(base + Vector3(0, 1.2, 0), 0.055, 2.3, "steel")
	_box(base + Vector3(-0.17, 2.31, 0), Vector3(0.43, 0.065, 0.065), "steel")
	_box(base + Vector3(-0.34, 2.18, 0), Vector3(0.19, 0.23, 0.19), "warm")
	_box(base + Vector3(-0.34, 2.32, 0), Vector3(0.30, 0.06, 0.30), "roof")

func _vegetation(parent: Node3D, scene: PackedScene, position: Vector3, size: float, yaw: float) -> void:
	var plant := scene.instantiate() as Node3D
	# Wrapper corrections and shared imported meshes are retained, but no new navigation ownership.
	plant.get_node("Collision").free()
	plant.position = position
	plant.scale = Vector3.ONE * size
	plant.rotation.y = yaw
	parent.add_child(plant)
	for mesh: MeshInstance3D in plant.find_children("*", "MeshInstance3D", true, false):
		mesh.lod_bias = 0.25
		# Small foliage shadows cost several full mesh passes without adding readable form.
		if scene == BUSH_SCENE:
			mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _grass_cluster(center: Vector3) -> void:
	for index: int in range(9):
		var angle := index * 2.4
		var offset := Vector3(cos(angle) * 0.38, 0, sin(angle) * 0.23)
		var blade := PrismMesh.new()
		blade.size = Vector3(0.055, 0.13 + (index % 3) * 0.035, 0.12)
		_append(blade, 0, Transform3D(Basis.from_euler(Vector3(0.15, angle, 0.20)), center + offset + Vector3(0, blade.size.y * 0.5, 0)), "grass" if index % 3 else "leaf_light")
	for offset: Vector3 in [Vector3(-0.18, 0.13, 0.05), Vector3(0.23, 0.11, -0.06)]:
		_cylinder(center + offset, 0.045, 0.025, "flower")

func _planter(center: Vector3, width: float) -> void:
	_box(center + Vector3(0, 0.18, 0), Vector3(width, 0.36, 0.38), "wood")
	_box(center + Vector3(0, 0.35, 0), Vector3(width + 0.045, 0.06, 0.42), "warm")
	_box(center + Vector3(0, 0.385, 0), Vector3(width - 0.06, 0.02, 0.31), "grass")
	_grass_cluster(center + Vector3(0, 0.39, 0))

func _boundary_fences() -> void:
	for body: StaticBody3D in _camp.get_node("NavigationSource/BoundaryBlockouts").get_children():
		var source: MeshInstance3D = body.get_node("MeshInstance3D")
		var size: Vector3 = source.mesh.size
		var along_x := size.x > size.z
		var length := maxf(size.x, size.z)
		var count := ceili(length / 1.5)
		var yaw := 0.0 if along_x else PI * 0.5
		var basis := Basis(Vector3.UP, yaw)
		var center := Vector3(body.position.x, 0, body.position.z)
		source.hide()
		# Match the original solid footprint and keep every existing opening.
		for index: int in range(count + 1):
			var foot := center + basis * Vector3(-length * 0.5 + length * index / count, 0, 0)
			_box(foot + Vector3(0, 0.09, 0), Vector3(0.26, 0.18, 0.26), "stone")
			_box(foot + Vector3(0, 0.52, 0), Vector3(0.15, 0.90, 0.15), "fence_post")
			_box(foot + Vector3(0, 0.98, 0), Vector3(0.19, 0.055, 0.19), "steel")
		for height: float in [0.36, 0.72]:
			_box(center + Vector3(0, height, 0), Vector3(length, 0.22, 0.085), "fence", Vector3(0, yaw, 0))
		# Sparse steel straps bind the two planks, avoiding a garden picket rhythm.
		for index: int in range(count):
			var strap := center + basis * Vector3(-length * 0.5 + length * (index + 0.5) / count, 0.54, 0.055)
			_box(strap, Vector3(0.085, 0.61, 0.035), "fence_post", Vector3(0, yaw, 0))
	# Two modest amber end reflectors establish the road-facing edge.
	for x: float in [2.72, 11.62]:
		_box(Vector3(x, 0.73, 8.78), Vector3(0.10, 0.16, 0.025), "warm")

func _material(id: String) -> StandardMaterial3D:
	if not _materials.has(id):
		var material := StandardMaterial3D.new()
		material.resource_name = "Camp_" + id
		material.albedo_color = COLORS.get(id, Color("77878a"))
		material.roughness = 0.88
		material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_materials[id] = material
	return _materials[id]

func _append(mesh: Mesh, surface: int, transform: Transform3D, id: String) -> void:
	if not _surfaces.has(id):
		var tool := SurfaceTool.new()
		tool.begin(Mesh.PRIMITIVE_TRIANGLES)
		tool.set_material(_material(id))
		_surfaces[id] = tool
	var tool: SurfaceTool = _surfaces[id]
	tool.append_from(mesh, surface, transform)

func _box(position: Vector3, size: Vector3, id: String, rotation: Vector3 = Vector3.ZERO) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	_append(mesh, 0, Transform3D(Basis.from_euler(rotation), position), id)

func _cylinder(position: Vector3, radius: float, height: float, id: String, rotation: Vector3 = Vector3.ZERO) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	_append(mesh, 0, Transform3D(Basis.from_euler(rotation), position), id)

func _torus(position: Vector3, inner_radius: float, outer_radius: float, id: String, rotation: Vector3 = Vector3.ZERO) -> void:
	var mesh := TorusMesh.new()
	mesh.inner_radius = inner_radius
	mesh.outer_radius = outer_radius
	mesh.rings = 12
	mesh.ring_segments = 8
	_append(mesh, 0, Transform3D(Basis.from_euler(rotation), position), id)

func _part(parent: Node3D, position: Vector3, size: Vector3, id: String, rotation: Vector3 = Vector3.ZERO) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	_append(mesh, 0, _camp.global_transform.affine_inverse() * parent.global_transform * Transform3D(Basis.from_euler(rotation), position), id)

func _collect(view: MeshInstance3D, id: String) -> void:
	for surface: int in range(view.mesh.get_surface_count()):
		_append(view.mesh, surface, _camp.global_transform.affine_inverse() * view.global_transform, id)
	view.hide()

func _core_prop(scene: PackedScene, position: Vector3, yaw: float) -> Node3D:
	var instance := scene.instantiate() as Node3D
	instance.position = position
	instance.rotation.y = yaw
	add_child(instance)
	return instance

func _source_prop(id: String, position: Vector3, yaw: float, size: float = 1.0) -> void:
	var source := GeneratedAssets.spawn(id, self, position, yaw)
	source.scale = Vector3.ONE * size
	for view: MeshInstance3D in source.find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(view.mesh.get_surface_count()):
			var material: Material = view.get_active_material(surface)
			_append(view.mesh, surface, global_transform.affine_inverse() * view.global_transform, material.resource_name)
	source.free()

func _workshop(workshop: Node3D) -> void:
	for view: MeshInstance3D in workshop.find_children("*", "MeshInstance3D", true, false):
		if view.name == "RepairBench":
			view.hide()
		else:
			_collect(view, "roof" if view.name == "LeanToRoof" else "steel")
	# Standing seams, fascia and knee braces turn the slab into a light service canopy.
	for index: int in range(13):
		_part(workshop, Vector3(-2.4 + index * 0.4, 2.745, 0), Vector3(0.032, 0.036, 3.45), "frame", Vector3(0.0872665, 0, 0))
	_part(workshop, Vector3(0, 2.41, 1.74), Vector3(5.10, 0.17, 0.12), "frame")
	_part(workshop, Vector3(0, 2.72, -1.74), Vector3(5.10, 0.17, 0.12), "frame")
	for side: float in [-1.0, 1.0]:
		_part(workshop, Vector3(side * 2.05, 2.12, 1.55), Vector3(0.10, 0.83, 0.12), "frame", Vector3(0, 0, side * 0.70))
		_part(workshop, Vector3(side * 2.49, 2.56, 0), Vector3(0.13, 0.17, 3.56), "frame", Vector3(0.0872665, 0, 0))
		_part(workshop, Vector3(side * 2.3, 0.09, 1.55), Vector3(0.38, 0.18, 0.38), "stone")
		_part(workshop, Vector3(side * 2.3, 0.29, 1.55), Vector3(0.28, 0.25, 0.28), "frame")
	_part(workshop, Vector3(0, 2.27, 1.51), Vector3(4.6, 0.13, 0.12), "steel")
	_part(workshop, Vector3(-0.4, 2.23, 1.12), Vector3(1.1, 0.11, 0.22), "roof")
	_part(workshop, Vector3(-0.4, 2.17, 1.12), Vector3(0.88, 0.025, 0.12), "paper")
	_part(workshop, Vector3(-1.45, 2.23, 1.83), Vector3(0.55, 0.29, 0.055), "warm")
	_part(workshop, Vector3(-1.45, 2.23, 1.87), Vector3(0.28, 0.045, 0.025), "paper")
	# Formal workbench is the single maintenance anchor; its front remains open.
	_core_prop(WORKBENCH_SCENE, workshop.global_position + Vector3(-0.2, 0, -0.10), PI)
	_torus(workshop.global_position + Vector3(1.65, 0.46, -0.95), 0.24, 0.40, "rubber", Vector3(PI * 0.5, 0, 0))
	_torus(workshop.global_position + Vector3(1.65, 0.46, -0.05), 0.24, 0.40, "rubber", Vector3(PI * 0.5, 0, 0))
	_torus(workshop.global_position + Vector3(1.65, 0.12, 0.82), 0.24, 0.40, "rubber")
	_cylinder(workshop.global_position + Vector3(-2.15, 0.54, 0.72), 0.30, 0.78, "steel")
	_cylinder(workshop.global_position + Vector3(-1.48, 0.54, 0.72), 0.30, 0.78, "steel")
	_box(workshop.global_position + Vector3(-2.15, 0.84, 0.72), Vector3(0.34, 0.08, 0.10), "orange")
	_box(workshop.global_position + Vector3(-1.48, 0.84, 0.72), Vector3(0.34, 0.08, 0.10), "orange")
	_box(workshop.global_position + Vector3(1.55, 1.55, -1.48), Vector3(0.08, 1.10, 0.08), "steel")
	_box(workshop.global_position + Vector3(1.55, 2.12, -1.48), Vector3(0.38, 0.18, 0.18), "warm")
	_core_prop(GENERATOR_SCENE, workshop.global_position + Vector3(1.65, 0, 0.10), deg_to_rad(20.0))
	_source_prop("BH_MetalCrate", workshop.position + Vector3(-1.7, 0, -0.9), 0, 0.52)

func _greenhouse(house: Node3D) -> void:
	for view: MeshInstance3D in house.find_children("*", "MeshInstance3D", true, false):
		if "Glass" in str(view.name) or str(view.name).begins_with("Roof"):
			_collect(view, "glass")
		else:
			_collect(view, "stone" if view.name == "Base" else "frame")
	# Opaque polycarbonate panels keep the roof silhouette clean without transparent layers.
	for z: float in [-1.50, -0.50, 0.50, 1.50]:
		for side: float in [-1.0, 1.0]:
			_part(house, Vector3(side * 0.98, 2.30, z), Vector3(2.16, 0.075, 0.075), "frame", Vector3(0, 0, -side * 0.349066))
	_part(house, Vector3(0, 2.66, 0), Vector3(0.12, 0.10, 3.17), "frame")
	for z: float in [-1.52, 1.52]:
		_part(house, Vector3(0, 0.34, z), Vector3(4.02, 0.43, 0.10), "stone")
		_part(house, Vector3(0, 1.95, z), Vector3(4.02, 0.10, 0.10), "frame")
		for x: float in [-1.94, -0.62, 0.62, 1.94]:
			_part(house, Vector3(x, 1.12, z), Vector3(0.075, 1.68, 0.10), "frame")
	for x: float in [-2.0, 2.0]:
		_part(house, Vector3(x, 0.34, 0), Vector3(0.10, 0.43, 3.0), "stone")
		_part(house, Vector3(x, 1.95, 0), Vector3(0.10, 0.10, 3.0), "frame")
		for z: float in [-0.50, 0.50]:
			_part(house, Vector3(x, 1.12, z), Vector3(0.10, 1.68, 0.075), "frame")
	_part(house, Vector3(0, 1.0, 1.59), Vector3(0.82, 1.50, 0.055), "roof")
	_part(house, Vector3(0, 1.38, 1.63), Vector3(0.64, 0.52, 0.03), "glass")
	_part(house, Vector3(0.28, 0.86, 1.67), Vector3(0.055, 0.16, 0.06), "frame")

func _living_area(living: Node3D) -> void:
	var table: Node3D = living.get_node("TestTable")
	for view: MeshInstance3D in living.find_children("*", "MeshInstance3D", true, false):
		view.hide()
	for index: int in range(4):
		_part(table, Vector3(0, 0.79, -0.33 + index * 0.22), Vector3(1.65, 0.085, 0.205), "wood")
	for x: float in [-0.61, 0.61]:
		_part(table, Vector3(x, 0.40, 0), Vector3(0.09, 0.71, 0.66), "steel")
	_part(table, Vector3(0, 0.24, 0), Vector3(1.3, 0.08, 0.08), "steel")
	_source_prop("BH_Bench_01", Vector3(1.55, 0, 0.69), PI, 0.72)
	_source_prop("BH_Bench_01", Vector3(1.55, 0, 2.62), 0, 0.72)
	_source_prop("BH_WoodCrate", Vector3(2.98, 0, 1.1), 0.08, 0.68)
	_source_prop("BH_MetalCrate", Vector3(3.02, 0, 2.18), -0.08, 0.64)
	_source_prop("BH_Pallet", Vector3(2.9, 0, 3.17), 0, 0.68)
	# Folded blanket on the end of the bench; storage remains on the table's outer side.
	_box(Vector3(2.08, 0.49, 2.61), Vector3(0.45, 0.09, 0.34), "roof")
	_box(Vector3(2.08, 0.54, 2.61), Vector3(0.065, 0.015, 0.35), "paper")
	_box(Vector3(3.02, 0.51, 2.18), Vector3(0.29, 0.12, 0.25), "wood")
	_box(Vector3(1.11, 0.955, 1.54), Vector3(0.29, 0.008, 0.018), "warm", Vector3(0, 0.18, 0))
	# A few large silhouettes make the table read as a lived-in briefing spot.
	_box(Vector3(1.10, 0.91, 1.55), Vector3(0.46, 0.08, 0.28), "paper", Vector3(0, 0.18, 0))
	_box(Vector3(1.98, 0.91, 1.72), Vector3(0.30, 0.20, 0.22), "steel")
	_cylinder(Vector3(1.34, 0.94, 1.93), 0.10, 0.18, "warm")
	_cylinder(Vector3(1.64, 0.94, 1.93), 0.10, 0.18, "warm")
	_box(Vector3(2.10, 0.48, 0.82), Vector3(0.52, 0.44, 0.24), "steel", Vector3(0, 0.15, 0))
	_box(Vector3(2.10, 0.74, 0.82), Vector3(0.40, 0.05, 0.20), "orange")
	var basin: MeshInstance3D = living.get_node("FirepitPosition/Basin")
	_collect(basin, "steel")
	for index: int in range(3):
		_box(Vector3(-0.55, 0.22 + index * 0.045, 1.65), Vector3(0.78, 0.075, 0.13), "wood", Vector3(0, index * 1.05, 0))
	_cylinder(Vector3(-0.55, 0.48, 2.12), 0.16, 0.28, "steel")
