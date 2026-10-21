class_name RunMemberResultCard
extends PanelContainer
## A reusable result card has no Campaign, settlement or save dependency.

const Art = preload("res://ui/menu_art.gd")
const Fonts = preload("res://ui/new_run_art.gd")
const PAPER = preload("res://assets/ui/common/cards/ui_common_card_paper.png")
const TAPE = preload("res://assets/ui/common/cards/ui_common_washi_tape.svg")
const ResultArt = preload("res://ui/run_end_art.gd")
const STATES: Dictionary = {
	"alive": ["生还", "RETURNED", Color("#42694f")],
	"combat": ["战斗阵亡", "FALLEN IN COMBAT", Color("#82433f")],
	"starved": ["缺粮损失", "LOST TO HUNGER", Color("#925b38")],
	"unknown": ["记录不详", "UNCONFIRMED", Color("#62666b")],
}

var member_id: String = ""
var survivor_id: String = ""
var final_status: String = ""
var name_label: Label
var portrait: TextureRect
var status_label: Label
var placeholder: Label
var _photo: PanelContainer
var _row: HBoxContainer
var _corner_tape: TextureRect

func setup(member: Dictionary) -> void:
	member_id = str(member.member_id)
	survivor_id = str(member.get("survivor_id", ""))
	final_status = str(member.get("status", "unknown"))
	name = "Member_" + member_id.validate_node_name()
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	custom_minimum_size = Vector2(0, 194)
	var paper := StyleBoxTexture.new()
	paper.texture = PAPER
	paper.set_texture_margin_all(16)
	paper.content_margin_left = 16
	paper.content_margin_right = 16
	paper.content_margin_top = 18
	paper.content_margin_bottom = 18
	add_theme_stylebox_override("panel", paper)
	_row = HBoxContainer.new()
	_row.add_theme_constant_override("separation", 16)
	add_child(_row)
	_photo = PanelContainer.new()
	_photo.custom_minimum_size = Vector2(128, 158)
	var frame := _plate(Color("#faf5e8"))
	frame.content_margin_left = 5
	frame.content_margin_right = 5
	frame.content_margin_top = 5
	frame.content_margin_bottom = 11
	frame.shadow_color = Color(0.10, 0.16, 0.22, .27)
	frame.shadow_size = 3
	frame.shadow_offset = Vector2(2, 3)
	_photo.add_theme_stylebox_override("panel", frame)
	_row.add_child(_photo)
	portrait = TextureRect.new()
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.clip_contents = true
	portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var path: String = str(member.get("portrait_path", ""))
	if not path.is_empty() and ResourceLoader.exists(path, "Texture2D"):
		portrait.texture = load(path) as Texture2D
	_photo.add_child(portrait)
	placeholder = _label("?", 38, Art.MUTED)
	placeholder.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	placeholder.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	placeholder.visible = portrait.texture == null
	_photo.add_child(placeholder)
	if final_status != "alive":
		var faded := ShaderMaterial.new()
		faded.shader = preload("res://ui/run_end_backdrop.gdshader")
		faded.set_shader_parameter("saturation", .12)
		faded.set_shader_parameter("exposure", .77)
		faded.set_shader_parameter("tint", Color(.95, .97, 1.0))
		portrait.material = faded
	var details := VBoxContainer.new()
	details.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	details.alignment = BoxContainer.ALIGNMENT_CENTER
	details.add_theme_constant_override("separation", 7)
	_row.add_child(details)
	name_label = _label(str(member.display_name), 24, ResultArt.INK)
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name_label.tooltip_text = str(member.display_name)
	details.add_child(name_label)
	var state: Array = STATES.get(final_status, STATES.unknown)
	var badge := Control.new()
	badge.custom_minimum_size.y = 38
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	details.add_child(badge)
	var brush := ResultArt.image(badge, ResultArt.BRUSH)
	brush.modulate = state[2]
	brush.stretch_mode = TextureRect.STRETCH_SCALE
	brush.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	status_label = _label(str(state[0]), 21, Art.WHITE)
	status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	badge.add_child(status_label)
	status_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var english := _label(str(state[1]), 12, Art.MUTED)
	english.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	details.add_child(english)
	var tape := TextureRect.new()
	tape.texture = TAPE
	tape.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tape.position = Vector2(-8, -5)
	tape.size = Vector2(68, 29)
	tape.rotation = -.35
	tape.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var decoration := Control.new()
	decoration.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(decoration)
	decoration.add_child(tape)
	_corner_tape = ResultArt.image(decoration, TAPE)
	_corner_tape.size = Vector2(48, 20)
	_corner_tape.position = Vector2(104, 146)
	_corner_tape.rotation = -.3
	_corner_tape.modulate.a = .68

func set_compact(compact: bool) -> void:
	custom_minimum_size.y = 172 if compact else 194
	_photo.custom_minimum_size = Vector2(110, 136) if compact else Vector2(128, 158)
	_row.add_theme_constant_override("separation", 12 if compact else 16)
	name_label.add_theme_font_size_override("font_size", 22 if compact else 24)
	_corner_tape.position = Vector2(86, 125) if compact else Vector2(104, 146)

func _label(value: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_override("font", Fonts.body_font(600))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label

func _plate(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.content_margin_left = 5
	style.content_margin_right = 5
	style.content_margin_top = 3
	style.content_margin_bottom = 3
	return style
