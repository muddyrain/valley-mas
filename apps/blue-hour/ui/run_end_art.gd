extends RefCounted
## Presentation-only resources shared by the end page and reusable member cards.

const Fonts = preload("res://ui/new_run_art.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const BACKGROUND = preload("res://assets/ui/run_end/run_end_homeward_background.png")
const PAPER = preload("res://assets/ui/common/cards/ui_common_card_paper.png")
const TAPE = preload("res://assets/ui/common/cards/ui_common_washi_tape.svg")
const BRUSH = preload("res://assets/ui/common/cards/ui_common_status_brush.svg")
const FOCUS = preload("res://assets/ui/common/buttons/ui_common_chamfer_focus.svg")
const CREST = preload("res://assets/ui/run_end/run_end_heading_crest.svg")
const SYMBOLS = preload("res://assets/ui/run_end/run_end_symbols.svg")
const BLUE = preload("res://assets/ui/today_action/today_action_button_blue.png")
const GREEN = preload("res://assets/ui/today_action/today_action_button_green.png")
const INK := Color("#17334f")
const MUTED := Color("#71808c")
const CREAM := Color("#f7f0df")

static func label(value: String, font_size: int, color: Color = INK, weight: int = 600) -> Label:
	var result := Label.new()
	result.text = value
	result.add_theme_font_override("font", Fonts.body_font(weight))
	result.add_theme_font_size_override("font_size", font_size)
	result.add_theme_color_override("font_color", color)
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

static func headline_font() -> Font:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["SimHei", "Microsoft YaHei", "Noto Sans CJK SC"])
	font.font_weight = 900
	var heavy := FontVariation.new()
	heavy.base_font = font
	heavy.variation_embolden = 1.3
	return heavy

static func handwriting_font() -> SystemFont:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["KaiTi", "STKaiti", "Noto Serif CJK SC", "Microsoft YaHei"])
	return font

static func paper(padding: int = 20, tint: Color = Color.WHITE) -> StyleBoxTexture:
	var result := StyleBoxTexture.new()
	result.texture = PAPER
	result.set_texture_margin_all(18)
	result.modulate_color = tint
	result.content_margin_left = padding
	result.content_margin_right = padding
	result.content_margin_top = padding
	result.content_margin_bottom = padding
	return result

static func image(parent: Node, texture: Texture2D, minimum: Vector2 = Vector2.ZERO) -> TextureRect:
	var result := TextureRect.new()
	result.texture = texture
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.custom_minimum_size = minimum
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(result)
	return result

static func icon(kind: String) -> AtlasTexture:
	var regions: Dictionary = {"calendar": 0, "members": 64, "food": 128, "scrap": 192, "home": 256, "arrow": 320, "warning": 384}
	var result := AtlasTexture.new()
	result.atlas = SYMBOLS
	result.region = Rect2(int(regions[kind]), 0, 64, 64)
	return result

static func section(chinese: String, english: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	row.add_child(label(chinese, 21, INK, 800))
	var translation := label(english, 12, MUTED)
	translation.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(translation)
	return row

static func rule() -> HBoxContainer:
	var row := HBoxContainer.new()
	row.custom_minimum_size.y = 8
	row.add_theme_constant_override("separation", 0)
	for index: int in 3:
		var part := ColorRect.new()
		part.color = Color("#6f8393")
		part.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if index == 1:
			part.custom_minimum_size.y = 1
			part.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		else:
			part.custom_minimum_size = Vector2(3, 3)
		part.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(part)
	return row

static func button(chinese: String, english: String, kind: String, action: Callable, primary: bool) -> Button:
	var result := Button.new()
	result.text = chinese
	result.focus_mode = Control.FOCUS_ALL
	result.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	result.custom_minimum_size = Vector2(0, 78)
	result.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	result.pressed.connect(action)
	for state: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		result.add_theme_color_override(state, Color.TRANSPARENT)
	result.add_theme_font_size_override("font_size", 1)
	var normal := StyleBoxTexture.new()
	normal.texture = GREEN if primary else BLUE
	normal.region_rect = Rect2(36, 214, 1548, 331) if primary else Rect2(164, 173, 1150, 295)
	# These supplied plates contain their complete border inside the visible region.
	# Stretch that region as a whole; large nine-slice margins crush a 78px button.
	normal.set_texture_margin_all(0)
	normal.modulate_color = Color(.65, .85, .77) if primary else Color(.7, .82, .97)
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 6
	normal.content_margin_bottom = 6
	result.add_theme_stylebox_override("normal", normal)
	for state: String in ["hover", "pressed"]:
		var style: StyleBoxTexture = normal.duplicate()
		style.modulate_color = normal.modulate_color.lightened(.16) if state == "hover" else normal.modulate_color.darkened(.18)
		result.add_theme_stylebox_override(state, style)
	var focus := StyleBoxTexture.new()
	focus.texture = FOCUS
	focus.set_texture_margin_all(22)
	focus.set_expand_margin_all(-2)
	result.add_theme_stylebox_override("focus", focus)
	var margin := MarginContainer.new()
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	result.add_child(margin)
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 24)
	margin.add_theme_constant_override("margin_right", 24)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 22)
	margin.add_child(row)
	image(row, icon(kind), Vector2(31, 31))
	var copy := VBoxContainer.new()
	copy.alignment = BoxContainer.ALIGNMENT_CENTER
	copy.mouse_filter = Control.MOUSE_FILTER_IGNORE
	copy.add_theme_constant_override("separation", 0)
	row.add_child(copy)
	var title := label(chinese, 25, CREAM, 800)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copy.add_child(title)
	var subtitle := label(english, 11, Color("#c2d5d9"))
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	copy.add_child(subtitle)
	return result
