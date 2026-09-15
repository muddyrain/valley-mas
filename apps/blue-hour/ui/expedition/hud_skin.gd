extends RefCounted
## Supplied Expedition surfaces and semantic icons; gameplay owns all displayed state.
const ROOT: String = "res://assets/ui/expedition/hud/"
const INK := Color("#19324c")
const PAPER := Color("#f6f0df")
const MUTED := Color("#6f7d84")
const GOLD := Color("#b4873f")
const CYAN := Color("#5b9fc5")
static var textures: Dictionary = {}

static func _asset(name: String) -> String:
	if name == "icon_vehicle_bus":
		return "icons/actions/vehicle_bus"
	if name == "panel_pointer":
		return "world/panel_pointer"
	if name.begins_with("hud_survivor_card_bg_"):
		return "panels/hud_survivor_card_bg_normal"
	for family: String in ["hud_skill_slot_", "hud_action_button_", "hud_return_", "hud_small_button_", "hud_small_dark_button_", "hud_group_button_", "hud_menu_button_"]:
		if not name.begins_with(family):
			continue
		if family in ["hud_menu_button_", "hud_group_button_"]:
			return "buttons/hud_menu_button_default"
		var variant: String = name.trim_prefix(family).trim_prefix("button_")
		if family == "hud_return_":
			return "buttons/hud_return_button_" + (variant if variant in ["hover", "pressed"] else "default")
		return "buttons/hud_action_button_" + (variant if variant in ["hover", "disabled"] else "default")
	var aliases: Dictionary = {
		"logo_main": "final_match/expedition_logo_main",
		"minimap_frame": "final_match/minimap_frame",
		"hud_time_panel": "panels/hud_time_panel_bg",
		"hud_day_panel": "panels/hud_day_panel_bg",
		"hud_objective_panel": "panels/hud_mission_panel_bg",
		"hud_discovery_panel": "panels/hud_mission_panel_bg",
		"hud_party_card": "panels/hud_survivor_card_bg_normal",
		"hud_world_interact_panel": "panels/world_poi_card_bg_normal",
		"hud_command_bar": "panels/hud_command_bar_bg",
		"hud_action_bar": "panels/hud_command_bar_bg",
		"hud_return_default": "buttons/hud_return_button_default",
		"hud_small_button_default": "buttons/hud_small_dark_button_default",
		"icon_bag": "icons/resources/icon_food",
		"icon_loot": "icons/resources/icon_scrap",
		"icon_ammo": "icons/resources/icon_intel",
		"icon_team": "icons/actions/icon_home",
		"icon_menu": "icons/actions/icon_menu",
		"icon_stop": "icons/actions/icon_action_stop",
		"icon_focus_fire": "icons/actions/icon_action_focus",
		"icon_locate": "icons/actions/icon_action_locate",
		"icon_rage": "icons/actions/icon_action_rage",
		"icon_return": "icons/actions/icon_bus",
		"icon_return_highlight": "icons/actions/icon_bus_highlight",
		"icon_house": "icons/actions/icon_home",
		"icon_vehicle": "icons/actions/icon_vehicle_van",
		"icon_house_large": "icons/actions/icon_house_large",
		"icon_house_small": "icons/actions/icon_house_small",
		"icon_search": "icons/actions/search_time_clock",
		"icon_arrow_right": "icons/actions/arrow_right",
		"icon_chevron_down": "icons/actions/chevron_down",
		"icon_location_pin": "icons/actions/location_pin_micro",
		"icon_complete": "icons/actions/icon_home",
		"world_interact_marker": "minimap/map_poi_marker",
		"world_search_marker": "minimap/map_search_marker",
		"world_danger_marker": "minimap/map_teammate_danger",
		"ui_status_dot_blue": "feedback/status_follow",
		"ui_status_dot_gold": "feedback/status_follow",
		"ui_status_dot_purple": "feedback/status_follow",
		"ui_status_dot_red": "feedback/status_combat_warning",
		"ui_divider_line_long": "panels/hud_mission_row",
		"weapon_ranged": "icons/weapons/weapon_ranged_pistol",
		"weapon_melee": "icons/weapons/weapon_melee_knife",
		"party_index_badge": "panels/party_index_badge",
		"hp_friendly_bg": "panels/hp_friendly_bg",
		"hp_friendly_fill": "panels/hp_friendly_fill",
		"hp_enemy_bg": "panels/hp_enemy_bg",
		"hp_enemy_fill": "panels/hp_enemy_fill",
		"hotkey_normal": "buttons/hotkey_badge_normal",
		"hotkey_active": "buttons/hotkey_badge_active"
	}
	if aliases.has(name): return aliases[name]
	if name.begins_with("hud_survivor_card_bg_") or name.begins_with("hud_phase_") or name.begins_with("hud_hp_"): return "panels/" + name
	if name.begins_with("hud_return_") or name.begins_with("hud_group_button_") or name.begins_with("hud_menu_button_"): return "buttons/" + name
	if name.begins_with("hud_small_button_"): return "buttons/hud_small_dark_button_" + name.trim_prefix("hud_small_button_")
	if name.begins_with("hud_skill_slot_"): return "buttons/hud_action_button_" + name.trim_prefix("hud_skill_slot_")
	if name.begins_with("hud_action_button_"): return "buttons/" + name
	if name.begins_with("hud_small_dark_button_"): return "buttons/" + name
	if name.begins_with("map_"): return "minimap/" + name
	if name.begins_with("hud_minimap_"): return "minimap/" + name
	if name.begins_with("hud_resource_"): return "panels/" + name
	if name == "world_select_ring": return "world/world_select_ring"
	if name == "hud_portrait_frame": return "portraits/hud_portrait_frame"
	if name.begins_with("icon_phase_"): return "icons/phases/" + name
	if name.begins_with("icon_") and name in ["icon_food", "icon_scrap", "icon_intel"]: return "icons/resources/" + name
	return "icons/actions/" + name if name.begins_with("icon_") else "panels/" + name

