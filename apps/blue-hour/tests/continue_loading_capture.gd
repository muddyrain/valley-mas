extends SceneTree

const OUTPUT := "res://test-output/loading_v2/continue-camp-first-frame.png"

func _initialize() -> void:
	var app := preload("res://core/main.tscn").instantiate()
	root.add_child(app)
	var deadline := Time.get_ticks_msec() + 10000
	while Time.get_ticks_msec() < deadline and app.state != "menu":
		await process_frame
	if app.state != "menu":
		print("[LoadingV3.2] menu timeout state=%s" % app.state)
		quit(1)
		return
	app.campaign.new_run(772, "survey")
	app._save()
	app.show_main_menu()
	await process_frame
	app.continue_from_menu()
	while Time.get_ticks_msec() < deadline:
		await process_frame
		if app.state == "shelter" and app.continue_loading == null:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(ProjectSettings.globalize_path(OUTPUT))
			print("[LoadingV3.2] Continue -> Camp captured")
			quit()
			return
	print("[LoadingV3.2] Continue timeout state=%s" % app.state)
	quit(1)
