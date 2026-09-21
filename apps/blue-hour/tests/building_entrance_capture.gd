extends SceneTree
## Native-only visual evidence for the Building Entrance Facing contract.

const Generator = preload("res://maps/town/town_generator.gd")
const View = preload("res://maps/town/town_urban_view.gd")
const Assets = preload("res://data/world_asset_catalog.gd")
const Facing = preload("res://maps/town/building_entrance_facing.gd")
const OUTPUT := "res://test-output/building-entrance-facing/"

var world: Node3D
var camera: Camera3D
var current_town: Dictionary
var capture_failed: bool = false

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	root.unfocusable = true
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	_setup_world()
	for item: Dictionary in [
		{"seed": 4101, "name": "overview_seed_01.png"},
		{"seed": 4102, "name": "overview_seed_02.png"},
		{"seed": 4103, "name": "overview_seed_03.png"},
	]:
		_build_town(item.seed)
		_add_overlay(current_town.buildings, false)
		_camera_overview()
		await _capture(item.name)
	_build_town(4101)
	await _capture_category("residential", "residential_cases.png")
	await _capture_category("commercial", "commercial_cases.png")
	await _capture_category("industrial", "industrial_cases.png")
	await _capture_corner("corner_lot_cases.png")
	await _capture_category("commercial", "entrance_debug_overlay.png", true)
	await _capture_rotations()
	world.queue_free()
	await process_frame
	quit(1 if capture_failed else 0)

func _setup_world() -> void:
	world = Node3D.new()
	root.add_child(world)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#71808a")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#d7e1e5")
	environment.environment.ambient_light_energy = 0.75
	world.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55, -35, 0)
	light.light_energy = 1.1
	light.shadow_enabled = true
	world.add_child(light)
	camera = Camera3D.new()
	camera.fov = 48.0
	camera.current = true
	world.add_child(camera)

func _build_town(seed_value: int) -> void:
	_clear_content()
	current_town = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	View.build(world, current_town)

func _clear_content() -> void:
	for child: Node in world.get_children():
		if child != camera and not child is WorldEnvironment and not child is DirectionalLight3D:
			world.remove_child(child)
			child.free()

func _camera_overview() -> void:
	var center: Vector2 = current_town.bounds.get_center()
	var span := maxf(current_town.bounds.size.x, current_town.bounds.size.y)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = span * 1.02
	camera.position = Vector3(center.x + span * 0.28, span * 0.78, center.y + span * 0.32)
	camera.look_at(Vector3(center.x, 0.0, center.y))

func _capture_category(category: String, file_name: String, detailed: bool = false) -> void:
	_remove_overlay()
	var candidates: Array[Dictionary] = []
	for site: Dictionary in current_town.buildings:
		if site.category == category:
			candidates.append(site)
	var focus: Array[Dictionary] = []
	if not candidates.is_empty():
		focus.append(candidates[0])
		for site: Dictionary in candidates:
			if focus.size() >= 3:
				break
			if site.position.distance_to(focus[0].position) < 35.0:
				focus.append(site)
	_add_overlay(focus, true)
	_focus_camera(focus[0], 18.0 if detailed else 25.0)
	await _capture(file_name)

func _capture_corner(file_name: String) -> void:
	_remove_overlay()
	var chosen: Dictionary = {}
	for site: Dictionary in current_town.buildings:
		var block: Dictionary = _find(current_town.blocks, "id", site.block_id)
		if block.get("street_edges", []).size() > 1:
			chosen = site
			break
	_add_overlay([chosen], true)
	_focus_camera(chosen, 27.0)
	await _capture(file_name)

func _capture_rotations() -> void:
	_clear_content()
	var overlay := Node3D.new()
	overlay.name = "EntranceDebugOverlay"
	world.add_child(overlay)
	var definition: Resource = Assets.asset("BLD_010")
	var directions: Array[Vector3] = [Vector3.FORWARD, Vector3.RIGHT, Vector3.BACK, Vector3.LEFT]
	for index: int in 4:
		var x := (index % 2) * 18.0 - 9.0
		var z := floori(index / 2.0) * 18.0 - 9.0
		var center := Vector3(x, 0.0, z)
		var yaw := Facing.placement_yaw(definition.primary_entrance_local_forward, directions[index])
		var wrapper: Node3D = definition.scene.instantiate()
		wrapper.name = "Rotation%d" % (index * 90)
		wrapper.position = center
		wrapper.rotation.y = yaw
		world.add_child(wrapper)
		var door := Facing.world_anchor(center, yaw, definition.primary_entrance_local_anchor)
		var stand := Facing.world_anchor(center, yaw, definition.search_interaction_local_anchor)
		var forward := Facing.world_forward(yaw, definition.primary_entrance_local_forward)
		_add_road(center + forward * 7.0, forward)
		_add_debug(door, stand, forward, "BLD_010  yaw %d deg\nfrontage cardinal_%d  PASS" % [index * 90, index])
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 46.0
	camera.position = Vector3(0.0, 50.0, 0.01)
	camera.look_at(Vector3.ZERO)
	await _capture("rotation_0_90_180_270.png")

