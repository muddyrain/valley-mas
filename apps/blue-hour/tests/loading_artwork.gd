extends SceneTree

const LoadingScreen = preload("res://ui/loading_screen_v2.gd")
const OUTPUT := "res://test-output/loading_final_tune_review/"
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func capture(file_name: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(OUTPUT + file_name) == OK, "Capture " + file_name)

func run() -> void:
	root.unfocusable = true
	root.content_scale_size = Vector2i(1920, 1080)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var before := "before" in OS.get_cmdline_user_args()
	var loading := LoadingScreen.new()
	root.add_child(loading)
	loading.set_process(false)
	await create_timer(0.3).timeout
	var base := loading.artwork_root.get_node("ArtworkBase") as TextureRect
	var imported := base.texture.get_image()
	var raw := Image.load_from_file(ProjectSettings.globalize_path("res://assets/ui/loading/loading_right_artwork_main.png"))
	var samples: Array[Vector2i] = [Vector2i(750, 770), Vector2i(850, 470), Vector2i(730, 300)]
	for at: Vector2i in samples:
		print("ARTWORK ALPHA ", at, " raw=", raw.get_pixelv(at).a, " imported=", imported.get_pixelv(at).a)
		if not before:
			check(raw.get_pixelv(at).a == 0.0 and imported.get_pixelv(at).a == 0.0, "No rectangular residue at " + str(at))
	for elapsed_time: float in [0.65, 0.9, 1.3]:
		loading.elapsed = elapsed_time
		loading.ready_for_camp = elapsed_time > 1.2
		loading._process(0.02)
		var percent := roundi(loading.display_progress * 100.0)
		await capture("current-before.png" if before else "current-after-%d.png" % percent)
		if before:
			break
	if not before:
		check(loading.title_label.text == "欢迎回来。", "Welcome after 100%")
		check(loading.fade_rect.color.a == 0.0, "No black finish overlay")
		check(base is TextureRect and base.get_child_count() == 0, "Single baked artwork")
		for node_name: String in ["Photo01", "Photo02", "Note01", "Note02", "Ticket"]:
			check(loading.find_child(node_name, true, false) == null, "No duplicate " + node_name)
		loading.design.get_node("LeftUI").hide()
		loading.visual_layers.get_node("DecorationLine").hide()
		await capture("artwork-only-after.png")
		loading.queue_free()
		await process_frame
		# Let the original controller finish naturally; no overridden progress or fade methods.
		var live := LoadingScreen.new()
		root.add_child(live)
		await live.completed
		check(live.finishing and live.display_progress == 1.0, "Natural loading completed")
		live.queue_free()
	else:
		loading.queue_free()
	await process_frame
	print("LOADING ARTWORK REVIEW: ", failures.size(), " failures; before=", before)
	quit(0 if failures.is_empty() else 1)
