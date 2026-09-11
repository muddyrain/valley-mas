extends RefCounted

const REFERENCE := Vector2(1672, 941)

const LOGO = preload("res://assets/ui/common/branding/ui_common_logo_tagline_compact.png")
const ROUTE_TITLE = preload("res://assets/ui/route_selection/route_selection_title.png")
const COMPASS = preload("res://assets/ui/route_selection/route_selection_compass_decoration.png")
const TITLE_LINE_LEFT = preload("res://assets/ui/route_selection/route_selection_title_divider_left.png")
const TITLE_LINE_RIGHT = preload("res://assets/ui/route_selection/route_selection_title_divider_right.png")
const BOARD = preload("res://assets/ui/route_selection/route_selection_board_panel.png")

const TAB_COMBAT = preload("res://assets/ui/route_selection/route_selection_combat_tab_normal.png")
const TAB_SCAVENGE = preload("res://assets/ui/route_selection/route_selection_scavenge_tab_normal.png")
const TAB_SURVEY = preload("res://assets/ui/route_selection/route_selection_survey_tab_normal.png")
const TAB_COMBAT_SELECTED = preload("res://assets/ui/route_selection/route_selection_combat_tab_selected.png")
const TAB_SCAVENGE_SELECTED = preload("res://assets/ui/route_selection/route_selection_scavenge_tab_selected.png")
const TAB_SURVEY_SELECTED = preload("res://assets/ui/route_selection/route_selection_survey_tab_selected.png")
const TAB_LOCKED = preload("res://assets/ui/route_selection/route_selection_tab_locked.png")
const ICON_COMBAT = preload("res://assets/ui/route_selection/route_selection_combat_icon.png")
const ICON_SCAVENGE = preload("res://assets/ui/route_selection/route_selection_scavenge_icon.png")
const ICON_SURVEY = preload("res://assets/ui/route_selection/route_selection_survey_icon.png")
const ICON_LOCK = preload("res://assets/ui/common/icons/ui_common_lock_icon.png")
const TAB_TAPE = preload("res://assets/ui/route_selection/route_selection_tab_tape.png")
const TAB_PROGRESS = preload("res://assets/ui/route_selection/route_selection_tab_progress_frame.png")

const CARD_SHOOTING_TARGET = preload("res://assets/items/cards/item_shooting_target_card.png")
const CARD_RAGE = preload("res://assets/skills/cards/skill_rage_card.png")
const CARD_COFFEE = preload("res://assets/items/cards/item_coffee_card.png")
const CARD_MAP_HEAL = preload("res://assets/skills/cards/skill_map_healing_card.png")
const CARD_COMPOSITE = preload("res://assets/ui/common/cards/ui_common_card_background.png")
const CARD_PRINTER = preload("res://assets/items/cards/item_replicator_card.png")
const CARD_SPEED = preload("res://assets/skills/cards/skill_sprint_card.png")
const ICON_RUN = preload("res://assets/skills/icons/skill_sprint_icon.png")
const ICON_TENT = preload("res://assets/ui/common/icons/ui_common_camp_icon.png")
const TENT_STICKER = preload("res://assets/ui/route_selection/route_selection_unlock_tent_sticker.png")

const BUTTON_CANCEL = preload("res://assets/ui/route_selection/route_selection_cancel_button_normal.png")
const BUTTON_CONFIRM = preload("res://assets/ui/route_selection/route_selection_confirm_button_normal.png")
const BUTTON_UNLOCK = preload("res://assets/ui/route_selection/route_selection_unlock_button_normal.png")
const CONFIRM_ARROW = preload("res://assets/ui/common/icons/ui_common_confirm_arrow_icon.png")
const SMALL_ARROW = preload("res://assets/ui/common/icons/ui_common_small_arrow_icon.png")

const TOOLTIP_BADGE = preload("res://assets/ui/route_selection/route_selection_tooltip_skill_badge.png")
const XP_TRACK = preload("res://assets/ui/common/progress/ui_common_experience_track.png")
const XP_FILL = preload("res://assets/ui/common/progress/ui_common_experience_fill.png")

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
