extends RefCounted

const REFERENCE := Vector2(1672, 941)

const LOGO = preload("res://assets/ui/new_run/02_logo_tagline.png")
const ROUTE_TITLE = preload("res://assets/ui/new_run/04_route_title.png")
const COMPASS = preload("res://assets/ui/new_run/05_compass.png")
const TITLE_LINE_LEFT = preload("res://assets/ui/new_run/06_title_line_left.png")
const TITLE_LINE_RIGHT = preload("res://assets/ui/new_run/07_title_line_right.png")
const BOARD = preload("res://assets/ui/new_run/08_board.png")

const TAB_COMBAT = preload("res://assets/ui/new_run/09_tab_combat.png")
const TAB_SCAVENGE = preload("res://assets/ui/new_run/10_tab_scavenge.png")
const TAB_SURVEY = preload("res://assets/ui/new_run/11_tab_survey.png")
const TAB_LOCKED = preload("res://assets/ui/new_run/12_tab_locked.png")
const ICON_COMBAT = preload("res://assets/ui/new_run/13_icon_combat.png")
const ICON_SCAVENGE = preload("res://assets/ui/new_run/14_icon_scavenge.png")
const ICON_SURVEY = preload("res://assets/ui/new_run/15_icon_survey.png")
const ICON_LOCK = preload("res://assets/ui/new_run/16_icon_lock.png")
const TAB_TAPE = preload("res://assets/ui/new_run/17_tab_tape.png")
const TAB_PROGRESS = preload("res://assets/ui/new_run/18_tab_progress_frame.png")
const TAB_SELECTED = preload("res://assets/ui/new_run/19_tab_selected.png")

const CARD_COMPOSITE = preload("res://assets/ui/new_run/23_card_composite.png")
const CARD_SELECTED = preload("res://assets/ui/new_run/24_card_selected.png")
const CARD_PRINTER = preload("res://assets/ui/new_run/25_card_printer.png")
const CARD_SPEED = preload("res://assets/ui/new_run/26_card_speed.png")
const ICON_RUN = preload("res://assets/ui/new_run/29_icon_run.png")
const ICON_TENT = preload("res://assets/ui/new_run/30_icon_tent.png")
const TENT_STICKER = preload("res://assets/ui/new_run/31_tent_sticker.png")

const BUTTON_CANCEL = preload("res://assets/ui/new_run/32_button_cancel.png")
const BUTTON_CONFIRM = preload("res://assets/ui/new_run/33_button_confirm.png")
const BUTTON_UNLOCK = preload("res://assets/ui/new_run/34_button_unlock.png")
const CONFIRM_ARROW = preload("res://assets/ui/new_run/35_icon_confirm_arrow.png")
const SMALL_ARROW = preload("res://assets/ui/new_run/36_icon_small_arrow.png")

const TOOLTIP = preload("res://assets/ui/new_run/37_tooltip.png")
const TOOLTIP_BADGE = preload("res://assets/ui/new_run/38_tooltip_badge.png")
const TOOLTIP_RULE = preload("res://assets/ui/new_run/39_tooltip_rule.png")
const XP_TRACK = preload("res://assets/ui/new_run/40_xp_track.png")
const XP_FILL = preload("res://assets/ui/new_run/41_xp_fill.png")

const INK := Color("#122b48")
const INK_SOFT := Color("#314b63")
const WHITE := Color("#f5f4ed")
const ORANGE := Color("#f17816")

static func body_font(weight: int = 500) -> SystemFont:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"])
	font.font_weight = weight
	return font

static func title_font() -> SystemFont:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["STZhongsong", "SimSun", "Noto Serif CJK SC", "Microsoft YaHei UI"])
	font.font_weight = 700
	return font

static func empty_button(button: Button) -> void:
	for state in ["normal", "hover", "pressed", "disabled", "focus", "hover_pressed"]:
		button.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_disabled_color"]:
		button.add_theme_color_override(state, Color.TRANSPARENT)
	button.add_theme_font_size_override("font_size", 1)
	button.focus_mode = Control.FOCUS_ALL
	button.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
