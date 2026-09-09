extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
const Preferences = preload("res://scripts/ui_preferences.gd")
var game
var checks = 0
var failures: Array[String] = []

func _initialize() -> void: call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message); push_error(message)

func capture(name: String) -> void:
	await settle_surface()
	# Capture the settled page, separately from testing the live transition.
	await create_timer(.22).timeout
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/"+name+".png")

func settle_surface() -> void:
	var deadline=Time.get_ticks_msec()+10000
	while game.world!=null and (game.view.surface_thread!=null or not game.world.surface_pending_cells.is_empty() or not game.view.pending_terrain_uploads.is_empty() or not game.view.pending_rows.is_empty() or not game.view.canopy_dirty.is_empty()) and Time.get_ticks_msec()<deadline:
		await process_frame

func click(control: Control) -> void:
	await process_frame
	var motion = InputEventMouseMotion.new()
	motion.position = control.get_global_rect().get_center()
	root.push_input(motion,true)
	await process_frame
	var event = InputEventMouseButton.new()
	event.position = control.get_global_rect().get_center()
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = true
	# Keep the down/up pair in one dispatch cycle.
	root.push_input(event,true)
	event = event.duplicate()
	event.pressed = false
	root.push_input(event,true)
	await process_frame

func find_button(node: Node, text: String) -> Button:
	if node is Button and node.text == text: return node
	for child in node.get_children():
		var result = find_button(child,text)
		if result != null: return result
	return null

