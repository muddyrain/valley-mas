extends PanelContainer
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
const HealthBar = preload("res://ui/expedition/health_bar.gd")
signal inspected
const PORTRAITS: Dictionary = {
	"xia_zhiyao": preload("res://assets/ui/expedition/portraits/portrait_xia_zhiyao.png"),
	"su_wanxing": preload("res://assets/ui/expedition/portraits/portrait_su_wanxing.png")
}
var summary: Label
var details: Label
var status: Label
var health: ProgressBar
var select_button: Button
var portrait: TextureRect
var weapon_icon: TextureRect
var equipped_id: String = ""
var column: VBoxContainer
var compact: bool = false
var health_text: Label
var status_dot: TextureRect
var index_badge: Control
var index_label: Label

func setup(member: Node3D, template_id: String) -> void:
	custom_minimum_size = Vector2(304, 128)
	add_theme_stylebox_override("panel", HudArt.panel("hud_party_card", Vector4(12, 12, 12, 12)))
	column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 4)
	add_child(column)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	column.add_child(row)
	portrait = TextureRect.new()
	portrait.custom_minimum_size = Vector2(88, 88)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.texture = load(member.data.portrait_path) if not member.data.portrait_path.is_empty() else PORTRAITS.get(template_id)
	portrait.mouse_filter = MOUSE_FILTER_IGNORE
	row.add_child(portrait)
	var frame := HudArt.picture("hud_portrait_frame", Vector2.ZERO)
	frame.self_modulate = Visual.border_tint("hud_party_card")
	frame.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	portrait.add_child(frame)
	select_button = Button.new()
	select_button.flat = true
	select_button.focus_mode = FOCUS_NONE
	select_button.mouse_default_cursor_shape = CURSOR_POINTING_HAND
	select_button.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	for state: String in ["normal", "hover", "pressed", "disabled", "focus"]:
		select_button.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	portrait.add_child(select_button)
	select_button.pressed.connect(func(): inspected.emit())
	if portrait.texture == null:
		var initial := UI.label(member.data.display_name.left(1), 32, Style.CYAN)
		initial.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
		initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		portrait.add_child(initial)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 1)
	row.add_child(info)
	summary = UI.label("", 16, Style.INK)
	info.add_child(summary)
	health_text = UI.label("", 13, Style.INK)
	info.add_child(health_text)
	health = HealthBar.new()
	health.show_percentage = false
	var health_slot := Control.new()
	health_slot.custom_minimum_size.y = 8
	health_slot.mouse_filter = MOUSE_FILTER_IGNORE
	info.add_child(health_slot)
	health_slot.add_child(health)
	health.custom_minimum_size.y = 5
	health_slot.resized.connect(func():
		health.size = Vector2(health_slot.size.x, 5)
		health.position = Vector2(0, (health_slot.size.y - 5) * .5)
	)
	var weapon_row := HBoxContainer.new()
	weapon_row.add_theme_constant_override("separation", 6)
	info.add_child(weapon_row)
	weapon_icon = TextureRect.new()
	weapon_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	weapon_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	weapon_icon.custom_minimum_size = Vector2(32, 21)
	weapon_row.add_child(weapon_icon)
	details = UI.label("", 14, Style.MUTED)
	weapon_row.add_child(details)
	var status_row := HBoxContainer.new()
	status_row.add_theme_constant_override("separation", 6)
	info.add_child(status_row)
	status_dot = HudArt.picture("ui_status_dot_blue", Vector2(21, 19))
	status_row.add_child(status_dot)
	status = UI.label("", 13, Style.MUTED)
	status_row.add_child(status)
	HudArt.pass_decorations(self)
	index_badge = Control.new()
	index_badge.name = "NumberBadgeRoot"
	index_badge.custom_minimum_size = Vector2(32, 32)
	index_badge.size = Vector2(32, 32)
	# This overlay follows the card background's baked circle, not the portrait.
	index_badge.set_as_top_level(true)
	index_badge.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(index_badge)
	index_label = UI.label("", 13, Style.INK)
	index_label.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	index_label.offset_left = 0
	index_label.offset_top = 0
	index_label.offset_right = 0
	index_label.offset_bottom = 0
	index_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	index_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	index_label.mouse_filter = MOUSE_FILTER_IGNORE
	index_badge.add_child(index_label)
	call_deferred("_align_index_badge")

