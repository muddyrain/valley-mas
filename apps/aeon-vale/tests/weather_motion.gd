extends "res://tests/weather_runtime.gd"

func key(code: Key, pressed: bool) -> void:
	var event=InputEventKey.new(); event.keycode=code; event.physical_keycode=code; event.pressed=pressed
	Input.parse_input_event(event)

func run() -> void:
	var tempests=OS.get_cmdline_user_args().has("tempests")
	Save.directory="user://test-runs/weather-motion-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	Engine.max_fps=120; DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	if not OS.get_cmdline_user_args().has("large-window"):
		DisplayServer.window_set_size(Vector2i(1440,900))
		await process_frame
	var dimensions: Vector2i=World.MAP_SIZES[-1] if OS.get_cmdline_user_args().has("wide") else Vector2i(384,256)
	var w=World.generate({"width":dimensions.x,"height":dimensions.y,"seed":781936,"template":"continent","trees":.9})
	setup_world(w); game._select_category(1)
	var spot=Vector2i(w.width/2,w.height/2)
	var best=INF
	for i in w.terrain.size():
		if w.terrain[i] not in [World.GRASS,World.FOREST,World.HILLS]: continue
		var p=Vector2i(i%w.width,i/w.width); var d=Vector2(p).distance_to(Vector2(w.width,w.height)*.5)
		if d<best: best=d; spot=p
	var reports=[]
	for rate in [1,5]:
		for distance in 3:
			game.view.set_distance(distance)
			var center=focus_cell(Vector2(spot),game.view.zoom)
			w.rain_clouds.clear()
			w.tornadoes.clear()
			w.fair_clouds.clear()
			for n in 4:
				World.Weather.add_fair_cloud(w)
				w.fair_clouds[-1].x=spot.x-30+n*20
				w.fair_clouds[-1].y=spot.y+6
				w.fair_clouds[-1].life-=12
			for offset in [Vector2i(-30,-8),Vector2i(0,0),Vector2i(30,8)]: World.Weather.add_cloud(w,spot+offset,28,0,false,tempests and offset==Vector2i.ZERO)
			if tempests:
				for offset in [Vector2i(-12,0),Vector2i(0,0),Vector2i(12,0)]:
					w.begin_stroke(); var area=w.paint(spot+offset,12,World.TORNADO); w.end_stroke()
					game.view.refresh_edit(area)
			await click(game.tool_buttons[World.TREE_FERTILIZER if distance%2==0 else World.PLANT_FERTILIZER])
			game.view.radius=18; game.paused=false; game.time_speed=rate; game._update_pause_buttons()
			await pointer(center); await held(center,true)
			var initial=game.view.camera; var serial=game.view.cast_serial; var age=w.age
			var times=[]; var spikes=[]; var started=Time.get_ticks_usec()
			key(KEY_D,true)
			for frame in 240:
				var tick=Time.get_ticks_usec()
				if frame%60==0:
					key(KEY_D,frame%120==0); key(KEY_A,frame%120!=0)
					var event=InputEventMouseButton.new(); event.position=center; event.button_index=MOUSE_BUTTON_WHEEL_UP if frame%120==0 else MOUSE_BUTTON_WHEEL_DOWN; event.pressed=true
					root.push_input(event,true)
					event=event.duplicate(); event.pressed=false; root.push_input(event,true)
				await process_frame
				var frame_ms=(Time.get_ticks_usec()-tick)/1000.0
				times.append(frame_ms)
				if frame_ms>33:
					spikes.append({"frame":frame,"ms":frame_ms,"process_ms":Performance.get_monitor(Performance.TIME_PROCESS)*1000,"tick":w.eco_tick,"casts":game.view.cast_serial-serial,"rows":game.view.pending_rows.size(),"uploads":game.view.pending_terrain_uploads.size(),"transitions":game.view.transitions.size(),"clouds":w.rain_clouds.size()})
			key(KEY_D,false); key(KEY_A,false); await held(center,false)
			check(game.view.cast_serial>serial+3 and w.age>age,"Held fertilizer and the world keep running during rain and camera input")
			check(game.view.camera!=initial,"Real keyboard and wheel input move the camera during held fertilizer")
			var elapsed=(Time.get_ticks_usec()-started)/1000000.0
			times.sort(); var slow33=0; var slow50=0
			for t in times:
				if t>33: slow33+=1
				if t>50: slow50+=1
			reports.append({"rate":rate,"distance":distance,"seconds":elapsed,"world_seconds":w.age-age,"casts":game.view.cast_serial-serial,"p50_ms":times[120],"p95_ms":times[228],"p99_ms":times[237],"max_ms":times[-1],"over33":slow33,"over50":slow50,"spikes":spikes})
	var report={"checks":checks,"failures":failures,"samples":reports}
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "report"
	FileAccess.open("res://test-output/weather-motion-"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("AEON VALE WEATHER MOTION: "+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