func fit(node: Node) -> void:
	if node is Button and node.is_visible_in_tree():
		var rect = node.get_global_rect()
		var fits_x=rect.position.x>=-1 and rect.end.x<=game.size.x+1
		var fits_y=rect.position.y>=-1 and rect.end.y<=game.size.y+1
		var ancestor=node.get_parent()
		while ancestor!=null:
			if ancestor is ScrollContainer:
				var viewport=ancestor.get_global_rect()
				if ancestor.horizontal_scroll_mode!=ScrollContainer.SCROLL_MODE_DISABLED: fits_x=rect.size.x<=viewport.size.x
				if ancestor.vertical_scroll_mode!=ScrollContainer.SCROLL_MODE_DISABLED: fits_y=rect.size.y<=viewport.size.y
			ancestor=ancestor.get_parent()
		check(fits_x and fits_y,"Button fits its window or scrollable region: "+node.text+node.tooltip_text)
	for child in node.get_children(): fit(child)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var directory = "user://test-runs/interface-%d" % Time.get_ticks_usec()
	Save.directory = directory
	Preferences.path = directory+"/interface.cfg"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	await capture("30-storybook-startup")
	while game.loading != null: await process_frame
	await capture("31-storybook-title")
	await click(find_button(game.title_screen,"创 造 世 界"))
	await capture("32-storybook-new-world")
	fit(game.modal)
	await click(find_button(game.modal,"让世界诞生"))
	check(game.loading != null,"New world uses real loading")
	await capture("33-storybook-loading")
	while game.loading != null: await process_frame
	game._toggle_pause()
	check(game.selected_category == -1 and game.home_content.visible and not game.tool_grid.visible,"New world starts in home toolbar")
	check(game.view.position.y == 0,"World fills the removed top bar")
	await capture("34-storybook-home")
	fit(game.hud)
	var pause_rect = game.pause_button.get_global_rect()
	var speed_rect = game.speed_button.get_global_rect()
	for category in [0,1]:
		await click(game.group_buttons[category])
		check(game.selected_category == category and game.back_button.visible and not game.home_content.visible,"Tab opens its category")
		check(game.pause_button.get_global_rect() == pause_rect and game.speed_button.get_global_rect() == speed_rect,"Time controls remain in same location")
		fit(game.hud)
		await capture("35-storybook-category-%d" % category)
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	check(game.power_panel.visible and game.brush_button.is_visible_in_tree(),"Brush belongs to current power")
	await click(game.back_button)
	check(game.selected_category == -1 and game.selected_tool == World.TREE_FERTILIZER,"Back keeps selected power")
	await click(game.brush_button)
	await capture("47-brush-picker")
	await click(game.brush_options[17])
	check(game.view.radius == 7 and game.view.brush_shape == 2,"Power brush changes actual radius")
	await click(game.speed_button)
	await capture("36-storybook-hourglass")
	await click(game.speed_value_button)
	await click(game.speed_choices[2])
	check(game.time_speed == 3 and game.paused and game.selected_tool == World.TREE_FERTILIZER,"Speed keeps pause and power")
	await click(game.observation_button)
	await capture("37-storybook-observation")
	check(game.observation_panel.get_global_rect().end.y < game.group_buttons[0].get_global_rect().position.y,"Observation popup stays above category tabs")
	await click(find_button(game.observation_panel,"近景"))
	check(game.view.distance_name() == "近景","Observation shortcut changes map distance")
	await click(game.observation_button)
	await click(game.plants_toggle)
	check(not game.view.show_plants and not Preferences.read().plants,"Plant visibility has an effect and persists")
	await click(game.plants_toggle)
	await click(game.power_close)
	check(game.selected_tool == -1 and not game.power_panel.visible,"Close clears power and brush panel")
	game.observation_panel.hide()
	await click(game.settings_button)
	check(game.modal != null,"Settings opens a real panel")
	await capture("38-storybook-settings")
	fit(game.modal)
	await click(game.fullscreen_toggle)
	await create_timer(.2).timeout
	check(DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN and Preferences.read().fullscreen,"Fullscreen changes window mode and persists")
	await click(game.fullscreen_toggle)
	await create_timer(.2).timeout
	check(DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_WINDOWED and not Preferences.read().fullscreen,"Windowed mode can be restored")
	game.view.set_distance(2)
	var zoom_before: float = game.view.zoom
	var anchor_before: Vector2 = (game.view.size/2-game.view.camera)/game.view.zoom
	await click(game.scale_buttons[2])
	check(is_equal_approx(game.ui_scale,1.15) and is_equal_approx(Preferences.read().scale,1.15),"Interface scale changes and persists")
	check(is_equal_approx(game.view.zoom,zoom_before) and anchor_before.distance_to((game.view.size/2-game.view.camera)/game.view.zoom)<.1,"Interface sizing preserves map observation")
	game._close_modal()
	await process_frame
	fit(game.hud)
	await click(game.group_buttons[1])
	fit(game.hud)
	await capture("39-storybook-large-ui")
	DisplayServer.window_set_size(Vector2i(1100,720))
	await create_timer(.3).timeout
	fit(game.hud)
	await capture("40-storybook-small-window")
	await click(game.back_button)
	fit(game.hud)
	await capture("45-storybook-small-home")
	game._open_new_world()
	await process_frame
	fit(game.modal)
	await capture("41-storybook-small-new-world")
	game._close_modal()
	game._set_ui_scale(1.0)
	game._select_category(-1)
	game._open_slots(true)
	await capture("42-storybook-save")
	await click(game.slot_buttons[0])
	check(game.modal == null and FileAccess.file_exists(Save.path(1)),"Clicking an empty save card writes the world")
	check(game.toast_label.get_global_rect().size.x < game.size.x*.6,"Save feedback is a compact toast, not a top status bar")
	game._open_slots(false)
	await capture("43-storybook-load")
	await click(game.slot_buttons[0])
	check(game.modal == null and game.world != null,"Clicking a saved world card loads it")
	game._open_slots(true)
	await click(game.slot_buttons[0])
	check(find_button(game.modal,"覆盖保存") != null,"Existing world card requires overwrite confirmation")
	await capture("46-storybook-confirm")
	await click(find_button(game.modal,"取消"))
	var old_terrain = game.world.terrain.duplicate()
	for code in [KEY_Z,KEY_Y]:
		var event = InputEventKey.new()
		event.keycode = code
		event.ctrl_pressed = true
		event.pressed = true
		root.push_input(event,true)
		await process_frame
	check(game.world.terrain == old_terrain,"Removed undo/redo shortcuts do not alter world")
	game._open_help()
	await capture("44-storybook-help")
	fit(game.modal)
	var report = FileAccess.open("res://test-output/interface-report.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks":checks,"failures":failures}))
	report.close()
	print("AEON VALE INTERFACE: %d checks, %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
