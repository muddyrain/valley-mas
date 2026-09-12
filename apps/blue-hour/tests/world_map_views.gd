extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.unfocusable = true
	var mission := Mission.new()
	root.add_child(mission)
	mission.setup(Catalog.new(), Ledger.new(), ["pistol", "smg"], 20260912)
	mission.set_physics_process(false)
	for view: Dictionary in [
		{"name": "overview", "at": Vector3.ZERO, "size": 102.0},
		{"name": "south", "at": Vector3(0, 0, 14), "size": 54.0},
		{"name": "gas", "at": mission.city.sites.fuel.spec.position, "size": 28.0},
		{"name": "tree", "at": Vector3(45, 0, -14), "size": 13.0},
		{"name": "fence", "at": Vector3(24, 0, -30), "size": 12.0},
		{"name": "player", "at": mission.catalog.map.bus_position, "size": 28.0},
	]:
		mission.camera_center = view.at
		mission.camera.size = view.size
		mission._update_camera()
		for i: int in range(12):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/world-detail-" + view.name + ".png")
	mission.free()
	print("WORLD DETAIL VIEWS: 6 native captures")
	quit()
