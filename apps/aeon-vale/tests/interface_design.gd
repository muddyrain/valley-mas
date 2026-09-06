extends "res://tests/landscape_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/design-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var before=OS.get_cmdline_user_args().has("before")
	var tag="before12" if before else "design12"
	game._open_new_world(); await wait_preview(); await capture(tag+"-new-world")
	check(absf(game.density_slider.get_global_rect().get_center().y-game.density_slider.get_parent().get_child(0).get_global_rect().get_center().y)<1,"Vegetation slider and label share their vertical center")
	check(game.map_preview.size.y>=250,"New-world preview has enough height to judge the island shape")
	fit(game.modal)
	await click(find_button(game.modal,"地形细调  ›")); await capture(tag+"-advanced")
	await process_frame
	check(game.advanced_panel.visible and not game.template_panel.visible and game.modal.find_children("*","ScrollContainer",true,false).is_empty(),"Advanced settings replace the template page without any scroll container")
	check(game.generation_controls.coast.get_global_rect().end.y<find_button(game.modal,"让世界诞生").get_global_rect().position.y,"Advanced controls fit above the persistent creation action")
	game.generation_controls.coast.value=8
	await click(find_button(game.modal,"‹  返回地形图案"))
	await click(find_button(game.modal,"地形细调  ›"))
	check(game.generation_controls.coast.value==8,"Advanced values survive a return to templates")
	game._close_modal()
	setup_world(World.generate({"width":128,"height":96,"seed":781936,"trees":.9}))
	game._select_category(-1); await capture(tag+"-home")
	game._select_category(1); await capture(tag+"-nature")
	var ordinary=game.tool_buttons[World.TREE_FERTILIZER]
	check(ordinary.size==game.pause_button.size and ordinary.size.x==ordinary.size.y,"Time and power tiles use the same square size")
	var row_gap=(game.speed_button.position.y-game.pause_button.position.y)-game.pause_button.size.y
	check(row_gap>=8,"Two rows of time buttons have a visible gap")
	game._open_settings()
	await pointer(game.spread_toggle.get_global_rect().get_center()); await capture(tag+"-checked-hover")
	var style=game.spread_toggle.get_theme_stylebox("hover_pressed")
	check(style is StyleBoxFlat and style.bg_color.g>=style.bg_color.b,"A checked world setting retains the forest palette on hover")
	var bounds=game.spread_toggle.get_global_rect()
	await click(game.spread_toggle); await capture(tag+"-unchecked-hover")
	check(bounds==game.spread_toggle.get_global_rect(),"Toggling a world setting does not move its hit area")
	check(not game.world.spread_enabled,"The redesigned spread setting changes the world rule")
	var weather=game.modal.find_child("NaturalWeather",true,false)
	await pointer(weather.get_global_rect().get_center()); await capture(tag+"-weather-hover")
	style=weather.get_theme_stylebox("hover_pressed")
	check(style is StyleBoxFlat and style.bg_color.g>=style.bg_color.b,"Checked weather hover uses the same palette")
	await click(weather)
	check(not game.world.weather_enabled,"The redesigned weather setting changes the world rule")
	weather.grab_focus(); await capture(tag+"-setting-focus")
	check(weather.has_focus(),"World settings retain a keyboard focus target")
	game._open_help(); await capture(tag+"-handbook"); handbook_fits(); game._close_modal()
	game._select_tool(World.OCEAN); await capture(tag+"-power")
	await click(game.speed_button); await capture(tag+"-hourglass")
	await click(game.speed_value_button); await capture(tag+"-speeds")
	await click(game.speed_panel.find_child("CloseTime",true,false))
	check(game.power_panel.visible and game.selected_tool==World.OCEAN,"The hourglass close icon restores the selected power")
	await click(game.power_close)
	check(game.selected_tool<0 and not game.brush_button.visible,"The power close icon cancels the power and its brush")
	DisplayServer.window_set_size(Vector2i(1100,720)); game._set_ui_scale(1.15)
	await create_timer(.3).timeout
	game._select_category(-1); await capture(tag+"-small-home")
	game._open_new_world(); await wait_preview(); await capture(tag+"-small-new"); fit(game.modal)
	await click(find_button(game.modal,"地形细调  ›")); await capture(tag+"-small-advanced"); fit(game.modal)
	check(game.generation_controls.coast.get_global_rect().end.y<find_button(game.modal,"让世界诞生").get_global_rect().position.y,"Small-window advanced controls stay above the creation button")
	game._close_modal(); game._open_help(); await capture(tag+"-small-handbook"); handbook_fits()
	game._close_modal(); game._select_category(1); await process_frame
	await scroll_tools_to_end(); await capture(tag+"-small-nature")
	check(absf(game.pause_button.get_global_rect().position.y-game.tool_buttons[World.TREE_FERTILIZER].get_global_rect().position.y)<1,"The horizontal scrollbar does not shift the two button rows")
	var tool_rect=game.tool_buttons[World.TREE_FERTILIZER].get_global_rect()
	check(game.tool_scroll.get_global_rect().encloses(tool_rect),"The last tool is fully inside the scrolled viewport")
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	check(game.selected_tool==World.TREE_FERTILIZER,"The last tool group remains reachable in a small window")
	game._set_ui_scale(.9); await process_frame
	game._open_new_world(); await wait_preview(); await capture(tag+"-90-new"); fit(game.modal)
	var result={"checks":checks,"failures":failures}
	FileAccess.open("res://test-output/"+tag+"-report.json",FileAccess.WRITE).store_string(JSON.stringify(result,"\t"))
	print("INTERFACE DESIGN: "+JSON.stringify(result))
	quit(0 if before or failures.is_empty() else 1)

func handbook_fits() -> void:
	var scroll=game.modal.find_children("*","ScrollContainer",true,false)[0]
	var last=scroll.get_child(0).get_children().back()
	check(last.get_global_rect().end.y<=scroll.get_global_rect().end.y+1,"Every handbook shortcut is visible at this window size")

func scroll_tools_to_end() -> void:
	var point=game.tool_scroll.get_global_rect().get_center()
	for i in 30:
		var event=InputEventMouseButton.new()
		event.position=point; event.button_index=MOUSE_BUTTON_WHEEL_DOWN; event.pressed=true
		root.push_input(event,true); await process_frame
		event=event.duplicate(); event.pressed=false; root.push_input(event,true)
