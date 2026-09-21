extends Node
## GPU ping-pong mask: R is current sight, G remembers this expedition only.
enum Visibility { UNEXPLORED, EXPLORED, VISIBLE }
const Config = preload("res://data/exploration.tres")
const MaskShader = preload("res://assets/world/materials/exploration_mask.gdshader")
const FogShader = preload("res://assets/world/materials/exploration_fog.gdshader")
var config: Resource = Config
var mission: Node3D
var sources: PackedVector2Array = []
var explored_stamps: Array[Vector2] = []
var _stamp_cells: Dictionary = {}
var _viewports: Array[SubViewport] = []
var _materials: Array[ShaderMaterial] = []
var _front: int = 0
var _elapsed: float = 0.0
var _fog: ShaderMaterial
var fog_mesh: MeshInstance3D
var _world_size: Vector2
var full_rebuild_count: int = 0
var dynamic_update_count: int = 0

func setup(target: Node3D) -> void:
	mission = target
	_world_size = Vector2(mission.catalog.map.half_width, mission.catalog.map.half_depth) * 2
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
	if _elapsed >= 1.0 / config.update_rate:
		_elapsed = fmod(_elapsed, 1.0 / config.update_rate)
		refresh()

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
		if not _stamp_cells.has(cell):
			_stamp_cells[cell] = true
			explored_stamps.append(point)
	for site: Dictionary in mission.city.sites.values():
		if is_visible(site.spec.entry):
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
	material.set_shader_parameter("previous_mask", _viewports[previous].get_texture())
	material.set_shader_parameter("sources", positions)
	material.set_shader_parameter("source_count", mini(sources.size(), 4))
	_viewports[_front].render_target_update_mode = SubViewport.UPDATE_ONCE
	_fog.set_shader_parameter("exploration_mask", _viewports[_front].get_texture())
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
	if is_visible(position):
		return Visibility.VISIBLE
	var point := Vector2(position.x, position.z)
	for stamp: Vector2 in explored_stamps:
		if stamp.distance_squared_to(point) < config.radius * config.radius:
			return Visibility.EXPLORED
	return Visibility.UNEXPLORED
