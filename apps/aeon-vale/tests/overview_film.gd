extends "res://tests/weather_runtime.gd"

func frames(count: int) -> void:
	for n in count:
		await process_frame; await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/film15/frame-%05d.png"%film_frame)
		film_frame+=1

func zoom_step(up: bool) -> void:
	var event=InputEventMouseButton.new(); event.position=game.view.size/2
	event.button_index=MOUSE_BUTTON_WHEEL_UP if up else MOUSE_BUTTON_WHEEL_DOWN; event.pressed=true
	root.push_input(event,true); event=event.duplicate(); event.pressed=false; root.push_input(event,true)
	await frames(8)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/film15")
	Save.directory="user://test-runs/overview15-film-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1440,900)); await process_frame
	var w=World.generate({"width":384,"height":256,"seed":350351710,"trees":.8})
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	World.Weather.add_fair_cloud(w)
	w.fair_clouds[-1].x=114; w.fair_clouds[-1].y=156; w.fair_clouds[-1].life-=12
	game.paused=false; game._update_pause_buttons()
	await frames(70)
	game._select_category(1); await process_frame
	await click(game.tool_buttons[World.TREE_FERTILIZER]); game.view.radius=18
	var target=Vector2(218,112)
	var point=game.view.camera+target*World.TILE*game.view.zoom
	await cast(point); await frames(50)
	await click(game.tool_buttons[World.RAIN]); game.view.radius=26
	await cast(point); await frames(60)
	game._select_tool(-1); game._select_category(-1)
	var event=InputEventKey.new(); event.keycode=KEY_D; event.physical_keycode=KEY_D; event.pressed=true
	Input.parse_input_event(event); await frames(16)
	event=event.duplicate(); event.pressed=false; Input.parse_input_event(event)
	for n in 11: await zoom_step(true)
	await frames(50)
	for n in 11: await zoom_step(false)
	await frames(60)
	print("OVERVIEW FILM FRAMES: "+str(film_frame)); quit()
