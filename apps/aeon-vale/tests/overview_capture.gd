extends "res://tests/weather_runtime.gd"

func run() -> void:
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "current15"
	Save.directory="user://test-runs/overview-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	Engine.max_fps=120; DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var w=World.generate({"width":384,"height":256,"seed":350351710,"template":"continent","trees":.8})
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	await capture(tag+"-fit")
	game.view.show_plants=false; await capture(tag+"-ground"); game.view.show_plants=true
	for z in [.4,.8,1.1,1.5,2.2,5.0]:
		focus_cell(Vector2(192,128),z)
		await capture(tag+"-zoom-"+str(z))
	game.view.set_distance(0)
	await create_timer(.5).timeout
	game.paused=false; game._update_pause_buttons()
	var times=[]; var previous=Time.get_ticks_usec(); var age=w.age
	for frame in 600:
		await process_frame
		var now=Time.get_ticks_usec(); times.append((now-previous)/1000.0); previous=now
	game.paused=true; game._update_pause_buttons()
	var over33=0
	for t in times:
		if t>33.333: over33+=1
	times.sort()
	var report={"frames":times.size(),"world_seconds":w.age-age,"p95":times[int(times.size()*.95)],"p99":times[int(times.size()*.99)],"max":times[-1],"over33":over33,"plants":w.plant_count()}
	FileAccess.open("res://test-output/overview-"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("OVERVIEW CAPTURE: "+JSON.stringify(report)); quit()
