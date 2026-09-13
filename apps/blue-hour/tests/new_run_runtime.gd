extends "res://tests/day_loop_runtime.gd"
var run_save := "user://test-runs/new-run-ui-%d.json" % Time.get_ticks_usec()

func launch(_fresh: bool) -> void:
	if app != null:
		app.queue_free()
		await frames()
	app = load("res://core/main.gd").new()
	app.save_path = run_save
	root.add_child(app)
	await frames(12)

func move_mouse(point: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.device = 42
	motion.position = point
	root.push_input(motion, true)
	await process_frame

func set_mouse_button(point: Vector2, pressed: bool) -> void:
	var event := InputEventMouseButton.new()
	event.device = 42
	event.position = point
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = pressed
	root.push_input(event, true)
	await process_frame

func alpha_bounds(texture: Texture2D, threshold: float = 0.125) -> Rect2i:
	var image := texture.get_image()
	var min_x := image.get_width()
	var min_y := image.get_height()
	var max_x := -1
	var max_y := -1
	for y in range(image.get_height()):
		for x in range(image.get_width()):
			if image.get_pixel(x, y).a <= threshold:
				continue
			min_x = mini(min_x, x)
			min_y = mini(min_y, y)
			max_x = maxi(max_x, x)
			max_y = maxi(max_y, y)
	if max_x < min_x or max_y < min_y:
		return Rect2i()
	return Rect2i(min_x, min_y, max_x - min_x + 1, max_y - min_y + 1)

func check_card_hover(card: Button, plate: TextureRect) -> void:
	var visual := card.get_node_or_null("CardVisual") as Control
	check(visual != null, "Cards share the reusable paper hover visual root")
	if visual == null:
		return
	var effect := visual.get_node_or_null("CardHoverEffect") as TextureRect
	check(effect != null, "Cards share the alpha-contour hover effect layer")
	if effect == null:
		return
	check(effect.texture == plate.texture, "Hover contour reuses the current card PNG")
	check(plate.material == null, "Hover shader leaves the original card colors untouched")
	var uses_rectangular_selection := false
	for child in card.find_children("*", "TextureRect", true, false):
		var texture_rect := child as TextureRect
		if texture_rect.texture != null and texture_rect.texture.resource_path.ends_with("24_card_selected.png"):
			uses_rectangular_selection = true
	check(not uses_rectangular_selection, "Cards no longer render the rectangular blue selection frame")
	var base_position := visual.position
	await move_mouse(card.get_global_rect().get_center())
	var tooltip := app.screen.get("tooltip_panel") as Control
	check(tooltip != null, "Effect details use a reusable animated information card")
	if tooltip == null:
		return
	check(tooltip.visible and tooltip.modulate.a < 1.0 and tooltip.scale.x < 1.0, "Effect details begin with a subtle enter animation")
	await create_timer(0.18).timeout
	var tooltip_paper := tooltip.get_node_or_null("TooltipPaper") as Polygon2D
	var panel_surface := tooltip.get_theme_stylebox("panel") as StyleBoxFlat
	var pointer_is_integrated := false
	if tooltip_paper != null:
		for point in tooltip_paper.polygon:
			if point.x < 0.0 or point.x > tooltip.size.x:
				pointer_is_integrated = true
				break
	check(
		panel_surface != null
		and panel_surface.bg_color.a < 0.01
		and tooltip_paper != null
		and pointer_is_integrated
		and tooltip.get_node_or_null("TooltipPointer") == null,
		"Tooltip pointer is part of one paper silhouette without a rectangular seam",
	)
	check(
		tooltip_paper != null
		and tooltip_paper.polygon.size() >= 17
		and not is_equal_approx(tooltip_paper.polygon[0].y, tooltip_paper.polygon[1].y)
		and not is_equal_approx(tooltip_paper.polygon[1].y, tooltip_paper.polygon[2].y),
		"Tooltip paper uses an irregular hand-cut perimeter instead of a rectangular card",
	)
	check(visual.position.is_equal_approx(base_position + Vector2.UP * 4.0), "Hover lifts the paper card by four pixels")
	check(visual.scale.is_equal_approx(Vector2.ONE * 1.03), "Hover scales the paper card to 1.03")
	check(tooltip.modulate.a > 0.99 and tooltip.scale.is_equal_approx(Vector2.ONE), "Effect details finish their enter animation cleanly")
	var card_rect := card.get_global_rect()
	var tooltip_rect := tooltip.get_global_rect()
	if card.name == "EffectCard_0":
		check(tooltip_rect.end.x <= card_rect.position.x and card_rect.position.x - tooltip_rect.end.x <= 24.0, "Item details open beside the item card")
	else:
		check(tooltip_rect.position.x >= card_rect.end.x and tooltip_rect.position.x - card_rect.end.x <= 24.0, "Skill details open beside the skill card")
	var upgrade_summary := app.screen.get("tooltip_upgrade_summary") as Label
	check(upgrade_summary != null and not upgrade_summary.text.is_empty(), "Every starter card exposes a concrete upgrade preview")
	var uses_extra_rule := false
	for child in tooltip.find_children("*", "TextureRect", true, false):
		var texture_rect := child as TextureRect
		if texture_rect.texture != null and texture_rect.texture.resource_path.ends_with("39_tooltip_rule.png"):
			uses_extra_rule = true
	check(not uses_extra_rule, "Effect details no longer stack a second decorative divider")
	check(
		is_equal_approx(app.screen.tooltip_prefix.global_position.y, app.screen.tooltip_summary.global_position.y)
		and app.screen.tooltip_prefix.get_theme_font_size("font_size") == app.screen.tooltip_summary.get_theme_font_size("font_size"),
		"Effect label and description share one aligned text row",
	)
	check(
		app.screen.tooltip_summary.get_line_count() >= 2 if card.name == "EffectCard_0" else true,
		"Long effect descriptions wrap naturally inside the information card",
	)
	check(
		not app.screen.tooltip_summary.text.contains("% ") if card.name == "EffectCard_0" else true,
		"Percentage values stay attached to the following Chinese copy",
	)
	check(
		app.screen.tooltip_upgrade_prefix.global_position.y >= app.screen.tooltip_summary.get_global_rect().end.y + 10.0,
		"Wrapped effect descriptions push the upgrade row downward without overlap",
	)
	var ui_scale: float = app.screen.composition.scale.x
	var left_margin: float = (app.screen.tooltip_title.global_position.x - app.screen.tooltip_panel.global_position.x) / ui_scale
	var bottom_margin: float = (
		app.screen.tooltip_panel.get_global_rect().end.y
		- app.screen.tooltip_upgrade_row.get_global_rect().end.y
	) / ui_scale
	check(
		app.screen.tooltip_panel.size.y >= 196.0
		and app.screen.tooltip_panel.size.y < 320.0
		and left_margin >= 24.0
		and bottom_margin >= 18.0
		and bottom_margin <= 26.0,
		"Effect details keep consistent paper margins while adapting their height (height=%.1f, left=%.1f, bottom=%.1f)" % [
			app.screen.tooltip_panel.size.y,
			left_margin,
			bottom_margin,
		],
	)
	if card.name == "EffectCard_0":
		var original_summary: String = app.screen.tooltip_summary.text
		var original_height: float = app.screen.tooltip_panel.size.y
		app.screen.tooltip_summary.text = original_summary + "。这是一段用于验证未来更长效果说明仍会继续向下排布的文字。"
		app.screen.call("_refresh_tooltip_layout")
		await process_frame
		await process_frame
		check(
			app.screen.tooltip_summary.get_line_count() >= 3
			and app.screen.tooltip_panel.size.y > original_height
			and app.screen.tooltip_upgrade_prefix.global_position.y >= app.screen.tooltip_summary.get_global_rect().end.y + 10.0,
			"Three-line descriptions expand the paper card and keep the upgrade row below",
		)
		app.screen.tooltip_summary.text = original_summary
		app.screen.call("_refresh_tooltip_layout")
		await process_frame
		await process_frame
	var material := effect.material as ShaderMaterial
	check(material != null and float(material.get_shader_parameter("hover_amount")) > 0.99, "Hover fades in the alpha-contour shader")
	if card.name == "EffectCard_0":
		await capture("21-card-hover")
	else:
		await capture("21-skill-hover")
	await set_mouse_button(card.get_global_rect().get_center(), true)
	await create_timer(0.10).timeout
	await process_frame
	check(visual.scale.is_equal_approx(Vector2.ONE * 0.98), "Press feedback scales the hovered card to 0.98")
	await set_mouse_button(card.get_global_rect().get_center(), false)
	await create_timer(0.16).timeout
	check(visual.scale.is_equal_approx(Vector2.ONE * 1.03), "Releasing restores the hover scale")
	await move_mouse(app.screen.tooltip_title.get_global_rect().get_center())
	await create_timer(0.18).timeout
	check(visual.position.is_equal_approx(base_position) and visual.scale.is_equal_approx(Vector2.ONE), "Mouse exit smoothly restores the card transform")
	check(float(material.get_shader_parameter("hover_amount")) < 0.01, "Mouse exit fades out the alpha-contour shader")
	check(not tooltip.visible, "Effect details leave with the card hover state")

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("NEW RUN UI TIMEOUT"); quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output")
	await launch(true)
	check(app.state == "menu" and app.campaign.data.is_empty(), "Missing save starts at menu, not an implicit run")
	check(not FileAccess.file_exists(run_save), "Menu alone never writes a run")
	await capture("20-main-menu")
	await click(button("开始游戏"))
	var route_tabs: Array[Button] = [
		app.screen.tabs.combat,
		app.screen.tabs.scavenge,
		app.screen.tabs.survey,
		app.screen.composition.get_node("Route_locked") as Button,
	]
	for tab in route_tabs:
		var title_row := tab.get_node_or_null("TabTitleRow") as HBoxContainer
		var icon_view := tab.get_node_or_null("TabTitleRow/TabIcon") as TextureRect
		var progress_text := tab.get_node_or_null("TabProgressText") as Label
		var progress_bar := tab.get_node_or_null("TabProgress") as TextureRect
		var description := tab.get_node_or_null("TabDescription") as Label
		check(
			title_row != null
			and is_equal_approx(title_row.position.x + title_row.size.x * 0.5, tab.size.x * 0.5),
			"Tab icon and title form one centered visual group: " + tab.name,
		)
		check(
			icon_view != null
			and icon_view.size.x <= 46.0
			and title_row.position.y >= 13.0,
			"Tab icon keeps a safe optical inset from the top edge: " + tab.name,
		)
		check(
			progress_text != null
			and progress_bar != null
			and is_equal_approx(progress_bar.position.x + progress_bar.size.x * 0.5, tab.size.x * 0.5),
			"Tab progress value and track share a centered column: " + tab.name,
		)
		check(
			description != null
			and description.position.y + description.size.y <= 127.0,
			"Tab description stays above the overlapping paper board: " + tab.name,
		)
	for index in range(app.screen.cards.size()):
		await check_card_hover(app.screen.cards[index], app.screen.card_plates[index])
	var selected_paths := {
		"combat": "res://assets/ui/route_selection/route_selection_combat_tab_selected.png",
		"scavenge": "res://assets/ui/route_selection/route_selection_scavenge_tab_selected.png",
		"survey": "res://assets/ui/route_selection/route_selection_survey_tab_selected.png",
	}
	var normal_paths := {
		"combat": "res://assets/ui/route_selection/route_selection_combat_tab_normal.png",
		"scavenge": "res://assets/ui/route_selection/route_selection_scavenge_tab_normal.png",
		"survey": "res://assets/ui/route_selection/route_selection_survey_tab_normal.png",
	}
	var selected_reference_bounds := alpha_bounds(load(selected_paths.combat) as Texture2D, 0.0)
	var hover_motion := InputEventMouseMotion.new()
	hover_motion.device = 42
	hover_motion.position = app.screen.tabs.combat.get_global_rect().get_center()
	root.push_input(hover_motion, true)
	await frames()
	check(app.screen.selected == "scavenge", "Hover does not select a route")
	check(
			app.screen.tabs.scavenge.get_child(0).texture.resource_path == selected_paths.scavenge
			and app.screen.tabs.combat.get_child(0).texture.resource_path == normal_paths.combat,
			"Hover leaves both selected and unselected tab backgrounds unchanged",
	)
	for choice in ["scavenge", "survey", "combat"]:
		await click(app.screen.tabs[choice])
		check(app.screen.selected == choice, "Tab selects " + choice)
		for route_id in normal_paths:
			var background := app.screen.tabs[route_id].get_child(0) as TextureRect
			var expected_path: String = selected_paths[route_id] if route_id == choice else normal_paths[route_id]
			check(background.texture.resource_path == expected_path, "Only the selected tab uses its highlighted background: " + route_id)
			check(background.position == Vector2(-10, 0) and background.size == Vector2(300, 160), "Tab swaps textures without changing its background rectangle: " + route_id)
			if route_id == choice:
				var selected_bounds := alpha_bounds(background.texture, 0.0)
				check(
					selected_bounds == selected_reference_bounds,
					"Selected tabs share one stable highlighted silhouette: " + route_id,
				)
	await click(app.screen.cards[0])
	var combat_background := app.screen.tabs.combat.get_child(0) as TextureRect
	check(combat_background.texture.resource_path == selected_paths.combat and app.screen.tab_tapes.combat.visible, "Selected background remains highlighted after focus leaves the tab")
	check(app.screen.tooltip_upgrade_summary.text == "全队远程伤害 +40%。", "Combat item shows its concrete upgraded effect")
	await click(app.screen.cards[1])
	check(app.screen.tooltip_upgrade_summary.text == "全队伤害 ×2，持续 12 秒。", "Combat skill shows its concrete upgraded effect")
	check(
			app.screen.card_plates[0].texture.resource_path == "res://assets/items/cards/item_shooting_target_card.png"
			and app.screen.card_plates[1].texture.resource_path == "res://assets/skills/cards/skill_rage_card.png",
			"Combat cards use their effect artwork instead of the blue placeholder",
	)
	await click(app.screen.tabs.survey)
	check(
			app.screen.card_plates[0].texture.resource_path == "res://assets/items/cards/item_coffee_card.png"
			and app.screen.card_plates[1].texture.resource_path == "res://assets/skills/cards/skill_map_healing_card.png",
			"Survey cards use their coffee and map-heal artwork",
	)
	check(
			app.screen.effect_titles[0].text == "咖啡"
			and app.screen.effect_titles[1].text == "全地图治疗"
			and app.screen.effect_descriptions[0].text == "白昼延长 20 秒。"
			and app.screen.effect_descriptions[1].text == "恢复所有存活队员 40% 最大生命。",
			"Survey cards expose the intended reward copy",
	)
	await click(app.screen.cards[0])
	check(
		app.screen.tooltip_title.text == "咖啡"
		and app.screen.tooltip_flavor.text == "早起的鸟儿有虫吃。"
		and app.screen.tooltip_upgrade_summary.text == "白昼延长 35 秒。",
		"Coffee card updates the detail callout and upgrade preview",
	)
	await click(app.screen.cards[1])
	check(
		app.screen.tooltip_title.text == "全地图治疗"
		and app.screen.tooltip_flavor.text == "我希望别把僵尸也救活了。"
		and app.screen.tooltip_upgrade_summary.text == "恢复所有存活队员 60% 最大生命。",
		"Map-heal card updates the detail callout and upgrade preview",
	)
	await click(app.screen.tabs.scavenge)
	check(app.screen.cards.size() == 2 and app.screen.selected_effect == 1, "Route preview exposes two selectable rewards")
	await click(app.screen.cards[0])
	check(
		app.screen.selected_effect == 0
		and app.screen.tooltip_title.text == "复印机"
		and app.screen.tooltip_upgrade_summary.text == "成功归航时，65%概率复制库存中价值最高的一把武器。",
		"Passive card updates the detail callout and upgrade preview",
	)
	await click(app.screen.cards[1])
	check(
		app.screen.selected_effect == 1
		and app.screen.tooltip_title.text == "疾行号令"
		and app.screen.tooltip_upgrade_summary.text == "全队移速 ×1.5，持续 15 秒。",
		"Skill card updates the detail callout and upgrade preview",
	)
	await capture("21-specialization")
	await click(button("取消"))
	check(app.state == "menu" and app.campaign.data.is_empty(), "Cancel leaves no created run")
	await click(button("开始游戏"))
	await click(app.screen.tabs.survey)
	await click(app.screen.confirm_button)
	check(app.state == "shelter" and app.campaign.data.members.size() == 2, "Confirmation creates two-member shelter")
	check(app.campaign.data.specialization == "survey", "Chosen specialization reaches saved run")
	var members: Array = app.campaign.data.members.duplicate()
	await click_at(app.screen.view.member_point(members[1]))
	check(app.selected_member == members[1], "Clicking 3D survivor selects the matching member")
	var food: int = app.campaign.data.food
	await click(app.screen.training_button)
	check(app.campaign.member_level(members[1]) == 2 and app.campaign.data.food == food - 1, "Native training button spends food and grows member")
	await key(KEY_ESCAPE)
	await click(app.screen.member_buttons[members[0]])
	check(app.selected_member == members[0], "Roster click selects the same identity as the world")
	await capture("22-new-run-shelter")
	var selected_weapon: String = app.campaign.data.equipment[members[0]]
	var transfer_uid: String = app.campaign.data.equipment[members[1]]
	await click(app.screen.drawer.switch_button)
	await click(app.screen.browser.entries[transfer_uid])
	await click(button("转交给 " + app.member_name(members[0])))
	check(app.campaign.data.equipment[members[1]] == "" and app.campaign.weapon_inventory.has_weapon(selected_weapon), "Transfer keeps one holder and returns displaced weapon to stock")
	await key(KEY_ESCAPE)
	await click(button("菜单"))
	await click(button("主菜单"))
	var saved: String = FileAccess.get_file_as_string(run_save)
	await click(button("开始游戏"))
	await click(app.screen.tabs.combat)
	await click(app.screen.confirm_button)
	var confirmation := app.find_child("NewRunConfirmation", true, false) as Control
	check(confirmation != null and confirmation.visible, "Replacing an active run has an in-scene confirmation")
	check(app.find_children("*", "ConfirmationDialog", true, false).is_empty(), "New-run confirmation does not use a native system dialog")
	var confirmation_card := confirmation.find_child("ConfirmationCard", true, false) as PanelContainer
	var paper_backing := confirmation.find_child("ConfirmationPaperBacking", true, false) as PanelContainer
	var confirmation_shade := confirmation.find_child("ConfirmationShade", true, false) as ColorRect
	var keep_progress := confirmation.find_child("KeepProgressButton", true, false) as Button
	var create_run_button := confirmation.find_child("CreateRunButton", true, false) as Button
	check(
		confirmation_card != null
		and confirmation_card.get_theme_stylebox("panel") is StyleBoxTexture
		and confirmation_card.size.x >= 560.0,
		"New-run confirmation uses a substantial paper card",
	)
	var backing_style := paper_backing.get_theme_stylebox("panel") as StyleBoxFlat
	check(
		backing_style != null and backing_style.bg_color.a > 0.99,
		"Paper confirmation stays opaque over the route cards",
	)
	check(
		confirmation_shade != null
		and confirmation_shade.color.a >= 0.55
		and confirmation.mouse_filter == Control.MOUSE_FILTER_STOP,
		"New-run confirmation isolates the pending decision from the route screen",
	)
	check(
		keep_progress != null
		and create_run_button != null
		and keep_progress.custom_minimum_size.y >= 56.0
		and create_run_button.custom_minimum_size.y >= 56.0,
		"Confirmation actions are clear game-sized targets",
	)
	check(
		root.get_visible_rect().encloses(confirmation_card.get_global_rect())
		and confirmation_card.get_global_rect().encloses(keep_progress.get_global_rect())
		and confirmation_card.get_global_rect().encloses(create_run_button.get_global_rect())
		and not keep_progress.get_global_rect().intersects(create_run_button.get_global_rect())
		and confirmation.z_index > app.screen.composition.z_index,
		"Confirmation card and actions are unclipped, non-overlapping, and above the route scene",
	)
	await capture("21-new-run-confirmation")
	await key(KEY_ESCAPE)
	check(app.find_child("NewRunConfirmation", true, false) == null and app.state == "new_game", "Esc closes only the replacement confirmation")
	check(FileAccess.get_file_as_string(run_save) == saved, "Esc preserves the exact old save")
	await click(app.screen.confirm_button)
	confirmation = app.find_child("NewRunConfirmation", true, false) as Control
	keep_progress = confirmation.find_child("KeepProgressButton", true, false) as Button
	await click(keep_progress)
	check(FileAccess.get_file_as_string(run_save) == saved, "Cancel replacement preserves exact old save")
	await click(app.screen.confirm_button)
	confirmation = app.find_child("NewRunConfirmation", true, false) as Control
	create_run_button = confirmation.find_child("CreateRunButton", true, false) as Button
	await click(create_run_button)
	check(
		app.state == "shelter"
		and app.campaign.data.day == 1
		and app.campaign.data.specialization == "combat",
		"Paper confirmation creates the selected replacement run",
	)
	var restore_save := FileAccess.open(run_save, FileAccess.WRITE)
	restore_save.store_string(saved)
	restore_save.close()
	await launch(false)
	await click(button("继续"))
	check(app.campaign.data.members == members and app.campaign.member_level(members[1]) == 2, "Continue retains team and training")
	root.size = Vector2i(1024, 640)
	await frames(12)
	check(root.get_visible_rect().encloses(app.screen.departure.get_global_rect()), "Departure visible at minimum size")
	await click_at(app.camp_view.member_point(members[0]))
	await frames(3)
	check(root.get_visible_rect().encloses(app.screen.training_button.get_global_rect()), "Training remains visible in the fitted HUD at minimum size")
	await capture("23-new-run-small")
	root.size = Vector2i(1440, 900)
	await frames()
	await click(button("今日行动"))
	await click(button("商业街"))
	await click(button("确认出发"))
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission.survivors[0].hp = 10
	app.mission.survivors[1].hp = 20
	await click(app.hud.power_buttons.aid)
	check(app.mission.powers.states.aid.used_today and app.mission.survivors[0].hp > 10 and app.mission.survivors[1].hp > 20, "HUD casts global aid on both members")
	check(app.hud.power_buttons.aid.disabled, "Used power cannot be cast again")
	await capture("24-special-power")
	app.mission.ledger.add_loot(3, 4)
	app.mission._finish(false)
	await frames(10)
	await click(button("确认结算"))
	check(app.campaign.data.day == 2 and app.campaign.member_level(members[1]) == 2, "Return preserves individual level into next day")
	await click(button("今日行动"))
	await click(button("商业街"))
	await click(button("确认出发"))
	check(not app.mission.powers.states.aid.used_today, "Next day recharges the equipped power")
	# Controlled I/O failure: no player save is touched and domain state must roll back.
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission._finish(false)
	await frames(10)
	await click(button("确认结算"))
	var before: Dictionary = app.campaign.data.duplicate(true)
	var good_store = app.store
	app.store = load("res://core/save_store.gd").new(run_save + "/blocked.json")
	app.train_member(members[0])
	check(app.campaign.data == before, "Failed training write rolls back food and level")
	for node in app.get_children():
		if node is AcceptDialog and node.visible:
			await click_at(Vector2(node.position) + node.get_ok_button().get_global_rect().get_center())
			check(not is_instance_valid(node) or not node.visible, "Save error can be dismissed")
	app.create_run("combat")
	check(app.campaign.data == before, "Failed creation write preserves previous run")
	app.store = good_store
	var report := FileAccess.open("res://test-output/new-run-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "evidence":"native synthetic mouse input, isolated save, real 3D viewport and mission powers"}, "\t"))
	print("NEW RUN NATIVE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
