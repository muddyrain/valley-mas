extends "res://tests/day_loop_runtime.gd"
## Native Expedition view contract. Gameplay is the production Mission and SearchTask.
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Campaign = preload("res://core/campaign.gd")
var mission: Node3D
var hud: Control
var evidence: Array[Dictionary] = []

func results_path() -> String:
	return "res://test-output/expedition-hud-2/runtime.json"

func hover(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.device = 42
	event.position = point
	root.push_input(event, true)
	await create_timer(.18).timeout

func step(seconds: float) -> void:
	for i: int in range(ceili(seconds * 30)):
		if not mission.active:
			break
		mission._physics_process(1.0 / 30.0)
		if i % 30 == 0:
			await process_frame
	hud.refresh()
	await frames(2)

func snap(id: String) -> void:
	if DisplayServer.get_name() != "headless":
		await create_timer(.24).timeout
		await capture("expedition-hud-2/" + id)

func layout(resolution: Vector2i) -> void:
	root.size = resolution
	await frames(10)
	var area: Rect2 = root.get_visible_rect()
	var rectangles: Dictionary = {}
	var panels: Array[Control] = [hud.brand_panel, hud.top_panel, hud.resources_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button]
	for panel: Control in panels:
		var rect := panel.get_global_rect()
		check(area.encloses(rect), "%s inside %s: %s" % [panel.name, resolution, rect])
		rectangles[panel.name] = var_to_str(rect)
	for i: int in range(panels.size()):
		for j: int in range(i + 1, panels.size()):
			check(not panels[i].get_global_rect().intersects(panels[j].get_global_rect()), "%s does not overlap %s at %s" % [panels[i].name, panels[j].name, resolution])
	evidence.append({"resolution": var_to_str(resolution), "panels": rectangles})
	await snap("01_expediton_hud_overview_%dx%d" % [resolution.x, resolution.y])

func run() -> void:
	create_timer(180).timeout.connect(func(): printerr("HUD2 TIMEOUT"); quit(2))
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/expedition-hud-2")
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260912, "scavenge", ["xia_zhiyao", "su_wanxing"])
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(5)
	check(hud.top_panel.get_theme_stylebox("panel").has_meta("expedition_hud_2"), "Time HUD uses supplied PNG shell")
	check(hud.squad_cards.size() == mission.survivors.size(), "Party cards follow the actual roster")
	for node: Node in hud.find_children("*", "Control", true, false):
		if node is Label or node is TextureRect or node is ProgressBar:
			check(node.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Decoration passes world input: " + str(node.get_path()))
	for resolution: Vector2i in [Vector2i(1920, 1080), Vector2i(2560, 1440), Vector2i(1366, 768), Vector2i(1024, 640)]:
		await layout(resolution)
	root.size = Vector2i(1920, 1080)
	await frames(10)
	await click(hud.squad_cards[1].select_button)
	check(hud.selected_member == mission.survivors[1], "Portrait click selects and locates the actual second member")
	await click(hud.squad_cards[0].select_button)
	check(hud.selected_member == mission.survivors[0], "Portrait click switches inspection without assigning a search")
	check(mission.survivors[0].selection_ring.material_override.albedo_color.a > .6 and mission.survivors[1].selection_ring.material_override.albedo_color.a < .2, "Only the inspected member has a clear selection ring")
	await hover(hud.brand_panel.get_global_rect().get_center())
	var original_rally: Vector3 = mission.rally_point
	await click_at(mission.camera.unproject_position(mission.survivors[1].rig.global_position + Vector3.UP * .8))
	check(hud.selected_member == mission.survivors[1] and mission.rally_point == original_rally, "World character click changes inspection without issuing movement")
	await click(hud.squad_cards[0].select_button)
	check(mission.search_tasks.is_empty(), "Portrait inspection has no gameplay assignment side effect")
	await hover(hud.brand_panel.get_global_rect().get_center())
	check(root.gui_get_hovered_control() == null, "Brand decoration does not intercept map input")
	var ground: Vector3 = catalog.map.bus_position + Vector3(0, 0, -10)
	await click_at(mission.camera.unproject_position(ground))
	await create_timer(.15).timeout
	check(mission.order == "前往阵位" and not mission.survivors[0].path.is_empty(), "Ground click uses the original move command")
	check(mission.city.marker.visible and mission.city.marker.material_override.albedo_color.a > .75, "Move marker animates actual Compatibility material alpha")
	await snap("02_character_selected_move_marker")
	ground += Vector3(3, 0, -1)
	await click_at(mission.camera.unproject_position(ground))
	await create_timer(.15).timeout
	check(mission.city.marker.visible and mission.city.marker.position.distance_to(mission.rally_point + Vector3.UP * .55) < .01, "Repeated move replaces the previous marker and restarts its animation")
	await create_timer(.7).timeout
	check(not mission.city.marker.visible, "Move marker finishes in less than one second")
	await step(5)
	await click(hud.command_buttons["停止"])
	check(mission.order.begins_with("停止"), "Stop button invokes the original command")
	await click(hud.command_buttons["定位"])
	check(mission.camera_controller.following, "Locate button restores the original camera follow")
	var start_camera: Vector3 = mission.camera_center
	var pan := InputEventKey.new()
	pan.device = 42
	pan.physical_keycode = KEY_W
	pan.pressed = true
	root.push_input(pan, true)
	await step(.3)
	pan.pressed = false
	root.push_input(pan, true)
	check(mission.camera_center != start_camera and not mission.camera_controller.following, "W remains camera movement, consistent with Deadly Days")
	var gunner: Node3D = mission.survivors.filter(func(member: Node3D): return member.weapon != null and not member.weapon.melee)[0]
	var ammo_before: int = gunner.ammo
	await hover(mission.camera.unproject_position(gunner.position + Vector3(0, 0, -6)))
	var aim := InputEventKey.new()
	aim.device = 42
	aim.physical_keycode = KEY_CTRL
	aim.pressed = true
	root.push_input(aim, true)
	await step(.3)
	check(mission.manual_aim and gunner.ammo < ammo_before, "Held Ctrl retains actual directed shooting and ammo consumption")
	aim.pressed = false
	root.push_input(aim, true)
	await frames(2)
	check(not mission.controls.aiming and not mission.manual_aim, "Releasing Ctrl clears aiming")
	var rally_before: Vector3 = mission.rally_point
	start_camera = mission.camera_center
	var drag := InputEventMouseButton.new()
	drag.device = 42
	drag.position = mission.camera.unproject_position(mission.squad_center() + Vector3(0, 0, -4))
	drag.button_index = MOUSE_BUTTON_RIGHT
	drag.pressed = true
	root.push_input(drag, true)
	var motion := InputEventMouseMotion.new()
	motion.device = 42
	motion.position = drag.position + Vector2(40, 20)
	motion.relative = Vector2(40, 20)
	root.push_input(motion, true)
	drag.position = hud.pause_button.get_global_rect().get_center()
	drag.pressed = false
	root.push_input(drag, true)
	await frames(3)
	check(mission.camera_center != start_camera and mission.rally_point == rally_before and not mission.controls.dragging, "Right drag moves the camera and release over HUD cannot stick")
	await click(hud.command_buttons["定位"])
	await create_timer(.5).timeout
	var site_id: String = "arrival_house"
	var site: Dictionary = mission.city.sites[site_id]
	mission.camera_controller.following = false
	mission.camera_center = site.spec.entry
	mission.camera_controller.apply()
	await frames(4)
	await hover(mission.camera.unproject_position(site.spec.entry + Vector3.UP * .2))
	await snap("03_building_compact")
	await click_at(mission.camera.unproject_position(site.spec.entry + Vector3.UP * .2))
	check(mission.search_tasks.has(site_id), "Actual building entrance click starts the original search")
	var limit: float = mission.clock.elapsed + 55
	while site.progress < .12 and mission.clock.elapsed < limit:
		await step(.2)
	check(site.progress >= .12, "Search advances through real travel, entry and progress")
	await hover(hud.brand_panel.get_global_rect().get_center())
	hud.refresh()
	await frames(8)
	var card: PanelContainer = hud.poi_context._focus_card
	check(not card.progress.get_rect().intersects(card.action.get_rect()), "Actual progress minimum height cannot overlap cancel action")
	check(card.get_global_rect().encloses(card.action.get_global_rect()), "Cancel action stays inside its PNG shell")
	check(card.is_visible_in_tree() and card.progress.value > 0, "Visible search card reads live progress")
	check(is_equal_approx(card.progress.value, site.progress * 100), "Displayed percentage equals authoritative site progress")
	check(site.ring.image_name == "world_search_marker" and site.ring.visible, "Search marker reflects the real running task")
	await snap("03_building_search")
	var position_before: Vector2 = card.position
	for i: int in range(20):
		await process_frame
		check(card.position == position_before, "Stationary search card has zero frame-to-frame jitter")
	var camera_before: Vector3 = mission.camera_center
	for i: int in range(12):
		mission.camera_center = camera_before + Vector3(.001 if i % 2 == 0 else -.001, 0, 0)
		mission.camera_controller.apply()
		await process_frame
	check(card.position.distance_to(position_before) <= 1.5, "Sub-pixel projection noise stays within the dead zone")
	mission.camera_center = camera_before + Vector3(1.4, 0, 0)
	mission.camera_controller.apply()
	await create_timer(.35).timeout
	check(card.position.distance_to(position_before) > 12, "Search card still follows real camera movement")
	check(root.get_visible_rect().encloses(card.get_global_rect()), "Search card stays clamped within the viewport")
	var progress_before: float = site.progress
	await click(card.action)
	check(not mission.search_tasks.has(site_id) and site.progress == progress_before, "Cancel button releases the task and preserves progress")
	await step(.4)
	await click(hud.site_buttons[site_id])
	check(mission.search_tasks.has(site_id), "Tracker can restart the cancelled search")
	while not site.searched and mission.clock.elapsed < limit + 60:
		await step(.1)
	check(site.searched, "Restarted search completes through the original algorithm")
	hud.refresh()
	await frames(4)
	check(hud.site_buttons[site_id].status.text == "已搜", "Objective updates after completion")
	if not mission.pickups.is_empty():
		check(mission.pickups[0].view.has_node("WorldLootMarker"), "Real search reward creates its loot marker")
		await snap("04_loot_marker")
	else:
		check(false, "Search-completion checkpoint captures an uncollected real pickup")
	await step(.5)
	check(mission.ledger.food > 0 or mission.ledger.scrap > 0, "Existing pickup collection still credits the ledger")
	await click(hud.expand_button)
	check(hud.objectives_expanded, "View all expands the actual discovered objectives")
	var power: Button = hud.power_buttons.values()[0]
	await hover(power.get_global_rect().get_center())
	check(power.get_draw_mode() == BaseButton.DRAW_HOVER, "Ability hover is a native interactive state")
	await snap("04_objective_action_interaction")
	await key(KEY_1)
	check(mission.powers.states.sprint.active and power.disabled and power._active, "Numeric key activates existing power and renders active while preventing repeat use")
	check(power.badge.text == "1", "Shortcut badge remains distinct from the active countdown")
	await snap("04_skill_active")
	await step(mission.powers.states.sprint.remaining_duration + .1)
	check(not mission.powers.states.sprint.active and power.disabled and not power._active, "Spent power displays the actual disabled state")
	await snap("04_skill_disabled")
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", mission.city.nearest_open(mission.squad_center() + Vector3(2, 0, 0)))
	mission.exploration.refresh()
	await click(hud.command_buttons["集火"])
	check(mission.focus_target == enemy, "Focus button chooses the real visible threat")
	await frames(4)
	check(hud.world_markers.danger.visible, "Danger marker is limited to a real priority threat")
	await snap("04_danger_marker")
	mission.debug_clear_enemies()
	var vehicle_ids: Array = mission.city.sites.keys().filter(func(id: String): return mission.city.sites[id].vehicle)
	vehicle_ids.sort_custom(func(a: String, b: String): return mission.city.sites[a].spec.entry.distance_to(mission.squad_center()) < mission.city.sites[b].spec.entry.distance_to(mission.squad_center()))
	var vehicle_id: String = vehicle_ids[0]
	var vehicle: Dictionary = mission.city.sites[vehicle_id]
	mission.command_move(vehicle.spec.entry + Vector3(0, 0, 2))
	var travel_limit: float = mission.clock.elapsed + 80
	while mission.squad_center().distance_to(vehicle.spec.entry) > 4 and mission.clock.elapsed < travel_limit:
		await step(.5)
	check(vehicle.discovered, "Vehicle is discovered by actual travel before interaction")
	mission.camera_controller.following = false
	mission.camera_center = vehicle.spec.entry
	mission.camera_controller.apply()
	await frames(5)
	await hover(mission.camera.unproject_position(vehicle.spec.entry + Vector3.UP * .2))
	await click_at(mission.camera.unproject_position(vehicle.spec.entry + Vector3.UP * .2))
	check(mission.search_tasks.has(vehicle_id), "Actual vehicle click dispatches through the original search controller")
	await step(2)
	check(vehicle.ring.visible, "Discovered nearby searchable vehicle shows its world marker")
	await snap("03_vehicle_search")
	await click(hud.extract_button)
	check(mission.extraction and mission.search_tasks.is_empty(), "Return button cancels outstanding work using the original extraction flow")
	check(mission.city.get_node("ReturnZone").mesh.size == Vector2.ONE * catalog.map.board_radius * 2, "Return display reads the existing boarding radius")
	while mission.board_count() < mission.living().size() and mission.active:
		await step(.2)
	mission.camera_controller.following = false
	mission.camera_center = catalog.map.bus_position
	mission.camera_controller.apply()
	await frames(5)
	await snap("05_return_bus")
	await step(90)
	check(not mission.active and mission.board_count() == mission.living().size(), "Real travel, full-party gathering and bus preparation complete extraction")
	check(hud.extract_button.disabled and not hud.extract_button._active, "Return transitions to disabled after extraction")
	var last_member: Node3D = mission.survivors.pop_back()
	hud.refresh()
	await frames(3)
	check(hud.squad_cards.size() == 1, "HUD rebuilds against a changed one-person roster")
	mission.survivors.append(last_member)
	hud.refresh()
	await frames(3)
	check(hud.squad_cards.size() == 2, "HUD restores a dynamic two-person roster")
	FileAccess.open(results_path(), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "layout": evidence, "mode": "Native Godot, production Expedition, synthetic inputs; fixed campaign, director disabled, time-compressed original simulation"}, "\t"))
	for player: Node in mission.sound.get_children():
		if player is AudioStreamPlayer:
			player.stop()
	await create_timer(.15).timeout
	layer.free()
	mission.free()
	await create_timer(.15).timeout
	print("EXPEDITION HUD 2: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
