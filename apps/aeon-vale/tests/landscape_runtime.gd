extends "res://tests/seasons_runtime.gd"

func wait_preview() -> void:
	await process_frame
	check(game.map_preview.texture==game.previews[game.selected_template] and game.generation_thread==null,"A bundled template thumbnail is immediately ready without world generation")

func hold_key(code: Key, duration: float, ctrl: bool=false) -> void:
	var press=InputEventKey.new(); press.keycode=code; press.physical_keycode=code; press.pressed=true; press.ctrl_pressed=ctrl
	Input.parse_input_event(press); await create_timer(duration).timeout
	press=press.duplicate(); press.pressed=false; Input.parse_input_event(press); await process_frame

func wheel(point: Vector2) -> void:
	await pointer(point)
	var event=InputEventMouseButton.new(); event.position=point; event.button_index=MOUSE_BUTTON_WHEEL_UP; event.pressed=true
	root.push_input(event,true); await process_frame
	event=event.duplicate(); event.pressed=false; root.push_input(event,true); await process_frame

func run() -> void:
	Save.directory="user://test-runs/landscape-runtime-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	await click(find_button(game.title_screen,"创 造 世 界"))
	await wait_preview()
	await capture("90-generation-preview")
	var first=game.map_preview.texture
	await click(find_button(game.modal,"地形细调  ›"))
	await process_frame
	game.generation_controls.coast.value=7
	game.generation_controls.land_size.value=8
	await wait_preview()
	check(first==game.map_preview.texture and game.generation_thread==null,"Shaping controls retain the template illustration without generating a world")
	await capture("91-generation-options")
	game.name_input.text="风栖之岛"
	await click(find_button(game.modal,"让世界诞生"))
	while game.loading!=null: await process_frame
	game.paused=true; game._update_pause_buttons()
	check(game.world.generation_settings.coast==7 and game.world.generation_settings.land_size==8,"Creation applies the chosen shaping values")
	check(game.world.world_name=="风栖之岛","Creation applies the chosen world name")
	var rendered=game.view.overview_image.duplicate()
	rendered.blend_rect(game.view.canopy_image,Rect2i(Vector2i.ZERO,rendered.get_size()),Vector2i.ZERO)
	check(rendered.get_data()==World.Landscape.preview(game.world).get_data(),"The entered world's overview matches its actual terrain and plants")
	await capture("92-landscape-overview")
	game.view.set_distance(1); await capture("93-landscape-middle")
	game.view.set_distance(2); await capture("94-landscape-close")
	game.view.show_plants=false; game.view.queue_redraw(); await capture("95-landscape-surface")
	game.view.show_plants=true; game.view.queue_redraw()
	await click(game.group_buttons[1]); await click(game.tool_buttons[World.TREE_FERTILIZER])
	await capture("96-landscape-toolbar")
	var sample=game.tool_buttons[World.TREE_FERTILIZER].get_global_rect()
	check(game.pause_button.size==game.speed_button.size and game.pause_button.size==game.tool_buttons[World.TREE_FERTILIZER].size,"Time and ordinary tool buttons share the same dimensions")
	check(absf(game.speed_button.get_global_rect().end.y-game.tool_buttons[World.BERRY_SEEDS].get_global_rect().end.y)<1,"All bottom-row buttons align")
	check(game.brush_button.size.x==game.power_close.size.x and game.power_close.size.y>=44,"Power close keeps the card width and a usable hit area")
	await click(game.speed_button)
	check(game.speed_value_button.visible and not game.speed_options_row.visible,"Only the current multiplier is initially shown")
	check(game.speed_value_button.size==game.brush_button.size,"Multiplier and brush tiles have consistent sizes")
	await capture("97-speed-collapsed")
	await click(game.speed_value_button)
	check(game.speed_options_row.visible and game.speed_choices.size()==5,"Clicking the multiplier expands five rates")
	await capture("98-speed-expanded")
	var zoom: float=game.view.zoom
	await wheel(game.view.size*.5)
	check(game.view.zoom>zoom,"Map scroll remains available while speed choices are expanded")
	var terrain=game.world.terrain.duplicate(); var plants=game.world.plants.duplicate()
	var drag_start: Vector2=game.view.camera
	await pointer(game.view.size*.5)
	var drag=InputEventMouseButton.new(); drag.button_index=MOUSE_BUTTON_MIDDLE; drag.position=game.view.size*.5; drag.pressed=true
	root.push_input(drag,true); await process_frame
	var motion=InputEventMouseMotion.new(); motion.position=drag.position+Vector2(60,30); motion.relative=Vector2(60,30); motion.button_mask=MOUSE_BUTTON_MASK_MIDDLE
	root.push_input(motion,true); await process_frame
	drag=drag.duplicate(); drag.position=motion.position; drag.pressed=false; root.push_input(drag,true); await process_frame
	check(game.view.camera.distance_to(drag_start)>50,"Map dragging remains available while time choices are open")
	await cast(game.view.size*.5)
	check(game.world.terrain==terrain and game.world.plants==plants,"Speed mode does not cast the retained power")
	var camera: Vector2=game.view.camera
	await hold_key(KEY_D,.3)
	check(game.view.camera.x<camera.x-50,"WASD moves the camera while paused and in speed mode")
	await click(game.speed_choices[3])
	check(game.time_speed==4 and game.paused and game.selected_tool==World.TREE_FERTILIZER and game.power_panel.visible,"Choosing a rate restores the power and preserves pause")
	for code in [KEY_W,KEY_A,KEY_S]:
		camera=game.view.camera
		await hold_key(code,.15)
		check(game.view.camera.distance_to(camera)>20,"Camera responds to direction "+str(code))
	game._open_settings()
	var enabled: bool=game.world.spread_enabled
	await click(game.spread_toggle)
	check(game.world.spread_enabled!=enabled and Save.decode(Save.encode(game.world)).world.spread_enabled==game.world.spread_enabled,"World setting changes and persists ecological spread")
	camera=game.view.camera; await hold_key(KEY_D,.15)
	check(game.view.camera==camera,"Settings modal prevents accidental camera movement")
	game._close_modal(); game._open_new_world()
	game.name_input.grab_focus(); camera=game.view.camera
	await hold_key(KEY_A,.12)
	check(game.view.camera==camera,"Text entry never moves the camera")
	game._close_modal()
	await preview_races()
	await ecology_scene()
	await pending_surface_switch()
	var report=FileAccess.open("res://test-output/landscape-runtime-report.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics})); report.close()
	print("AEON VALE LANDSCAPE RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func preview_races() -> void:
	game.dirty=false; game._open_new_world(); game.selected_size=0
	var previous=game.world.world_seed
	await click(game.template_buttons.fjords); await click(game.template_buttons.donut)
	check(game.generation_thread==null and game.map_preview.texture==game.previews.donut,"Rapid template choices only swap bundled thumbnails")
	await click(find_button(game.modal,"让世界诞生"))
	check(game.loading!=null and game.generation_thread!=null,"Creation starts a loading screen and a single world worker")
	while game.loading!=null: await process_frame
	game.paused=true; game._update_pause_buttons()
	check(game.world.world_seed!=previous and game.world.width==World.MAP_SIZES[0].x and game.world.template=="donut","Each creation randomizes a new map and applies its selected template")
	var camera: Vector2=game.view.camera
	await hold_key(KEY_S,.15,true)
	check(game.view.camera==camera and game.modal!=null,"Ctrl+S opens save without panning south")
	game._close_modal(); game._open_new_world()
	var retained=game.world
	game._close_modal()
	check(game.modal==null and game.world==retained and game.generation_thread==null,"Closing selection retains the current world without pending generation")

func ecology_scene() -> void:
	var w=Fixtures.empty({"width":80,"height":64,"seed":372,"trees":0})
	w.terrain.fill(World.FOREST); w.warmth.fill(.49); w.moisture.fill(.60); w.elevation.fill(.1)
	for i in w.terrain.size(): w.biomes[i]=World.BIRCH if i%w.width<40 else World.TEMPERATE
	w.prepare_ecology(); World.Landscape.populate(w,.8,Callable()); w.image=w.bake_image()
	setup_world(w); game._select_tool(-1); game._select_category(-1)
	game.view.zoom=3; game.view.camera=game.view.size/2-Vector2(40,32)*World.TILE*3
	game.view.queue_redraw(); game._update_status()
	await capture("99-ecology-before")
	var initial=w.biomes.duplicate(); var texture=terrain_bytes()
	var started=Time.get_ticks_usec()
	w.advance(World.YEAR_SECONDS*20); game.view.refresh_ecology(); game._update_status()
	await settle_surface()
	metrics.twenty_years_seconds=(Time.get_ticks_usec()-started)/1000000.0
	metrics.changed_tiles=w.spread_changes
	check(w.biomes!=initial and texture!=terrain_bytes(),"Twenty-year ecology changes update the actual ground textures")
	check(game.view.surface_revision==w.surface_revision and Save.decode(Save.encode(w)).world!=null,"Spread and newly adapted vegetation render and save together")
	var complete=w.image.duplicate(); complete.resize(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	var whole_bytes=complete.get_data(); var partial_bytes=game.view.overview_image.get_data()
	var different=0; var largest=0
	for i in whole_bytes.size():
		if whole_bytes[i]!=partial_bytes[i]: different+=1; largest=maxi(largest,absi(whole_bytes[i]-partial_bytes[i]))
	metrics.overview_different_bytes=different; metrics.overview_max_byte_delta=largest
	check(complete.get_data()==game.view.overview_image.get_data(),"Incremental overview updates match a full resample without seams")
	await capture("100-ecology-twenty-years")

func pending_surface_switch() -> void:
	var former=game.world
	former.begin_stroke(); var area=former.paint(Vector2i(18,18),8,World.BIOME_TOOLS+World.SAKURA); former.end_stroke()
	game.view.refresh_edit(area)
	check(game.view.surface_thread!=null,"Painting queues a background surface update")
	var fresh=Fixtures.empty({"width":32,"height":32,"trees":0})
	setup_world(fresh)
	await settle_surface()
	check(game.view.terrain_textures[Vector2i.ZERO].get_image().get_pixel(20,20)==fresh.image.get_pixel(20,20) and game.view.world==fresh,"An older render job cannot overwrite a newly entered world")
	setup_world(former); await settle_surface()
	var full=former.bake_image()
	check(former.image.get_data()==full.get_data(),"Edits are retained when leaving and returning during a surface update")

func terrain_bytes() -> PackedByteArray:
	var bytes=PackedByteArray()
	for texture in game.view.terrain_textures.values(): bytes.append_array(texture.get_image().get_data())
	return bytes
