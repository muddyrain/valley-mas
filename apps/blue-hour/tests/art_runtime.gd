extends SceneTree
var failures: Array[String] = []
var checks := 0
var gallery: Node3D
var captures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func frames(count: int) -> void:
	for index in range(count):
		await process_frame

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	var path := "res://test-output/art/" + id + ".png"
	check(root.get_texture().get_image().save_png(path) == OK, "Captured native art viewport: " + id)
	captures.append(path)

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("ART RUNTIME TIMEOUT"); quit(2))
	root.unfocusable = true
	DirAccess.make_dir_recursive_absolute("res://test-output/art")
	gallery = load("res://scenes/debug/art_showcase.tscn").instantiate()
	root.add_child(gallery)
	await frames(8)
	var expected: Dictionary = preload("res://vfx/generated_assets.gd").catalog()
	check(gallery.asset_nodes.size() == expected.size(), "Every registered asset is instantiated in the showcase")
	for mode in [0,1]:
		gallery.set_mode(mode)
		await frames(5)
		for category in ["all","buildings","modules","props","vehicles","bus","weapons","roads","infected"]:
			gallery.focus_category(category)
			await frames(3)
			await capture(category + ("-day" if mode == 0 else "-blue-hour"))
		check(gallery.atmosphere.environment.background_color.is_equal_approx(Color("#344D69") if mode==1 else Color("#859d9f")), "Shared phase palette in native showcase")
	# Exercise the actual input handler as well as the capture controls.
	var event := InputEventKey.new()
	event.keycode = KEY_TAB
	event.physical_keycode = KEY_TAB
	event.pressed = true
	root.push_input(event, true)
	await frames(3)
	check(gallery.mode == 0, "Tab switches lighting through Godot input")
	var report := FileAccess.open("res://test-output/art/runtime.json",FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks":checks,"failures":failures,"captures":captures,"engine":Engine.get_version_info().string,"renderer":RenderingServer.get_current_rendering_method(),"mode":"native offscreen Godot window; synthetic input; no player save","assets":gallery.asset_nodes.size()},"\t"))
	gallery.queue_free()
	await frames(5)
	print("ART NATIVE RUNTIME: %d checks, %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