static func texture(name: String) -> Texture2D:
	if textures.has(name): return textures[name]
	var relative := _asset(name) + ".png"
	var path := ROOT + relative
	if not ResourceLoader.exists(path):
		var legacy_folder := "panels"
		if name.begins_with("icon_"): legacy_folder = "icons"
		elif name.begins_with("world_"): legacy_folder = "world"
		elif name == "hud_portrait_frame": legacy_folder = "portraits"
		elif name.begins_with("ui_"): legacy_folder = "common"
		elif name.begins_with("hud_") and ("button" in name or "skill" in name or "return" in name): legacy_folder = "buttons"
		var legacy_name := "hud_small_button_" + name.trim_prefix("hud_small_dark_button_") if name.begins_with("hud_small_dark_button_") else name
		path = "res://assets/ui/expedition/legacy/hud_compat/" + legacy_folder + "/" + legacy_name + ".png"
	if not ResourceLoader.exists(path): return null
	var loaded := load(path) as Texture2D
	if loaded == null: return null
	textures[name] = loaded
	return loaded

static func fitted_icon(source: Texture2D) -> Texture2D: return source

static func surface(name: String, margins: Vector4 = Vector4(12,12,12,12), tint: Color = Color.WHITE) -> StyleBoxTexture:
	var result := StyleBoxTexture.new()
	result.texture = texture(name)
	result.modulate_color = tint
	var slices: Vector4 = slice_margins(name)
	for side: int in range(4):
		result.set_texture_margin(side, slices[side])
		result.set_content_margin(side, margins[side])
	result.set_meta("expedition_hud_2", name)
	return result

static func slice_margins(name: String) -> Vector4:
	var asset: String = _asset(name)
	match asset:
		"panels/hud_time_panel_bg": return Vector4(16, 12, 16, 12)
		"panels/hud_survivor_card_bg_normal": return Vector4(30, 24, 24, 16)
		"panels/hud_command_bar_bg": return Vector4(42, 24, 42, 24)
		"panels/world_poi_card_bg_normal": return Vector4(18, 16, 18, 16)
		"panels/hud_mission_panel_bg": return Vector4(18, 64, 18, 54)
		"minimap/hud_minimap_frame": return Vector4(40, 28, 36, 32)
		"buttons/hud_menu_button_default": return Vector4(18, 15, 18, 15)
	if asset.begins_with("buttons/hud_action_button_"):
		return Vector4(22, 20, 22, 22)
	return Vector4(12, 12, 12, 12)

