extends Node
## GPU ping-pong mask: R is current sight, G remembers this expedition only.
enum Visibility { UNEXPLORED, EXPLORED, VISIBLE }
const Config = preload("res://data/exploration.tres")
const ExplorationStateData = preload("res://maps/exploration_state.gd")
const MaskShader = preload("res://assets/world/materials/exploration_mask.gdshader")
const FogShader = preload("res://assets/world/materials/exploration_fog.gdshader")
var config: Resource = Config
var mission: Node3D
var sources: PackedVector2Array = []
var explored_stamps: Array[Vector2] = []
var _stamp_cells: Dictionary = {}
var exploration_state: RefCounted
var _viewports: Array[SubViewport] = []
var _materials: Array[ShaderMaterial] = []
var _front: int = 0
var _elapsed: float = 0.0
var _save_elapsed: float = 0.0
var _state_dirty: bool = false
var _fog: ShaderMaterial
var _restored_mask: Texture2D
var _mask_seed_pending: bool = false
var fog_mesh: MeshInstance3D
var _world_size: Vector2
var full_rebuild_count: int = 0
var dynamic_update_count: int = 0

func setup(target: Node3D) -> void:
	mission = target
	var town_bounds: Rect2 = mission.runtime_data.get("town_bounds", Rect2(-mission.catalog.map.half_width,
		-mission.catalog.map.half_depth, mission.catalog.map.half_width * 2, mission.catalog.map.half_depth * 2))
	_world_size = town_bounds.size
	exploration_state = ExplorationStateData.new()
	var profile_namespace: String = str(mission.random_map_config.get("exploration_state_namespace", ""))
	var town_signature: String = str(mission.runtime_data.get("source_signatures", {}).get("town", ""))
	var identity: String = "%s:%s:%s:%s:%s" % [str(mission.runtime_data.get("provider", mission.map_provider)), mission.mission_type, str(mission.runtime_data.get("seed", mission.rng.seed)), town_signature, profile_namespace]
	exploration_state.load_map(identity)
	for key: String in exploration_state.explored_cells:
		var parts: PackedStringArray = key.split(":")
		var cell := Vector2i(int(parts[0]), int(parts[1]))
		_stamp_cells[key] = true
		explored_stamps.append((Vector2(cell) + Vector2.ONE * 0.5) * ExplorationStateData.CELL_SIZE)
	if DisplayServer.get_name() != "headless":
		_build_gpu_mask()
	refresh()

func _build_gpu_mask() -> void:
	full_rebuild_count += 1
	var empty := ImageTexture.create_from_image(Image.create(1, 1, false, Image.FORMAT_RGBA8))
	for index: int in range(2):
		var viewport := SubViewport.new()
		viewport.name = "ExplorationMask" + str(index)
		viewport.size = config.mask_resolution
		viewport.disable_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		add_child(viewport)
		var rect := ColorRect.new()
		rect.size = config.mask_resolution
		var material := ShaderMaterial.new()
		material.shader = MaskShader
		material.set_shader_parameter("world_size", _world_size)
		material.set_shader_parameter("radius", config.radius)
		material.set_shader_parameter("falloff", config.falloff)
		material.set_shader_parameter("previous_mask", empty)
		rect.material = material
		viewport.add_child(rect)
		_viewports.append(viewport)
		_materials.append(material)
	if not exploration_state.explored_cells.is_empty():
		var restored: Image = Image.create(config.mask_resolution.x, config.mask_resolution.y, false, Image.FORMAT_RGBA8)
		for key: String in exploration_state.explored_cells:
			var parts: PackedStringArray = key.split(":")
			var cell := Vector2i(int(parts[0]), int(parts[1]))
			var world_center: Vector2 = (Vector2(cell) + Vector2.ONE * 0.5) * ExplorationStateData.CELL_SIZE
			var uv: Vector2 = world_center / _world_size + Vector2.ONE * 0.5
			if uv.x < 0.0 or uv.y < 0.0 or uv.x >= 1.0 or uv.y >= 1.0:
				continue
			var cell_pixels: Vector2 = Vector2(config.mask_resolution) * ExplorationStateData.CELL_SIZE / _world_size
			var rect: Rect2i = Rect2i((uv * Vector2(config.mask_resolution) - cell_pixels * 0.5).floor(), cell_pixels.ceil())
			restored.fill_rect(rect.intersection(Rect2i(Vector2i.ZERO, config.mask_resolution)), Color(0, 1, 0, 1))
		_restored_mask = ImageTexture.create_from_image(restored)
		_mask_seed_pending = true
	_fog = ShaderMaterial.new()
	_fog.shader = FogShader
	_fog.render_priority = 127
	_fog.set_shader_parameter("world_size", _world_size)
	fog_mesh = MeshInstance3D.new()
	fog_mesh.name = "ExplorationFog"
	var quad := QuadMesh.new()
	quad.size = Vector2(2, 2)
	fog_mesh.mesh = quad
	fog_mesh.material_override = _fog
	fog_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	fog_mesh.extra_cull_margin = 16384
	mission.camera.add_child(fog_mesh)
	fog_mesh.position.z = -1

