extends RefCounted
## Shared subtle surfaces in world space, so adjacent road modules never restart the pattern.

const Surface = preload("res://assets/world/materials/street_surface.gdshader")
static var materials: Dictionary = {}

static func get_material(color: Color, kind: String) -> Material:
	var key: String = kind + str(color)
	if not materials.has(key):
		var material := ShaderMaterial.new()
		material.shader = Surface
		material.set_shader_parameter("base_color", color)
		material.set_shader_parameter("variation", 0.055 if kind == "ground" else 0.025)
		material.set_shader_parameter("paving", 1.0 if kind == "pavement" else 0.0)
		materials[key] = material
	return materials[key]
