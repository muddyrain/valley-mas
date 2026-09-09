extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/earth14-native-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	await capture("earth14-menu-default")
	check(DisplayServer.window_get_size().x>=1500,"Default game window makes use of a larger display")
	menu_fits()
	DisplayServer.window_set_size(Vector2i(1100,720)); game._set_ui_scale(1.15)
	await capture("earth14-menu-small"); menu_fits()
	DisplayServer.window_set_size(Vector2i(1600,1000)); game._set_ui_scale(1)
	await process_frame
	var w=Fixtures.empty({"width":144,"height":96,"seed":7193,"trees":0})
	w.weather_enabled=false; w.spread_enabled=false; w.biomes.fill(World.MARSH)
	for cell in [Vector2i(26,48),Vector2i(116,48)]:
		w.begin_stroke(); w.paint(cell,16,World.COMBO_TOOLS+World.BIRCH); w.end_stroke()
	w.prepare_ecology(); World.Landscape.populate(w,.8,Callable()); w.image=w.bake_image()
	setup_world(w); game._select_category(0)
	var point=focus_cell(Vector2(72,48),3.5)
	await click(game.tool_buttons[World.GRASS]); game.view.radius=5
	await held(game.view.camera+Vector2(38,48)*World.TILE*game.view.zoom,true)
	for x in range(38,110):
		var at=game.view.camera+Vector2(x,48)*World.TILE*game.view.zoom
		var motion=InputEventMouseMotion.new(); motion.position=at; motion.button_mask=MOUSE_BUTTON_MASK_LEFT
		root.push_input(motion,true); await process_frame
	await held(game.view.camera+Vector2(109,48)*World.TILE*game.view.zoom,false)
	await create_timer(1.25).timeout
	game._select_tool(-1); await capture("earth14-plain-soil-middle")
	check(w.bare_soil[48*144+72]==1,"Actual soil brush creates unseeded land over the ocean")
	check(w.image.get_data()==w.bake_image().get_data(),"Worker-rendered bare soil matches a full render")
	game._select_category(1); await process_frame
	await click(game.tool_buttons[World.BIOME_TOOLS+World.MEADOW]); game.view.radius=4
	for x in range(44,102,6):
		await cast(game.view.camera+Vector2(x,48)*World.TILE*game.view.zoom)
	await create_timer(1.25).timeout
	game._select_tool(-1); await capture("earth14-seeded-soil-middle")
	check(w.bare_soil[48*144+72]==0 and w.biomes[48*144+72]==World.MEADOW,"Actual grass seeds establish meadow over the same soil")
	check(w.bare_soil.count(1)>30,"Unsown soil remains visible around the seeded patch")
	game.view.set_distance(0); await capture("earth14-seeded-soil-far")
	focus_cell(Vector2(72,48),8); await capture("earth14-seeded-soil-near")
	await click(game.tool_buttons[World.PLANT_FERTILIZER]); game.view.radius=5
	await cast(game.view.size/2); await create_timer(1.3).timeout
	game._select_tool(-1); await capture("earth14-plants-after-seeding")
	var island=World.generate({"width":384,"height":256,"seed":781936,"template":"continent","trees":.9})
	setup_world(island); game._select_category(-1); game._select_tool(-1)
	await capture("earth14-island-far")
	game.view.set_distance(1); await capture("earth14-island-middle")
	game.view.set_distance(2); await capture("earth14-island-near")
	game.view.show_plants=false; await capture("earth14-island-ground"); game.view.show_plants=true
	World.Weather.add_fair_cloud(island)
	var cloud=island.fair_clouds[0]; cloud.x=192.0; cloud.y=128.0; cloud.radius=20; cloud.life=cloud.duration-14
	focus_cell(Vector2(192,128),2.2); await capture("earth14-cloud-middle")
	check(game.view.cloud_visibility()>0,"Middle view displays clouds")
	focus_cell(Vector2(192,128),8); await capture("earth14-cloud-hidden-near")
	check(game.view.cloud_visibility()==0,"Near view hides cloud body and independent shadow completely")
	var frozen=island.fair_clouds.duplicate(true)
	await create_timer(.4).timeout
	check(island.fair_clouds==frozen,"Hidden clouds still respect pause")
	game._select_category(1); await process_frame; await click(game.tool_buttons[World.RAIN]); game.view.radius=12
	await cast(game.view.size/2); await capture("earth14-rain-without-cloud-near")
	check(game.view.cloud_visibility()==0 and island.rain_clouds.size()==1,"Near rain remains active while its cloud is hidden")
	# Actual player earthquake on a populated, uniform plateau.
	w=Fixtures.empty({"width":144,"height":96,"seed":5,"trees":0})
	w.terrain.fill(World.GRASS); w.biomes.fill(World.BIRCH); w.elevation.fill(.1)
	w.prepare_ecology(); World.Landscape.populate(w,.9,Callable()); w.image=w.bake_image()
	w.weather_enabled=false; w.spread_enabled=false
	setup_world(w); game._select_category(1); focus_cell(Vector2(72,48),5)
	await capture("earth14-quake-before")
	await click(game.tool_buttons[World.EARTHQUAKE]); game.view.radius=16
	var before=w.terrain.duplicate(); var camera=game.view.camera
	await cast(game.view.size/2); await create_timer(.08).timeout
	check(game.view.quake_offset!=Vector2.ZERO and game.view.camera==camera,"Earthquake shakes the map without moving its logical camera")
	check(game.view.map_layer.position==camera+game.view.quake_offset,"Ground and effects share the earthquake motion")
	await capture("earth14-quake-dust")
	await create_timer(1.4).timeout; await settle_surface(); game._select_tool(-1)
	await capture("earth14-quake-after")
	check(before!=w.terrain and w.plant_stage.count(World.DEAD)>0,"Actual earthquake changes land and damages plants")
	check(game.view.quake_offset==Vector2.ZERO,"The camera settles back after the earthquake")
	check(w.image.get_data()==w.bake_image().get_data(),"Worker rendering retains exactly the displaced terrain")
	check(Save.decode(Save.encode(w)).world.terrain==w.terrain,"Earthquake terrain persists through saving")
	var result={"checks":checks,"failures":failures}
	FileAccess.open("res://test-output/earth14-runtime.json",FileAccess.WRITE).store_string(JSON.stringify(result,"\t"))
	print("AEON VALE EARTH RUNTIME: "+JSON.stringify(result)); quit(0 if failures.is_empty() else 1)

func menu_fits() -> void:
	var card: Rect2=game.title_card.get_global_rect()
	check(Rect2(Vector2.ZERO,game.size).encloses(card),"Main menu card fits within the window")
	var start=find_button(game.title_card,"创 造 世 界")
	var load_button=find_button(game.title_card,"载入世界")
	var settings=find_button(game.title_card,"游戏设置")
	var help_button=find_button(game.title_card,"操作手记")
	check(card.end.y-settings.get_global_rect().end.y>=27*game.ui_scale,"Menu actions have clear space above the ornamental bottom border")
	check(absf(start.get_global_rect().position.x-settings.get_global_rect().position.x)<1 and absf(load_button.get_global_rect().end.x-help_button.get_global_rect().end.x)<1,"Primary and secondary menu rows align")
