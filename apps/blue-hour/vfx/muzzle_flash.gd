extends MeshInstance3D
## One shared mesh, one draw call, no particles, lights, collisions or damage.
const LIFETIME: float = .072
static var _shared_mesh: ArrayMesh
var time_left: float = 0.0
var pulses: int = 0

func _init() -> void:
	if _shared_mesh == null:
		_shared_mesh = build_mesh()
	mesh = _shared_mesh
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visible = false

func trigger() -> void:
	time_left = LIFETIME
	pulses += 1
	visible = true
	scale = Vector3.ONE
	rotation.z = .35 if pulses % 2 == 0 else -.20

func advance(delta: float) -> void:
	time_left = maxf(0.0, time_left - delta)
	visible = time_left > 0.0
	if visible:
		scale = Vector3.ONE * lerpf(.65, 1.0, time_left / LIFETIME)

func clear() -> void:
	time_left = 0.0
	visible = false

static func build_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	# Crossed tapered tongues stay readable both along and across the muzzle axis.
	for axis: Vector3 in [Vector3.RIGHT, Vector3.UP]:
		var corners: Array[Vector3] = [Vector3.ZERO, axis * .14 + Vector3(0, 0, -.09), Vector3(0, 0, -.32), -axis * .14 + Vector3(0, 0, -.09)]
		for index in 4:
			surface.set_color(Color(1.0, .96, .75, 1.0))
			surface.add_vertex(Vector3(0, 0, -.11))
			surface.set_color(Color(1.0, .55, .13, .55))
			surface.add_vertex(corners[index])
			surface.add_vertex(corners[(index + 1) % 4])
	# A small face-on star prevents the flash disappearing into a single line.
	for index in 8:
		var angle := TAU * index / 8
		var next := TAU * (index + 1) / 8
		var radius := .15 if index % 2 == 0 else .06
		var next_radius := .15 if (index + 1) % 2 == 0 else .06
		surface.set_color(Color(1.0, .96, .75, 1.0))
		surface.add_vertex(Vector3(0, 0, -.08))
		surface.set_color(Color(1.0, .55, .13, .35))
		surface.add_vertex(Vector3(cos(angle) * radius, sin(angle) * radius, -.08))
		surface.add_vertex(Vector3(cos(next) * next_radius, sin(next) * next_radius, -.08))
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.vertex_color_use_as_albedo = true
	surface.set_material(material)
	return surface.commit()