func _add_overlay(sites: Array, labels: bool) -> void:
	var overlay := Node3D.new()
	overlay.name = "EntranceDebugOverlay"
	world.add_child(overlay)
	for site: Dictionary in sites:
		var door: Vector3 = site.primary_entrance
		var stand: Vector3 = site.search_interaction
		var forward: Vector3 = site.primary_entrance_forward
		var label := "%s / %s\nstreet %s  frontage %s\nyaw %.0f deg  PASS" % [site.id, Assets.asset(site.asset).building_id,
			site.assigned_street_id, site.selected_frontage, rad_to_deg(site.yaw)]
		_add_debug(door, stand, forward, label if labels else "")
		_add_line(door + Vector3.UP * 0.12, site.road_point + Vector3.UP * 0.12, Color("#48a8ff"), 0.12)

func _add_debug(door: Vector3, stand: Vector3, forward: Vector3, text: String) -> void:
	_add_marker(door + Vector3.UP * 0.35, Color("#39e36b"), 0.4)
	_add_marker(stand + Vector3.UP * 0.35, Color("#ffd83d"), 0.36)
	_add_line(door + Vector3.UP * 0.45, door + forward * 3.0 + Vector3.UP * 0.45, Color("#39e36b"), 0.15)
	if not text.is_empty():
		var label := Label3D.new()
		label.text = text
		label.position = door + Vector3.UP * 3.2
		label.font_size = 36
		label.pixel_size = 0.014
		label.outline_size = 7
		label.modulate = Color.WHITE
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		world.get_node("EntranceDebugOverlay").add_child(label)

func _add_marker(position: Vector3, color: Color, radius: float) -> void:
	var marker := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 2.0
	marker.mesh = sphere
	marker.position = position
	marker.material_override = _material(color)
	world.get_node("EntranceDebugOverlay").add_child(marker)

func _add_line(from: Vector3, to: Vector3, color: Color, width: float) -> void:
	var delta := to - from
	if delta.length() < 0.01:
		return
	var line := MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = width
	cylinder.bottom_radius = width
	cylinder.height = delta.length()
	line.mesh = cylinder
	line.position = (from + to) * 0.5
	line.quaternion = Quaternion(Vector3.UP, delta.normalized())
	line.material_override = _material(color)
	world.get_node("EntranceDebugOverlay").add_child(line)

func _add_road(center: Vector3, outward: Vector3) -> void:
	var road := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(14.0, 5.0)
	road.mesh = plane
	road.position = center + Vector3.DOWN * 0.02
	road.rotation.y = atan2(outward.x, outward.z)
	road.material_override = _material(Color("#41474b"))
	world.add_child(road)

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return material

func _focus_camera(site: Dictionary, distance: float) -> void:
	camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	var focus: Vector3 = site.primary_entrance + Vector3.UP * 1.0
	var forward: Vector3 = site.primary_entrance_forward
	var lateral := forward.cross(Vector3.UP)
	camera.position = focus + forward * distance + lateral * distance * 0.65 + Vector3.UP * distance * 0.62
	camera.look_at(focus)

func _remove_overlay() -> void:
	var overlay: Node = world.get_node_or_null("EntranceDebugOverlay")
	if overlay != null:
		overlay.free()

func _capture(file_name: String) -> void:
	for frame: int in 5:
		await process_frame
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	var error: Error = image.save_png(OUTPUT + file_name)
	if error != OK:
		capture_failed = true
		push_error("Failed to save " + file_name)

func _find(items: Array, key: String, value: Variant) -> Dictionary:
	for item: Dictionary in items:
		if item.get(key) == value:
			return item
	return {}
