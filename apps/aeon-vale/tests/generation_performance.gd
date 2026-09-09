extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/generation-performance-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	Engine.max_fps=120; DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	for type in ["boring_plains","islands"]:
		var started=Time.get_ticks_usec()
		var w=World.generate({"width":480,"height":480,"seed":781936,"template":type,"trees":1.0,"islands":7,"land_size":10,"coast":10})
		var creation=(Time.get_ticks_usec()-started)/1000000.0
		setup_world(w); game._select_category(-1); game._select_tool(-1)
		for moving in [false,true]:
			focus_cell(Vector2(240,240),2.2); await settle_surface(); await create_timer(.5).timeout
			focus_cell(Vector2(240,240),.8); await create_timer(.5).timeout
			game.paused=false; game.time_speed=1; game._update_pause_buttons()
			var times=[]; var prior=Time.get_ticks_usec(); var age=w.age
			var frames=900 if moving else 1800
			for frame in frames:
				if moving: focus_cell(Vector2(240+sin(frame*.012)*70,240+cos(frame*.014)*40),.85+sin(frame*.014)*.65)
				await process_frame
				var now=Time.get_ticks_usec(); times.append((now-prior)/1000.0); prior=now
			game.paused=true; game._update_pause_buttons()
			var over33=0
			for ms in times:
				if ms>33.333: over33+=1
			times.sort()
			var report={"generation_seconds":creation,"frames":times.size(),"plants":w.plant_count(),"world_seconds":w.age-age,"p95_ms":times[int(times.size()*.95)],"max_ms":times[-1],"over33":over33}
			metrics[type+("-moving" if moving else "-idle")]=report
			check(w.age>age,"World advances at 1x throughout "+type)
			check(times[int(times.size()*.95)]<33.333,"95 percent of frames stay within two 60Hz refreshes: "+type)
			print("PERFORMANCE "+type+" "+str(moving)+" "+JSON.stringify(report))
	FileAccess.open("res://test-output/square-performance.json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	quit(0 if failures.is_empty() else 1)
