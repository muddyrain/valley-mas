class_name EnemyHitFeedback
extends RefCounted
## Shared shader overlay used by every enemy instance; no per-weapon branches.

const FLASH_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, blend_add;
uniform float flash_strength : hint_range(0.0, 1.0) = 0.0;
void fragment() {
    ALBEDO = vec3(1.0, 0.88, 0.68);
    EMISSION = ALBEDO * (1.0 + flash_strength * 0.65);
    ALPHA = flash_strength * 0.32;
}
"""

var target: Node3D
var overlays: Array[ShaderMaterial] = []
var time_left: float = 0.0
var duration: float = 0.065

func setup(enemy: Node3D, rig: Node3D) -> void:
	target = enemy
	var shader := Shader.new()
	shader.code = FLASH_SHADER
	for mesh: MeshInstance3D in rig.find_children("*", "MeshInstance3D", true, false):
		var material := ShaderMaterial.new()
		material.shader = shader
		material.set_shader_parameter("flash_strength", 0.0)
		mesh.material_overlay = material
		overlays.append(material)

func trigger() -> void:
	time_left = duration
	_set_strength(0.52)

func advance(delta: float) -> void:
	if time_left <= 0.0:
		return
	time_left = maxf(0.0, time_left - delta)
	_set_strength(clampf(time_left / duration, 0.0, 1.0) * 0.52)

func clear() -> void:
	time_left = 0.0
	_set_strength(0.0)

func active() -> bool:
	return time_left > 0.0

func _set_strength(value: float) -> void:
	for material: ShaderMaterial in overlays:
		material.set_shader_parameter("flash_strength", value)
