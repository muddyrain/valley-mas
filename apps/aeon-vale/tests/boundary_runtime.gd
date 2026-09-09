extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/boundary-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	for type in game.TEMPLATES:
		var w=World.generate({"width":384,"height":384,"seed":319762786,"template":type})
		w.weather_enabled=false; setup_world(w)
		game._select_category(-1); game._select_tool(-1); game._update_status()
		game.view.fit_world(); game.view.zoom*=.88
		game.view.camera=(game.view.size-Vector2(w.width,w.height)*World.TILE*game.view.zoom)/2
		game.view.queue_redraw(); game.view.effects.queue_redraw()
		await capture("square-"+type)
		check(w.width==w.height,"Square native world: "+type)
		check(game.view.boundary_solid==(type in ["boring_plains","box_world"]),"Outline matches actual edge: "+type)
		await inspect_outline(type)
		if type in ["continent","boring_plains"]:
			DisplayServer.window_set_size(Vector2i(1100,720)); await process_frame
			game.view.fit_world(); game.view.queue_redraw(); game.view.effects.queue_redraw()
			await capture("square-"+type+"-small"); await inspect_outline(type)
			game.view.zoom_at(game.view.size/2,2.1); game.view.pan_camera(Vector2(65,35))
			await process_frame
			var rect=game.view.world_boundary_rect()
			check(rect.position==(game.view.camera+game.view.quake_offset).round(),"Frame tracks camera: "+type)
			check(rect.size==(Vector2(w.width,w.height)*World.TILE*game.view.zoom).round(),"Frame tracks zoom: "+type)
			await capture("square-"+type+"-zoom")
			DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
		if type=="boring_plains":
			w.paint(Vector2i.ZERO,4,World.DEEP); game.view.refresh_edit(); game.view.effects.queue_redraw()
			await settle_surface(); await process_frame; await RenderingServer.frame_post_draw
			check(not game.view.boundary_solid,"Opening water at the edge changes solid frame to dashed")
	var old=Save.decode(JSON.parse_string(FileAccess.get_file_as_string("res://test-output/ground-world.json"))).world
	var before=Save.encode(old); before.erase("saved_at")
	setup_world(old); game._update_status(); game.view.fit_world()
	await capture("square-legacy-rectangle")
	var after=Save.encode(old); after.erase("saved_at")
	check(before==after,"Existing rectangular world remains unchanged")
	game._open_new_world(); await capture("square-menu")
	for n in game.size_buttons.size():
		check(game.size_buttons[n].tooltip_text=="%d × %d"%[World.MAP_SIZES[n].x,World.MAP_SIZES[n].y],"Creation shows square size: "+str(n))
	FileAccess.open("res://test-output/square-runtime.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("SQUARE RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func inspect_outline(type: String) -> void:
	await process_frame; await RenderingServer.frame_post_draw
	var image=root.get_texture().get_image()
	var scale_factor=Vector2(image.get_size())/game.size
	var rect=game.view.world_boundary_rect()
	var left=roundi(rect.position.x*scale_factor.x); var right=roundi(rect.end.x*scale_factor.x)
	var top=roundi(rect.position.y*scale_factor.y)
	var marked=0; var span=right-left-8
	var expected=Color("465847") if game.view.boundary_solid else Color(.70,.81,.88).lerp(World.COLORS[World.DEEP],.48)
	for x in range(left+4,right-4):
		var found=false
		for y in range(top-2,top+2):
			var c=image.get_pixel(x,y)
			if Vector3(c.r,c.g,c.b).distance_to(Vector3(expected.r,expected.g,expected.b))<.065: found=true
		if found: marked+=1
	metrics[type+"-"+str(image.get_width())]={"edge_pixels":marked,"span":span,"solid":game.view.boundary_solid}
	check(marked>span*.85 if game.view.boundary_solid else marked>span*.25 and marked<span*.8,"Visible fine solid/dashed top boundary: "+type+" / "+str(marked))
