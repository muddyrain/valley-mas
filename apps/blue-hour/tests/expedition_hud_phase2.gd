extends "res://tests/expedition_hud_2.gd"
## Production Mission and HUD, deterministic fixture, native device-42 input.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var output_directory: String = "res://test-output/expedition_hud_phase2/"
var screenshots: Array[String] = []

func run() -> void:
	if "--final-fix" in OS.get_cmdline_user_args():
		output_directory = "res://test-output/expedition_hud_final_fix/"
	elif "--final-match" in OS.get_cmdline_user_args():
		output_directory = "res://test-output/expedition_hud_final_match/"
	elif "--polish" in OS.get_cmdline_user_args():
		output_directory = "res://test-output/expedition_hud_phase2_1/"
	create_timer(150).timeout.connect(func(): printerr("PHASE2 TIMEOUT"); quit(2))
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(output_directory)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260912, "combat", ["xia_zhiyao", "su_wanxing"])
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(12)
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.power_buttons.has("rage"), "Combat loadout supplies the real Rage power")
	check(hud.power_buttons.rage.icon == HudArt.texture("icon_rage"), "Rage binds the clean action_frenzy source")
	check(hud.command_buttons["集火"].icon == HudArt.texture("icon_focus_fire"), "Focus binds the clean action_focus_fire source")
	check(hud.pause_button.icon == HudArt.texture("icon_menu"), "Menu icon is inside the Phase 1 button")
	for resolution: Vector2i in [Vector2i(1920,1080), Vector2i(2560,1440)]:
		root.size = resolution
		await frames(12)
		for panel: Control in [hud.resources_panel, hud.squad_panel, hud.command_panel, hud.sites_panel, hud.extract_button, hud.minimap]:
			check(root.get_visible_rect().encloses(panel.get_global_rect()), "Panel fits %s: %s" % [resolution, panel.name])
		for action: Button in hud.command_buttons.values() + hud.power_buttons.values() + [hud.extract_button]:
			check(action.get_global_rect().encloses(action.key_backplate.get_global_rect()), "Native key badge stays inside click target at " + str(resolution))
		await shot("01_full_hud" if resolution.x == 1920 else "01_full_hud_2560x1440")
		if "--final-match" in OS.get_cmdline_user_args() or "--final-fix" in OS.get_cmdline_user_args():
			check(hud.top_panel.get_parent() == hud.day_panel.get_parent(), "Time and day share the horizontal container")
			check(absf(hud.top_panel.global_position.y - hud.day_panel.global_position.y) < 2, "Time and day are on one row")
			check(hud.command_panel.get_theme_stylebox("panel") is StyleBoxEmpty, "Action tray has no painted background")
			check(not hud.brand_panel.get_global_rect().intersects(hud.squad_panel.get_global_rect()), "Brand and roster do not overlap")
	root.size = Vector2i(1920,1080)
	await frames(12)
	mission.ledger.add_loot(7, 13)
	hud.refresh()
	check(hud.resource_counts[0].text == "07" and hud.resource_counts[1].text == "13", "Live ledger updates resource values")
	await shot("02_top_resources", hud.resources_panel)
	var member: Node3D = mission.survivors[0]
	var old_hp: float = member.hp
	member.hp = member.data.max_hp * .4325
	hud.refresh()
	check(is_equal_approx(hud.squad_cards[0].health.value, member.hp), "Friendly bar reads actual HP")
	await shot("15_friendly_hp_partial", hud.squad_cards[0])
	member.hp = 0
	hud.refresh()
	check(is_zero_approx(hud.squad_cards[0].health.ratio), "Zero HP empties the friendly fill")
	for index: int in range(hud.squad_cards.size()):
		var card: Control = hud.squad_cards[index]
		var actor: Node3D = mission.survivors[index]
		check(card.index_label.text == str(index + 1), "Party index is dynamic")
		check(card.weapon_icon.texture == HudArt.texture("weapon_melee" if actor.weapon.melee else "weapon_ranged"), "Weapon type follows current equipment")
		check(card.get_global_rect().encloses(card.health.get_global_rect()), "Health display stays within the survivor card")
		check(not card.health.get_global_rect().intersects(card.details.get_global_rect()), "Health and ammunition rows remain separate")
	member.cooldown = 1
	member.hp = old_hp
	hud.refresh()
	check(hud.squad_cards[0].status.text == "战斗" and hud.squad_cards[0].status_dot.texture == HudArt.texture("ui_status_dot_red"), "Combat status shows warning and live Label")
	member.cooldown = 0
	hud.refresh()
	check(hud.squad_cards[0].status.text == "跟随" and hud.squad_cards[0].status_dot.texture == HudArt.texture("ui_status_dot_blue"), "Follow status uses the clean icon")
	await shot("03_survivor_cards", hud.squad_panel)
	var idle_squad_size: Vector2 = hud.squad_panel.size
	var idle_rally_position: Vector2 = hud.rally_button.global_position
	var idle_roster_actions: int = hud.squad_panel.find_children("*", "BaseButton", true, false).size()
	var idle_card_sizes: Array[Vector2] = []
	for card: Control in hud.squad_cards:
		idle_card_sizes.append(card.size)
		check(card.size.y <= 128, "Survivor display keeps the compact reference proportions")
		check(card.find_children("*", "BaseButton", true, false).size() == 1, "Survivor information has no search command button")
	await shot("04_action_bar", hud.command_panel)
	await hover(hud.command_buttons["停止"].get_global_rect().get_center())
	check(hud.command_buttons["停止"].get_draw_mode() == BaseButton.DRAW_HOVER, "Real Stop hover state")
	await shot("05_action_hover", hud.command_panel)
	await click(hud.command_buttons["停止"].key_backplate)
	check(mission.order.begins_with("停止"), "Click through key badge executes Stop")
	mission.camera_controller.following = false
	await key(KEY_L)
	check(mission.camera_controller.following, "L still restores follow")
	await key(KEY_X)
	check(mission.order.begins_with("停止"), "X still stops the squad")
	await key(KEY_R)
	check(mission.search_tasks.is_empty(), "R uses existing rally action")
	await click(hud.expand_button)
	check(hud.objectives_expanded and hud.expand_button.icon == HudArt.texture("icon_chevron_down"), "Discovery expands and changes its collapse icon")
	await shot("06_discovery_panel", hud.sites_panel)
	await click(hud.expand_button)
	var site_id: String = "arrival_house"
	var site: Dictionary = mission.city.sites[site_id]
	mission.camera_controller.following = false
	mission.camera_center = site.spec.entry
	mission.camera_controller.apply()
	hud.poi_context.focused_id = site_id
	hud.refresh()
	await frames(8)
	if "--final-match" in OS.get_cmdline_user_args() or "--final-fix" in OS.get_cmdline_user_args():
		await create_timer(.3).timeout
		await shot("08_world_interaction", hud.poi_context.cards[site_id], 24)
	await click(hud.site_buttons[site_id])
	check(mission.search_tasks.has(site_id), "Discovery click starts the production search")
	check(not hud.poi_context.cards[site_id].visible, "Search card stays hidden while the worker is travelling")
	var deadline: float = mission.clock.elapsed + 60
	while site.progress < .1 and mission.clock.elapsed < deadline:
		await step(.2)
	hud.poi_context.focused_id = site_id
	hud.refresh()
	await create_timer(.3).timeout
	var search_card: Control = hud.poi_context.cards[site_id]
	for index: int in range(hud.squad_cards.size()):
		check(hud.squad_cards[index].size.is_equal_approx(idle_card_sizes[index]), "Searching does not resize either survivor display")
	check(hud.squad_panel.size.is_equal_approx(idle_squad_size), "Searching does not expand the roster")
	check(hud.rally_button.global_position.is_equal_approx(idle_rally_position), "Searching does not move Rally")
	check(hud.squad_panel.find_children("*", "BaseButton", true, false).size() == idle_roster_actions, "Searching adds no roster actions beyond existing portrait selection and Rally")
	var worker_index: int = mission.survivors.find(mission.search_tasks[site_id].worker)
	check(hud.squad_cards[worker_index].status.text.begins_with("搜索"), "Read-only survivor display still reports live search progress")
	await shot("16_survivor_cards_searching", hud.squad_panel)
	check(search_card.visible and is_equal_approx(search_card.progress.value, site.progress * 100), "Visible card uses authoritative search progress without rounding")
	check(search_card.get_global_rect().encloses(search_card.action.get_global_rect()), "Cancel button fits the expanded card")
	check(not search_card.progress.get_global_rect().intersects(search_card.action.get_global_rect()), "Progress and cancel do not overlap")
	check(search_card.action.size.y >= 32, "Cancel retains a readable button height")
	await shot("07_world_interaction", search_card, 24)
	await click(search_card.action)
	check(not mission.search_tasks.has(site_id), "World cancel remains clickable")
	hud.refresh()
	check(not hud.poi_context.cards[site_id].visible or not hud.poi_context.cards[site_id].action.visible, "Cancel immediately clears world search UI")
	mission.command_search(site_id)
	check(mission.search_tasks.has(site_id), "Search can be started again after cancel")
	mission.command_move(mission.squad_center() + Vector3(2, 0, 0))
	check(mission.search_tasks.is_empty(), "Ground movement may replace a newly assigned approach before searching begins")
	check(hud.minimap.get("marker_player") == null and hud.minimap.get("marker_teammate") == null, "Minimap has no avatar survivor marker resources")
	check(hud.minimap.marker_poi == HudArt.texture("map_poi_marker"), "Minimap uses supplied house PNG")
	check(hud.minimap.marker_target == HudArt.texture("map_target_marker"), "Minimap uses supplied target PNG")
	await shot("08_minimap", hud.minimap)
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.nearest_open(member.position + Vector3(2,0,0)))
	enemy.take_damage(enemy.max_hp * .5)
	check(is_equal_approx(enemy.hp_bar.ratio, .5) and enemy.hp_bar.scale == Vector3.ONE, "Enemy damage clips fill without scaling the frame")
	check(enemy.hp_bar.fill.region_rect.size.x == enemy.hp_bar.fill.texture.get_width() * .5, "Enemy fill clips half the source region")
	mission.exploration.refresh()
	await frames(4)
	await key(KEY_F)
	check(mission.focus_target == enemy, "F retains real target selection")
	await shot("13_enemy_hp")
	mission.debug_clear_enemies()
	await hover(hud.power_buttons.rage.get_global_rect().get_center())
	await shot("12_frenzy_binding_check", hud.power_buttons.rage, 20)
	await key(KEY_1)
	check(mission.powers.states.rage.active and hud.power_buttons.rage._active, "Numeric shortcut activates actual Rage gameplay")
	check(hud.power_buttons.rage.key_backplate.background.texture == HudArt.texture("hotkey_active"), "Active skill changes badge")
	await shot("14_frenzy_active", hud.power_buttons.rage, 20)
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.extract_button.get_draw_mode() == BaseButton.DRAW_NORMAL, "Return is natively normal")
	check(hud.extract_button.icon == HudArt.texture("icon_return"), "Normal return bus icon")
	check(hud.extract_button.badge.text == "E", "Return retains dynamic E")
	await shot("09_return_bus_normal", hud.extract_button, 18)
	await hover(hud.extract_button.get_global_rect().get_center())
	check(hud.extract_button.get_draw_mode() == BaseButton.DRAW_HOVER and hud.extract_button.icon == HudArt.texture("icon_return_highlight"), "Real hover changes return icon")
	await shot("10_return_bus_hover", hud.extract_button, 18)
	var press := InputEventMouseButton.new()
	press.device = 42
	press.position = hud.extract_button.get_global_rect().get_center()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	root.push_input(press,true)
	await frames(3)
	check(hud.extract_button.get_draw_mode() in [BaseButton.DRAW_PRESSED, BaseButton.DRAW_HOVER_PRESSED], "Real held mouse produces pressed state")
	check(not mission.extraction, "Press is not premature extraction")
	await shot("11_return_bus_pressed", hud.extract_button, 18)
	press.pressed = false
	root.push_input(press,true)
	await frames(3)
	check(mission.extraction, "Releasing inside button starts real extraction")
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.extract_button.icon == HudArt.texture("icon_return_highlight"), "Extraction keeps active bus icon after hover leaves")
	# Restore an ordinary movement command before testing the independent E path.
	mission.command_move(mission.squad_center())
	check(not mission.extraction, "Existing movement command cancels return")
	await key(KEY_E)
	check(mission.extraction, "E invokes existing return command")
	await step(120)
	check(not mission.active and mission.board_count() == mission.living().size(), "Whole party reaches bus and completes existing extraction")
	for node: Node in hud.find_children("*", "Control", true, false):
		if node is TextureRect or node is Label or node is ProgressBar:
			check(node.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Decoration does not intercept input: " + str(node.name))
	FileAccess.open(output_directory + "runtime.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"screenshots":screenshots,"evidence":"Native Godot 4.7.2, production Mission and HUD, fixed combat campaign, synthetic input, time-compressed original simulation; isolated from player save"},"\t"))
	layer.free()
	mission.free()
	await frames(3)
	print("PHASE2: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func shot(id: String, control: Control = null, padding: float = 8) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var pixels: Image = root.get_texture().get_image()
	if (output_directory.ends_with("phase2_1/") or output_directory.ends_with("final_match/") or output_directory.ends_with("final_fix/")) and id == "02_top_resources":
		pixels = pixels.get_region(Rect2i(0, 0, pixels.get_width(), 176))
	elif control != null:
		var region: Rect2i = Rect2i(root.get_stretch_transform() * control.get_global_rect().grow(padding)).intersection(Rect2i(Vector2i.ZERO, pixels.get_size()))
		pixels = pixels.get_region(region)
	if output_directory.ends_with("phase2_1/"):
		var polish_names: Dictionary = {
			"01_full_hud_2560x1440": "12_full_hud_2560x1440",
			"02_top_resources": "02_top_hud_polish",
			"03_survivor_cards": "03_survivor_cards_polish",
			"04_action_bar": "04_action_bar_polish",
			"05_action_hover": "05_action_hover_polish",
			"06_discovery_panel": "06_discovery_panel_polish",
			"07_world_interaction": "07_world_interaction_polish",
			"08_minimap": "08_minimap_polish"
		}
		id = polish_names.get(id, id)
	if output_directory.ends_with("final_match/"):
		var final_names: Dictionary = {
			"01_full_hud": "02_final_match_full", "01_full_hud_2560x1440": "11_final_match_2560x1440",
			"02_top_resources": "04_top_hud", "03_survivor_cards": "05_survivor_hud",
			"04_action_bar": "06_action_bar", "06_discovery_panel": "07_discovery",
			"08_minimap": "09_minimap", "09_return_bus_normal": "10_return_bus"
		}
		id = final_names.get(id, id)
	if output_directory.ends_with("final_fix/"):
		var fix_names: Dictionary = {
			"01_full_hud": "01_full_hud_1080p", "01_full_hud_2560x1440": "08_full_hud_1440p",
			"02_top_resources": "02_top_time_fix", "03_survivor_cards": "03_survivor_fix",
			"04_action_bar": "04_action_bar_fix", "06_discovery_panel": "05_discovery_fix",
			"08_minimap": "07_minimap_stability", "09_return_bus_normal": "06_return_bus_fix"
		}
		id = fix_names.get(id, id)
	check(pixels.save_png(output_directory + id + ".png") == OK,"Native capture " + id)
	screenshots.append(id + ".png")