static func frame(name: String) -> NinePatchRect:
	var view := NinePatchRect.new()
	view.texture = texture(name)
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var slices: Vector4 = slice_margins(name)
	for side: int in range(4):
		view.set_patch_margin(side, int(slices[side]))
	return view

static func plate(color: Color = Color("#19324cf2"), edge: Color = Color("#9bb8c4"), inset: int = 12) -> StyleBoxFlat:
	var result := StyleBoxFlat.new()
	result.bg_color = color
	result.border_color = edge
	result.set_border_width_all(1)
	result.set_corner_radius_all(8)
	result.content_margin_left = inset
	result.content_margin_right = inset
	result.content_margin_top = inset
	result.content_margin_bottom = inset
	return result

static func panel(name: String, margins: Vector4 = Vector4(18,14,18,14)) -> StyleBoxTexture: return surface(name, margins)

static func button(target: Button, family: String = "hud_small_button") -> void:
	var prefix := family
	if family == "hud_skill_slot": prefix = "hud_action_button"
	elif family == "hud_return": prefix = "hud_return_button"
	elif family == "hud_small_button": prefix = "hud_small_dark_button"
	var dark: bool = family in ["hud_menu_button", "hud_group_button"]
	for state: String in ["normal","hover","pressed","hover_pressed","disabled","focus"]:
		var variant := "default"
		if state in ["hover","focus"]: variant = "hover"
		elif state in ["pressed", "hover_pressed"]: variant = "pressed"
		elif state == "disabled": variant = "disabled"
		var tint: Color = Color("#ccd8e3") if state in ["pressed", "hover_pressed"] and family != "hud_return" else Color.WHITE
		if dark and state in ["hover", "focus"]:
			tint = Color(1.12, 1.12, 1.12)
		elif dark and state == "disabled":
			tint = Color(.6, .6, .6)
		var style: StyleBox = surface(prefix + "_" + variant, Vector4(10,8,10,8), tint)
		if style.texture == null: style = plate()
		target.add_theme_stylebox_override(state, style)
	var foreground: Color = PAPER if dark else INK
	target.add_theme_color_override("font_color", foreground)
	target.add_theme_color_override("font_hover_color", foreground)
	target.add_theme_color_override("font_pressed_color", foreground)
	target.add_theme_color_override("font_disabled_color", Color(foreground,.45))
	target.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	target.mouse_filter = Control.MOUSE_FILTER_STOP

static func progress(target: ProgressBar, color: Color = CYAN) -> void:
	target.show_percentage = false
	target.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if texture("hud_hp_track") != null: target.add_theme_stylebox_override("background", surface("hud_hp_track", Vector4.ZERO))
	if texture("hud_hp_fill") != null: target.add_theme_stylebox_override("fill", surface("hud_hp_fill", Vector4.ZERO, color))
	else: target.add_theme_stylebox_override("fill", plate(color, Color.TRANSPARENT, 0))

static func picture(name: String, dimensions: Vector2) -> TextureRect:
	var result := TextureRect.new()
	result.texture = texture(name)
	result.custom_minimum_size = dimensions
	result.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	result.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

static func pass_decorations(node: Node) -> void:
	if node is Control and not node is BaseButton and not node is Range and not node is LineEdit and not node is OptionButton and not node is ScrollContainer: node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for child: Node in node.get_children(): pass_decorations(child)

static func anchored(parent: Control, node_name: String, preset: int, rect: Rect2) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.name = node_name
	parent.add_child(panel)
	panel.set_anchors_and_offsets_preset(preset)
	panel.offset_left = rect.position.x
	panel.offset_top = rect.position.y
	panel.offset_right = rect.end.x
	panel.offset_bottom = rect.end.y
	return panel

