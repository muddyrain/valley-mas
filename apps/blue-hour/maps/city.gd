extends Node3D
const Visuals = preload("res://vfx/visuals.gd")
const Assets = preload("res://vfx/generated_assets.gd")
const Generator = preload("res://maps/generation/map_generator.gd")
const Navigation = preload("res://maps/generation/navigation_builder.gd")
const HudMarker = preload("res://ui/expedition/world_marker.gd")
var data: Resource
var grid := AStarGrid2D.new()
var sites: Dictionary = {}
var buildings: Dictionary = {}
var lamps: Array[MeshInstance3D] = []
var accent_lights: Array[OmniLight3D] = []
var lamp_materials: Array[Material] = []
var bus_door: Node3D
var bus_root: Node3D
var bus_label: Label3D
var bus_light: OmniLight3D
var marker: MeshInstance3D

func build(map: Resource) -> void:
	data = map
	grid.region = Rect2i(-data.half_width, -data.half_depth, data.half_width * 2 + 1, data.half_depth * 2 + 1)
	grid.cell_size = Vector2.ONE
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	Generator.build(self, data)
	var ground := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(data.half_width * 2, 0.2, data.half_depth * 2)
	collision.shape = shape
	ground.add_child(collision)
	ground.position.y = -0.15
	add_child(ground)
	_build_bus()
	preload("res://maps/world/surface_palette.gd").style_world(self)
	Navigation.build(self)
	marker = HudMarker.create(self, "world_move_marker", 1.05, data.bus_position)
	marker.visible = false

func register_site(spec: Dictionary, body: Node3D, vehicle: bool) -> void:
	var root := Node3D.new()
	root.name = "Search_" + spec.id
	add_child(root)
	var entry: Vector3 = spec.entry
	var ring := HudMarker.create(root, "world_interact_marker", .7, entry + Vector3.UP * 1.0)
	ring.hide()
	Visuals.hit_area(root, "site_id", spec.id, 1.1)
	# The entrance proxy is independent of the building's model and collider.
	root.get_child(root.get_child_count() - 1).position = entry
	var anchor := Marker3D.new()
	anchor.name = "SearchUIAnchor"
	body.get_node("Anchors").add_child(anchor)
	anchor.global_position = entry + Vector3.UP * (1.8 if vehicle else 2.0)
	sites[spec.id] = {"spec": spec, "progress": 0.0, "searched": false, "discovered": false, "ring": ring, "body": body, "vehicle": vehicle, "search_anchor": anchor}

func _build_bus() -> void:
	var pos: Vector3 = data.bus_position + Vector3(0, 0, 3.7)
	var bus := Assets.spawn("BH_EvacBus_01", self, pos, PI * .5, true)
	bus_root = bus
	Assets.collect_lamps(bus, lamps)
	# The supplied mesh is fused. Keep extraction timing without moving the whole car.
	bus_door = bus.get_node("DoorMotion") as Node3D
	# The existing tween moves in city X; keep its state and duration contract.
	bus_door.reparent(self, true)
	bus_door.set_meta("closed_x", bus_door.position.x)
	bus_door.position.x -= .8
	var return_zone := HudMarker.create(self, "world_select_ring", data.board_radius * 2.0, data.bus_position + Vector3(0, .06, 0), true)
	return_zone.name = "ReturnZone"
	return_zone.material_override.albedo_color = Color("#f4d397")
	var bus_marker := HudMarker.create(self, "icon_return", .85, pos + Vector3.UP * 3.1)
	bus_marker.name = "BusMarker"
	bus_label = Visuals.label(self, "归航巴士", pos + Vector3(0, 2.4, 0), Color("#ffe1a5"), 22)
	bus_label.pixel_size = .022
	bus_label.outline_size = 2
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
	# Movement feedback is rendered by WorldInteractionVfx's procedural ring.
	# The legacy textured marker has no semantic asset and can fall back to a
	# black quad, so keep the compatibility node permanently hidden.
	marker.visible = false

func update_site(id: String) -> void:
	if sites[id].searched:
		sites[id].ring.visible = false
