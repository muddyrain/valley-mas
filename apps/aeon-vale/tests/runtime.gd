extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
var game
var failures: Array[String] = []
var checks: int = 0
var metrics: Dictionary = {}

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func capture(name: String) -> void:
	var deadline=Time.get_ticks_msec()+10000
	while game.world!=null and (game.view.surface_thread!=null or not game.world.surface_pending_cells.is_empty() or not game.view.pending_terrain_uploads.is_empty() or not game.view.pending_rows.is_empty() or not game.view.canopy_dirty.is_empty()) and Time.get_ticks_msec()<deadline:
		await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/" + name + ".png")

func click_control(control: Control) -> void:
	# Wait for container layout before deriving pointer coordinates from a new dialog.
	await process_frame
	await RenderingServer.frame_post_draw
	await click_point(control.get_global_rect().get_center())

func click_point(point: Vector2) -> void:
	# Include pointer motion so resized windows update hover/focus before a click.
	var motion = InputEventMouseMotion.new()
	motion.position = point
	root.push_input(motion,true)
	await process_frame
	var press = InputEventMouseButton.new()
	press.position = point
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	root.push_input(press,true)
	# Dispatch a click atomically; the offscreen desktop pointer must not cancel
	# the synthetic press between down/up. Held-input tests use separate events.
	var release = press.duplicate()
	release.pressed = false
	root.push_input(release,true)
	await process_frame

func key(code: Key, ctrl: bool = false) -> void:
	var event = InputEventKey.new()
	event.keycode = code
	event.ctrl_pressed = ctrl
	event.pressed = true
	root.push_input(event,true)
	await process_frame
	event = event.duplicate()
	event.pressed = false
	root.push_input(event,true)
	await process_frame

func find_button(node: Node, text: String) -> Button:
	if node is Button and node.text == text: return node
	for child in node.get_children():
		var result = find_button(child, text)
		if result != null: return result
	return null

