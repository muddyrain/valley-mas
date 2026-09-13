extends PanelContainer
signal closed
const CampArt = preload("res://ui/camp/camp_skin.gd")
const Surface = preload("res://ui/camp/camp_surface.gd")
const CampButton = preload("res://ui/camp/camp_texture_button.gd")
const Model = preload("res://ui/camp/camp_view_model.gd")
var app: Node
var member_id: String
var training_button: Button
var close_button: Button
var switch_button: Button
var equipment_button: Button
var member_name: Label
var weapon_name: Label
var damage_label: Label
var portrait: TextureRect
var stat_fills: Array[Control] = []
var data: Dictionary
var _canvas: Control
var _open_tween: Tween
var _close_tween: Tween
var _closing := false

func setup(owner_app: Node, selected: String) -> void:
	app = owner_app
	member_id = selected
	name = "SurvivorDrawer"
	theme = CampArt.theme()
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	custom_minimum_size = Vector2(430, 540)
	mouse_filter = MOUSE_FILTER_STOP
	data = Model.new(app).survivor(selected)
	var canvas := Control.new()
	_canvas = canvas
	canvas.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(canvas)
	var paper := Surface.new()
	paper.configure(501, 32, 0.24)
	CampArt.place(paper, canvas, Rect2(0, 0, 430, 540))
	var header := Surface.new()
	header.configure(503, 20, 0.20)
	CampArt.place(header, canvas, Rect2(7, 8, 416, 105))
	member_name = CampArt.label(data.name, 29, CampArt.WHITE)
	CampArt.place(member_name, canvas, Rect2(22, 15, 250, 43))
	var role := CampArt.label(data.role, 18, CampArt.CYAN)
	CampArt.place(role, canvas, Rect2(22, 60, 245, 34))
	var tags := HBoxContainer.new()
	tags.add_theme_constant_override("separation", 5)
	CampArt.place(tags, canvas, Rect2(21, 118, 237, 25))
	for value: String in data.tags:
		var chip := Surface.new()
		chip.configure(52, 100, 0.05)
		tags.add_child(chip)
		var tag := CampArt.label(value, 12)
		tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		chip.add_child(tag)
		chip.custom_minimum_size = Vector2(tag.get_minimum_size().x + 14, 24)
	var talent: Resource = data.talent
	var trait_text := CampArt.label(talent.display_name + " · Lv.%d" % data.level, 15)
	CampArt.place(trait_text, canvas, Rect2(22, 152, 230, 27))
	var description := CampArt.label(talent.summary(), 13, CampArt.MUTED)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	CampArt.place(description, canvas, Rect2(22, 180, 232, 44))
	portrait = CampArt.icon(data.portrait, Vector2.ZERO)
	portrait.name = "OfficialPortrait"
	CampArt.place(portrait, canvas, Rect2(250, 0, 173, 226))
	if portrait.texture == null:
		var initial := CampArt.label(str(data.name).left(1), 58, CampArt.CYAN)
		initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		portrait.add_child(initial)
		CampArt.full_rect(initial)
	close_button = _button("", request_close, "plain", 214, Rect2(390, 6, 31, 31), canvas)
	close_button.tooltip_text = "关闭档案"
	close_button.skin.visible = false
	close_button.text = ""
	close_button.main_label.text = "×"
	close_button.main_label.visible = true
	close_button.main_label.add_theme_font_size_override("font_size", 24)
	close_button.main_label.add_theme_color_override("font_color", CampArt.WHITE)
	_divider(canvas, 231)
	var weapon: Resource = data.weapon
	weapon_name = CampArt.label(weapon.display_name if weapon != null else "未装备武器", 18)
	CampArt.place(weapon_name, canvas, Rect2(74, 236, 223, 28))
	var weapon_type := CampArt.label(weapon.type_name() if weapon != null else "", 12, CampArt.MUTED)
	CampArt.place(weapon_type, canvas, Rect2(22, 265, 230, 22))
	if weapon != null:
		var weapon_icon := CampArt.icon(weapon.icon(), Vector2.ZERO)
		CampArt.place(weapon_icon, canvas, Rect2(22, 236, 44, 44))
	damage_label = CampArt.label("%.1f" % data.damage if weapon != null else "—", 40)
	damage_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CampArt.place(damage_label, canvas, Rect2(285, 240, 126, 53))
	var damage_caption := CampArt.label("单次伤害", 14, CampArt.MUTED)
	damage_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CampArt.place(damage_caption, canvas, Rect2(285, 292, 126, 27))
	damage_caption.tooltip_text = "含天赋与随队被动加成"
	for index: int in range(data.stats.size()):
		_stat(canvas, data.stats[index], 344 + index * 24)
	_divider(canvas, 445)
	var passives: Array[Resource] = data.passives
	if not passives.is_empty():
		var passive: Resource = passives[0]
		CampArt.place(CampArt.icon(passive.icon, Vector2.ZERO), canvas, Rect2(22, 450, 42, 42))
		CampArt.place(CampArt.label(passive.display_name, 16), canvas, Rect2(74, 449, 323, 23))
		var description_label := CampArt.label(passive.description(), 12, CampArt.MUTED)
		description_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		CampArt.place(description_label, canvas, Rect2(74, 472, 323, 22))
	else:
		CampArt.place(CampArt.label("未装备随队被动", 15, CampArt.MUTED), canvas, Rect2(23, 452, 380, 39))
	switch_button = _button("更换", _show_equipment, "secondary", 211, Rect2(16, 494, 78, 42), canvas)
	equipment_button = _button("查看装备", _show_equipment, "secondary", 212, Rect2(98, 494, 125, 42), canvas)
	training_button = _button("升级幸存者", func(): app.train_member(member_id), "primary", 210, Rect2(227, 494, 187, 42), canvas)
	training_button.disabled = data.training_cost < 0 or app.campaign.data.food < data.training_cost
	training_button.tooltip_text = "已达等级上限" if data.training_cost < 0 else "消耗 %d 食物" % data.training_cost
	play_open_animation()

