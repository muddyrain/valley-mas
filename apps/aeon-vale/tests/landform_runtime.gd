extends "res://tests/weather_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/landform-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var w=World.generate({"width":384,"height":256,"seed":781936,"template":"continent","trees":.9})
	setup_world(w); game._select_category(-1); game._select_tool(-1)
	await capture("140-landform-overview")
	game.view.set_distance(1); await capture("141-landform-middle")
	game.view.set_distance(2); await capture("142-landform-near")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("143-landform-ground")
	game.view.show_plants=true
	var i=0
	for at in w.plants.size():
		if w.plants[at]==2 and w.plant_stage[at]==World.ADULT: i=at; break
	focus_cell(World.Landscape.plant_anchor(w,i)/World.TILE-Vector2(0,2),5.0)
	var anchor=(game.view.size/2-game.view.camera)/game.view.zoom
	game.view.zoom_at(game.view.size/2,100)
	var extreme_zoom=game.view.zoom
	check(game.view.zoom==32.0,"Extreme close view reaches 32x")
	check(((game.view.size/2-game.view.camera)/game.view.zoom).distance_to(anchor)<.01,"Zoom preserves the pointer's world anchor")
	await capture("144-landform-extreme")
	game.view.zoom_at(game.view.size/2,1/1.18)
	check(game.view.zoom<32 and game.view.zoom>20,"Wheel zoom remains reversible at the upper limit")
	var wheel=InputEventMouseButton.new(); wheel.position=game.view.size/2; wheel.button_index=MOUSE_BUTTON_WHEEL_UP; wheel.pressed=true
	root.push_input(wheel,true); await process_frame
	wheel=wheel.duplicate(); wheel.pressed=false; root.push_input(wheel,true); await process_frame
	check(game.view.zoom==32,"Actual wheel input reaches extreme zoom")
	var before_pan=game.view.camera
	var key=InputEventKey.new(); key.keycode=KEY_D; key.physical_keycode=KEY_D; key.pressed=true
	Input.parse_input_event(key); await create_timer(.15).timeout
	key=key.duplicate(); key.pressed=false; Input.parse_input_event(key); await process_frame
	check(game.view.camera!=before_pan,"WASD still pans in the extreme close view while paused")
	await click(game.group_buttons[1])
	check(game.tool_buttons.has(World.TREE_FERTILIZER),"The nature toolbar opens after wheel and keyboard input")
	if not game.tool_buttons.has(World.TREE_FERTILIZER):
		quit(1); return
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	game.view.radius=1; await pointer(game.view.size/2)
	await capture("145-landform-extreme-brush")
	game.view.set_distance(1)
	await escape(); await escape(); await escape()
	check(game.modal==null and game.selected_tool==-1,"Esc power/settings behavior survives zoom changes")
	check(w.terrain==World.generate({"width":384,"height":256,"seed":781936,"template":"continent","trees":0}).terrain,"Observation does not change the terrain")
	var result={"checks":checks,"failures":failures,"max_zoom":extreme_zoom}
	FileAccess.open("res://test-output/landform-report.json",FileAccess.WRITE).store_string(JSON.stringify(result,"\t"))
	print("LANDFORM RUNTIME: "+JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
