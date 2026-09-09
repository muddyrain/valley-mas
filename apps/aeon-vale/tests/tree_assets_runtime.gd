extends "res://tests/overview_runtime.gd"

func run() -> void:
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "trees16-after"
	Save.directory="user://test-runs/trees16-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	var w=World.generate({"width":384,"height":256,"seed":168760530,"template":"continent","trees":.8})
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	for z in [.4,.98,2.2,5.0]:
		focus_cell(Vector2(192,104),z)
		await capture(tag+"-island-"+str(z))
	game.view.show_plants=false; await capture(tag+"-ground"); game.view.show_plants=true
	var ids=[1,2,3,9]
	var biomes=[World.TEMPERATE,World.BIRCH,World.CONIFER,World.TROPICAL]
	w=Fixtures.empty({"width":128,"height":96,"seed":17821,"trees":0})
	w.terrain.fill(World.FOREST); w.elevation.fill(.1)
	for i in w.terrain.size(): w.biomes[i]=biomes[mini(3,(i%w.width)/32)]
	w.prepare_ecology(); w.weather_enabled=false; w.spread_enabled=false
	for y in range(10,86,5):
		for x in range(5,124,5):
			if World.hash_cell(x,y,97)%5==0: continue
			var i=y*w.width+x
			w.plants[i]=ids[mini(3,x/32)]; w.plant_age[i]=w.maturity(i)*2; w.plant_stage[i]=World.ADULT
	w.prepare_ecology(); w.image=w.bake_image(); setup_world(w); game._update_status()
	for z in [.75,1.24,1.26,2.2,5.0]:
		focus_cell(Vector2(64,48),z)
		await capture(tag+"-grove-"+str(z))
	await life_sheet(tag)
	if tag.ends_with("after"):
		await live_overview()
		await motion_sample()
	FileAccess.open("res://test-output/"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("TREE ASSETS RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func life_sheet(tag: String) -> void:
	var panel=ColorRect.new(); panel.color=Color("f4f0df")
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); game.add_child(panel)
	var heading=game.label("树木样板 · 生长阶段",26,game.CREAM)
	heading.position=Vector2(48,24); panel.add_child(heading)
	for col in 4:
		var species=[1,2,3,9][col]
		var label_node=game.label(World.Catalog.NAMES[species-1],20,game.CREAM)
		label_node.position=Vector2(210+col*300,72); panel.add_child(label_node)
		for stage in 6:
			var sprite=TextureRect.new(); sprite.texture=game.View.Flora.texture(species,stage,1)
			sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
			sprite.position=Vector2(210+col*300,112+stage*116); sprite.size=Vector2(80,96)
			panel.add_child(sprite)
	for stage in 6:
		var label_node=game.label(["种子","新芽","幼树","成年","老树","枯树"][stage],18,game.CREAM)
		label_node.position=Vector2(48,155+stage*116); panel.add_child(label_node)
	await capture(tag+"-life-stages"); panel.queue_free(); await process_frame

func motion_sample() -> void:
	var w=World.generate({"width":480,"height":320,"seed":17821,"trees":.8})
	setup_world(w); game._select_category(-1); game._select_tool(-1)
	# Finish the world's first draw/upload before timing continuous interaction.
	focus_cell(Vector2(240,160),2.2); await settle_surface(); await create_timer(.5).timeout
	focus_cell(Vector2(240,160),.95); await create_timer(.5).timeout
	game.paused=false; game.time_speed=1; game._update_pause_buttons()
	var times=[]; var previous=Time.get_ticks_usec(); var age=w.age; var long_frames=[]
	for frame in 720:
		var z=.95+sin(frame*.014)*.5
		focus_cell(Vector2(240+sin(frame*.012)*50,160+cos(frame*.014)*25),z)
		await process_frame
		var now=Time.get_ticks_usec(); var elapsed=(now-previous)/1000.0
		times.append(elapsed); previous=now
		if elapsed>33.333: long_frames.append({"frame":frame,"ms":elapsed,"zoom":z})
	game.paused=true; game._update_pause_buttons()
	var over33=0
	for t in times:
		if t>33.333: over33+=1
	times.sort()
	metrics.motion={"frames":times.size(),"p95_ms":times[684],"max_ms":times[-1],"over33":over33,"world_seconds":w.age-age,"plants":w.plant_count(),"long_frames":long_frames}
	check(w.age>age,"The world advances while repeatedly crossing the image LOD boundary")
