extends "res://tests/weather_runtime.gd"

# Wall-clock 1x reproduction: no powers, fixed map, normal HUD and rendering.
func run() -> void:
	Save.directory="user://test-runs/idle-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	Engine.max_fps=120; DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	if not OS.get_cmdline_user_args().has("large-window"):
		DisplayServer.window_set_size(Vector2i(1440,900))
		await process_frame
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "current"
	var dimensions: Vector2i=World.MAP_SIZES[-1] if args.has("wide") else Vector2i(384,256)
	var w=World.generate({"width":dimensions.x,"height":dimensions.y,"seed":781936,"template":"continent","trees":.9})
	setup_world(w); game._select_category(-1); game._select_tool(-1)
	game.view.set_distance(0 if args.has("far") else 1)
	if args.has("no-spread"): w.spread_enabled=false
	for frame in 45: await process_frame
	game.paused=args.has("paused"); game.time_speed=1; game._update_pause_buttons()
	var times=[]; var spikes=[]; var steps=[]
	var started=Time.get_ticks_usec(); var prior=started
	var initial_age=w.age; var prior_tick=w.eco_tick; var prior_spread=w.spread_changes; var prior_surface=game.view.surface_revision
	while Time.get_ticks_usec()-started<15000000:
		await process_frame
		var now=Time.get_ticks_usec(); var elapsed=(now-prior)/1000.0
		var sample={"at":(now-started)/1000000.0,"ms":elapsed,"tick":w.eco_tick,"stepped":w.eco_tick!=prior_tick,"spread":w.spread_changes-prior_spread,"surface":game.view.surface_revision!=prior_surface}
		times.append(elapsed)
		if elapsed>25: spikes.append(sample)
		if w.eco_tick!=prior_tick: steps.append(sample)
		prior=now; prior_tick=w.eco_tick; prior_spread=w.spread_changes; prior_surface=game.view.surface_revision
	game.paused=true; game._update_pause_buttons()
	var slow33=0; var slow50=0
	for t in times:
		if t>33.333: slow33+=1
		if t>50: slow50+=1
	times.sort()
	var report={"seconds":(prior-started)/1000000.0,"world_seconds":w.age-initial_age,"plants":w.plant_count(),"spread_changes":w.spread_changes,"frames":times.size(),"p50_ms":times[int(times.size()*.5)],"p95_ms":times[int(times.size()*.95)],"p99_ms":times[int(times.size()*.99)],"max_ms":times[-1],"over33":slow33,"over50":slow50,"steps":steps,"spikes":spikes}
	FileAccess.open("res://test-output/idle-"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("IDLE REPRO: "+JSON.stringify(report))
	check(slow33==0,"1x idle has no recurring frame longer than two 60 Hz refreshes")
	quit(0 if failures.is_empty() else 1)
