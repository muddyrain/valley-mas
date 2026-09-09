extends "res://tests/weather_runtime.gd"

var tag="generation"

func run() -> void:
	if not OS.get_cmdline_user_args().is_empty(): tag=OS.get_cmdline_user_args()[0]
	Save.directory="user://test-runs/generation-interaction-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1100,720)); await process_frame
	game._open_new_world()
	for type in game.TEMPLATES:
		await click(game.template_buttons[type]); await process_frame
		fit(game.modal)
		if game.advanced_button.visible:
			await click(game.advanced_button); await process_frame
			var footer=find_button(game.modal,"让世界诞生").get_global_rect()
			for key in game.generation_controls:
				var rect=game.generation_controls[key].get_global_rect()
				check(rect.position.x>=0 and rect.end.x<=game.size.x and rect.end.y<footer.position.y,"Small-window controls fit: "+type+" "+key)
			await click(find_button(game.modal,"‹  返回地形图案"))
	await capture(tag+"-small-menu")
	game._close_modal()
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	game._start_generation({"width":480,"height":480,"seed":17821,"template":"boring_plains","trees":1.0})
	var frames=0; var slow=0; var previous=Time.get_ticks_usec(); var highest=0.0; var handoff=0.0
	while game.generation_thread!=null:
		await process_frame
		var now=Time.get_ticks_usec(); var ms=(now-previous)/1000.0; previous=now
		if game.generation_thread==null: handoff=ms
		else:
			frames+=1; highest=maxf(highest,ms)
			if ms>100: slow+=1
	check(frames>30,"Loading animation keeps drawing during full-world creation")
	while game.loading!=null: await process_frame
	check(game.world.width==480 and game.world.height==480 and game.world.terrain.count(World.RIVER)==0 and game.world.terrain.count(World.DEEP)==0,"Loading enters the selected full-land world")
	game.paused=true; game._update_pause_buttons()
	metrics.loading={"frames":frames,"worker_max_ms":highest,"worker_over100":slow,"handoff_ms":handoff}
	await capture(tag+"-loading-result")
	await boundary_review()
	await boundary_review(true)
	var old=Save.decode(JSON.parse_string(FileAccess.get_file_as_string("res://test-output/ground-world.json"))).world
	var encoded=Save.encode(old); encoded.erase("saved_at")
	setup_world(old); game._update_status()
	for z in [.45,1.2,3.0]: focus_cell(Vector2(192,128),z); await process_frame
	var after=Save.encode(old); after.erase("saved_at")
	check(encoded==after,"Loading and zooming an existing world preserves all saved cells and life")
	await capture(tag+"-legacy-world")
	FileAccess.open("res://test-output/"+tag+"-interaction.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("GENERATION INTERACTION: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func boundary_review(animated: bool=false) -> void:
	var w=World.generate({"width":96,"height":64,"seed":17821,"template":"boring_plains","trees":0})
	w.weather_enabled=false; w.spread_enabled=false
	var rows=range(0,w.height,4); rows.append(w.height-1)
	var columns=range(0,w.width,4); columns.append(w.width-1)
	for y in rows:
		for x in columns:
			var i=y*w.width+x; w.biomes[i]=World.TEMPERATE; w.plants[i]=1
			w.plant_age[i]=w.maturity(i)*2; w.plant_stage[i]=World.ADULT
	w.prepare_ecology(); setup_world(w); game._select_category(-1); game._select_tool(-1)
	if animated:
		for y in [0,4,w.height-4,w.height-1]:
			for x in [0,4,w.width-4,w.width-1]:
				var i=y*w.width+x
				game.view.transitions[i]={"cell":i,"species":1,"stage":World.ADULT,"kind":"grow","active":true,"started":game.view.real_time-.6,"duration":1.25}
		game.view.set_process(false)
	for z in [.6,3.0]:
		for corner in [Vector2.ZERO,Vector2(w.width,w.height)]:
			game.view.zoom=z; game.view.camera=Vector2(480,300)-corner*World.TILE*z
			game.view.show_plants=true; game.view.queue_redraw(); game.view.effects.queue_redraw()
			await process_frame; await RenderingServer.frame_post_draw
			var vegetation=root.get_texture().get_image()
			game.view.show_plants=false; game.view.queue_redraw(); game.view.effects.queue_redraw()
			await process_frame; await RenderingServer.frame_post_draw
			var ground=root.get_texture().get_image()
			var scale_factor=Vector2(vegetation.get_size())/game.size
			var rect=Rect2(game.view.camera*scale_factor,Vector2(w.width,w.height)*World.TILE*z*scale_factor).grow(2)
			var outside=0; var inside=0
			for y in range(5,int(game.view.size.y*scale_factor.y)-5):
				for x in range(5,int(game.view.size.x*scale_factor.x)-5):
					if vegetation.get_pixel(x,y)==ground.get_pixel(x,y): continue
					if rect.has_point(Vector2(x,y)): inside+=1
					else: outside+=1
			metrics[("animated-edge-" if animated else "edge-")+str(z)+str(corner)]={"outside":outside,"inside":inside}
			check(outside==0 and inside>30,("Animated" if animated else "Visible")+" canopy clips to actual world boundary at "+str(z)+" / "+str(corner))
			game.view.show_plants=true; game.view.queue_redraw(); game.view.effects.queue_redraw()
			await capture(tag+"-"+("animated-edge-" if animated else "edge-")+str(z)+("-start" if corner==Vector2.ZERO else "-end"))
	game.view.set_process(true)
