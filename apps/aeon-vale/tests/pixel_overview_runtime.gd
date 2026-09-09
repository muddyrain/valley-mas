extends "res://tests/art_runtime.gd"

func run() -> void:
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "pixel-after"
	Save.directory="user://test-runs/pixel-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	var w=Save.decode(JSON.parse_string(FileAccess.get_file_as_string("res://test-output/ground-world.json"))).world
	var original=Save.encode(w)
	w.image=w.bake_image(); setup_world(w)
	game._select_category(-1); game._select_tool(-1); game._update_status()
	for z in [.3,.85,1.25,2.2,5.0]:
		focus_cell(Vector2(192,128),z); game.view.show_plants=true
		await capture(tag+"-"+str(z))
		game.view.show_plants=false; await capture(tag+"-"+str(z)+"-ground")
	var observed=Save.encode(w); observed.erase("saved_at"); original.erase("saved_at")
	check(observed==original,"Viewing and redrawing a legacy world preserves every saved model field except the save timestamp")
	game.view.show_plants=true
	for seed_value in [319762786,168760530,17821]:
		w=World.generate({"width":384,"height":256,"seed":seed_value,"template":"continent","trees":.8})
		setup_world(w); game._update_status(); focus_cell(Vector2(192,128),.75)
		await capture(tag+"-new-"+str(seed_value))
		FileAccess.open("res://test-output/"+tag+"-world-"+str(seed_value)+".json",FileAccess.WRITE).store_string(JSON.stringify(Save.encode(w)))
	if args.has("verify"):
		await biome_review(tag)
		await live_overview()
	FileAccess.open("res://test-output/"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("PIXEL OVERVIEW RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)
