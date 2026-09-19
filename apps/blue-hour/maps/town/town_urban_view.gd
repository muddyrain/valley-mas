extends RefCounted
## Geometry follows the generated result. Road surfaces are an exact rectangle union without coplanar faces.

const Assets = preload("res://data/world_asset_catalog.gd")
const Surfaces = preload("res://maps/world/surface_palette.gd")
const Bus = preload("res://scenes/world/vehicles/veh_blue_hour.tscn")

static func instantiate_building(site: Dictionary) -> Node3D:
	var definition: Resource = Assets.asset(site.asset)
	var wrapper: Node3D = definition.scene.instantiate()
	# Expansion wrappers face +Z except BLD_010, already corrected to -Z in its scene.
	# Correct only the town instance; applying this twice reverses BLD_010's entrance.
	var number := int(definition.building_id.trim_prefix("BLD_"))
	if number >= 9 and number <= 22 and number != 10:
		var model: Node3D = wrapper.get_node("ModelRoot")
		wrapper.set_meta("audited_facade_local", model.basis.inverse() * Vector3.BACK)
		model.transform = Transform3D(Basis(Vector3.UP, PI), Vector3.ZERO) * model.transform
		wrapper.set_meta("source_front_correction", PI)
	wrapper.name = site.id
	wrapper.rotation.y = site.yaw
	wrapper.position = site.road_anchor - wrapper.basis * wrapper.get_node("Anchors/RoadAnchor").position
	wrapper.set_meta("parcel_id", site.id)
	return wrapper

static func build(parent: Node3D, town: Dictionary) -> void:
	_slab(parent, "Ground", town.bounds.grow(20), -0.12, Color("#73806a"), "ground")
	for space: Dictionary in town.ground_spaces:
		_polygon_surface(parent, space.kind, space.polygon, -0.07, _space_color(space.kind), _space_material(space.kind))
		if space.kind == "parking":
			_parking_surface(parent, space.polygon)
	var roads: Array[Rect2] = []
	var walks: Array[Rect2] = []
	for road: Dictionary in town.roads:
		roads.append(road.bounds)
		walks.append(road.bounds.grow(1.6 if road.kind == "alley" else 2.2))
	_union_mesh(parent, "RoadNetwork", roads, [], 0.025, Color("#45494b"))
	_union_mesh(parent, "SidewalkNetwork", walks, roads, 0.08, Color("#b7b8b3"))
	var block_root := Node3D.new()
	block_root.name = "Blocks"
	parent.add_child(block_root)
	for block: Dictionary in town.blocks:
		var block_node := Node3D.new()
		block_node.name = block.id
		block_node.set_meta("street_edges", block.street_edges)
		block_root.add_child(block_node)
		for space: Dictionary in block.spaces:
			_polygon_surface(block_node, space.kind, space.polygon, -0.025, _space_color(space.kind), _space_material(space.kind))
		if block.land_use_type == "OPEN_SPACE":
			var bounds: Rect2 = block.bounds
			var center: Vector2 = bounds.get_center()
			var path_rect := Rect2(bounds.position.x, center.y - 1.2, bounds.size.x, 2.4)
			for polygon: PackedVector2Array in Geometry2D.intersect_polygons(preload("res://maps/town/town_land_use.gd").rect_polygon(path_rect), block.polygon):
				_polygon_surface(block_node, "ParkPath", polygon, 0.01, Color("#b7b8b3"), "pavement")
			path_rect = Rect2(center.x - 1.2, bounds.position.y, 2.4, bounds.size.y)
			for polygon: PackedVector2Array in Geometry2D.intersect_polygons(preload("res://maps/town/town_land_use.gd").rect_polygon(path_rect), block.polygon):
				_polygon_surface(block_node, "ParkPath", polygon, 0.015, Color("#b7b8b3"), "pavement")
	var building_root := Node3D.new()
	building_root.name = "Buildings"
	parent.add_child(building_root)
	for site: Dictionary in town.buildings:
		var wrapper := instantiate_building(site)
		building_root.add_child(wrapper)
		var apron: Rect2 = site.bounds.grow(0.55)
		_slab(parent, "Foundation_" + site.id, apron, -0.005, Color("#a1a49a"), "pavement")
		var entry: Vector3 = site.entry
		var street: Vector3 = site.road_point
		var path := Rect2(Vector2(entry.x, entry.z), Vector2.ZERO).expand(Vector2(street.x, street.z)).grow(0.8)
		_slab(parent, "Entrance_" + site.id, path, 0.015, Color("#b7b8b3"), "pavement")
	var bus: Node3D = Bus.instantiate()
	bus.name = "BusArrival"
	bus.position = town.arrival.position
	bus.rotation.y = town.arrival.yaw
	parent.add_child(bus)
	var arrival := Marker3D.new()
	arrival.name = "BusArrivalPoint"
	arrival.position = town.arrival.position
	parent.add_child(arrival)
	var poi := Marker3D.new()
	poi.name = "MissionPOI"
	poi.position = town.poi.entry
	parent.add_child(poi)
	Surfaces.style_world(parent)

