extends "res://tests/day_loop_runtime.gd"

const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
var mission: Node3D
var hud: Control

func hover(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.device = 42
	event.position = point
	root.push_input(event, true)
	await create_timer(.18).timeout

func run() -> void:
	create_timer(30).timeout.connect(func(): quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 20260912)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var entry: Vector3 = mission.city.sites.arrival_mid.spec.entry
	mission.survivors[0].position = mission.city.sites.garden_house.spec.entry
	mission.survivors[1].position = entry
	mission.exploration.refresh()
	mission.camera_controller.following = false
	mission.camera_center = entry + Vector3(0, 0, -3)
	mission.camera_controller.apply()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(8)
	mission.command_search("garden_house")
	mission.poi_selected_id = ""
	hud.refresh()
	await hover(hud.site_buttons.arrival_mid.get_global_rect().get_center())
	check(hud.poi_context.displayed_id == "arrival_mid", "Tracker hover shows the station cottage")
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.poi_context.displayed_id != "arrival_mid", "Leaving the tracker dismisses its hover card")
	await hover(mission.camera.unproject_position(entry + Vector3.UP * .2))
	check(hud.poi_context.displayed_id == "arrival_mid", "World hover shows the station cottage")
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.poi_context.displayed_id != "arrival_mid", "Leaving the building dismisses its hover card")
	# Reproduce the reported idle cottage beside another building's active search.
	mission.command_search("arrival_mid")
	mission.command_recall("arrival_mid")
	hud.refresh()
	check(mission.poi_selected_id.is_empty(), "Cancelling search clears the idle building selection")
	await hover(hud.site_buttons.arrival_mid.get_global_rect().get_center())
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(hud.poi_context.displayed_id != "arrival_mid", "Cancelled building does not stay pinned after hovering away")
	mission.command_search("arrival_mid")
	hud.refresh()
	var ground: Vector3 = entry + Vector3(0, 0, 7)
	await click_at(mission.camera.unproject_position(ground))
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(mission.poi_selected_id.is_empty(), "Ground command dismisses the idle selected cottage")
	check(hud.poi_context.displayed_id != "arrival_mid", "Idle cottage card does not remain after leaving and clicking ground")
	check(mission.search_tasks.has("garden_house"), "Dismissing an idle card preserves another survivor's search")
	check(hud.poi_context.cards.has("garden_house"), "Active building keeps its independent search card")
	check(hud.poi_context.cards.garden_house.is_visible_in_tree(), "Other building's active progress card remains visible: %s" % hud.poi_context.cards.garden_house.get_global_rect())
	check(mission.search_tasks.has("arrival_mid"), "Ground click dismisses selection without cancelling its active search")
	mission.command_recall("arrival_mid")
	hud.refresh()
	await frames(3)
	check(not hud.poi_context.cards.has("arrival_mid"), "Cancelled building has no lingering task card")
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/poi-context-dismiss.png")
	layer.free()
	mission.free()
	await frames(2)
	print("POI CONTEXT RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
