extends RefCounted

const Icons = preload("res://scripts/storybook_icons.gd")
const INK = Color("36584b")
const GOLD = Color("806537")
const MUTED = Color("596d57")
const PAPER = Color("f7f3e4")
const EDGE = Color("bdc6b0")
const FOREST = Color("436951")
const SELECTED = Color("dce6ce")
const TOOL_SIZE = 64
const TOOL_GAP = 10
const GROUP_GAP = 24
const HUD_HEIGHT = 198

static func box(fill: Color = PAPER, border: Color = EDGE, thickness: int = 1) -> StyleBoxFlat:
	var result = StyleBoxFlat.new()
	result.bg_color = fill
	result.border_color = border
	result.set_border_width_all(thickness)
	result.set_corner_radius_all(8)
	result.corner_detail = 8
	result.content_margin_left = 14
	result.content_margin_right = 14
	result.content_margin_top = 9
	result.content_margin_bottom = 9
	result.shadow_size = 0
	return result

static func build(font: Font) -> Theme:
	var result = Theme.new()
	result.default_font = font
	result.default_font_size = 16
	result.set_color("font_color","Label",INK)
	var normal = box(Color("f1f1e3"),EDGE)
	var hover = box(Color("e7edd9"),Color("93a481"))
	var pressed = box(SELECTED,Color("82966f"))
	var disabled = box(Color("e9e9d9"),Color("d7dac4"))
	disabled.shadow_size = 0
	var focus = box(Color.TRANSPARENT,Color("bba370"),2)
	focus.shadow_size = 0
	for type in ["Button","OptionButton","CheckBox","CheckButton"]:
		for state in ["normal","hover","pressed","hover_pressed","disabled","focus"]:
			result.set_stylebox(state,type,{"normal":normal,"hover":hover,"pressed":pressed,"hover_pressed":pressed,"disabled":disabled,"focus":focus}[state])
		for state in ["font_color","font_hover_color","font_pressed_color","font_hover_pressed_color","font_focus_color"]: result.set_color(state,type,INK)
		result.set_color("font_disabled_color",type,Color("a8b09a"))
		result.set_color("icon_disabled_color",type,Color(.8,.8,.7,.4))
	result.set_icon("arrow","OptionButton",small_icon("arrow",18))
	result.set_constant("arrow_margin","OptionButton",8)
	for type in ["CheckBox","CheckButton"]:
		for state in ["normal","hover","pressed","hover_pressed","disabled"]:
			var fill_color=Color.TRANSPARENT
			if state in ["hover","hover_pressed"]: fill_color=Color("e5ebd7")
			elif state=="pressed": fill_color=Color("edf0df")
			var check_style=box(fill_color,Color.TRANSPARENT,0)
			check_style.set_content_margin_all(8)
			result.set_stylebox(state,type,check_style)
		result.set_icon("checked",type,small_icon("checked",28))
		result.set_icon("unchecked",type,small_icon("unchecked",28))
		result.set_icon("checked_disabled",type,small_icon("checked",28))
		result.set_icon("unchecked_disabled",type,small_icon("unchecked",28))
		result.set_constant("h_separation",type,8)
	result.set_stylebox("panel","PanelContainer",box())
	result.set_stylebox("panel","PopupMenu",box())
	result.set_stylebox("hover","PopupMenu",pressed)
	result.set_color("font_color","PopupMenu",INK)
	result.set_color("font_hover_color","PopupMenu",INK)
	result.set_constant("v_separation","PopupMenu",12)
	result.set_stylebox("normal","LineEdit",box(Color("fffcef"),EDGE))
	result.set_stylebox("focus","LineEdit",focus)
	result.set_color("font_color","LineEdit",INK)
	result.set_color("font_placeholder_color","LineEdit",MUTED)
	result.set_color("caret_color","LineEdit",INK)
	result.set_color("selection_color","LineEdit",Color("cfddba"))
	result.set_stylebox("background","ProgressBar",box(Color("e5e7ce"),EDGE))
	var fill = box(Color("a5bf8e"),Color("89a475"))
	fill.shadow_size = 0
	result.set_stylebox("fill","ProgressBar",fill)
	result.set_stylebox("panel","TooltipPanel",box(Color("fbf7e7"),Color("c4b589")))
	result.set_color("font_color","TooltipLabel",INK)
	var track = box(Color("e1e4cc"),Color("c4cbb0"))
	track.set_content_margin_all(3)
	track.shadow_size = 0
	result.set_stylebox("slider","HSlider",track)
	result.set_stylebox("grabber_area","HSlider",fill)
	result.set_stylebox("grabber_area_highlight","HSlider",fill)
	result.set_icon("grabber","HSlider",small_icon("knob",24))
	result.set_icon("grabber_highlight","HSlider",small_icon("knob",26))
	result.set_icon("grabber_disabled","HSlider",small_icon("knob",24))
	var separator = StyleBoxLine.new()
	separator.color = Color("d1d3b9")
	separator.thickness = 1
	separator.vertical = true
	result.set_stylebox("separator","VSeparator",separator)
	var horizontal=separator.duplicate(); horizontal.vertical=false
	result.set_stylebox("separator","HSeparator",horizontal)
	for type in ["HScrollBar","VScrollBar"]:
		for state in ["scroll","grabber","grabber_highlight","grabber_pressed"]:
			var color={"scroll":"dfe5d2","grabber":"9aa98a","grabber_highlight":"80966f","grabber_pressed":"687f60"}[state]
			var bar=box(Color(color),Color.TRANSPARENT,0)
			bar.set_content_margin_all(4); bar.set_corner_radius_all(4)
			result.set_stylebox(state,type,bar)
	return result

static func selected_box() -> StyleBoxFlat:
	return box(SELECTED,Color("80956f"))

static func primary(target: Button) -> void:
	for state in ["normal","hover","pressed","hover_pressed"]:
		var fill=FOREST.lightened(.07) if state=="hover" else FOREST
		target.add_theme_stylebox_override(state,box(fill,fill))
	for state in ["font_color","font_hover_color","font_pressed_color","font_hover_pressed_color","font_focus_color"]:
		target.add_theme_color_override(state,PAPER)

static func small_icon(key: String, extent: int) -> Texture2D:
	var image = Icons.texture(key).get_image()
	image.resize(extent,extent,Image.INTERPOLATE_LANCZOS)
	return ImageTexture.create_from_image(image)
