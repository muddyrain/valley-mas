extends RefCounted
## Shared CAMP palette, source sampling and typography; no gameplay values.
const Manifest = preload("res://ui/camp/camp_asset_manifest.gd")
const Fonts = preload("res://ui/new_run_art.gd")
const INK := Color("#132e49")
const MUTED := Color("#506477")
const PAPER := Color("#f4f0e6")
const CYAN := Color("#64caff")
const WHITE := Color("#f7f6ef")
const TEXT_VISUAL_OFFSET_Y := -1.0
static var _textures: Dictionary = {}
static var _font: Font = Fonts.body_font(600)

static func texture(id: int) -> Texture2D:
	if not _textures.has(id):
		_textures[id] = load(Manifest.PATHS[id])
	return _textures[id]

static func label(value: String, font_size: int = 18, color: Color = INK) -> Label:
	var result := Label.new()
	result.text = value
	result.add_theme_font_override("font", _font)
	result.add_theme_font_size_override("font_size", font_size)
	result.add_theme_color_override("font_color", color)
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	result.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	return result

static func icon(value: Texture2D, dimensions: Vector2) -> TextureRect:
	var result := TextureRect.new()
	result.texture = value
	result.custom_minimum_size = dimensions
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

static func full_rect(node: Control) -> void:
	node.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE

static func place(node: Control, parent: Control, rect: Rect2) -> void:
	parent.add_child(node)
	node.position = rect.position
	node.size = rect.size
	if node is Label and node.autowrap_mode != TextServer.AUTOWRAP_OFF:
		# Autowrap initially measures at width zero; settle width before final height.
		node.set_deferred("size", rect.size)

static func theme() -> Theme:
	var result: Theme = preload("res://ui/camp_style.gd").paper_theme()
	result.default_font = _font
	result.default_font_size = 18
	return result
