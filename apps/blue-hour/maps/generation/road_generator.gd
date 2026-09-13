extends RefCounted
const Visuals = preload("res://vfx/visuals.gd")
const Surfaces = preload("res://maps/world/surface_palette.gd")
const WIDTH: float = 8.0
const SIDEWALK: float = 2.4
const ASPHALT := Color("#3c495a")
const CONCRETE := Color("#8f9690")
const MARKING := Color("#d9d7c6")
static var meshes: Dictionary = {}

static func slab(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	if not meshes.has(size):
		var mesh := BoxMesh.new()
		mesh.size = size
		meshes[size] = mesh
	var view := MeshInstance3D.new()
	view.mesh = meshes[size]
	# Horizontal paving receives the world shadows, but must never shadow itself.
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	view.material_override = Visuals.material(color)
	if size.y >= .03:
		view.material_override = Surfaces.get_material(color, "ground" if size.y > .2 else "pavement" if color == CONCRETE else "asphalt")
	view.position = at
	parent.add_child(view)
	return view

static func module(parent: Node3D, kind: String, at: Vector3, yaw: float = 0.0) -> Node3D:
	var road := Node3D.new()
	road.name = kind.capitalize()
	parent.add_child(road)
	road.position = at
	road.rotation.y = yaw
	slab(road, Vector3(WIDTH, 0.12, WIDTH), Vector3(0, -0.06, 0), ASPHALT)
	var connected: Array = {"straight": [true, false, true, false], "corner": [true, true, false, false], "t_junction": [true, true, false, true], "crossroad": [true, true, true, true]}[kind]
	for side: int in range(4):
		if not connected[side]:
			var edge := Node3D.new()
			road.add_child(edge)
			edge.rotation.y = side * PI / 2
			slab(edge, Vector3(WIDTH, .12, .12), Vector3(0, .06, -4), CONCRETE)
	if kind == "straight":
		slab(road, Vector3(.1, .012, 2.4), Vector3(0, .025, 0), MARKING)
	return road

static func cells(map: Resource) -> Dictionary:
	var result: Dictionary = {}
	for segment: Dictionary in map.road_segments:
		var start: Vector2i = segment.start
		var end: Vector2i = segment.end
		var direction := Vector2i(signi(end.x - start.x), signi(end.y - start.y)) * 8
		var cursor: Vector2i = start
		while true:
			result[cursor] = true
			if cursor == end:
				break
			cursor += direction
	return result

static func build(city: Node3D, map: Resource) -> void:
	var root := Node3D.new()
	root.name = "RoadNetwork"
	city.add_child(root)
	slab(root, Vector3(map.half_width * 2 + 120, .3, map.half_depth * 2 + 120), Vector3(0, -.19, 0), Color("#697d64"))
	for district: Dictionary in map.districts:
		var bounds: Rect2 = district.bounds
		var center: Vector2 = bounds.get_center()
		var color := Color("#8c9698") if "industrial" in district.id or "yard" in district.id else Color("#a3a59b") if district.paved else Color("#939d88")
		slab(root, Vector3(bounds.size.x, .03, bounds.size.y), Vector3(center.x, -.035, center.y), color)
	var network: Dictionary = cells(map)
	var directions: Array[Vector2i] = [Vector2i(0,-8), Vector2i(-8,0), Vector2i(0,8), Vector2i(8,0)]
	for cell: Vector2i in network:
		var neighbors: Array[int] = []
		for side: int in range(4):
			if network.has(cell + directions[side]):
				neighbors.append(side)
		var kind: String = "crossroad" if neighbors.size() == 4 else "t_junction" if neighbors.size() == 3 else "straight"
		var yaw: float = PI / 2 if neighbors.has(1) or neighbors.has(3) else 0.0
		if kind == "t_junction":
			for missing: int in range(4):
				if not neighbors.has(missing):
					yaw = (missing - 2) * PI / 2
		var tile: Node3D = module(root, kind, Vector3(cell.x, 0, cell.y), yaw)
		tile.name = "%s_%d_%d" % [kind, cell.x, cell.y]
		tile.set_meta("road_cell", cell)
		tile.set_meta("connection_count", neighbors.size())
		if neighbors.size() >= 3:
			for side: int in neighbors:
				var crossing := Node3D.new()
				tile.add_child(crossing)
				crossing.rotation.y = side * PI / 2 - yaw
				for stripe: int in range(-3, 4):
					slab(crossing, Vector3(.55, .012, 2), Vector3(stripe, .025, -6), MARKING)
				slab(crossing, Vector3(3.2, .012, .16), Vector3(2, .025, -8), MARKING)
	_build_sidewalk(root, network)
	for parking: Dictionary in map.parking_areas:
		var area := Node3D.new()
		area.name = "ParkingArea"
		root.add_child(area)
		area.position = parking.position
		area.rotation.y = parking.yaw
		slab(area, Vector3(parking.width, .06, parking.depth), Vector3(0, -.005, 0), ASPHALT.lightened(.08))
		for x: float in [-3.0, 0.0, 3.0]:
			slab(area, Vector3(.08, .012, 5), Vector3(x, .045, 0), MARKING)
		slab(area, Vector3(6, .012, .08), Vector3(0, .045, -2.5), MARKING)

static func _build_sidewalk(root: Node3D, network: Dictionary) -> void:
	# Union on an 0.8 m lattice: each pavement cell is emitted once, including junction corners.
	# Combine adjacent cells into strips and one shared mesh, instead of overlapping sidewalk boxes.
	var road_cells: Dictionary = {}
	var pavement: Dictionary = {}
	for cell: Vector2i in network:
		var center := Vector2i(roundi(cell.x / .8), roundi(cell.y / .8))
		for x: int in range(-8, 8):
			for z: int in range(-8, 8):
				var point := center + Vector2i(x, z)
				pavement[point] = true
				if x >= -5 and x < 5 and z >= -5 and z < 5:
					road_cells[point] = true
	for point: Vector2i in road_cells:
		pavement.erase(point)
	var builder := SurfaceTool.new()
	builder.begin(Mesh.PRIMITIVE_TRIANGLES)
	builder.set_normal(Vector3.UP)
	var remaining: Dictionary = pavement.duplicate()
	while not remaining.is_empty():
		var start: Vector2i = remaining.keys()[0]
		var finish: Vector2i = start
		while remaining.has(finish):
			remaining.erase(finish)
			finish.x += 1
		_quad(builder, Vector3(start.x * .8, .045, start.y * .8), Vector2((finish.x - start.x) * .8, .8))
	var view := MeshInstance3D.new()
	view.name = "ContinuousSidewalk"
	view.mesh = builder.commit()
	view.material_override = Surfaces.get_material(CONCRETE, "pavement")
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(view)
	_build_curbs(root, pavement, road_cells)

static func _build_curbs(root: Node3D, pavement: Dictionary, road_cells: Dictionary) -> void:
	var builder := SurfaceTool.new()
	builder.begin(Mesh.PRIMITIVE_TRIANGLES)
	var section := BoxMesh.new()
	section.size = Vector3(.78, .09, .17)
	var gutter := BoxMesh.new()
	gutter.size = Vector3(.8, .018, .22)
	var gutters := SurfaceTool.new()
	gutters.begin(Mesh.PRIMITIVE_TRIANGLES)
	for cell: Vector2i in pavement:
		for direction: Vector2i in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
			if not road_cells.has(cell + direction):
				continue
			var at := Vector3((cell.x + .5) * .8, .042, (cell.y + .5) * .8)
			at += Vector3(direction.x, 0, direction.y) * .32
			var basis := Basis(Vector3.UP, PI / 2 if direction.x != 0 else 0.0)
			builder.append_from(section, 0, Transform3D(basis, at))
			at += Vector3(direction.x, 0, direction.y) * .18
			at.y = .009
			gutters.append_from(gutter, 0, Transform3D(basis, at))
	for entry: Array in [["Curbs", builder, Color("#bdc0b5")], ["Gutters", gutters, Color("#4b5866")]]:
		var view := MeshInstance3D.new()
		view.name = entry[0]
		view.mesh = entry[1].commit()
		view.material_override = Visuals.material(entry[2])
		view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(view)

static func _quad(builder: SurfaceTool, start: Vector3, size: Vector2) -> void:
	for offset: Vector3 in [Vector3.ZERO, Vector3(size.x,0,size.y), Vector3(0,0,size.y), Vector3.ZERO, Vector3(size.x,0,0), Vector3(size.x,0,size.y)]:
		builder.add_vertex(start + offset)
