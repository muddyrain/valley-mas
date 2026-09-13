extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Ledger = preload("res://core/run_ledger.gd")

func _initialize() -> void:
	call_deferred("run")

func frames(count: int = 5) -> void:
	for i in count:
		await process_frame

func shot(id: String) -> void:
	await RenderingServer.frame_post_draw
	var dir := ProjectSettings.globalize_path("res://test-output/expedition-ui-1-1")
	DirAccess.make_dir_recursive_absolute(dir)
	root.get_texture().get_image().save_png(dir + "/" + id + ".png")

func run() -> void:
	root.size = Vector2i(1600, 900)
	var mission := Mission.new()
	root.add_child(mission)
	mission.setup(Catalog.new(), Ledger.new(), ["pistol", "smg"], 20260912)
	mission.set_physics_process(false)
	var layer := CanvasLayer.new()
	root.add_child(layer)
	var hud := HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(20)
	await shot("01_expedition_normal")
	hud.poi_context.focused_id = "arrival_house"
	mission.city.sites["arrival_house"].discovered = true
	hud.refresh()
	await frames(8)
	await shot("02_poi_hover")
	mission.command_search("arrival_house")
	await frames(10)
	await shot("03_search_active")
	mission.clock.set_phase(mission.clock.BLUE_HOUR)
	hud.refresh()
	await frames(8)
	await shot("04_blue_hour")
	hud.free()
	layer.free()
	mission.free()
	quit(0)
