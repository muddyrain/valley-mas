extends RefCounted
## Instance-only materials and collision-free geometry over frozen M02.

const UrbanView = preload("res://maps/town/town_urban_view.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Surface = preload("res://maps/world/surface_palette.gd")
const RoadSurface = preload("res://maps/town/environment/roadside_surface.gdshader")
const WireShader = preload("res://assets/world/materials/town_wire.gdshader")
const RADIUS := 0.014

static func build(parent: Node3D, town: Dictionary, data: Dictionary) -> Node3D:
	var layer := Node3D.new()
	layer.name = "M03RoadsideVisualLayer"
	parent.add_child(layer)
	var wires := Node3D.new()
	wires.name = "Wires"
	layer.add_child(wires)
	var material := ShaderMaterial.new()
	material.shader = WireShader
	material.set_shader_parameter("wire_color", Color("#3c4850"))
	for pair: Dictionary in data.wires:
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)
		var origin: Vector3 = pair.lines[0].points[6]
		for line: Dictionary in pair.lines:
			_tube(surface, line.points, origin)
		var mesh := MeshInstance3D.new()
		mesh.name = pair.id.replace(":", "_")
		mesh.position = origin
		mesh.mesh = surface.commit()
		mesh.material_override = material
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		wires.add_child(mesh)
	var grounds := Node3D.new()
	grounds.name = "GroundDetails"
	layer.add_child(grounds)
	for mark: Dictionary in data.parking_marks:
		grounds.add_child(_p_mark(mark))
	for accent: Dictionary in data.commercial_accents:
		var color := Color("#858578").lerp(Color("#989588"), accent.tone)
		var mesh := _polygon(accent.polygon, accent.height, "Frontage_" + accent.anchor)
		mesh.material_override = Surface.get_material(color, "pavement")
		grounds.add_child(mesh)
	var surfaces := Node3D.new()
	surfaces.name = "SurfacePolish"
	layer.add_child(surfaces)
	var refs: Array[Dictionary] = []
	for spec: Array in [["RoadNetwork", Color("#444c55"), false], ["SidewalkNetwork", Color("#98958a"), true]]:
		var mesh := parent.get_node(NodePath(spec[0])) as MeshInstance3D
		var polished := ShaderMaterial.new()
		polished.shader = RoadSurface
		polished.set_shader_parameter("base_color", spec[1])
		polished.set_shader_parameter("paving", spec[2])
		refs.append({"mesh": mesh, "before": mesh.material_override, "after": polished})
		mesh.material_override = polished
	layer.set_meta("materials", refs)
	var roads: Array[Rect2] = []
	var curb_outer: Array[Rect2] = []
	for road: Dictionary in town.roads:
		roads.append(road.bounds)
		curb_outer.append(road.bounds.grow(0.18))
	# Union-minus-union leaves only a narrow strip outside the road, including junctions.
	UrbanView._union_mesh(surfaces, "RoadEdgeReadability", curb_outer, roads, 0.084, Color("#777b78"))
	return layer

static func set_enabled(layer: Node3D, enabled: bool) -> void:
	layer.visible = enabled
	for ref: Dictionary in layer.get_meta("materials"):
		ref.mesh.material_override = ref.after if enabled else ref.before

static func _tube(surface: SurfaceTool, points: PackedVector3Array, origin: Vector3) -> void:
	# Six radial sides, twelve segments; three wires share one mesh and material.
	for index: int in range(points.size() - 1):
		var tangent := (points[index + 1] - points[index]).normalized()
		var side := tangent.cross(Vector3.UP).normalized()
		var up := tangent.cross(side).normalized()
		for radial: int in 6:
			var angle := TAU * radial / 6.0
			var next := TAU * (radial + 1) / 6.0
			var normal_a := side * cos(angle) + up * sin(angle)
			var normal_b := side * cos(next) + up * sin(next)
			var a := points[index] - origin + normal_a * RADIUS
			var b := points[index] - origin + normal_b * RADIUS
			var c := points[index + 1] - origin + normal_b * RADIUS
			var d := points[index + 1] - origin + normal_a * RADIUS
			for vertex: Vector3 in [a, b, c, a, c, d]:
				surface.set_normal(normal_a)
				surface.add_vertex(vertex)

static func _polygon(polygon: PackedVector2Array, height: float, node_name: String) -> MeshInstance3D:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	surface.set_normal(Vector3.UP)
	var indices := Geometry2D.triangulate_polygon(polygon)
	for index: int in range(0, indices.size(), 3):
		var a := polygon[indices[index]]
		var b := polygon[indices[index + 1]]
		var c := polygon[indices[index + 2]]
		if (b - a).cross(c - a) < 0:
			var swap := b
			b = c
			c = swap
		for point: Vector2 in [a, b, c]:
			surface.add_vertex(Vector3(point.x, height, point.y))
	var mesh := MeshInstance3D.new()
	mesh.name = node_name
	mesh.mesh = surface.commit()
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mesh

static func _p_mark(mark: Dictionary) -> Node3D:
	var root := Node3D.new()
	root.name = "P_" + mark.anchor
	root.position = Vector3(mark.point.x, mark.height, mark.point.y)
	# The observer stands on +Z (road side); the top of the P points away.
	root.rotation.y = atan2(mark.facing.x, mark.facing.y)
	for bar: Rect2 in [Rect2(-0.4, -0.55, 0.14, 1.1), Rect2(-0.26, -0.55, 0.52, 0.14), Rect2(-0.26, -0.05, 0.52, 0.14), Rect2(0.12, -0.41, 0.14, 0.36)]:
		var mesh := _polygon(Geometry.polygon(bar), 0, "PaintStroke")
		mesh.material_override = Surface.get_material(Color("#b7b4a8"), "mark")
		root.add_child(mesh)
	return root
