extends MeshInstance3D
## A collision-free PNG view. Width is in world metres, independent of gameplay radii.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
var image_name: String = ""
var _fade: Tween
var _discovery_ripple: MeshInstance3D
var _discovery_ripple_material: StandardMaterial3D

const DISCOVERY_DOT_COLOR := Color("#bdefff")
const DISCOVERY_RIPPLE_COLOR := Color("#75d8e8")

static func create(parent: Node3D, image_id: String, width: float, point: Vector3, ground: bool = false) -> MeshInstance3D:
	var view := load("res://ui/expedition/world_marker.gd").new() as MeshInstance3D
	view.name = image_id.to_pascal_case()
	var surface := StandardMaterial3D.new()
	surface.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	surface.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	surface.cull_mode = BaseMaterial3D.CULL_DISABLED
	surface.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	surface.albedo_color = Visual.world_tint(Visual.SITE_ALPHA)
	view.material_override = surface
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if ground:
		var plane := PlaneMesh.new()
		plane.size = Vector2.ONE * width
		view.mesh = plane
	else:
		var quad := QuadMesh.new()
		quad.size = Vector2.ONE * width
		view.mesh = quad
		surface.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	parent.add_child(view)
	view.position = point
	view.call("set_image", image_id)
	if image_id == "world_discover_marker":
		view.call("_setup_discovery_marker", width)
	return view

func set_image(image_id: String) -> void:
	if image_name == image_id:
		return
	image_name = image_id
	if image_id == "world_discover_marker":
		material_override.albedo_texture = null
		return
	material_override.albedo_texture = HudArt.texture(image_id)

func _setup_discovery_marker(width: float) -> void:
	# Available targets use native geometry so the cue remains readable without
	# introducing another baked icon or a second world-space UI system.
	var dot := SphereMesh.new()
	dot.radius = width * .14
	dot.height = width * .28
	dot.radial_segments = 12
	dot.rings = 6
	mesh = dot
	material_override.albedo_color = DISCOVERY_DOT_COLOR
	material_override.emission_enabled = true
	material_override.emission = DISCOVERY_DOT_COLOR
	material_override.emission_energy_multiplier = 1.4

	var ripple := MeshInstance3D.new()
	ripple.name = "DiscoveryRipple"
	var torus := TorusMesh.new()
	torus.inner_radius = width * .26
	torus.outer_radius = width * .31
	torus.rings = 20
	torus.ring_segments = 8
	ripple.mesh = torus
	# Keep the dot readable near the entrance while the ripple visually belongs
	# to the ground below it.
	ripple.position = Vector3(0, -0.57, 0)
	var ripple_material := StandardMaterial3D.new()
	ripple.material_override = ripple_material
	ripple.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_setup_ripple_material(ripple_material)
	add_child(ripple)
	_discovery_ripple = ripple
	_discovery_ripple_material = ripple_material

func _setup_ripple_material(material: StandardMaterial3D) -> void:
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = DISCOVERY_RIPPLE_COLOR
	material.emission_enabled = true
	material.emission = DISCOVERY_RIPPLE_COLOR
	material.emission_energy_multiplier = 1.1

func animate_discovery(time: float) -> void:
	if not is_instance_valid(_discovery_ripple):
		return
	var phase: float = fmod(time, 1.25) / 1.25
	var breath: float = 0.5 + 0.5 * sin(time * TAU / 1.35)
	var wave: float = phase
	_discovery_ripple.scale = Vector3.ONE * (0.88 + wave * .34)
	_discovery_ripple_material.albedo_color = Color(DISCOVERY_RIPPLE_COLOR, lerpf(.22, .015, wave))
	_discovery_ripple_material.emission_energy_multiplier = lerpf(.8, .2, wave)
	material_override.albedo_color = Color(DISCOVERY_DOT_COLOR, lerpf(.76, .84, breath))
	material_override.emission_energy_multiplier = lerpf(1.18, 1.36, breath)

func flash() -> void:
	if _fade != null:
		_fade.kill()
	visible = true
	scale = Vector3.ONE * Visual.MOVE_SCALE * .75
	material_override.albedo_color.a = 0.0
	_fade = create_tween()
	_fade.set_parallel(true)
	_fade.tween_property(self, "scale", Vector3.ONE * Visual.MOVE_SCALE, Visual.MOVE_SHOW).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_fade.tween_property(material_override, "albedo_color:a", Visual.MOVE_ALPHA, Visual.MOVE_SHOW)
	_fade.chain().tween_interval(Visual.MOVE_HOLD)
	_fade.chain().tween_property(material_override, "albedo_color:a", 0.0, Visual.MOVE_FADE)
	_fade.chain().tween_callback(hide)