static func _space_color(kind: String) -> Color:
	match kind:
		"small_park", "community_green":
			return Color("#7d936a")
		"backyard":
			return Color("#899475")
		"green_buffer":
			return Color("#64745f")
		"loading_yard":
			return Color("#838c8b")
		"parking":
			return Color("#727b7b")
	return Color("#9b9f96")

static func _space_material(kind: String) -> String:
	return "ground" if kind in ["small_park", "community_green", "backyard", "green_buffer"] else "pavement"

static func _parking_surface(parent: Node3D, polygon: PackedVector2Array) -> void:
	var bounds := Rect2(polygon[0], Vector2.ZERO)
	for point: Vector2 in polygon:
		bounds = bounds.expand(point)
	for x: int in range(floori(bounds.position.x / 3.0), ceili(bounds.end.x / 3.0)):
		for z: int in range(floori(bounds.position.y / 11.0), ceili(bounds.end.y / 11.0)):
			var stripe := Rect2(x * 3.0, z * 11.0, 0.12, 5.0)
			for clipped: PackedVector2Array in Geometry2D.intersect_polygons(preload("res://maps/town/town_land_use.gd").rect_polygon(stripe), polygon):
				_polygon_surface(parent, "ParkingMark", clipped, -0.06, Color("#b7b8b3"), "pavement")

static func _slab(parent: Node3D, node_name: String, rect: Rect2, y: float, color: Color, kind: String) -> void:
	if rect.size.x <= 0 or rect.size.y <= 0:
		return
	var view := MeshInstance3D.new()
	view.name = node_name
	var mesh := PlaneMesh.new()
	mesh.size = rect.size
	view.mesh = mesh
	view.position = Vector3(rect.get_center().x, y, rect.get_center().y)
	var material: ShaderMaterial = Surfaces.get_material(color, kind).duplicate()
	if kind == "ground":
		material.set_shader_parameter("variation", 0.015)
	view.material_override = material
	view.set_meta(&"walkable_ground", true)
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(view)

static func _polygon_surface(parent: Node3D, node_name: String, polygon: PackedVector2Array, y: float, color: Color, kind: String) -> void:
	var indices := Geometry2D.triangulate_polygon(polygon)
	if indices.is_empty():
		return
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_normal(Vector3.UP)
	for i: int in range(0, indices.size(), 3):
		var a := polygon[indices[i]]
		var b := polygon[indices[i + 1]]
		var c := polygon[indices[i + 2]]
		if (b - a).cross(c - a) < 0:
			var swap := b
			b = c
			c = swap
		for point: Vector2 in [a, b, c]:
			surface.add_vertex(Vector3(point.x, y, point.y))
	var view := MeshInstance3D.new()
	view.name = node_name
	view.mesh = surface.commit()
	var material: ShaderMaterial = Surfaces.get_material(color, kind).duplicate()
	material.set_shader_parameter("variation", 0.012 if kind == "ground" else 0.02)
	view.material_override = material
	view.set_meta(&"walkable_ground", true)
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(view)

static func _union_mesh(parent: Node3D, node_name: String, include: Array[Rect2], exclude: Array[Rect2], y: float, color: Color) -> void:
	var xs: Array[float] = []
	var zs: Array[float] = []
	for rect: Rect2 in include + exclude:
		for x: float in [rect.position.x, rect.end.x]:
			if not xs.has(x):
				xs.append(x)
		for z: float in [rect.position.y, rect.end.y]:
			if not zs.has(z):
				zs.append(z)
	xs.sort()
	zs.sort()
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_normal(Vector3.UP)
	for xi: int in range(xs.size() - 1):
		for zi: int in range(zs.size() - 1):
			var midpoint := Vector2((xs[xi] + xs[xi + 1]) * 0.5, (zs[zi] + zs[zi + 1]) * 0.5)
			if not _contains(include, midpoint) or _contains(exclude, midpoint):
				continue
			var a := Vector3(xs[xi], y, zs[zi])
			var b := Vector3(xs[xi + 1], y, zs[zi])
			var c := Vector3(xs[xi + 1], y, zs[zi + 1])
			var d := Vector3(xs[xi], y, zs[zi + 1])
			for point: Vector3 in [a, b, c, a, c, d]:
				surface.add_vertex(point)
	var view := MeshInstance3D.new()
	view.name = node_name
	view.mesh = surface.commit()
	view.material_override = Surfaces.get_material(color, "asphalt" if exclude.is_empty() else "pavement")
	view.set_meta(&"walkable_ground", true)
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(view)

static func _contains(rects: Array[Rect2], point: Vector2) -> bool:
	for rect: Rect2 in rects:
		if rect.has_point(point):
			return true
	return false