func set_index(index: int) -> void:
	if index_label != null:
		index_label.text = str(index)

func _process(_delta: float) -> void:
	if is_instance_valid(index_badge) and index_badge.is_set_as_top_level():
		var target_position: Vector2 = global_position + Vector2(1, 1)
		if index_badge.global_position != target_position:
			index_badge.global_position = target_position

func _align_index_badge() -> void:
	if not is_instance_valid(index_badge):
		return
	# PanelContainer resizes direct children to its content rect.  A top-level
	# overlay lets the badge use the baked background circle's card coordinates.
	# The baked circle's center is 17px from the card's left edge and 17px
	# from its top edge; a 32px label box therefore starts at (1, 1).
	index_badge.global_position = global_position + Vector2(1, 1)

func set_compact(value: bool) -> void:
	if compact == value:
		return
	compact = value
	reset_size()

func set_selected(selected: bool) -> void:
	add_theme_stylebox_override("panel", HudArt.surface("hud_party_card", Vector4(12, 12, 12, 12), Color.WHITE))
	portrait.modulate = Color("#e7f2ff") if selected else Color.WHITE
	summary.add_theme_color_override("font_color", Style.INK)

func update_member(member: Node3D, mission: Node3D) -> void:
	var danger_state: bool = member.dead or member.hp < member.data.max_hp * .5
	if danger_state:
		add_theme_stylebox_override("panel", HudArt.surface("hud_survivor_card_bg_danger", Vector4(12, 12, 12, 12)))
	else:
		add_theme_stylebox_override("panel", HudArt.surface("hud_survivor_card_bg_normal", Vector4(12, 12, 12, 12)))
	summary.text = member.data.display_name
	health.max_value = member.data.max_hp
	health.value = member.hp
	health_text.text = "HP  %d / %d" % [ceili(member.hp), ceili(member.data.max_hp)]
	var weapon_id: String = member.weapon.id if member.weapon != null else ""
	if equipped_id != weapon_id:
		equipped_id = weapon_id
		weapon_icon.texture = HudArt.texture("weapon_melee" if member.weapon != null and member.weapon.melee else "weapon_ranged") if member.weapon != null else null
	details.text = "未装备" if member.weapon == null else "近战" if member.weapon.melee else ("换弹" if member.reload_left > 0 else "%d/%d" % [member.ammo, member.weapon.magazine])
	var task = mission.task_for(member)
	status.text = "跟随"
	if member.dead:
		status.text = "阵亡"
	elif mission.extraction or member.regrouping:
		status.text = "归队"
	elif task != null:
		status.text = "自卫 · 暂停" if task.phase == task.Phase.DEFEND else "搜索 %d%%" % (mission.city.sites[task.site_id].progress * 100)
	elif member.hp < member.data.max_hp * .5:
		status.text = "受伤 · %d" % member.hp
	elif member.cooldown > 0 or member.reload_left > 0:
		status.text = "战斗"
	status_dot.texture = HudArt.texture("ui_status_dot_red" if status.text == "战斗" or status.text.begins_with("自卫") or danger_state else "ui_status_dot_blue")
	tooltip_text = "%s · %d/%d HP\n%s · %s\n%s" % [member.data.display_name, member.hp, member.data.max_hp, (member.weapon.display_name if member.weapon != null else "未装备"), member.talent.display_name, member.talent.description]
	modulate = Color("#8b9499") if member.dead else Color.WHITE