func advance(delta: float) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	_elapsed += delta
	_save_elapsed += delta
	if _elapsed >= 1.0 / config.update_rate:
		_elapsed = fmod(_elapsed, 1.0 / config.update_rate)
		refresh()
	if _state_dirty and _save_elapsed >= 1.0:
		_save_elapsed = 0.0
		_state_dirty = not exploration_state.save()

func refresh() -> void:
	dynamic_update_count += 1
	sources.clear()
	for member: Node3D in mission.living():
		if member.inside_building or member.boarding:
			continue
		var point := Vector2(member.position.x, member.position.z)
		sources.append(point)
		# Gameplay queries store sparse visited positions, never scan or upload mask pixels.
		var cell := Vector2i((point / 1.5).floor())
		var stamp_key: String = "%d:%d" % [cell.x, cell.y]
		if not _stamp_cells.has(stamp_key):
			_stamp_cells[stamp_key] = true
			explored_stamps.append(point)
	var state_changed: bool = exploration_state.update_visibility(sources, config.radius)
	if state_changed:
		_state_dirty = true
	for site: Dictionary in mission.city.sites.values():
		if state_at(site.spec.entry) != Visibility.UNEXPLORED:
			site.discovered = true
	for enemy: Node3D in mission.enemies:
		var shown: bool = enemy.active and is_visible(enemy.position)
		enemy.visible = shown
		enemy.get_node("HitArea").collision_layer = 2 if shown else 0
	if _fog != null:
		_update_gpu()

func _update_gpu() -> void:
	var previous: int = _front
	_front = 1 - _front
	var positions := PackedVector2Array(sources)
	positions.resize(4)
	var material: ShaderMaterial = _materials[_front]
	material.set_shader_parameter("previous_mask", _restored_mask if _mask_seed_pending else _viewports[previous].get_texture())
	material.set_shader_parameter("sources", positions)
	material.set_shader_parameter("source_count", mini(sources.size(), 4))
	_viewports[_front].render_target_update_mode = SubViewport.UPDATE_ONCE
	_fog.set_shader_parameter("exploration_mask", _viewports[_front].get_texture())
	_mask_seed_pending = false
	var blue: bool = mission.clock.phase != mission.clock.DAY
	_fog.set_shader_parameter("unexplored_color", config.blue_unexplored if blue else config.day_unexplored)
	_fog.set_shader_parameter("explored_color", config.blue_explored if blue else config.day_explored)
func is_visible(position: Vector3) -> bool:
	var point := Vector2(position.x, position.z)
	# Dynamic information is gated before the faint outer edge, avoiding ghost enemies.
	for member: Node3D in mission.living():
		if member.inside_building or member.boarding:
			continue
		var source := Vector2(member.position.x, member.position.z)
		if source.distance_squared_to(point) < pow(config.radius - config.falloff * .35, 2):
			return true
	return false

func state_at(position: Vector3) -> Visibility:
	var stored_state: int = exploration_state.state_at(Vector2(position.x, position.z))
	if stored_state == 2 or is_visible(position):
		return Visibility.VISIBLE
	if stored_state == 1:
		return Visibility.EXPLORED
	return Visibility.UNEXPLORED

func _exit_tree() -> void:
	if exploration_state != null and _state_dirty:
		exploration_state.save()
