extends MeshInstance3D
## A collision-free PNG view. Width is in world metres, independent of gameplay radii.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
var image_name: String = ""
var _fade: Tween

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
	return view

func set_image(image_id: String) -> void:
	if image_name == image_id:
		return
	image_name = image_id
	material_override.albedo_texture = HudArt.texture(image_id)

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
