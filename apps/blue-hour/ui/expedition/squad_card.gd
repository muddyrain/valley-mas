extends PanelContainer
const UI = preload("res://ui/ui_style.gd")
const Style = preload("res://ui/expedition_theme.gd")
const PORTRAITS: Dictionary = {
	"xia_zhiyao": preload("res://assets/ui/expedition/portraits/portrait_xia_zhiyao.png"),
	"su_wanxing": preload("res://assets/ui/expedition/portraits/portrait_su_wanxing.png")
}
var summary: Label
var details: Label
var status: Label
var health: ProgressBar
var action: Button
var portrait: TextureRect
var weapon_icon: TextureRect
var equipped_id: String = ""
var column: VBoxContainer
var compact: bool = false

func setup(member: Node3D, command: Callable, template_id: String) -> void:
	custom_minimum_size = Vector2(178, 80)
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 3)
	add_child(column)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 5)
	column.add_child(row)
	portrait = TextureRect.new()
	portrait.custom_minimum_size = Vector2(70, 72)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait.texture = load(member.data.portrait_path) if not member.data.portrait_path.is_empty() else PORTRAITS.get(template_id)
	portrait.mouse_filter = MOUSE_FILTER_IGNORE
	row.add_child(portrait)
	if portrait.texture == null:
		var initial := UI.label(member.data.display_name.left(1), 32, Style.CYAN)
		initial.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
		initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		portrait.add_child(initial)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation", 3)
	row.add_child(info)
	summary = UI.label("", 14, Style.PAPER)
	summary.add_theme_stylebox_override("normal", Style.plate(Color("#122b3990"), Color.TRANSPARENT, 2))
	info.add_child(summary)
	health = ProgressBar.new()
	health.show_percentage = false
	health.custom_minimum_size.y = 3
	info.add_child(health)
	var weapon_row := HBoxContainer.new()
	info.add_child(weapon_row)
	weapon_icon = TextureRect.new()
	weapon_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	weapon_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	weapon_icon.custom_minimum_size = Vector2(26, 18)
	weapon_row.add_child(weapon_icon)
	details = UI.label("", 11, Style.MUTED)
	weapon_row.add_child(details)
	status = UI.label("", 11, Style.CYAN)
	info.add_child(status)
	action = UI.button("查看搜索", command, Vector2(0, 22))
	action.add_theme_font_size_override("font_size", 11)
	for state: String in ["normal", "hover", "pressed", "disabled"]:
		action.add_theme_stylebox_override(state, Style.plate(Color("#172f3bb0"), Color("#6898a166"), 3))
	column.add_child(action)

func set_compact(value: bool) -> void:
	if compact == value:
		return
	compact = value
	# At the minimum window size the whole portrait becomes the existing assignment button.
	action.reparent(self if compact else column)
	action.custom_minimum_size.y = 0 if compact else 22
	for state: String in ["normal", "hover", "pressed", "disabled"]:
		action.add_theme_stylebox_override(state, StyleBoxEmpty.new() if compact else Style.plate(Color("#172f3bb0"), Color("#6898a166"), 3))
	reset_size()

func update_member(member: Node3D, mission: Node3D) -> void:
	summary.text = member.data.display_name
	health.max_value = member.data.max_hp
	health.value = member.hp
	var weapon_id: String = member.weapon.id if member.weapon != null else ""
	if equipped_id != weapon_id:
		equipped_id = weapon_id
		weapon_icon.texture = member.weapon.icon() if member.weapon != null else null
	details.text = "未装备" if member.weapon == null else "近战" if member.weapon.melee else ("换弹" if member.reload_left > 0 else "%d/%d" % [member.ammo, member.weapon.magazine])
	var task = mission.task_for(member)
	status.text = "跟随"
	if member.dead:
		status.text = "阵亡"
	elif mission.extraction or member.regrouping:
		status.text = "归队"
	elif task != null:
		status.text = "自卫 · 暂停" if task.phase == 2 else "搜索 %d%%" % (mission.city.sites[task.site_id].progress * 100)
	elif member.hp < member.data.max_hp * .5:
		status.text = "受伤 · %d" % member.hp
	elif member.cooldown > 0 or member.reload_left > 0:
		status.text = "战斗"
	tooltip_text = "%s · %d/%d HP\n%s · %s\n%s" % [member.data.display_name, member.hp, member.data.max_hp, (member.weapon.display_name if member.weapon != null else "未装备"), member.talent.display_name, member.talent.description]
	action.visible = task != null or not mission.search_id.is_empty()
	action.disabled = member.dead or not mission.active or task == mission.search_task
	action.tooltip_text = "查看搜索" if task != null else "接替当前搜索"
	action.text = "" if compact else "查看搜索" if task != null else "接替搜索"
	modulate = Color("#8b9499") if member.dead else Color.WHITE
