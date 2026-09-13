extends Node
## Camp-only overrides keep shared imports, actors and the city untouched.

const HeroShader = preload("res://assets/world/materials/environment_stylized.gdshader")
const GroundShader = preload("res://assets/world/materials/camp_ground.gdshader")
static var hero_materials: Dictionary = {}
static var character_materials: Dictionary = {}
var _ground_materials: Array[ShaderMaterial] = []
var _actors: Array[Node3D] = []
var _vehicle: Node3D

func configure(camp: Node3D) -> void:
	_vehicle = camp.get_node("NavigationSource/BlueHourBerth")
	style_model(camp.get_node("NavigationSource/MainBuilding"), false)
	style_model(_vehicle, true)
	var sources: Array[String] = ["NavigationSource/GroundSurface", "SurroundingTerrain", "NavigationSource/MainForecourt", "NavigationSource/BerthDriveway", "NavigationSource/Road/MeshInstance3D"]
	var kinds: Array[int] = [0, 0, 1, 2, 3]
	var shared: Dictionary = {}
	for i: int in range(sources.size()):
		if not shared.has(kinds[i]):
			var material := ShaderMaterial.new()
			material.shader = GroundShader
			material.set_shader_parameter("surface_kind", kinds[i])
			shared[kinds[i]] = material
			_ground_materials.append(material)
		var mesh: MeshInstance3D = camp.get_node(sources[i])
		mesh.material_override = shared[kinds[i]]
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func style_model(model: Node3D, vehicle: bool) -> void:
	for mesh: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(mesh.mesh.get_surface_count()):
			var source := mesh.get_active_material(surface) as BaseMaterial3D
			if source == null or source.albedo_texture == null:
				continue
			var bounds := mesh.get_aabb()
			var key := str(source.get_instance_id()) + str(vehicle) + str(bounds)
			if not hero_materials.has(key):
				var material := ShaderMaterial.new()
				material.shader = HeroShader
				material.set_shader_parameter("source_texture", source.albedo_texture)
				material.set_shader_parameter("source_tint", source.albedo_color)
				material.set_shader_parameter("bounds_center", bounds.get_center())
				material.set_shader_parameter("bounds_extent", bounds.size * 0.5)
				material.set_shader_parameter("hero_surface", 1.0)
				material.set_shader_parameter("vehicle", 1.0 if vehicle else 0.0)
				material.set_shader_parameter("palette", Color("71b3cb") if vehicle else Color("c6cdcc"))
				material.set_shader_parameter("roof_color", Color("596e86"))
				material.set_shader_parameter("shade_color", Color("b1b9de"))
				material.set_shader_parameter("rim_strength", 0.075 if vehicle else 0.025)
				hero_materials[key] = material
			mesh.set_surface_override_material(surface, hero_materials[key])

func register_actor(actor: Node3D) -> void:
	_actors.append(actor)
	# Only skin-rendered imported meshes: no weapon, ring, rig or animation changes.
	for mesh: MeshInstance3D in actor.find_children("*", "MeshInstance3D", true, false):
		if mesh.skin == null:
			continue
		for surface: int in range(mesh.mesh.get_surface_count()):
			var source := mesh.get_active_material(surface) as BaseMaterial3D
			if source == null:
				continue
			var key: int = source.get_instance_id()
			if not character_materials.has(key):
				var material := source.duplicate() as BaseMaterial3D
				# Leave headroom for the source's near-white hair/coat under daylight.
				material.albedo_color = source.albedo_color.darkened(0.12)
				material.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
				material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
				material.metallic = 0.0
				material.roughness = 0.85
				material.normal_scale = 0.2
				material.rim_enabled = true
				material.rim = 0.14
				material.rim_tint = 0.6
				character_materials[key] = material
			mesh.set_surface_override_material(surface, character_materials[key])

func _process(_delta: float) -> void:
	var contacts := PackedVector4Array()
	contacts.resize(4)
	for i: int in range(mini(_actors.size(), 4)):
		var actor: Node3D = _actors[i]
		if is_instance_valid(actor) and actor.is_visible_in_tree() and actor.visual.is_visible_in_tree():
			var point := actor.global_position
			contacts[i] = Vector4(point.x, point.y, point.z, 1.0)
	for material: ShaderMaterial in _ground_materials:
		material.set_shader_parameter("contacts", contacts)
		material.set_shader_parameter("vehicle_contact", _vehicle.global_position)
		material.set_shader_parameter("vehicle_yaw", _vehicle.global_rotation.y)
