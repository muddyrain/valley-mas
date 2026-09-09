extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/renewal-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var island=World.generate({"width":384,"height":256,"seed":781936,"template":"continent","trees":.9})
	setup_world(island); game._select_category(-1); game._select_tool(-1)
	await capture("150-map12-overview")
	game.view.set_distance(1); await capture("151-map12-middle")
	game.view.set_distance(2); await capture("152-map12-near")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("153-map12-ground")
	var w=Fixtures.empty({"width":96,"height":64,"seed":3711,"trees":0})
	w.terrain.fill(World.GRASS)
	for i in w.terrain.size():
		w.biomes[i]=World.MEADOW if i%w.width<32 else (World.BIRCH if i%w.width<64 else World.SAVANNA)
	w.prepare_ecology(); World.Landscape.populate(w,.90,Callable()); w.image=w.bake_image()
	w.spread_enabled=false; w.weather_enabled=false
	setup_world(w); game.view.show_plants=true; focus_cell(Vector2(48,32),3.6)
	await capture("154-map12-meadow-birch-savanna")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("155-map12-three-soils")
	game.view.show_plants=true; game.view.queue_redraw()
	World.Weather.add_fair_cloud(w)
	var cloud=w.fair_clouds[0]; cloud.x=48.0; cloud.y=31.0; cloud.radius=20; cloud.life=cloud.duration-12
	focus_cell(Vector2(48,32),2.0); await capture("156-map12-fair-cloud")
	var frozen=w.fair_clouds.duplicate(true)
	await create_timer(.4).timeout
	check(w.fair_clouds==frozen and w.rain_clouds.is_empty(),"A paused fair cloud remains stationary and produces no rain")
	focus_cell(Vector2(48,32),8.0); await capture("157-map12-cloud-near")
	focus_cell(Vector2(48,32),24.0); await capture("158-map12-extreme")
	game.paused=false; game.time_speed=5; await create_timer(.8).timeout
	game.paused=true
	check(w.fair_clouds[0].x>frozen[0].x and w.fair_clouds[0].life<frozen[0].life,"A fair cloud moves and ages at the selected world speed")
	w.fair_clouds.clear(); game.time_speed=1
	var point=focus_cell(Vector2(48,32),5.0)
	await click(game.group_buttons[1])
	await click(game.tool_buttons[World.BIOME_TOOLS+World.SAVANNA]); game.view.radius=12; game.view.brush_shape=1
	await cast(point); await capture("159-map12-changed-habitat")
	var dead_before=w.life_counts().dead
	check(dead_before>0,"An actual habitat cast retires incompatible birch trees")
	await click(game.tool_buttons[World.TREE_FERTILIZER]); await pointer(point)
	await held(point,true); await create_timer(.65).timeout; await held(point,false)
	await capture("160-map12-fertilizer")
	check(w.life_counts().dead<dead_before and w.age<10,"Paused fertilizer clears old wood without advancing natural life")
	var wrong_crosses=0
	for event in game.view.cast_events:
		if not event.get("cross",false) or event.tool!=World.TREE_FERTILIZER: continue
		var cell=Vector2i((event.position-Vector2(2,2))/World.TILE)
		var at=cell.y*w.width+cell.x
		if w.objects[at]==0 and w.terrain[at] in [World.GRASS,World.FOREST,World.HILLS] and not w.fires.has(at): wrong_crosses+=1
	check(wrong_crosses==0,"Held fertilizer on suitable, occupied soil does not repeat red crosses")
	await create_timer(1.6).timeout; await capture("161-map12-fertilized")
	# A second retired patch is left alone and must renew on world time.
	for y in range(12,22,4):
		for x in range(43,55,4):
			var i=y*w.width+x
			w.remove_plant(i,"clear"); w.biomes[i]=World.SAVANNA
			w.plants[i]=2; w.plant_stage[i]=World.DEAD; w.plant_age[i]=0
	w.prepare_ecology(); game.view.refresh_ecology(); focus_cell(Vector2(48,17),6)
	await capture("162-map12-natural-before")
	w.advance(World.YEAR_SECONDS*.9); game.view.refresh_ecology()
	await capture("163-map12-natural-after")
	check(w.life_counts().dead==0 and w.life_counts().young>0,"Unfertilized retired trees yield to young vegetation within a year")
	check(Save.decode(Save.encode(w)).world!=null,"The renewed world remains saveable")
	var result={"checks":checks,"failures":failures}
	FileAccess.open("res://test-output/renewal12-runtime.json",FileAccess.WRITE).store_string(JSON.stringify(result,"\t"))
	print("RENEWAL RUNTIME: "+JSON.stringify(result)); quit(0 if failures.is_empty() else 1)
