extends "res://tests/weather_runtime.gd"

func film(seconds: float) -> void:
	for n in int(seconds*30):
		await process_frame; await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/film14/frame-%05d.png"%film_frame)
		film_frame+=1

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/film14")
	Save.directory="user://test-runs/earth-film-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1440,900)); await process_frame
	await film(.8)
	var w=Fixtures.empty({"width":144,"height":96,"seed":7193,"trees":0})
	w.weather_enabled=false; w.spread_enabled=false; w.biomes.fill(World.MARSH)
	for center in [Vector2i(28,48),Vector2i(112,48)]:
		w.begin_stroke(); w.paint(center,16,World.COMBO_TOOLS+World.BIRCH); w.end_stroke()
	w.prepare_ecology(); World.Landscape.populate(w,.8,Callable()); w.image=w.bake_image()
	setup_world(w); game._select_category(0); focus_cell(Vector2(72,48),3.5)
	await click(game.tool_buttons[World.GRASS]); game.view.radius=5
	await held(game.view.camera+Vector2(38,48)*World.TILE*game.view.zoom,true)
	for x in range(38,107):
		var motion=InputEventMouseMotion.new(); motion.position=game.view.camera+Vector2(x,48)*World.TILE*game.view.zoom
		motion.button_mask=MOUSE_BUTTON_MASK_LEFT; root.push_input(motion,true); await film(1.0/30)
	await held(game.view.camera+Vector2(106,48)*World.TILE*game.view.zoom,false)
	game._select_tool(-1); await film(1.3)
	game._select_category(1); await process_frame
	await click(game.tool_buttons[World.BIOME_TOOLS+World.MEADOW]); game.view.radius=4
	for x in range(44,101,3):
		await cast(game.view.camera+Vector2(x,48)*World.TILE*game.view.zoom); await film(.10)
	game._select_tool(-1); await film(1.2)
	# Two original uniform-forest fixtures show opposite displacement directions.
	for rising in [false,true]:
		var seed=1
		while (World.hash_cell(72,48,seed)%2==0)!=rising: seed+=1
		w=Fixtures.empty({"width":144,"height":96,"seed":seed,"trees":0})
		w.terrain.fill(World.FOREST); w.biomes.fill(World.BIRCH); w.elevation.fill(.17)
		w.prepare_ecology(); World.Landscape.populate(w,.9,Callable()); w.image=w.bake_image()
		w.weather_enabled=false; w.spread_enabled=false
		setup_world(w); game._select_category(1); focus_cell(Vector2(72,48),3.2)
		await click(game.tool_buttons[World.EARTHQUAKE]); game.view.radius=16
		await film(.5); await cast(game.view.size/2); await film(2.3)
	# Rain remains readable at close range, then clouds return on zooming out.
	w=World.generate({"width":192,"height":128,"seed":781936,"trees":.9})
	w.weather_enabled=false; setup_world(w); game._select_category(1)
	focus_cell(Vector2(96,64),7)
	await click(game.tool_buttons[World.RAIN]); game.view.radius=14; await cast(game.view.size/2)
	game.paused=false; game._update_pause_buttons(); await film(1.5)
	game._select_tool(-1); focus_cell(Vector2(96,64),2.2); await film(1.5)
	print("EARTH FILM: %d frames at 1440x900 / 30 fps"%film_frame)
	quit()
