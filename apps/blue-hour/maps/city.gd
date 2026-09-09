extends Node3D
const Visuals = preload("res://vfx/visuals.gd")
const Assets = preload("res://vfx/generated_assets.gd")
const CityArt = preload("res://maps/city_art.gd")
var data: Resource
var grid := AStarGrid2D.new()
var sites: Dictionary = {}
var lamps: Array[MeshInstance3D] = []
var accent_lights: Array[OmniLight3D] = []
var bus_door: MeshInstance3D
var bus_label: Label3D
var bus_light: OmniLight3D
var marker: MeshInstance3D

func build(map: Resource) -> void:
	data = map
	grid.region = Rect2i(-data.half_width, -data.half_depth, data.half_width * 2 + 1, data.half_depth * 2 + 1)
	grid.cell_size = Vector2.ONE
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	CityArt.streets(self, data)
	var ground := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(data.half_width * 2, 0.2, data.half_depth * 2)
	collision.shape = shape
	ground.add_child(collision)
	ground.position.y = -0.15
	add_child(ground)
	for site in data.buildings:
		_add_site(site, false)
	for site in data.vehicles:
		_add_site(site, true)
	_build_bus()
	# Distant silhouettes are deliberately outside navigation and play space.
	for index in range(12):
		var x: float = -36 + index * 6
		Visuals.box(self, Vector3(4.4, 7 + index % 4 * 2, 4), Vector3(x, 2, -35 - index % 2 * 3), Color("#334550"))
	marker = Visuals.ring(self, data.bus_position, 1.1, Color("#7febdc"))
	marker.visible = false

func _collider(pos: Vector3, size: Vector3, key: String = "", value: Variant = null) -> void:
	var collider := StaticBody3D.new()
	collider.position = pos + Vector3(0, size.y * 0.5, 0)
	if not key.is_empty():
		collider.set_meta(key, value)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	collider.add_child(collision)
	add_child(collider)
	# Block grid centers inside the inflated footprint, not an extra row outside it.
	for x in range(ceili(pos.x - size.x * 0.5 - 0.7), floori(pos.x + size.x * 0.5 + 0.7) + 1):
		for z in range(ceili(pos.z - size.z * 0.5 - 0.7), floori(pos.z + size.z * 0.5 + 0.7) + 1):
			var cell := Vector2i(x, z)
			if grid.is_in_boundsv(cell):
				grid.set_point_solid(cell, true)

func _add_site(spec: Dictionary, vehicle: bool) -> void:
	var pos: Vector3 = spec.position
	var size: Vector3 = spec.size
	var root := Node3D.new()
	add_child(root)
	var body := CityArt.site(self, root, spec, vehicle)
	_collider(pos, size, "site_id", spec.id)
	var entry: Vector3 = spec.entry
	var ring := Visuals.ring(root, entry + Vector3(0, 0.08, 0), 1.15, Color("#f3d39c"))
	var text := Visuals.label(root, spec.name + "\n%d 食物 · %d 废料" % [spec.food, spec.scrap], entry + Vector3(0, 1.4, 0), Color("#f6e4c9"), 29)
	Visuals.hit_area(root, "site_id", spec.id, 1.1)
	# The entrance proxy is independent of the building's model and collider.
	root.get_child(root.get_child_count() - 1).position = entry
	sites[spec.id] = {"spec": spec, "progress": 0.0, "searched": false, "label": text, "ring": ring, "body": body, "vehicle": vehicle}

func _build_bus() -> void:
	var pos: Vector3 = data.bus_position + Vector3(0, 0, 3.7)
	var bus := Assets.spawn("BH_EvacBus_01", self, pos, PI * .5)
	Assets.collect_lamps(bus, lamps)
	bus_door = Assets.part(bus, "_Door")
	# The existing tween moves in city X, along the bus; preserve its contract.
	bus_door.reparent(self, true)
	bus_door.set_meta("closed_x", bus_door.position.x)
	bus_door.position.x -= .8
	_collider(pos, Vector3(9.22, 3.0, 2.7), "bus", true)
	Visuals.ring(self, data.bus_position + Vector3(0, 0.06, 0), data.board_radius, Color("#eabd73"))
	bus_label = Visuals.label(self, "归航巴士", data.bus_position + Vector3(0, 2, 0), Color("#ffe1a5"), 36)
	bus_light = OmniLight3D.new()
	bus_light.position = data.bus_position + Vector3(0, 3.5, 0)
	bus_light.light_color = Color("#E8B36A")
	bus_light.omni_range = 10.0
	bus_light.light_energy = 0.0
	bus_light.shadow_enabled = false
	add_child(bus_light)

func cell_at(pos: Vector3) -> Vector2i:
	return Vector2i(roundi(pos.x), roundi(pos.z))

func nearest_open(pos: Vector3) -> Vector3:
	var cell := cell_at(pos)
	cell.x = clampi(cell.x, grid.region.position.x, grid.region.end.x - 1)
	cell.y = clampi(cell.y, grid.region.position.y, grid.region.end.y - 1)
	for radius in range(0, 16):
		for x in range(-radius, radius + 1):
			for z in range(-radius, radius + 1):
				var candidate := cell + Vector2i(x, z)
				if grid.is_in_boundsv(candidate) and not grid.is_point_solid(candidate):
					return Vector3(candidate.x, 0, candidate.y)
	return data.bus_position

func path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var start := cell_at(nearest_open(from))
	var end := cell_at(nearest_open(to))
	var points := PackedVector3Array()
	for point in grid.get_id_path(start, end):
		points.append(Vector3(point.x, 0, point.y))
	return points

func line_clear(from: Vector3, to: Vector3) -> bool:
	var steps := maxi(1, ceili(from.distance_to(to) * 2.0))
	for i in range(1, steps):
		var cell := cell_at(from.lerp(to, float(i) / steps))
		if not grid.is_in_boundsv(cell) or grid.is_point_solid(cell):
			return false
	return true

func set_marker(point: Vector3) -> void:
	marker.position = point + Vector3(0, 0.1, 0)
	marker.visible = true

func show_assignments(ids: Array) -> void:
	for key in sites:
		sites[key].label.visible = key not in ids

func update_site(id: String) -> void:
	var site: Dictionary = sites[id]
	if site.searched:
		site.label.text = site.spec.name + " · 已搜"
		site.label.modulate = Color("#8faaa7")
		site.ring.visible = false
	else:
		site.label.text = site.spec.name + "\n%d 食物 · %d 废料  %d%%" % [site.spec.food, site.spec.scrap, site.progress * 100]
