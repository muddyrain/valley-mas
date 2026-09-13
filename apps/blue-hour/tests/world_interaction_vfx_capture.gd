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

func snapshot_vfx(id: String) -> void:
	await RenderingServer.frame_post_draw
	var directory := ProjectSettings.globalize_path("res://test-output/world-interaction-vfx")
	DirAccess.make_dir_recursive_absolute(directory)
	root.get_texture().get_image().save_png(directory + "/" + id + ".png")

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
	await snapshot_vfx("01_selection_ring")
	mission.command_move(mission.squad_center() + Vector3(3, 0, 0))
	await create_timer(0.04).timeout
	await snapshot_vfx("02_move_click_start")
	await create_timer(0.15).timeout
	await snapshot_vfx("03_move_click_expand")
	await create_timer(0.28).timeout
	await snapshot_vfx("04_move_click_end")
	mission.city.sites["arrival_house"].discovered = true
	mission.command_search("arrival_house")
	await create_timer(0.12).timeout
	await snapshot_vfx("05_search_target")
	var enemy: Node3D = mission.spawn_enemy(mission.catalog.enemies[0].id, mission.squad_center() + Vector3(4, 0, 0))
	mission.command_focus(enemy)
	await create_timer(0.2).timeout
	await snapshot_vfx("06_focus_target")
	FileAccess.open("res://test-output/world-interaction-vfx/capture.json", FileAccess.WRITE).store_string(JSON.stringify({"move_pool": mission.world_interaction_vfx.move_pool.size(), "selection": true, "search": true, "focus": true}, "\t"))
	hud.free()
	layer.free()
	mission.free()
	quit(0)
