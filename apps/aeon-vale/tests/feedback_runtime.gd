extends "res://tests/seasons_runtime.gd"

func run() -> void:
	create_timer(90).timeout.connect(func():
		push_error("Feedback runtime timed out at check %d; loading=%s" % [checks,str(game.loading!=null)])
		quit(1)
	)
	Save.directory="user://test-runs/feedback-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var w=Fixtures.empty({"width":96,"height":64,"seed":4673,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.BIRCH); w.prepare_ecology(); w.image=w.bake_image()
	setup_world(w)
	game.view.zoom=4; game.view.camera=game.view.size/2-Vector2(48,32)*World.TILE*4
	await click(game.group_buttons[1]); await click(game.tool_buttons[World.BERRY_SEEDS])
	game.view.radius=10
	var center: Vector2=game.view.size/2
	await cast(center)
	var berry_count=w.plant_count()
	check(berry_count>5,"A real berry cast places multiple visible bushes on empty suitable soil")
	for i in w.plants.size():
		if w.plants[i]>0: check(w.plants[i]==World.BERRY and w.plant_stage[i]==World.ADULT,"Placed berries are complete bushes")
	check(game.power_panel.get_theme_stylebox("panel") is StyleBoxFlat,"Icon and close share a visible card background")
	check(game.power_close.get_theme_stylebox("normal") is StyleBoxEmpty,"Close is inside the card rather than a separate boxed button")
	await capture("110-berry-cast")
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	game.view.radius=16
	await cast(center)
	check(w.plant_count()>berry_count,"Tree fertilizer adds trees into suitable unoccupied sites")
	check(w.age==0,"Paused active casts do not advance the natural world")
	var trees=0
	for i in w.plants.size():
		if World.is_tree(w.plants[i]):
			trees+=1
			check(w.can_live(i,w.plants[i]) and w.plant_stage[i]==World.ADULT,"Fertilizer trees match their local ecology")
	check(trees>5,"The birch habitat visibly fills with trees")
	await capture("111-tree-cast")
	await create_timer(1.35).timeout
	check(game.view.transitions.is_empty(),"Active growth animation finishes while the world remains paused")
	await capture("112-birch-grove")
	await click(game.speed_button)
	await capture("113-shared-hourglass")
	game._close_speed_panel()
	var serial=game.view.cast_serial
	game.paused=false; game._update_pause_buttons()
	await pointer(center)
	var down=InputEventMouseButton.new(); down.position=center; down.button_index=MOUSE_BUTTON_LEFT; down.pressed=true
	root.push_input(down,true)
	await create_timer(.8).timeout
	down=down.duplicate(); down.pressed=false; root.push_input(down,true)
	check(game.view.cast_serial>=serial+4,"Holding in one position continues fixed-rate casting")
	check(w.age>.6,"Holding the brush no longer freezes world time")
	game.paused=true; game._update_pause_buttons()
	w.terrain[32*w.width+48]=World.MOUNTAIN
	await cast(center)
	var invalid=false
	for event in game.view.cast_events: invalid=invalid or event.invalid
	check(invalid,"Blocked ground has transient invalid feedback")
	var camera_before: Vector2=game.view.camera
	var zoom_before: float=game.view.zoom
	var cast_before: int=game.view.cast_serial
	game.paused=false; game._update_pause_buttons()
	down=down.duplicate(); down.pressed=true; root.push_input(down,true)
	var key=InputEventKey.new(); key.keycode=KEY_D; key.physical_keycode=KEY_D; key.pressed=true
	Input.parse_input_event(key)
	await create_timer(.2).timeout
	key=key.duplicate(); key.pressed=false; Input.parse_input_event(key); await process_frame
	check(game.view.camera.distance_to(camera_before)>20,"WASD moves the camera while actively holding a power")
	var wheel=InputEventMouseButton.new(); wheel.position=center; wheel.button_index=MOUSE_BUTTON_WHEEL_UP; wheel.pressed=true
	root.push_input(wheel,true); await process_frame
	check(game.view.zoom>zoom_before,"The wheel zooms while actively holding a power")
	check(game.view.painting and game.view.cast_serial>cast_before,"Camera movement keeps the held cast active")
	down=down.duplicate(); down.pressed=false; root.push_input(down,true); await process_frame
	check(not game.view.painting,"Releasing after combined camera input ends the stroke")
	game.paused=true; game._update_pause_buttons()
	game._select_tool(-1)
	game.view.set_distance(0)
	w.visual_events.append({"cell":32*w.width+48,"kind":"grow","species":2,"stage":2,"active":false})
	game.view.consume_events()
	check(not game.view.transitions.has(32*w.width+48),"Natural growth animation is suppressed at distant view")
	var island=World.generate({"width":288,"height":192,"seed":68324,"template":"continent","trees":.85})
	setup_world(island); game._select_category(-1)
	await capture("114-new-overview")
	game.view.set_distance(1); await capture("115-new-middle")
	game.view.set_distance(2); await capture("116-new-close")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("117-new-ground")
	game.view.show_plants=true
	game.dirty=false; game._open_new_world()
	var first=game.map_pattern
	game._close_modal(); game._open_new_world()
	check(game.map_pattern==first and game.generation_thread==null and game.map_preview.texture==game.previews[game.selected_template],"Reopening selection retains a static thumbnail and does not generate a world")
	check(not has_seed_field(game.modal),"The map selection screen contains no seed field")
	game._close_modal()
	var file=FileAccess.open("res://test-output/feedback-runtime-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks,"failures":failures,"trees":trees,"berries":berry_count}))
	print("FEEDBACK RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)

func has_seed_field(node: Node) -> bool:
	if node is Label and node.text=="种子": return true
	for child in node.get_children():
		if has_seed_field(child): return true
	return false