func check_buttons_fit(node: Node) -> void:
	if node is Button and node.is_visible_in_tree():
		var rect = node.get_global_rect()
		check(rect.position.x >= -1 and rect.position.y >= -1 and rect.end.x <= game.size.x + 1 and rect.end.y <= game.size.y + 1, "Visible button fits viewport: " + node.text + node.tooltip_text)
	for child in node.get_children(): check_buttons_fit(child)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var ignore_file = FileAccess.open("res://test-output/.gdignore", FileAccess.WRITE)
	ignore_file.close()
	Save.directory = "user://test-runs/runtime-%d" % Time.get_ticks_usec()
	preload("res://scripts/ui_preferences.gd").path = Save.directory + "/interface.cfg"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	check(game.loading != null, "Cold start displays asset preparation")
	await capture("00-startup")
	while game.loading != null: await process_frame
	check(game.title_screen.visible and game.previews.size() == 8, "Cold start finishes with all eight world previews")
	if "--polish-only" in OS.get_cmdline_user_args():
		game.world = World.generate({"width":288,"height":192,"seed":48217,"trees":0.85,"rivers":true})
		game.view.set_world(game.world)
		game.title_screen.hide()
		game.hud.show()
		game.view.show()
		await verify_polish()
		await capture_catalog()
		var visual_report = FileAccess.open("res://test-output/polish-report.json",FileAccess.WRITE)
		visual_report.store_string(JSON.stringify({"checks":checks,"failures":failures}))
		visual_report.close()
		print("AEON VALE VISUAL: %d checks, %d failures" % [checks,failures.size()])
		quit(0 if failures.is_empty() else 1)
		return
	await capture("01-title")
	await click_control(find_button(game.title_screen, "创 造 世 界"))
	check(game.modal != null, "Title button opens new-world dialog through input dispatch")
	await create_timer(0.3).timeout
	await capture("02-new-world")
	check_buttons_fit(game.modal)
	await click_control(game.template_buttons["donut"])
	check(game.selected_template == "donut", "Template button changes selection")
	await click_control(game.template_buttons["continent"])
	var started = Time.get_ticks_usec()
	await click_control(find_button(game.modal, "让世界诞生"))
	check(game.loading != null, "Create action enters real generation loading")
	await capture("03-loading")
	var generation_frames = 0
	while game.loading != null:
		generation_frames += 1
		await process_frame
	metrics.generation_seconds = (Time.get_ticks_usec() - started) / 1000000.0
	metrics.generation_rendered_frames = generation_frames
	check(generation_frames > 2 and game.world != null and game.view.visible, "Generation leaves the render loop responsive and reveals a playable world")
	# Test real creation above; use a fixed, separately generated fixture for sprite coverage.
	game.world=World.generate({"width":288,"height":192,"seed":781936,"trees":.8,"rivers":true})
	game.view.set_world(game.world); game._update_status()
	await create_timer(.3).timeout
	var empty_sprite_bounds = 0
	for entry in game.view.plant_draws:
		if entry[1].size.x <= 0 or entry[1].size.y <= 0: empty_sprite_bounds += 1
	check(empty_sprite_bounds == 0, "Every plant, including narrow snow pines and cacti, has nonzero rendered bounds")
	check(game.world.plants.has(4) and game.world.plants.has(10), "The rendering fixture contains snow pines and desert cacti")
	game._toggle_pause()
	await capture("04-world")
	var toolbar_size = game.group_buttons[0].get_global_rect().size
	var focus = game.view.size * 0.5
	var anchor = (focus - game.view.camera) / game.view.zoom
	game.view.zoom_at(focus, 2.4)
	check(anchor.distance_to((focus - game.view.camera) / game.view.zoom) < 0.01, "Zoom keeps the pointed world location stationary")
	await click_control(game.group_buttons[1])
	await capture("05-middle")
	check(game.tool_grid.get_child_count() == 4 and game.tool_buttons.size() == World.BIOME_NAMES.size()+9, "Nature tools group temperature, disasters, ecology seeds and fertilizers")
	check_tool_contents()
	game.view.set_distance(2)
	await capture("05-close-up")
	check(game.view.distance_name() == "近景", "Close view exposes the near observation distance")
	check(game.group_buttons[0].get_global_rect().size == toolbar_size and game.distance_label.text == "近景", "Toolbar geometry stays fixed while the distance label updates immediately")
	game.view.fit_world()
	await click_control(game.group_buttons[0])
	if not game.tool_buttons.has(World.BEACH):
		check(false,"Terrain category click must finish before accessing its controls")
		await capture("runtime13-category-failure")
		print("CATEGORY FAILURE: "+JSON.stringify({"category":game.selected_category,"modal":game.modal!=null,"button":str(game.group_buttons[0].get_global_rect()),"tools":game.tool_buttons.keys()}))
		quit(1); return
	await click_control(game.tool_buttons[World.BEACH])
	check(game.view.tool == World.BEACH, "Terrain tool selection reaches the map input controller")
	var before = game.world.terrain.duplicate()
	var start = game.view.global_position + game.view.camera + Vector2(game.world.width * 0.52, game.world.height * 0.58) * World.TILE * game.view.zoom
	var event = InputEventMouseButton.new()
	event.position = start
	event.button_index = MOUSE_BUTTON_LEFT
	event.pressed = true
	root.push_input(event,true)
	await process_frame
	var painting_start = Time.get_ticks_usec()
	var last = start
	for i in range(1, 13):
		var motion = InputEventMouseMotion.new()
		motion.position = start + Vector2(i * 7, sin(i * 0.3) * 15)
		motion.relative = motion.position - last
		motion.button_mask = MOUSE_BUTTON_MASK_LEFT
		last = motion.position
		root.push_input(motion,true)
		await process_frame
	metrics.drag_12_frames_seconds = (Time.get_ticks_usec() - painting_start) / 1000000.0
	event = event.duplicate()
	event.position = last
	event.pressed = false
	root.push_input(event,true)
	await process_frame
	check(game.world.terrain != before and game.world.undo_stack.size() == 1, "A mouse drag paints terrain and commits exactly one undo record")
	await capture("06-edited")
	var painted = game.world.terrain.duplicate()
	await key(KEY_Z, true)
	check(game.world.terrain == painted, "Removed Ctrl+Z leaves the painted world unchanged")
	await key(KEY_Y, true)
	check(game.world.terrain == painted, "Removed Ctrl+Y leaves the painted world unchanged")
	await key(KEY_SPACE)
	await key(KEY_SPACE)
	var age = game.world.age
	var animation_time = game.view.clock_time
	await create_timer(0.25).timeout
	check(game.paused and game.world.age == age and game.view.clock_time == animation_time, "Pause stops world time and ambient animation")
	await key(KEY_SPACE)
	await click_control(game.speed_button)
	await click_control(game.speed_value_button)
	await click_control(game.speed_choices[1])
	check(game.time_speed == 2 and game.view.speed == 2, "Time speed button affects world and ambient time")
	await key(KEY_S, true)
	check(game.modal != null, "Ctrl+S opens save slots")
	await capture("07-save-slots")
	game._save_to_slot(1)
	check(FileAccess.file_exists(Save.path(1)) and not game.dirty, "Real disk save succeeds in an isolated test directory")
	var saved = game.world.terrain.duplicate()
	game.world.begin_stroke()
	game.world.paint(Vector2i(40, 40), 8, World.DESERT)
	game.world.end_stroke()
	game._load_slot(1)
	check(game.world.terrain == saved, "Disk load restores the saved edits")
	check(Save.write_slot(game.world, 1) == "", "Atomic replacement of an existing save succeeds")
	var corrupt = FileAccess.open(Save.path(2), FileAccess.WRITE)
	corrupt.store_string("{invalid json")
	corrupt.close()
	var world_before_failed_load = game.world
	game._load_slot(2)
	check(game.world == world_before_failed_load, "A failed load preserves the current world")
	game.dirty = true
	game._open_new_world()
	game._submit_new_world()
	check(find_button(game.modal, "取消") != null, "Replacing an edited world requires an in-game decision")
	await click_control(find_button(game.modal, "取消"))
	check(game.world == world_before_failed_load and game.loading == null, "Cancel keeps the edited world intact")
	DisplayServer.window_set_size(Vector2i(1100, 720))
	await create_timer(0.3).timeout
	game._open_new_world()
	await create_timer(0.2).timeout
	check_buttons_fit(game.modal)
	await capture("08-small-window")
	game._close_modal()
	game.toast_label.visible = false
	game.toast_time = 0
	check_buttons_fit(game.hud)
	await capture("09-small-world")
	await click_control(game.group_buttons[1])
	check(game.selected_category == 1, "Scaled-window pointer input reaches the selected category")
	check_buttons_fit(game.hud)
	check_tool_contents()
	await capture("09-small-nature")
	DisplayServer.window_set_size(Vector2i(1440, 900))
	await create_timer(0.2).timeout
	await verify_living_world()
	await verify_large_world()
	await verify_polish()
	await capture_catalog()
	metrics.checks = checks
	metrics.failures = failures
	metrics.renderer = RenderingServer.get_video_adapter_name()
	var report = FileAccess.open("res://test-output/runtime-report.json", FileAccess.WRITE)
	report.store_string(JSON.stringify(metrics, "\t"))
	report.close()
	print("AEON VALE RUNTIME: ", JSON.stringify(metrics))
	quit(0 if failures.is_empty() else 1)

