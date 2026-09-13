extends SceneTree
var failures: Array[String] = []
var checks: int = 0
var app: Node

class InputGate extends Node:
	func _input(event: InputEvent) -> void:
		if event.device != 42:
			get_viewport().set_input_as_handled()

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func frames(count: int) -> void:
	for i in range(count):
		await process_frame

func wait_seconds(seconds: float) -> void:
	await create_timer(seconds).timeout

func wait_until(condition: Callable, timeout: float) -> void:
	var deadline := Time.get_ticks_msec() + int(timeout * 1000)
	while not condition.call() and Time.get_ticks_msec() < deadline:
		await process_frame

func click(point: Vector2) -> void:
	var motion := InputEventMouseMotion.new()
	motion.device = 42
	motion.position = point
	root.push_input(motion, true)
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.device = 42
		event.position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame

func key(code: Key) -> void:
	for pressed in [true, false]:
		var event := InputEventKey.new()
		event.device = 42
		event.physical_keycode = code
		event.keycode = code
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame

func button(text: String) -> Button:
	for node in app.find_children("*", "Button", true, false):
		if node.text == text and node.is_visible_in_tree():
			return node
	return null

func click_button(text: String) -> void:
	var target := button(text)
	check(target != null, "Visible button exists: " + text)
	if target:
		await click(target.get_global_rect().get_center())
	await frames(4)
	await wait_for_departure()

func wait_for_departure() -> void:
	await wait_until(func(): return app.state != "departure", 45)
	check(app.state != "departure", "Departure completes before mission controls")
	if app.state == "mission":
		await wait_until(func(): return app.mission.arrival == null or app.mission.arrival.finished, 8)
		check(app.mission.arrival == null or app.mission.arrival.finished, "Squad disembarks before mission input")
		await wait_seconds(0.3)

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	var path := "res://test-output/" + id + ".png"
	check(root.get_texture().get_image().save_png(path) == OK, "Native viewport captured: " + id)

func reveal_site(id: String) -> void:
	app.hud.set_objectives_expanded(true)
	await frames(4)
	var target: Button = app.hud.site_buttons[id]
	var scroll := target.get_parent().get_parent() as ScrollContainer
	scroll.ensure_control_visible(target)
	await frames(4)
	check(scroll.get_global_rect().encloses(target.get_global_rect()), "Scrolled site is fully reachable: " + id)

func click_site(id: String) -> void:
	await reveal_site(id)
	await click(app.hud.site_buttons[id].get_global_rect().get_center())

