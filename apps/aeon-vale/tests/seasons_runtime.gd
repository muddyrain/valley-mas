extends "res://tests/interface.gd"

var metrics: Dictionary = {}

func pointer(point: Vector2) -> void:
	var motion = InputEventMouseMotion.new()
	motion.position = point
	root.push_input(motion,true)
	await process_frame
	await process_frame

func cast(point: Vector2) -> void:
	await pointer(point)
	var event = InputEventMouseButton.new()
	event.button_index = MOUSE_BUTTON_LEFT
	event.position = point
	event.pressed = true
	root.push_input(event,true)
	event = event.duplicate(); event.pressed = false
	root.push_input(event,true)
	await process_frame

func setup_world(w) -> void:
	game.world = w
	game.view.set_world(w)
	game.title_screen.hide(); game.hud.show(); game.view.show()
	game.paused = true
	game._update_pause_buttons()

func run() -> void:
	Save.directory = "user://test-runs/seasons-runtime-%d" % Time.get_ticks_usec()
	Preferences.path = Save.directory+"/interface.cfg"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	while game.loading != null: await process_frame
	setup_world(World.generate({"width":192,"height":128,"seed":48217,"trees":.85}))
	for tab in game.group_buttons: check(tab.text.is_empty() and not tab.tooltip_text.is_empty(),"Category is an icon with hover description")
	await click(game.group_buttons[2])
	check(game.future_buttons.size() >= 10,"Future creatures have explicit reserved entries")
	for item in game.future_buttons: check(item.disabled and "尚未开放" in item.tooltip_text,"Future power is visibly unavailable")
	await capture("50-future-creatures")
	await click(game.group_buttons[1])
	check(game.future_buttons.size() == 2 and game.tool_buttons.size() == 27,"Nature contains two future temperatures and 27 working tools")
	await capture("51-nature-toolbar")
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	await process_frame
	check(game.brush_button.get_global_rect().end.y < game.power_panel.get_global_rect().position.y,"Brush button sits above the vertical power card")
	var power_left: float = game.power_panel.get_global_rect().position.x
	await click(game.speed_button)
	check(not game.power_panel.visible and not game.brush_button.visible and game.view.casting_locked and not game.view.interaction_locked,"Speed picker temporarily occupies the power slot and locks casting while allowing camera input")
	check(game.speed_panel.get_global_rect().position.x == power_left,"Time and power share the left edge")
	await capture("52-left-hourglass")
	await click(game.speed_panel.find_child("CloseTime",true,false))
	check(game.selected_tool == World.TREE_FERTILIZER and game.power_panel.visible and not game.view.interaction_locked,"Closing hourglass restores the selected power")
	await click(game.speed_button)
	game._open_settings()
	check(game.modal != null and not game.speed_panel.visible and game.view.interaction_locked,"Opening settings closes the time picker and keeps modal input locked")
	game._close_modal()
	check(game.power_panel.visible and not game.view.interaction_locked,"Closing settings restores the active power without an invisible lock")
	await click(game.brush_button)
	check(game.brush_options.size() == 25,"Picker has ten circles and five squares, diamonds and sprays")
	fit(game.modal)
	await capture("53-four-brush-families")
	await click(game.brush_options[22])
	check(game.view.brush_shape == 3 and game.view.radius == 8 and game.modal == null,"Spray selection updates the actual map brush")
	await click(game.back_button)
	check(game.selected_tool == World.TREE_FERTILIZER and game.brush_button.visible,"Back preserves power and brush")
	await ecology_gallery()
	await verify_casting()
	await verify_live_time()
	var report = {"checks":checks,"failures":failures,"metrics":metrics}
	var file = FileAccess.open("res://test-output/seasons-runtime-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report)); file.close()
	print("AEON VALE SEASONS RUNTIME: "+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func ecology_gallery() -> void:
	var w = World.generate({"width":210,"height":112,"template":"ocean","seed":5912,"trees":0})
	# Authored inspection garden. Every patch is seeded through actual game input below.
	for row in 2:
		for col in 7:
			w.begin_stroke()
			w.paint(Vector2i(15+col*30,28+row*56),13,World.GRASS,1)
			w.end_stroke()
	setup_world(w)
	game.view.radius = 13; game.view.brush_shape = 1
	await click(game.group_buttons[1])
	for biome in 14:
		var cell = Vector2i(15+(biome%7)*30,28+(biome/7)*56)
		await click(game.tool_buttons[World.BIOME_TOOLS+biome])
		var point = game.view.camera+(Vector2(cell)*World.TILE+Vector2(2,2))*game.view.zoom
		await cast(point)
		check(w.biomes[cell.y*w.width+cell.x] == biome,"Real seed input changes ecology %d" % biome)
	game._select_tool(-1)
	w.advance(World.YEAR_SECONDS*6)
	game.view.refresh_ecology()
	game._update_status()
	check(w.life_counts().trees > 50 and w.life_counts().adult > 100,"New ecology patches develop naturally into mixed vegetation")
	await capture("54-fourteen-ecologies")
	# Near view of the newly authored bamboo, flowers and mushroom canopy.
	game.view.zoom = 4.2
	game.view.camera = game.view.size/2-Vector2(160,84)*World.TILE*game.view.zoom
	game.view.queue_redraw()
	await capture("55-new-vegetation-close")
	check(Save.decode(Save.encode(w)).world != null,"All fourteen planted habitats save together")

func verify_casting() -> void:
	var w = World.generate({"width":64,"height":64,"template":"ocean","seed":12,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE)
	w.prepare_ecology(); w.advance(World.YEAR_SECONDS*6)
	w.image = w.bake_image()
	setup_world(w)
	game.view.set_distance(2)
	game.view.brush_shape = 0; game.view.radius = 5
	var center: Vector2 = game.view.size/2
	await click(game.group_buttons[0])
	for shape in 4:
		game._set_brush(shape,5)
		await click(game.tool_buttons[World.BEACH])
		await pointer(center)
		await capture("56-brush-preview-%d" % shape)
		check(game.view.preview_visible() and not game.view.preview_cells.is_empty(),"Selected brush shows preview for shape %d" % shape)
		var expected: Dictionary = {}
		for item in game.view.preview_cells: expected[item[0]] = item[1]
		var original = w.terrain.duplicate()
		await cast(center)
		var mismatch = 0
		for i in w.terrain.size():
			var cell = Vector2i(i%w.width,i/w.width)
			if (w.terrain[i] != original[i]) != bool(expected.get(cell,false)): mismatch += 1
		check(mismatch == 0,"Preview and actual brush edit agree at every cell for shape %d (%d differences, cursor %s, center %s)" % [shape,mismatch,game.view.cursor_position,center])
		w.terrain.fill(World.FOREST); w.image = w.bake_image(); game.view.refresh_edit()
	var zoom: float = game.view.zoom
	game._set_brush(0,4)
	await pointer(center)
	var wheel = InputEventMouseButton.new()
	wheel.position = center; wheel.button_index = MOUSE_BUTTON_WHEEL_UP; wheel.pressed = true; wheel.alt_pressed = true
	root.push_input(wheel,true); await process_frame
	wheel = wheel.duplicate(); wheel.pressed = false
	root.push_input(wheel,true); await process_frame
	check(game.view.radius == 6 and game.view.zoom == zoom,"Alt-wheel changes brush size while preserving camera zoom")
	await click(game.brush_button)
	check(game.modal != null and game.view.interaction_locked,"Brush button opens a modal that locks the map")
	var before = w.terrain.duplicate()
	await cast(center)
	check(w.terrain == before,"Brush modal never paints through into the world")
	game._close_modal()
	await click(game.group_buttons[1])
	# Refill by natural update; no individual sowing power is reintroduced.
	w.advance(600); game.view.refresh_ecology()
	game._set_brush(0,8)
	await click(game.tool_buttons[World.FIRE])
	await cast(center)
	check(not w.fires.is_empty(),"Actual fire power ignites vegetation")
	await capture("57-fire-cast")
	var fire_before = w.fires.duplicate()
	await create_timer(.3).timeout
	check(w.fires == fire_before,"Paused world does not advance burning")
	check(Save.write_slot(w,1).is_empty(),"Burning world can be saved")
	var restored = Save.read_slot(1).world
	check(restored != null and restored.fires == w.fires,"Saved fire returns when loading")
	w.advance(4); game.view.refresh_ecology()
	await capture("58-fire-aftermath")
	await click(game.tool_buttons[World.RAIN])
	game.view.radius = 16
	await cast(center)
	check(w.fires.is_empty(),"Actual rain power extinguishes affected fires")
	await capture("59-rain")
	await click(game.tool_buttons[World.TORNADO]); game.view.radius = 5
	await cast(center)
	check(w.tornadoes.size() == 1,"One real click creates one tornado")
	w.advance(3); game.view.refresh_ecology()
	await capture("60-tornado")
	await click(game.tool_buttons[World.EARTHQUAKE]); game.view.radius = 10
	var ground_before=w.terrain.duplicate()
	await cast(center)
	check(w.terrain!=ground_before,"Actual earthquake creates lasting terrain changes")
	await capture("61-earthquake")
	await click(game.tool_buttons[World.LIGHTNING])
	await cast(center+Vector2(-100,20))
	await capture("62-lightning")
	await click(game.power_close)
	check(game.selected_tool == -1 and not game.brush_button.visible and not game.view.preview_visible(),"Power close restores observation and removes the brush")

func verify_live_time() -> void:
	game._set_speed(1)
	var age: float = game.world.age
	var began = Time.get_ticks_usec()
	await click(game.pause_button)
	await create_timer(1.2).timeout
	await click(game.pause_button)
	var elapsed = (Time.get_ticks_usec()-began)/1000000.0
	metrics.real_seconds_1x = elapsed
	metrics.world_seconds_1x = game.world.age-age
	check(absf(game.world.age-age-elapsed)<.15,"At 1x one real second advances one world second")
	game.world.age = World.YEAR_SECONDS-1
	game.world.eco_remainder = 0
	game._update_status()
	check("第 1 年" in game.age_label.text,"Calendar stays in year one before 84 seconds")
	game.world.advance(1); game._update_status()
	check("第 2 年" in game.age_label.text,"Calendar reaches year two exactly at 84 seconds")
	await click(game.speed_button); await click(game.speed_value_button); await click(game.speed_choices[4])
	age = game.world.age; began = Time.get_ticks_usec()
	await click(game.pause_button)
	await create_timer(1.2).timeout
	await click(game.pause_button)
	elapsed = (Time.get_ticks_usec()-began)/1000000.0
	metrics.real_seconds_5x = elapsed
	metrics.world_seconds_5x = game.world.age-age
	check(absf(game.world.age-age-elapsed*5)<.6,"At 5x world and persistent disasters advance five times as fast")