func check_tool_contents() -> void:
	var clipped: Array[String] = []
	for item in game.tool_buttons.values():
		var bounds: Rect2 = item.get_global_rect().grow(1)
		for content in item.get_child(0).get_children():
			if not bounds.encloses(content.get_global_rect()): clipped.append(item.tooltip_text)
	check(clipped.is_empty(), "Tool captions and artwork fit inside their buttons: " + ", ".join(clipped))

func verify_living_world() -> void:
	# A real editable world is prepared empty, then advanced by the same simulation used in play.
	if not game.paused: game._toggle_pause()
	var garden = Fixtures.empty({"width": 192, "height": 64, "seed": 5381,  "trees": 0})
	for biome in World.BIOME_NAMES.size():
		garden.begin_stroke()
		garden.paint(Vector2i(12 + biome * 12, 32), 11, World.HILLS if biome == 3 else World.FOREST)
		garden.paint(Vector2i(12 + biome * 12, 32), 11, World.BIOME_TOOLS + biome)
		garden.end_stroke()
	garden.undo_stack.clear()
	game.world = garden
	game.view.set_world(garden)
	game.view.set_distance(1)
	game._update_status()
	check(garden.plant_count() == 0, "The live-growth scene starts with genuinely empty habitats")
	await capture("10-ecology-empty")
	var began = Time.get_ticks_usec()
	for n in int(World.YEAR_SECONDS*6):
		garden.advance(1)
		game.view.refresh_ecology()
		if n in [11, 44, 119]:
			game._update_status()
			await capture("11-ecology-%03d-seconds" % (n + 1))
		await process_frame
	metrics.ecology_six_years_rendered_seconds = (Time.get_ticks_usec() - began) / 1000000.0
	check(garden.plant_count() > 80 and garden.life_counts().adult > 0, "Visible habitats develop real mature plants through simulation")
	var oak = -1
	for i in garden.plants.size():
		if World.is_tree(garden.plants[i]) and garden.plants[i]!=9 and garden.plant_stage[i] in [World.ADULT,World.OLD]:
			oak = i
			break
	check(oak >= 0, "Growth produced an adult tree for the interaction test")
	if oak >= 0:
		var tree_species=garden.plants[oak]
		var cell = Vector2i(oak % garden.width, oak / garden.width)
		game.view.zoom_at(game.view.size / 2, 6.0 / game.view.zoom)
		game.view.camera = game.view.size / 2 - Vector2(cell) * World.TILE * game.view.zoom
		game.view.queue_redraw()
		await click_control(game.group_buttons[0])
		check(game.tool_buttons.has(World.BEACH),"Terrain category opens before the habitat interaction")
		if not game.tool_buttons.has(World.BEACH):
			await capture("runtime-category-failed")
			return
		await click_control(game.tool_buttons[World.BEACH])
		check(game.selected_tool == World.BEACH,"Habitat interaction selected beach after window resizing")
		game.view.radius = 2
		await capture("12-before-wither")
		await click_point(game.view.global_position + game.view.camera + (Vector2(cell) * World.TILE + Vector2(2,2)) * game.view.zoom)
		check(garden.plant_stage[oak] == World.DEAD and game.view.transitions.has(oak), "Real brush input immediately starts a dead-tree transition")
		await capture("13-wither-transition")
		await create_timer(1.4).timeout
		check(not game.view.transitions.has(oak) and garden.plant_stage[oak] == World.DEAD, "Transition animation ends while the dead tree remains in the world")
		await capture("14-dead-tree")
		garden.advance(World.DEAD_SECONDS+1)
		game.view.refresh_ecology()
		await create_timer(0.8).timeout
		check(garden.plants[oak] != tree_species, "Dead tree decays after its world-time interval")
		await capture("15-regrowth-space")
	var reference = Save.decode(Save.encode(garden)).world
	var starting_tick = garden.eco_tick
	var starting_age = garden.age
	game.time_speed = 5
	game._update_pause_buttons()
	game._toggle_pause()
	var max_frame_ms = 0.0
	while garden.eco_tick < starting_tick + 10:
		var frame_started = Time.get_ticks_usec()
		await process_frame
		max_frame_ms = maxf(max_frame_ms, (Time.get_ticks_usec() - frame_started) / 1000.0)
	game._toggle_pause()
	reference.advance(garden.age-starting_age)
	check(garden.plants == reference.plants and garden.plant_stage == reference.plant_stage and garden.plant_age == reference.plant_age, "Five-times live play produces the same ecology as fixed world-time steps regardless of camera")
	metrics.live_5x_max_frame_ms = max_frame_ms
	var seed_site = -1
	for i in garden.plants.size():
		if garden.plants[i] > 0 and World.is_tree(garden.plants[i]) and garden.plant_stage[i] < World.ADULT:
			seed_site = i
			break
	check(seed_site >= 0,"Natural regeneration supplies a young tree for fertilizer")
	if seed_site >= 0:
		game.view.radius = 0
		game.view.zoom = 5
		var cell = Vector2(seed_site%garden.width,seed_site/garden.width)
		var point = game.view.size/2
		game.view.camera = point-(cell*World.TILE+Vector2(2,2))*5
		game.view.queue_redraw()
		await click_control(game.group_buttons[1])
		await click_control(game.tool_buttons[World.TREE_FERTILIZER])
		await click_point(point)
		check(garden.plant_stage[seed_site]==World.ADULT and game.view.transitions.has(seed_site),"Fertilizer input matures a natural seedling with visible feedback")
		await capture("17-fertilizer")
		garden.advance(40)
		game.view.refresh_ecology()
		check(garden.plant_stage[seed_site] == World.ADULT,"Fertilized natural seedling becomes adult")
		await capture("18-fertilized-tree")
	game._select_tool(-1)

