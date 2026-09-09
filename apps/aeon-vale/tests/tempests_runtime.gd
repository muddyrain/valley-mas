extends "res://tests/weather_runtime.gd"

func scene_world():
	var w=Fixtures.empty({"width":128,"height":96,"seed":7937,"trees":0})
	w.world_name="风雨之谷"; w.spread_enabled=false; w.weather_enabled=false
	for i in w.terrain.size():
		var x=i%w.width; var y=i/w.width
		var bank=87+int(sin(y*.13)*4)
		w.terrain[i]=World.FOREST if x<bank else (World.BEACH if x<bank+3 else (World.SHALLOW if x<bank+9 else World.OCEAN))
		w.biomes[i]=World.BIRCH
	w.prepare_ecology(); World.Landscape.populate(w,.9,Callable()); w.image=w.bake_image()
	return w

func shot(label: String) -> void:
	game.view.effects.queue_redraw()
	await process_frame; await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/"+label+".png")

func film(seconds: float) -> void:
	if not recording:
		await create_timer(seconds).timeout; return
	for n in int(seconds*30):
		await process_frame; await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/film13/frame-%05d.png" % film_frame)
		film_frame+=1

func run() -> void:
	create_timer(150).timeout.connect(func(): push_error("Tempests runtime timed out"); quit(1))
	recording=OS.get_cmdline_user_args().has("record")
	if recording: DirAccess.make_dir_recursive_absolute("res://test-output/film13")
	Save.directory="user://test-runs/tempests-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var w=scene_world(); setup_world(w)
	game._select_category(1)
	var point=focus_cell(Vector2(72,48),3.7)
	await click(game.tool_buttons[World.RAIN]); game.view.radius=16
	await pointer(point); await held(point,true); await film(.6); await shot("170-rain13-cast"); await held(point,false)
	check(w.rain_clouds.size()==1 and w.age==0,"Held rain gives visible drops while paused and merges overlapping clouds")
	var frozen=w.rain_clouds.duplicate(true)
	await film(1.5)
	check(w.rain_clouds==frozen,"Persistent precipitation remains frozen after the active feedback")
	game.paused=false; game.time_speed=1; game._update_pause_buttons(); game._select_tool(-1)
	await film(2); await shot("171-rain13-moving")
	check(w.rain_clouds!=frozen,"Unpausing moves and animates the rain")
	w.rain_clouds.clear(); game.paused=true; game._update_pause_buttons()
	await click(game.tool_buttons[World.LIGHTNING]); game.view.radius=8
	await pointer(point); await held(point,true); await shot("172-lightning13-strike"); await film(.1); await held(point,false); await film(.9)
	check(not w.fires.is_empty(),"An actual lightning strike ignites forest")
	await shot("173-lightning13-fire")
	await click(game.tool_buttons[World.RAIN]); game.view.radius=14; await cast(point)
	check(w.fires.is_empty(),"Rain extinguishes the lightning fire immediately while paused")
	await film(1)
	w=scene_world(); setup_world(w); game._select_category(1); point=focus_cell(Vector2(72,48),3.7)
	await click(game.tool_buttons[World.EARTHQUAKE]); game.view.radius=16
	await cast(point); await film(.2); await shot("174-earthquake13-dust"); await film(1.5); await settle_surface()
	await pointer(Vector2(1420,850))
	await shot("175-earthquake13-aftermath")
	check(w.bare_soil.count(1)>40 and w.life_counts().dead>5,"Actual earthquake leaves broad exposed earth and standing dead trees")
	check(w.image.get_data()==w.bake_image().get_data(),"Worker-rendered fault terrain matches a fresh render")
	var loaded=Save.decode(Save.encode(w)).world
	check(loaded!=null and loaded.bare_soil==w.bare_soil and loaded.terrain==w.terrain,"The visible fault persists through saving")
	await film(1)
	w=scene_world(); setup_world(w); game._select_category(1); point=focus_cell(Vector2(72,48),3.7)
	await click(game.tool_buttons[World.ACID_RAIN]); game.view.radius=16
	await pointer(point); await held(point,true); await film(.5); await shot("176-acid13-cast"); await held(point,false)
	check(w.life_counts().dead>5 and w.rain_clouds[0].acid,"The acid power creates a green cloud and withers local trees")
	game._select_tool(-1)
	game.paused=false; game.time_speed=1; game._update_pause_buttons(); await film(3)
	await shot("177-acid13-moving")
	game._select_tool(-1); await film(1)
	w=scene_world(); setup_world(w); game._select_category(1); point=focus_cell(Vector2(77,48),3.7)
	await click(game.tool_buttons[World.TORNADO]); game.view.radius=12
	await cast(point); await shot("178-tornado13-small")
	var storm=w.tornadoes[0]; var initial_scale=World.Forces.tornado_scale(storm)
	await film(.8)
	check(w.age==0 and storm.life==24,"Paused tornado has no movement or ongoing damage")
	game.paused=false; game.time_speed=1; game._update_pause_buttons(); game._select_tool(-1)
	await film(7); await shot("179-tornado13-growing")
	check(World.Forces.tornado_scale(storm)>initial_scale*4,"The funnel grows substantially after formation")
	await film(5); await shot("180-tornado13-full")
	var peak=World.Forces.tornado_scale(storm)
	await click(game.speed_button); await click(game.speed_value_button); await click(game.speed_choices[4])
	check(game.time_speed==5 and game.speed_button.get_child(0).get_child(1).text=="5x","The visible time control selects 5x for the storm's final phase")
	await film(1.8); await shot("181-tornado13-fading")
	check(World.Forces.tornado_scale(storm)<peak*.65,"The funnel shrinks at the selected world speed before disappearing")
	await film(1); check(w.tornadoes.is_empty(),"The funnel expires through the running game")
	await click(game.speed_button); await click(game.speed_value_button); await click(game.speed_choices[0])
	focus_cell(Vector2(102,48),4.6); await film(2); await shot("182-waves13")
	game.paused=true; game._update_pause_buttons(); var age=w.age
	await film(.5); check(w.age==age,"Ocean wave time stops with the paused world")
	var report={"checks":checks,"failures":failures,"recorded_frames":film_frame}
	FileAccess.open("res://test-output/tempests-runtime13.json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("AEON VALE TEMPESTS RUNTIME: "+JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
