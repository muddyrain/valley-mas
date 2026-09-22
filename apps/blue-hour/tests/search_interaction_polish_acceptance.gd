extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const HUD = preload("res://ui/mission_hud.gd")
const OUTPUT: String = "res://test-output/search-interaction-polish-acceptance/"

var world: Node3D
var hud: Control
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func step(seconds: float) -> void:
	for i: int in range(ceili(seconds * 30.0)):
		world._physics_process(1.0 / 30.0)
		if i % 90 == 0:
			await process_frame

func finish() -> void:
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("SEARCH INTERACTION POLISH ACCEPTANCE: %d checks, %d failures" % [checks, failures.size()])
	if is_instance_valid(hud):
		hud.queue_free()
	if is_instance_valid(world):
		world.queue_free()
	await create_timer(.15).timeout
	quit(0 if failures.is_empty() else 1)

func capture(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var image: Image = root.get_texture().get_image()
	image.save_png(OUTPUT + label + ".png")

func run() -> void:
	create_timer(60.0).timeout.connect(func() -> void: quit(2))
	root.size = Vector2i(1600, 900)
	root.unfocusable = true
	world = Mission.new()
	root.add_child(world)
	world.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	world.setup(Catalog.new(), Ledger.new(), loadout, 20260912)
	world.director_enabled = false
	world.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(world)
	await process_frame

	var house_id: String = "arrival_house"
	var vehicle_id: String = "van_south"
	var house: Dictionary = world.city.sites[house_id]
	var vehicle: Dictionary = world.city.sites[vehicle_id]
	var survivor_a: Node3D = world.survivors[0]
	var survivor_b: Node3D = world.survivors[1]
	var survivor_c: Node3D = world.survivors[2]
	survivor_a.position = house.spec.entry
	survivor_b.position = vehicle.spec.entry
	survivor_c.position = world.city.nearest_open(Vector3(0, 0, 10))

	check(world.command_search(house_id, survivor_a), "Selected Survivor A accepts the house search")
	check(world.command_search(vehicle_id, survivor_b), "Selected Survivor B accepts the vehicle search")
	check(not hud.toast_panel.visible and not hud.order_label.visible, "Search commands do not create the bottom status banner")
	var task_a: RefCounted = world.search_tasks[house_id]
	var task_b: RefCounted = world.search_tasks[vehicle_id]
	for i: int in range(8):
		task_a.prepare(.1, world)
		task_a.advance(.1, world)
		task_b.prepare(.1, world)
		task_b.advance(.1, world)
	world.camera_center = (house.spec.entry + vehicle.spec.entry) * .5
	world.camera_controller.following = false
	world.camera_controller.apply()
	hud.refresh()
	await process_frame
	var card_a: Control = hud.poi_context.cards[house_id]
	var card_b: Control = hud.poi_context.cards[vehicle_id]
	check(card_a.visible and card_b.visible, "Parallel searches show two active cards")
	check(card_a.worker_label.text != "" and card_b.worker_label.text != "", "Each active card identifies its searching survivor")
	check(card_a.worker_label.tooltip_text == survivor_a.data.display_name and card_b.worker_label.tooltip_text == survivor_b.data.display_name, "Card owner labels retain full survivor names")
	check(world.task_for(survivor_a) == task_a and world.task_for(survivor_b) == task_b, "Switching visual focus does not change task ownership")
	hud.inspect_member(survivor_b, false)
	check(hud.selected_member == survivor_b and world.task_for(survivor_a) == task_a, "Selecting B leaves A's active search untouched")
	await capture("parallel-search")

	world.command_recall(house_id)
	hud.refresh()
	await process_frame
	check(not hud.toast_panel.visible and not hud.order_label.visible, "Cancelling a search does not create the bottom status banner")
	check(not card_a.visible and card_b.visible, "Cancelling A hides only A's card")
	check(world.search_tasks.has(vehicle_id) and world.task_for(survivor_b) == task_b, "B continues after A cancellation")
	check(world.command_move(Vector3(0, 0, 14)), "Idle C accepts a ground move during B search")
	await step(.25)
	check(world.task_for(survivor_b) == task_b and world.city.sites[vehicle_id].progress > 0, "Ground movement does not interrupt B search")
	await capture("cancel-a-b-continues")

	world.poi_selected_id = ""
	var hover_id: String = "garden_house"
	world.city.sites[hover_id].discovered = true
	hud.poi_context._update_discovery_card(hover_id, "")
	check(hud.poi_context._discovery_mouse_hint.visible, "Hover prompt uses the native left mouse glyph")
	check(hud.poi_context._discovery_status.text == "搜索", "Hover prompt stays compact and action-focused")
	await capture("hover-search-prompt")
	await finish()
