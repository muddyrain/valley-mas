extends "res://tests/refinement_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/generation-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	game._open_new_world()
	for type in game.TEMPLATES:
		await click(game.template_buttons[type])
		check(game.generation_controls.size()==game.Templates.CONTROLS[type].size(),"Effective controls: "+type)
		check(game.rivers_toggle.visible==(type in game.Templates.RIVER_TYPES),"Effective river toggle: "+type)
		check(game.generation_thread==null and game.map_preview.texture==game.previews[type],"Fixed thumbnail: "+type)
		for key in game.generation_controls: game.generation_controls[key].value=game.generation_controls[key].max_value
		game.density_slider.value=.55
	for type in game.TEMPLATES:
		await click(game.template_buttons[type])
		for key in game.generation_controls: check(game.generation_controls[key].value==game.generation_controls[key].max_value,"Retained "+type+" "+key)
		check(is_equal_approx(game.density_slider.value,.55),"Retained vegetation: "+type)
	await capture("generation-menu")
	game._close_modal(); game._open_new_world()
	check(game.generation_controls.strait_width.value==10,"Reopening retains the selected recipe")
	game._close_modal()
	var args=OS.get_cmdline_user_args()
	var seeds=[319762786,168760530,17821,48217] if "full" in args else [319762786]
	for type in game.TEMPLATES:
		if "fjords" in args and type!="fjords": continue
		for seed_value in seeds:
			var started=Time.get_ticks_usec()
			var w=World.generate({"width":384,"height":384,"seed":seed_value,"template":type})
			metrics[type+"-"+str(seed_value)]={"seconds":(Time.get_ticks_usec()-started)/1000000.0,"plants":w.plant_count()}
			w.weather_enabled=false; setup_world(w)
			game._select_category(-1); game._select_tool(-1); game._update_status()
			game.view.fit_world(); game.view.zoom*=.76
			game.view.camera=(game.view.size-Vector2(w.width,w.height)*World.TILE*game.view.zoom)/2
			game.view.queue_redraw()
			await capture("generation-"+type+"-"+str(seed_value))
			if seed_value==seeds[0]:
				focus_cell(Vector2(w.width,w.height)*.5,2.2); await capture("generation-"+type+"-middle")
				game.view.show_plants=false; game.view.queue_redraw(); await capture("generation-"+type+"-ground")
				game.view.show_plants=true; game.view.queue_redraw()
		print("NATIVE GENERATION "+type)
	FileAccess.open("res://test-output/generation-fjords.json" if "fjords" in args else "res://test-output/generation-runtime.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("GENERATION RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)
