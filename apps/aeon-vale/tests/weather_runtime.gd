extends "res://tests/seasons_runtime.gd"

var recording=false
var film_frame=0

func escape() -> void:
	var event=InputEventKey.new(); event.keycode=KEY_ESCAPE; event.pressed=true
	Input.parse_input_event(event); await process_frame
	event=event.duplicate(); event.pressed=false; Input.parse_input_event(event); await process_frame

func focus_cell(cell: Vector2, level: float) -> Vector2:
	game.view.zoom=level; game.view.camera=game.view.size/2-cell*World.TILE*level
	game.view.queue_redraw(); game.view.effects.queue_redraw()
	return game.view.size/2

func held(point: Vector2, pressed: bool) -> void:
	var event=InputEventMouseButton.new(); event.position=point; event.button_index=MOUSE_BUTTON_LEFT; event.pressed=pressed
	root.push_input(event,true)
	await process_frame

func film(seconds: float) -> void:
	if not recording:
		await create_timer(seconds).timeout
		return
	for n in int(seconds*30):
		await process_frame; await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/film09/frame-%05d.png" % film_frame)
		film_frame+=1

func run() -> void:
	recording=OS.get_cmdline_user_args().has("record")
	if recording: DirAccess.make_dir_recursive_absolute("res://test-output/film09")
	Save.directory="user://test-runs/weather-native-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var island=World.generate({"width":288,"height":192,"seed":68324,"template":"continent","trees":.85})
	setup_world(island); game._select_category(-1); game._select_tool(-1)
	await capture("120-ridges-overview")
	game.view.set_distance(1); await capture("121-ridges-middle")
	game.view.set_distance(2); await capture("122-ridges-close")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("123-ridges-ground")
	game.view.show_plants=true
	await click(game.group_buttons[1]); await click(game.tool_buttons[World.TREE_FERTILIZER])
	await escape()
	check(game.selected_tool==-1 and game.modal==null and game.selected_category==1,"Esc cancels the current power without leaving its category")
	await escape()
	check(game.modal!=null and game.hud.visible and not game.title_screen.visible,"Esc without a power opens settings directly from a category")
	var weather_toggle=game.modal.find_child("NaturalWeather",true,false)
	check(weather_toggle!=null and weather_toggle.button_pressed,"The new weather setting defaults to enabled")
	await click(weather_toggle)
	check(not island.weather_enabled,"The weather control changes the world's saved rule")
	await escape()
	check(game.modal==null and game.hud.visible,"Esc closes settings back to the map")
	island.weather_enabled=true; island.weather_due=0
	game.paused=false; game._update_pause_buttons()
	await create_timer(1.1).timeout
	check(island.rain_clouds.size()==1 and island.rain_clouds[0].natural,"The running game produces a scheduled natural rain cloud")
	var natural=island.rain_clouds[0]
	focus_cell(Vector2(natural.x,natural.y),3.5)
	await pointer(Vector2(1420,850)); await film(2.5)
	await capture("132-natural-rain")
	game.paused=true; game._update_pause_buttons(); island.rain_clouds.clear(); island.weather_enabled=false
	var center=focus_cell(Vector2(148,48),4.6)
	await click(game.tool_buttons[World.RAIN]); game.view.radius=14
	await cast(center)
	check(island.rain_clouds.size()==1 and not game.view.disaster_draws.is_empty(),"A real rain cast on unburned land creates rain feedback and a cloud")
	await capture("124-rain-paused")
	var frozen=island.rain_clouds.duplicate(true); var age=island.age
	await create_timer(.3).timeout
	check(island.rain_clouds==frozen and island.age==age,"Paused rain leaves persistent cloud motion and the world clock still")
	game.paused=false; game._update_pause_buttons()
	await create_timer(2.1).timeout
	check(island.rain_clouds!=frozen,"Resuming advances the rain cloud")
	await pointer(Vector2(1420,850)); await capture("125-rain-coast")
	await film(1.5)
	game.paused=true; game._update_pause_buttons()
	var loaded=Save.decode(Save.encode(island)).world
	check(loaded!=null and loaded.rain_clouds==island.rain_clouds,"The visible moving cloud is part of the saved world")
	var w=Fixtures.empty({"width":96,"height":64,"seed":61439,"trees":0})
	w.world_name="晨雨原野"
	for i in w.terrain.size():
		var x=i%w.width; var y=i/w.width
		w.biomes[i]=World.ARID if x<30 else (World.MARSH if x>66 else World.MEADOW)
		if y>46 and x>=30 and x<=66: w.biomes[i]=World.MUSHROOM
		w.terrain[i]=World.ecology_soil(w.biomes[i])
		if w.biomes[i]==World.MEADOW and x%5==0 and y%5==0:
			w.plants[i]=World.HERB; w.plant_stage[i]=World.ADULT; w.plant_age[i]=70
	# A few fixed rocks demonstrate occupied sites without filling the whole planting area.
	for p in [Vector2i(18,25),Vector2i(22,36),Vector2i(74,28),Vector2i(79,36)]: w.objects[p.y*w.width+p.x]=1
	w.prepare_ecology(); w.image=w.bake_image(); setup_world(w)
	game._select_category(1); center=focus_cell(Vector2(48,30),3.1)
	await click(game.tool_buttons[World.TREE_FERTILIZER]); game.view.radius=13
	await pointer(center); await capture("126-fertilizer-preview")
	check(game.view.preview_cells.size()>300,"The live white preview covers the selected brush footprint")
	var valid=0
	for entry in game.view.preview_cells:
		if entry[1]: valid+=1
	check(valid>game.view.preview_cells.size()*.7,"Low ground cover no longer turns suitable preview cells into a rejected checkerboard")
	await film(.6); await held(center,true); await film(1.6); await held(center,false); await film(.5)
	check(w.life_counts().trees>8,"Actual held tree fertilizer grows a grove on the grass-covered plot")
	await capture("127-fertilizer-grove")
	await click(game.tool_buttons[World.PLANT_FERTILIZER]); await pointer(center)
	var previous=w.plant_count()
	await held(center,true); await film(1.6); await held(center,false); await film(.5)
	check(w.plant_count()>previous,"Plant fertilizer fills suitable gaps around established trees")
	await capture("128-ground-fertilizer")
	center=focus_cell(Vector2(48,53),4.2)
	await click(game.tool_buttons[World.TREE_FERTILIZER]); game.view.radius=9
	await pointer(center); await held(center,true); await film(1.6); await held(center,false); await film(.5)
	check(w.plants.count(54)>3,"The mushroom habitat produces multiple mature giant mushrooms through the real power")
	await capture("129-mushroom-fertilizer")
	center=focus_cell(Vector2(48,30),3.1)
	await click(game.tool_buttons[World.RAIN]); game.view.radius=16
	await cast(center); await film(.8)
	game.paused=false; game._update_pause_buttons(); await film(2.8)
	await pointer(Vector2(1420,850)); await capture("130-rain-garden")
	game.paused=true; game._update_pause_buttons()
	# Display the arid and marsh plant families in the same world, using real casts.
	for cell in [Vector2(16,30),Vector2(80,30)]:
		center=focus_cell(cell,3.1)
		await click(game.tool_buttons[World.TREE_FERTILIZER]); await cast(center)
		await click(game.tool_buttons[World.PLANT_FERTILIZER]); await cast(center)
	await create_timer(1.4).timeout
	game._select_tool(-1); game.view.fit_world(); await capture("131-soil-habitats")
	w.begin_stroke(); var changed=w.paint(Vector2i(32,32),10,World.MOUNTAIN); w.end_stroke()
	game.view.refresh_edit(changed); await settle_surface()
	var fresh=World.new(); fresh.width=w.width; fresh.height=w.height; fresh.world_seed=w.world_seed
	fresh.terrain=w.terrain.duplicate(); fresh.biomes=w.biomes.duplicate(); fresh.elevation=w.elevation.duplicate()
	check(w.image.get_data()==fresh.bake_image().get_data(),"New mountain art is identical after worker painting and a fresh full-world render")
	var report={"checks":checks,"failures":failures,"recorded_frames":film_frame}
	FileAccess.open("res://test-output/weather-runtime-report.json",FileAccess.WRITE).store_string(JSON.stringify(report))
	print("AEON VALE WEATHER RUNTIME: "+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