func verify_large_world() -> void:
	if not game.paused: game._toggle_pause()
	var large = World.generate({"width": 384, "height": 256, "seed": 48217, "trees": 0.85, "rivers": true})
	game.world = large
	game.view.set_world(large)
	game.time_speed = 5
	game._update_pause_buttons()
	game._toggle_pause()
	var frames: Array[float] = []
	while large.eco_tick < 60:
		var start = Time.get_ticks_usec()
		await process_frame
		frames.append((Time.get_ticks_usec() - start) / 1000.0)
	game._toggle_pause()
	frames.sort()
	metrics.large_world_plants = large.plant_count()
	metrics.large_world_5x_p95_ms = frames[int(frames.size() * 0.95)]
	metrics.large_world_5x_max_ms = frames[-1]
	var cpu_started = Time.get_ticks_usec()
	large.advance(1)
	metrics.large_world_simulation_cpu_ms = (Time.get_ticks_usec() - cpu_started) / 1000.0
	cpu_started = Time.get_ticks_usec()
	game.view.refresh_ecology()
	metrics.large_world_rebuild_cpu_ms = (Time.get_ticks_usec() - cpu_started) / 1000.0
	check(large.eco_tick >= 60 and game.view.plant_draws.size() >= large.plant_count(), "Large worlds advance through five spread cycles and keep plants in sync")
	game._update_status()
	await capture("19-large-world")

