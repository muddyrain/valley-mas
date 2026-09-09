extends "res://tests/art_runtime.gd"

func run() -> void:
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "ground-after"
	Save.directory="user://test-runs/ground-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	var model_path="res://test-output/ground-world.json"
	var w
	if tag=="ground-before":
		w=World.generate({"width":384,"height":256,"seed":319762786,"template":"continent","trees":.8})
		FileAccess.open(model_path,FileAccess.WRITE).store_string(JSON.stringify(Save.encode(w)))
	else:
		w=Save.decode(JSON.parse_string(FileAccess.get_file_as_string(model_path))).world
		w.image=w.bake_image()
	var original=Save.decode(JSON.parse_string(FileAccess.get_file_as_string(model_path))).world
	check(w.terrain==original.terrain and w.biomes==original.biomes and w.plants==original.plants and w.plant_stage==original.plant_stage and w.elevation==original.elevation,"Art review uses unchanged terrain, biome, elevation and vegetation arrays")
	metrics.model_hash=(w.terrain+w.biomes+w.plants+w.plant_stage).hex_encode().sha256_text()
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	if args.has("relief-only"):
		await relief_review(tag); quit(0 if failures.is_empty() else 1); return
	for shot in [["island",Vector2(192,128),.85],["middle",Vector2(192,132),2.2],["close",Vector2(205,135),5.0],["shore",Vector2(260,190),4.0]]:
		focus_cell(shot[1],shot[2]); game.view.show_plants=true; await capture(tag+"-"+shot[0])
		game.view.show_plants=false; await capture(tag+"-"+shot[0]+"-ground")
	game.view.show_plants=true
	if args.has("relief"): await relief_review(tag)
	if tag=="ground-target" or args.has("target"): quit(0 if failures.is_empty() else 1); return
	await life_sheet(tag)
	if args.has("verify"):
		if not args.has("relief"): await biome_review(tag)
		await live_overview()
		await motion_sample()
	FileAccess.open("res://test-output/"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("GROUND RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func relief_review(tag: String) -> void:
	var w=Fixtures.empty({"width":96,"height":72,"seed":782341,"trees":0})
	w.terrain.fill(World.GRASS); w.biomes.fill(World.BIRCH); w.bare_soil.fill(0); w.elevation.fill(.1)
	w.weather_enabled=false; w.spread_enabled=false; w.prepare_ecology(); w.image=w.bake_image()
	w.begin_stroke(); w.paint(Vector2i(48,36),16,World.HILLS); w.end_stroke()
	w.begin_stroke(); w.paint(Vector2i(48,36),9,World.MOUNTAIN); w.end_stroke()
	w.prepare_ecology(); setup_world(w); game._select_tool(-1); game._update_status()
	for zoom in [1.1,2.2,5.0]:
		focus_cell(Vector2(48,36),zoom); await capture(tag+"-hills-"+str(zoom))
	check(w.terrain[36*96+35]==World.HILLS and w.terrain[36*96+48]==World.MOUNTAIN,"Raised hill and mountain brush retain their actual terrain types")
	var snow_pixels=0
	for y in range(27*12,45*12):
		for x in range(39*12,57*12):
			var c=w.image.get_pixel(x,y)
			if c.r>.8 and c.b>.8: snow_pixels+=1
	check(snow_pixels>50,"A small painted summit still has visible complete snowy crests")
