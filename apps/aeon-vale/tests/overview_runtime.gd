extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/overview15-native-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	if not OS.get_cmdline_user_args().has("live-only"): await create_sizes()
	await live_overview()
	var report={"checks":checks,"failures":failures,"metrics":metrics}
	FileAccess.open("res://test-output/overview15-runtime.json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("AEON VALE OVERVIEW RUNTIME: "+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)

func create_sizes() -> void:
	var sizes=[Vector2i(288,192),Vector2i(384,256),Vector2i(480,320)]
	var creation=[]
	for n in 3:
		game.dirty=false; game._open_new_world()
		if n==0: check(game.selected_size==1,"New world defaults to the enlarged standard size")
		await click(game.size_buttons[n])
		var config=game._current_new_config()
		check(Vector2i(config.width,config.height)==sizes[n],"Actual size button selects the enlarged dimensions %s"%sizes[n])
		check(game.size_buttons[n].tooltip_text=="%d × %d"%[sizes[n].x,sizes[n].y],"Size hint matches the generated world")
		check(game.generation_thread==null,"Choosing a size does not generate a preview world")
		if n==1: await capture("overview15-size-selection")
		var began=Time.get_ticks_msec(); var frames=0; var last_progress=0.0; var monotonic=true
		await click(find_button(game.modal,"让世界诞生"))
		check(game.loading!=null and game.generation_thread!=null,"Create opens the live loading screen")
		while game.loading!=null:
			var value: float=game.progress_bar.value
			monotonic=monotonic and value>=last_progress; last_progress=value
			frames+=1; await process_frame
		game.paused=true; game._update_pause_buttons(); game._update_status()
		var w=game.world
		creation.append({"size":[w.width,w.height],"seconds":(Time.get_ticks_msec()-began)/1000.0,"loading_frames":frames})
		check(Vector2i(w.width,w.height)==sizes[n] and w.terrain.size()==sizes[n].x*sizes[n].y,"Generated world uses every selected cell")
		check(frames>20 and monotonic,"Loading remains animated with nondecreasing actual progress")
		var restored=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(w)))).world
		check(restored!=null and restored.width==w.width and restored.terrain==w.terrain and restored.plants==w.plants,"Enlarged world saves and loads without truncation")
		check(game.view.distance_name()=="远景" and game.view.canopy_sprite.visible,"Each enlarged map fits as a live overview")
		await capture("overview15-size-%d"%w.width)
	metrics.creation=creation
	var legacy=World.generate({"width":192,"height":128,"seed":719,"trees":0})
	var restored=Save.decode(Save.encode(legacy)).world
	check(restored.width==192 and restored.height==128 and restored.terrain==legacy.terrain,"Existing small worlds keep their original dimensions")
	DisplayServer.window_set_size(Vector2i(1100,720)); game._set_ui_scale(1.15)
	game.dirty=false; game._open_new_world(); await process_frame
	check(game.generation_thread==null,"Small-window size selection does not start a world worker")
	await capture("overview15-small-window")
	for b in game.size_buttons: check(Rect2(Vector2.ZERO,game.size).encloses(b.get_global_rect()),"Size button fits the small window")
	game._close_modal(); DisplayServer.window_set_size(Vector2i(1600,1000)); game._set_ui_scale(1)
	await process_frame

func consistent_canopy(label_text: String) -> void:
	var full=Image.create(game.world.width*World.Landscape.OVERVIEW_PIXELS,game.world.height*World.Landscape.OVERVIEW_PIXELS,false,Image.FORMAT_RGBA8)
	for i in game.world.plants.size(): World.Landscape.paint_crown(full,game.world,i)
	var base=game.view.canopy_image.duplicate(); base.clear_mipmaps()
	if full.get_data()!=base.get_data():
		full.save_png("res://test-output/overview15-expected.png")
		base.save_png("res://test-output/overview15-actual.png")
		var differences=[]
		for y in full.get_height():
			for x in full.get_width():
				if full.get_pixel(x,y)!=base.get_pixel(x,y) and differences.size()<12: differences.append([x,y,full.get_pixel(x,y).to_html(),base.get_pixel(x,y).to_html()])
		print("CANOPY DIFFERENCES: "+JSON.stringify(differences))
	check(full.get_data()==base.get_data(),label_text)

