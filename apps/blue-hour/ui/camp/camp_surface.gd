extends PanelContainer
## Draw native-resolution nine-patches at a uniform edge scale. The texture is
## never downsampled on disk, and corner width is independent of panel length.
const CampArt = preload("res://ui/camp/camp_skin.gd")
var asset_id: int = 20
var edge_scale: float = 0.12
var fixed_aspect: bool = false
var texture_tint: Color = Color.WHITE
var _patch := StyleBoxTexture.new()

func _init() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	resized.connect(queue_redraw)

func configure(id: int, corners: float = 80.0, scale_value: float = 0.12, fixed: bool = false) -> void:
	asset_id = id
	edge_scale = scale_value
	fixed_aspect = fixed
	_patch.texture = CampArt.texture(id)
	_patch.set_texture_margin_all(corners)
	_patch.draw_center = id not in [501, 40, 41, 42, 43]
	queue_redraw()

func _draw() -> void:
	if _patch.texture == null:
		return
	if fixed_aspect:
		var factor: float = minf(size.x / _patch.texture.get_width(), size.y / _patch.texture.get_height())
		var dimensions: Vector2 = _patch.texture.get_size() * factor
		draw_texture_rect(_patch.texture, Rect2((size - dimensions) * 0.5, dimensions), false, texture_tint)
		return
	if asset_id == 501:
		draw_texture_rect(CampArt.texture(502), Rect2(Vector2(7, 5), size - Vector2(14, 10)), false)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE * edge_scale)
	_patch.modulate_color = texture_tint
	draw_style_box(_patch, Rect2(Vector2.ZERO, size / edge_scale))
	draw_set_transform(Vector2.ZERO)
