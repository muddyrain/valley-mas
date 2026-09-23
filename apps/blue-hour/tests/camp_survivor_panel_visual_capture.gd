extends SceneTree

const DETAIL_SCENE := preload("res://ui/camp_hud/survivor_detail.tscn")
const PORTRAIT_SLOT_SCENE := preload("res://ui/camp_hud/portrait_slot.tscn")
const OUTPUT := "res://test-output/camp-survivor-panel/"
const ANIMATION_OUTPUT := "res://test-output/camp-survivor-detail-animation/"
const VIEW_SIZE := Vector2i(1600, 900)
var failures: Array[String] = []

func _initialize() -> void:
	_capture.call_deferred()

func _capture() -> void:
	root.size = VIEW_SIZE
	var canvas := Control.new()
	canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(canvas)
	var backdrop := ColorRect.new()
	backdrop.color = Color("#72908f")
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(backdrop)
	var camp_header := Label.new()
	camp_header.position = Vector2(46, 42)
	camp_header.text = "東岸營地  /  出發整備"
	camp_header.add_theme_color_override("font_color", Color("#eef5f2"))
	camp_header.add_theme_font_size_override("font_size", 24)
	canvas.add_child(camp_header)

	var detail := DETAIL_SCENE.instantiate() as Control
	detail.position = Vector2(1040, 187)
	canvas.add_child(detail)
	detail.set_layout_position(Vector2(1040, 187), 1.0)
	var portrait: Texture2D = load("res://assets/characters/xia_zhiyao/portrait/avatar_square.png") as Texture2D
	var survivor_data := {
		"id": "SUR_001",
		"name": "夏知遥",
		"level": 1,
		"hp": 100.0,
		"max_hp": 100.0,
		"current_state": "已招募",
		"tags": "搜索效率 · 资源管理",
		"background_description": "她以前就喜欢钻进城市那些不太有人注意的小巷。",
		"portrait": portrait,
		"weapon": "P9 半自动手枪",
		"weapon_type": "手枪",
		"power": "17.6",
		"attributes": [24, 22, 12, 10],
		"trait": "搜寻直觉",
		"trait_description": "提高搜索、车辆以及其他据点的搜索速度。",
		"trait_level": 1,
		"action_states": {"switch": "disabled", "equipment": "disabled", "upgrade": "locked"},
	}
	detail.present(survivor_data)
	_check(detail.size == Vector2(390, 526), "Detail uses the compact dispatch panel footprint")
	_check(not detail.get_node("BackgroundPanel").visible, "Profile copy does not overlap the mission header")
	_check(detail.get_node("HeaderPanel/TraitBadge/Label").text == "探索专家", "Detail shows a concise mission role")
	_check(detail.get_node("HeaderPanel/PortraitContainer/HalfPortrait").texture == portrait, "Detail uses the authored survivor portrait")
	_check(detail.get_node("CombatPanel/WeaponIconSlot") != null, "Equipment reserves a future icon slot without image assets")
	_check(detail.get_node("ActionBar/UpgradeButton").text == "升级幸存者", "Upgrade remains the visually primary action")

	var roster := Panel.new()
	roster.position = Vector2(1464, 180)
	roster.size = Vector2(118, 500)
	canvas.add_child(roster)
	var roster_title := Label.new()
	roster_title.position = Vector2(12, 7)
	roster_title.text = "营地成员  4"
	roster_title.add_theme_color_override("font_color", Color("#eef5f2"))
	roster.add_child(roster_title)
	var survivor_rows: Array[Dictionary] = [
		{"name": "夏知遥", "portrait": portrait, "selected": true, "level": 1},
		{"name": "苏晚星", "portrait": load("res://assets/characters/su_wanxing/portrait/avatar_square.png"), "selected": false, "level": 1},
		{"name": "林见月", "portrait": load("res://assets/characters/lin_jianyue/portrait/avatar_square.png"), "selected": false, "level": 1},
		{"name": "陆清禾", "portrait": load("res://assets/characters/lu_qinghe/portrait/avatar_square.png"), "selected": false, "level": 1},
	]
	for index: int in range(survivor_rows.size()):
		var row := survivor_rows[index]
		var slot := PORTRAIT_SLOT_SCENE.instantiate() as Control
		slot.position = Vector2(9, 38 + index * 114)
		roster.add_child(slot)
		slot.bind_survivor({
			"display_name": row.name,
			"name_en": "SUR_%03d" % (index + 1),
			"survivor_id": "SUR_%03d" % (index + 1),
			"level": row.level,
			"portrait": row.portrait,
		})
		slot.set_selected(row.selected)
	_check(survivor_rows.size() == 4, "Roster shows a narrow vertical sample")
	_check(roster.get_child_count() == survivor_rows.size() + 1, "Roster renders all portrait slots")

	await create_timer(0.34).timeout
	_check(detail.visible and is_equal_approx(detail.modulate.a, 1.0), "Open transition settles within its 0.30 second duration")
	DirAccess.make_dir_recursive_absolute(ANIMATION_OUTPUT)
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var screenshot := root.get_texture().get_image()
	var result := screenshot.save_png(OUTPUT + "camp-panel-isolated-1600x900.png")
	if result != OK:
		push_error("Could not save Camp panel screenshot: %s" % error_string(result))
		quit(1)
		return
	result = screenshot.save_png(ANIMATION_OUTPUT + "open-sur001-1600x900.png")
	if result != OK:
		push_error("Could not save open-state screenshot: %s" % error_string(result))
		quit(1)
		return
	print("CAMP SURVIVOR PANEL VISUAL CAPTURE: %s" % (OUTPUT + "camp-panel-isolated-1600x900.png"))
	var switched_data := survivor_data.duplicate(true)
	switched_data["id"] = "SUR_002"
	switched_data["name"] = "苏晚星"
	switched_data["tags"] = "战斗专长 · 资源管理"
	switched_data["portrait"] = load("res://assets/characters/su_wanxing/portrait/avatar_square.png")
	detail.present(switched_data)
	await create_timer(0.22).timeout
	_check(detail.survivor_id == "SUR_002" and detail.get_node("HeaderPanel/SurvivorName").text == "苏晚星", "Fast survivor switch refreshes the selected detail")
	_check(is_equal_approx(detail.get_node("HeaderPanel").modulate.a, 1.0), "Switched detail content settles fully opaque")
	await RenderingServer.frame_post_draw
	screenshot = root.get_texture().get_image()
	result = screenshot.save_png(ANIMATION_OUTPUT + "switch-sur002-1600x900.png")
	if result != OK:
		push_error("Could not save switch-state screenshot: %s" % error_string(result))
		quit(1)
		return
	detail.close_panel()
	await create_timer(0.10).timeout
	await RenderingServer.frame_post_draw
	screenshot = root.get_texture().get_image()
	result = screenshot.save_png(ANIMATION_OUTPUT + "closing-1600x900.png")
	if result != OK:
		push_error("Could not save closing-state screenshot: %s" % error_string(result))
		quit(1)
		return
	await create_timer(0.24).timeout
	_check(not detail.visible and is_zero_approx(detail.modulate.a), "Close transition settles within its 0.22 second duration")
	await RenderingServer.frame_post_draw
	screenshot = root.get_texture().get_image()
	result = screenshot.save_png(ANIMATION_OUTPUT + "closed-1600x900.png")
	if result != OK:
		push_error("Could not save closed-state screenshot: %s" % error_string(result))
		quit(1)
		return
	for failure: String in failures:
		printerr(failure)
	print("CAMP SURVIVOR PANEL VISUAL CAPTURE: %d failures" % failures.size())
	quit(0 if failures.is_empty() else 1)

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
