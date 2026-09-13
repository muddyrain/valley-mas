extends RefCounted
## V1 Expedition skin. Gameplay nodes still own state; this class only resolves supplied PNGs.
const ROOT: String = "res://assets/ui/expedition/hud/"
const INK := Color("#19324c")
const PAPER := Color("#f6f0df")
const MUTED := Color("#6f7d84")
const GOLD := Color("#b4873f")
const CYAN := Color("#5b9fc5")
static var textures: Dictionary = {}

static func _asset(name: String) -> String:
	var aliases: Dictionary = {"hud_time_panel":"panels/hud_time_panel_bg","hud_objective_panel":"panels/hud_mission_panel_bg","hud_party_card":"panels/hud_survivor_card_bg_normal","hud_world_interact_panel":"panels/world_poi_card_bg_normal","hud_action_bar":"buttons/hud_action_button_default","hud_return_default":"buttons/hud_return_button_default","hud_small_button_default":"buttons/hud_small_dark_button_default","icon_bag":"icons/resources/icon_food","icon_loot":"icons/resources/icon_scrap","icon_ammo":"icons/resources/icon_intel","icon_team":"icons/actions/icon_home","icon_stop":"icons/actions/icon_action_stop","icon_focus_fire":"icons/actions/icon_action_focus","icon_locate":"icons/actions/icon_action_locate","icon_return":"icons/actions/icon_bus","icon_house":"icons/actions/icon_home","icon_vehicle":"icons/actions/icon_bus","icon_search":"icons/actions/icon_action_locate","icon_complete":"icons/actions/icon_home","world_interact_marker":"minimap/map_poi_marker","world_search_marker":"minimap/map_search_marker","world_danger_marker":"minimap/map_teammate_danger","ui_status_dot_blue":"feedback/hud_warning_badge","ui_status_dot_gold":"feedback/hud_warning_badge","ui_status_dot_purple":"feedback/hud_warning_badge","ui_status_dot_red":"feedback/hud_warning_badge","ui_divider_line_long":"panels/hud_mission_row"}
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
	if not FileAccess.file_exists(path):
		var legacy_folder := "panels"
		if name.begins_with("icon_"): legacy_folder = "icons"
		elif name.begins_with("world_"): legacy_folder = "world"
		elif name == "hud_portrait_frame": legacy_folder = "portraits"
		elif name.begins_with("ui_"): legacy_folder = "common"
		elif name.begins_with("hud_") and ("button" in name or "skill" in name or "return" in name): legacy_folder = "buttons"
		var legacy_name := "hud_small_button_" + name.trim_prefix("hud_small_dark_button_") if name.begins_with("hud_small_dark_button_") else name
		path = "res://assets/ui/expedition/legacy/hud_compat/" + legacy_folder + "/" + legacy_name + ".png"
	if not FileAccess.file_exists(path): return null
	var loaded := load(path) as Texture2D
	if loaded == null: return null
	textures[name] = loaded
	return loaded

static func fitted_icon(source: Texture2D) -> Texture2D: return source

static func surface(name: String, margins: Vector4 = Vector4(12,12,12,12), tint: Color = Color.WHITE) -> StyleBoxTexture:
	var result := StyleBoxTexture.new()
	result.texture = texture(name)
	result.modulate_color = tint
	for side: int in range(4):
		result.set_texture_margin(side, 14)
		result.set_content_margin(side, margins[side])
	result.set_meta("expedition_hud_2", name)
	return result

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
	for state: String in ["normal","hover","pressed","disabled","focus"]:
		var variant := "default"
		if state in ["hover","focus"]: variant = "hover"
		elif state == "pressed": variant = "pressed"
		elif state == "disabled": variant = "disabled"
		var style: StyleBox = surface(prefix + "_" + variant, Vector4(10,8,10,8))
		if style.texture == null: style = plate()
		target.add_theme_stylebox_override(state, style)
	target.add_theme_color_override("font_color", INK)
	target.add_theme_color_override("font_hover_color", INK)
	target.add_theme_color_override("font_pressed_color", INK)
	target.add_theme_color_override("font_disabled_color", Color(INK,.45))
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
	if node is Control and not node is BaseButton and not node is Range and not node is LineEdit and not node is OptionButton: node.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
