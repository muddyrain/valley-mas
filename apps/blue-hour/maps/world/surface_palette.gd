extends RefCounted
## Shared subtle surfaces in world space, so adjacent road modules never restart the pattern.

const Surface = preload("res://assets/world/materials/street_surface.gdshader")
const EnvironmentStyle = preload("res://assets/world/materials/environment_stylized.gdshader")
static var materials: Dictionary = {}
static var model_materials: Dictionary = {}

static func get_material(color: Color, kind: String) -> Material:
	var key: String = kind + str(color)
	if not materials.has(key):
		var material := ShaderMaterial.new()
		material.shader = Surface
		material.set_shader_parameter("base_color", color)
		material.set_shader_parameter("variation", 0.10 if kind == "ground" else 0.025)
		material.set_shader_parameter("paving", 1.0 if kind == "pavement" else 0.0)
		materials[key] = material
	return materials[key]

static func style_world(root: Node3D) -> void:
	# Only city instances receive overrides; shared imports also serve Camp and the asset viewer.
	for wrapper: Node in root.find_children("*", "Node3D", true, false):
		var id: String = str(wrapper.get("asset_id")) if wrapper.get_script() != null and "asset_id" in wrapper else str(wrapper.get_meta("asset_id", ""))
		if id.is_empty() or id.begins_with("BAR_"):
			continue
		for mesh: MeshInstance3D in wrapper.find_children("*", "MeshInstance3D", true, false):
			for surface: int in range(mesh.mesh.get_surface_count()):
				var source := mesh.get_active_material(surface) as BaseMaterial3D
				# Lamp lenses retain their original shared day/night control.
				if source == null or source.albedo_texture == null:
					continue
				var key: String = str(source.get_instance_id()) + id
				if not model_materials.has(key):
					var material := ShaderMaterial.new()
					material.shader = EnvironmentStyle
					material.set_shader_parameter("source_texture", source.albedo_texture)
					material.set_shader_parameter("source_tint", source.albedo_color)
					material.set_shader_parameter("bounds_center", mesh.get_aabb().get_center())
					material.set_shader_parameter("bounds_extent", mesh.get_aabb().size * .5)
					material.set_shader_parameter("foliage", 1.0 if id.begins_with("VEG_") else 0.0)
					material.set_shader_parameter("architecture", 1.0 if id.begins_with("BLD_") else 0.0)
					# The atlas has tightly packed islands: extra mip bias bleeds dark triangle borders.
					material.set_shader_parameter("texture_softening", 0.0)
					var residential: bool = "house" in id
					var service: bool = "warehouse" in id or "repair" in id
					material.set_shader_parameter("palette", Color("#d3c9af") if residential else Color("#91a6aa") if service else Color("#c6cbbc"))
					material.set_shader_parameter("roof_color", Color("#58687e") if residential else Color("#526d77"))
					model_materials[key] = material
				mesh.set_surface_override_material(surface, model_materials[key])
