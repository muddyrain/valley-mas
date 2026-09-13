extends Node3D
class_name CampCoreProp
## Wrapper applies restrained CAMP material response while preserving source textures.
@export var albedo_tint: Color = Color(1, 1, 1, 1)
@export_range(0.0, 1.0) var roughness_floor: float = 0.72

func _ready() -> void:
	_apply_materials()

func _apply_materials() -> void:
	for view: MeshInstance3D in find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(view.mesh.get_surface_count()):
			var source := view.get_active_material(surface)
			if source is BaseMaterial3D:
				var material := source.duplicate() as BaseMaterial3D
				material.albedo_color = material.albedo_color * albedo_tint
				material.roughness = maxf(material.roughness, roughness_floor)
				material.metallic = minf(material.metallic, 0.72)
				view.set_surface_override_material(surface, material)