func play_open_animation() -> void:
	if _canvas == null:
		return
	if _open_tween != null:
		_open_tween.kill()
	var pivot := _canvas.size * 0.5
	if pivot == Vector2.ZERO:
		pivot = Vector2(215.0, 270.0)
	_canvas.pivot_offset = pivot
	_canvas.scale = Vector2(0.94, 0.94)
	_canvas.modulate = Color(1.0, 1.0, 1.0, 0.0)
	var portrait_position := portrait.position
	portrait.position = portrait_position + Vector2(18.0, 0.0)
	_open_tween = create_tween()
	_open_tween.set_parallel(true)
	_open_tween.set_trans(Tween.TRANS_BACK)
	_open_tween.set_ease(Tween.EASE_OUT)
	_open_tween.tween_property(_canvas, "scale", Vector2.ONE, 0.34)
	_open_tween.tween_property(_canvas, "modulate", Color.WHITE, 0.18)
	_open_tween.tween_property(portrait, "position", portrait_position, 0.38)

func request_close() -> void:
	if _closing or _canvas == null:
		return
	_closing = true
	mouse_filter = MOUSE_FILTER_IGNORE
	if _open_tween != null:
		_open_tween.kill()
	if _close_tween != null:
		_close_tween.kill()
	var portrait_position := portrait.position
	_close_tween = create_tween()
	_close_tween.set_parallel(true)
	_close_tween.set_trans(Tween.TRANS_QUAD)
	_close_tween.set_ease(Tween.EASE_IN)
	_close_tween.tween_property(_canvas, "scale", Vector2(0.96, 0.96), 0.07)
	_close_tween.tween_property(_canvas, "modulate", Color(1.0, 1.0, 1.0, 0.0), 0.06)
	_close_tween.tween_property(portrait, "position", portrait_position + Vector2(18.0, 0.0), 0.08)
	get_tree().create_timer(0.08).timeout.connect(func():
		if _closing:
			closed.emit()
	)

func _button(value: String, callback: Callable, family: String, icon: int, rect: Rect2, parent: Control) -> Button:
	var result := CampButton.new()
	CampArt.place(result, parent, rect)
	result.setup(value, callback, family, CampArt.texture(icon), "", 16)
	result.icon_view.custom_minimum_size = Vector2(20, 20)
	return result

func _show_equipment() -> void:
	app.camp_ui.show_weapons()
	var browser: Control = app.camp_ui.browser
	browser._show_list(true)
	var uid: String = app.campaign.data.equipment.get(member_id, "")
	if not uid.is_empty():
		browser._show_details(app.campaign.weapon(uid), app.campaign.item(uid))

func _divider(parent: Control, y: float) -> void:
	var line := ColorRect.new()
	line.color = Color("#c6c5bb")
	line.mouse_filter = MOUSE_FILTER_IGNORE
	CampArt.place(line, parent, Rect2(20, y, 391, 1))

func _stat(parent: Control, stat: Dictionary, y: float) -> void:
	CampArt.place(CampArt.label(stat.label, 14), parent, Rect2(23, y, 109, 23))
	var track := Surface.new()
	track.configure(60, 75, 0.06)
	CampArt.place(track, parent, Rect2(140, y + 8, 188, 8))
	var fraction: float = clampf(float(stat.value) / maxf(1.0, stat.maximum), 0, 1)
	var clip := Control.new()
	clip.mouse_filter = MOUSE_FILTER_IGNORE
	clip.clip_contents = true
	CampArt.place(clip, parent, Rect2(140, y + 8, 188 * fraction, 8))
	var fill := Surface.new()
	fill.configure(61, 44, 0.07)
	CampArt.place(fill, clip, Rect2(0, 0, 188, 8))
	stat_fills.append(clip)
	var amount := CampArt.label(str(stat.format) % float(stat.value), 13)
	amount.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	CampArt.place(amount, parent, Rect2(333, y, 69, 23))