func live_overview() -> void:
	var w=Fixtures.empty({"width":128,"height":96,"seed":92,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.BIRCH); w.elevation.fill(.1)
	w.prepare_ecology(); World.Landscape.populate(w,.9,Callable()); w.image=w.bake_image()
	w.spread_enabled=false; w.weather_enabled=false
	# Put a real sapling just before its next life stage at a dirty-strip boundary.
	var i=48*w.width+64
	w.plants[i]=2; w.plant_age[i]=w.maturity(i)-.3; w.plant_stage[i]=w.stage_for(i)
	w.prepare_ecology()
	setup_world(w); game._select_category(1); focus_cell(Vector2(64,48),.9)
	await capture("overview15-live-before")
	consistent_canopy("Initial distant marks match the actual plants")
	var texture=game.view.canopy_sprite.read_image().get_data()
	game.view.canopy_dirty[6]=true
	await settle_surface(); await create_timer(.3).timeout
	check(texture==game.view.canopy_sprite.read_image().get_data(),"Refreshing an unchanged strip cannot change filtered tree colours or edges")
	var before=game.view.canopy_image.get_data(); var age=w.age
	await create_timer(.4).timeout
	check(w.age==age and game.view.canopy_image.get_data()==before,"Paused overview does not change the world or its plant marks")
	await click(game.pause_button); await create_timer(1.5).timeout; await click(game.pause_button)
	await settle_surface(); await create_timer(.3).timeout
	check(w.age>age and w.plant_stage[i]==World.ADULT and game.view.canopy_image.get_data()!=before,"A sapling matures while staying in the distant view")
	consistent_canopy("Natural growth updates overview strips without stale marks")
	await capture("overview15-live-grown")
	await click(game.tool_buttons[World.TREE_FERTILIZER]); game.view.radius=12
	before=game.view.canopy_image.get_data(); var births=w.births
	await cast(game.view.size/2); await create_timer(1.4).timeout; await settle_surface()
	check(w.births>births and game.view.canopy_image.get_data()!=before,"Paused fertilizer updates the distant plants immediately")
	consistent_canopy("Fertilized overview equals a full reconstruction")
	await click(game.tool_buttons[World.ACID_RAIN]); game.view.radius=16
	await cast(game.view.size/2); await create_timer(.4).timeout; await settle_surface()
	check(w.plant_stage.count(World.DEAD)>0 and w.rain_clouds.size()==1,"Distant acid rain leaves dead plants and an active cloud")
	consistent_canopy("Dead distant plants retain their correct marks")
	await capture("overview15-live-acid")
	var clouds=w.rain_clouds.duplicate(true)
	await create_timer(.4).timeout
	check(w.rain_clouds==clouds,"Paused distant weather keeps its position and lifetime")
	game.time_speed=5; await click(game.pause_button); age=w.age
	await create_timer(.8).timeout; await click(game.pause_button)
	check(w.age-age>3.5 and w.rain_clouds!=clouds,"Distant weather and the world advance at 5x")
	game.time_speed=1; game._update_pause_buttons()
	game._select_category(0); await process_frame
	await click(game.tool_buttons[World.OCEAN]); game.view.radius=12
	await cast(game.view.size/2); await create_timer(.4).timeout; await settle_surface()
	consistent_canopy("Painting water removes distant plants across strip boundaries")
	game._select_category(1); await process_frame
	await click(game.tool_buttons[World.EARTHQUAKE]); game.view.radius=16
	var terrain=w.terrain.duplicate(); await cast(game.view.size/2)
	await create_timer(1.5).timeout; await settle_surface()
	check(w.terrain!=terrain and w.image.get_data()==w.bake_image().get_data(),"Distant earthquake changes the actual terrain and its rendered surface")
	var small=w.image.duplicate(); small.resize(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	check(small.get_data()==game.view.overview_image.get_data(),"Partial distant ground updates equal full resampling")
	var composited=small.duplicate()
	var all_plants=Image.create(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,false,Image.FORMAT_RGBA8)
	for plant in w.plants.size(): World.Landscape.paint_crown(all_plants,w,plant)
	composited.blend_rect(all_plants,Rect2i(Vector2i.ZERO,all_plants.get_size()),Vector2i.ZERO)
	var displayed=game.view.canopy_sprite.read_image()
	check(displayed.get_data()==composited.get_data(),"The visible composite includes current terrain and current plants after ground edits")
	consistent_canopy("Earthquake and weather leave no stale canopy pixels")
	game._select_tool(-1)
	var payload=Save.encode(w)
	var state=JSON.stringify(payload); var canopy=game.view.canopy_image.get_data()
	var camera=game.view.camera
	for code in [KEY_D,KEY_A]:
		var event=InputEventKey.new(); event.keycode=code; event.physical_keycode=code; event.pressed=true
		Input.parse_input_event(event); await create_timer(.15).timeout
		event=event.duplicate(); event.pressed=false; Input.parse_input_event(event)
	await process_frame
	check(game.view.camera!=camera,"Keyboard panning moves the distant camera")
	for direction in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
		for n in 12:
			var event=InputEventMouseButton.new(); event.position=game.view.size/2; event.button_index=direction; event.pressed=true
			root.push_input(event,true); event=event.duplicate(); event.pressed=false; root.push_input(event,true)
			await process_frame
		if direction==MOUSE_BUTTON_WHEEL_UP:
			check(not game.view.canopy_sprite.visible,"Real zoom input restores detailed plant silhouettes")
			await capture("overview15-live-near")
	await settle_surface(); await create_timer(.3).timeout
	var after_camera=Save.encode(w); after_camera.saved_at=payload.saved_at
	check(game.view.canopy_sprite.visible and JSON.stringify(after_camera)==state,"Zooming back restores the live overview without changing world state")
	check(canopy==game.view.canopy_image.get_data(),"Camera movement does not regenerate or randomize distant marks")
	var restored=Save.decode(JSON.parse_string(state)).world
	setup_world(restored); focus_cell(Vector2(64,48),.9); await settle_surface()
	check(game.view.canopy_image.get_data()==canopy,"Saved world restores exactly the same distant plants")
	await capture("overview15-live-restored")