func run() -> void:
	create_timer(100).timeout.connect(func(): printerr("RUNTIME TIMEOUT"); quit(2))
	root.unfocusable = true
	DirAccess.make_dir_recursive_absolute("res://test-output")
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/runtime.json"
	app.fresh_test_run = true
	root.add_child(app)
	root.add_child(InputGate.new())
	await frames(12)
	await capture("01-safehouse")
	await click_button("今日行动")
	await click_button("商业街")
	await click_button("确认出发")
	check(app.state == "mission", "Real button input launches the 3D scene")
	if app.state != "mission":
		quit(1)
		return
	var mission = app.mission
	mission.director_enabled = false
	mission.invincible = true
	await frames(20)
	await capture("02-day")
	mission.debug_clear_enemies()
	var destination: Vector3 = mission.catalog.map.bus_position + Vector3(0, 0, -7)
	var screen_point: Vector2 = mission.camera.unproject_position(destination)
	await click(screen_point)
	await wait_seconds(3.6)
	check(mission.squad_center().distance_to(destination) < 3.0, "Mouse ray on ground moves the squad to the clicked position")
	await key(KEY_X)
	check(mission.order.begins_with("停止"), "X key stops movement")
	mission.camera_center = mission.city.sites.corner.spec.entry + Vector3(0,0,7)
	mission.pan_camera(Vector2.ZERO)
	await click(mission.camera.unproject_position(mission.city.sites.corner.spec.entry + Vector3.UP))
	check(mission.search_id == "corner", "Mouse ray on an entrance starts building search")
	await key(KEY_X)
	check(mission.search_id == "corner", "X stops guards without canceling the assigned search")
	var new_index := 0 if mission.search_task.worker == mission.survivors[1] else 1
	await wait_seconds(0.2)
	await click(app.hud.assign_buttons[new_index].get_global_rect().get_center())
	check(mission.search_task.worker == mission.survivors[new_index], "Actual reassignment button changes the search worker")
	await click(mission.camera.unproject_position(Vector3(0, 0, 5)))
	check(mission.search_id == "corner", "Actual ground input moves guards while preserving the search")
	mission.time_scale = 4
	await wait_until(func(): return mission.search_task.worker != null and mission.search_task.worker.searching, 10)
	check(mission.search_task.worker != null and mission.search_task.worker.searching, "Dispatched worker reaches the entrance through live physics")
	await wait_seconds(0.15)
	await capture("10-dispatch")
	var worker = mission.search_task.worker
	if worker != null:
		mission.time_scale = 1
		mission.invincible = false
		var blocker = mission.spawn_enemy("ENM_001_infected_basic_a", worker.position + Vector3(0, 0, 0.8))
		blocker.hp = 500
		var previous_hp: float = worker.hp
		await wait_until(func(): return worker.hp < previous_hp, 3)
		await wait_seconds(0.8)
		check(worker.hp < previous_hp and not worker.searching, "Live entrance combat damages the visible worker and interrupts search")
		check(app.hud.task_label.text.contains("自卫"), "The HUD explains the worker's current interruption")
		await capture("11-defend")
	mission.debug_clear_enemies()
	mission.invincible = true
	await click(app.hud.recall_button.get_global_rect().get_center())
	check(mission.search_id.is_empty(), "Actual recall button releases the search assignment")
	mission.center_squad()
	var enemy = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.nearest_open(mission.squad_center() + Vector3(0,0,-4)))
	enemy.hp = 1000
	await frames(3)
	await click(mission.camera.unproject_position(enemy.position + Vector3.UP))
	check(mission.focus_target == enemy, "Mouse ray selects an enemy for focus fire")
	mission.debug_clear_enemies()
	await click_site("van_south")
	check(mission.search_id == "van_south", "Search list button issues a vehicle search order")
	mission.time_scale = 4
	await wait_until(func(): return mission.city.sites.van_south.searched, 15)
	await frames(3)
	check(mission.city.sites.van_south.searched and mission.ledger.food == mission.city.sites.van_south.spec.food, "Vehicle search completes through live physics with actual loot")
	mission.time_scale = 1
	await key(KEY_F1)
	check(app.hud.debug_menu.visible and mission.time_scale == 0, "F1 opens debug menu through real key input")
	await click_button("+10 食物")
	await click_button("+20 废料")
	check(mission.ledger.food == mission.city.sites.van_south.spec.food + 10 and mission.ledger.scrap == mission.city.sites.van_south.spec.scrap + 20, "Debug resource buttons update the actual inventory")
	await click_button("给予选定武器")
	check(mission.survivors[0].weapon.id == mission.catalog.weapons[0].id, "Debug weapon button equips its default selected definition")
	await click_button("普通感染者")
	check(mission.enemies.any(func(value): return value.data.id == "ENM_001_infected_basic_a"), "Debug enemy button spawns the selected type")
	await click_button("清除敌人")
	await click_button("BLUE HOUR")
	check(mission.clock.phase == 1, "Debug can switch directly to BLUE HOUR")
	await wait_seconds(0.2)
	await capture("03-debug")
	await key(KEY_F1)
	await wait_seconds(4)
	await capture("04-blue-hour")
	await key(KEY_F1)
	await click_button("Night")
	await key(KEY_F1)
	await wait_seconds(4)
	await capture("05-night")
	check(mission.atmosphere.sun.light_energy < 0.5, "Night lighting reaches its distinct native scene state")
	await key(KEY_E)
	mission.time_scale = 4
	await wait_until(func(): return app.state == "result", 15)
	await frames(3)
	check(app.state == "result", "E key completes boarding and opens settlement")
	if app.state == "result":
		await capture("06-homeward")
		await click_button("确认结算")
		check(app.state == "shelter" and app.campaign.data.food == 14 and app.campaign.data.day == 2, "Confirmation banks loot, consumes food and advances one day")
		await capture("07-returned")
	root.size = Vector2i(1024, 640)
	await frames(12)
	await capture("08-small-window")
	var depart := button("今日行动")
	check(depart != null and root.get_visible_rect().encloses(depart.get_global_rect()), "Primary action fits the minimum supported window")
	await click_button("今日行动")
	await click_button("商业街")
	await click_button("确认出发")
	await frames(12)
	check(root.get_visible_rect().encloses(app.hud.extract_button.get_global_rect()), "Evacuation action fits the minimum mission window")
	await capture("09-small-mission")
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	await click_site("van_south")
	await wait_seconds(0.2)
	check(root.get_visible_rect().encloses(app.hud.recall_button.get_global_rect()), "Recall remains inside the minimum supported viewport")
	for assign in app.hud.assign_buttons:
		check(root.get_visible_rect().encloses(assign.get_global_rect()), "Every reassignment button fits the minimum supported viewport")
	check(app.hud.recall_button.get_global_rect().end.y < app.hud.extract_button.get_global_rect().position.y, "Search controls do not overlap the bottom command bar")
	await capture("12-small-dispatch")
	var report := FileAccess.open("res://test-output/runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "engine": Engine.get_version_info().string, "renderer": RenderingServer.get_current_rendering_method(), "mode": "native offscreen window with synthetic viewport input"}, "\t"))
	print("NATIVE RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(6)
	await create_timer(0.1).timeout
	quit(0 if failures.is_empty() else 1)