func move_pointer(point: Vector2) -> void:
	var motion = InputEventMouseMotion.new()
	motion.position = point
	root.push_input(motion,true)
	await process_frame
	await process_frame

func verify_polish() -> void:
	if not game.paused: game._toggle_pause()
	game.view.radius = 4
	game.toast_label.hide()
	game.toast_time = 0
	game.view.set_distance(1)
	await click_control(game.group_buttons[1])
	await click_control(game.tool_buttons[World.TREE_FERTILIZER])
	check(game.power_panel.visible and game.power_name.text == "树木肥料", "Selected power appears above the toolbar")
	var old_age: float = game.world.age
	for value in range(1,6):
		await click_control(game.speed_button)
		check(game.speed_panel.visible and game.speed_value_button.visible and not game.speed_options_row.visible, "Hourglass starts with the current multiplier")
		await click_control(game.speed_value_button)
		await click_control(game.speed_choices[value-1])
		check(game.time_speed == value and game.selected_tool == World.TREE_FERTILIZER and game.paused and not game.speed_panel.visible, "Changing speed preserves the current power and pause")
	check(game.world.age == old_age, "Selecting a speed does not resume a paused world")
	await click_control(game.speed_button)
	await capture("20-hourglass")
	await click_control(game.speed_panel.find_child("CloseTime",true,false))
	check(game.time_speed == 5 and game.selected_tool == World.TREE_FERTILIZER, "Closing speed choices preserves speed and power")
	await click_control(game.group_buttons[0])
	check(game.selected_tool == World.TREE_FERTILIZER, "Browsing another category preserves current power")
	await click_control(game.tool_buttons[World.GRASS])
	game.view.set_distance(2)
	await move_pointer(game.view.global_position + game.view.size / 2)
	await capture("21-power-preview")
	check(game.view.preview_visible() and game.view.preview_cells.size() > 0 and game.view.tool_icon != null, "Terrain power shows icon and cell-accurate preview")
	await move_pointer(game.power_close.get_global_rect().get_center())
	await capture("22-pointer-over-panel")
	check(not game.view.preview_visible(), "Overlay controls hide map preview and cannot paint through")
	await click_control(game.power_close)
	check(game.selected_tool == -1 and not game.power_panel.visible and not game.view.preview_visible(), "Close cancels current power and returns to observation")
	await click_control(game.group_buttons[1])
	var seeds = 0
	var individuals = 0
	for tool in game.tool_buttons:
		if tool >= World.BIOME_TOOLS and tool < World.BIOME_TOOLS+World.BIOME_NAMES.size(): seeds += 1
		if tool >= World.PLANT_TOOLS and tool < World.PLANT_TOOLS+World.Catalog.MAX_ID: individuals += 1
	check(seeds == World.BIOME_NAMES.size() and individuals == 0,"Ecology seeds replace individual tree sowing")
	check_tool_contents()
	check_buttons_fit(game.hud)
	await capture("23-ecology-seeds")
	for dimensions in World.MAP_SIZES:
		var map = World.generate({"width":dimensions.x,"height":dimensions.y,"seed":48217,"trees":0.85,"rivers":true})
		game.world = map
		game.view.set_world(map)
		check(game.view.distance_name() == "远景" and game.distance_label.text == "远景" and game.view.overview_weight() == 1.0, "Fit uses true overview at map width %d" % dimensions.x)
		await capture("24-overview-%d" % dimensions.x)
	game.view.set_distance(2)
	game.view.show_plants = false
	await capture("25-ground-only")
	game.view.show_plants = true
	await capture("26-detailed-forest")

func capture_catalog() -> void:
	var sheet = ColorRect.new()
	sheet.color = Color("f7f3e4")
	sheet.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	game.add_child(sheet)
	var heading = game.label("纪元谷 · 草木图鉴",24,game.GOLD)
	heading.position = Vector2(40,14)
	sheet.add_child(heading)
	var index = 0
	for species in range(1,World.Catalog.MAX_ID+1):
		if not World.Catalog.valid(species): continue
		var position = Vector2(42+(index%8)*174,60+(index/8)*136)
		for variation in 3:
			var picture = TextureRect.new()
			picture.texture = game.View.Flora.texture(species,World.ADULT,variation)
			picture.position = position + Vector2(variation*45,0)
			picture.size = Vector2(60,88)
			picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			picture.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			sheet.add_child(picture)
		var name_label = game.label(World.Catalog.NAMES[species-1],13,game.CREAM)
		name_label.position = position + Vector2(35,90)
		sheet.add_child(name_label)
		index += 1
	await capture("27-plant-catalog")
	sheet.queue_free()
	await process_frame
