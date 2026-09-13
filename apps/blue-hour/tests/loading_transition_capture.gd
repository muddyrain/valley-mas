extends SceneTree

const OUTPUT := "res://test-output/loading_v2/camp-first-frame.png"

func _initialize() -> void:
	var app := preload("res://core/main.tscn").instantiate()
	root.add_child(app)
	var deadline := Time.get_ticks_msec() + 12000
	var last_loading_saved := false
	while Time.get_ticks_msec() < deadline:
		await process_frame
		var loading := root.find_child("LoadingScreenV2", true, false) as Control
		if loading != null and loading.modulate.a > 0.05 and not last_loading_saved and loading.modulate.a < 0.95:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://test-output/loading_v2/camp-transition-last-loading-frame.png"))
			last_loading_saved = true
		var cover := root.find_child("LoadingTransitionCover", true, false)
		if app.state == "shelter" and cover == null and app.continue_loading == null:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(ProjectSettings.globalize_path(OUTPUT))
			root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://test-output/loading_v2/camp-transition-first-camp-frame.png"))
			print("[LoadingV3.1] camp-first-frame captured")
			quit()
			return
	print("[LoadingV3.1] camp-first-frame timeout state=%s" % app.state)
	quit(1)
