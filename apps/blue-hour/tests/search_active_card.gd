extends "res://tests/expedition_hud_2.gd"
## Production search lifecycle with native input and isolated, in-memory campaign.
const OUTPUT: String = "res://test-output/search-cancel-spacing/"
var positions: Array[Dictionary] = []

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260912, "combat", ["xia_zhiyao", "su_wanxing"])
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	var id: String = "arrival_house"
	var site: Dictionary = mission.city.sites[id]
	mission.camera_controller.following = false
	mission.camera_center = site.spec.entry
	mission.camera_controller.apply()
	hud.poi_context.focused_id = id
	hud.refresh()
	await frames(8)
	var card: Control = hud.poi_context.cards[id]
	check(not card.visible, "Idle selected building has no information card")
	mission.command_search(id)
	hud.refresh()
	check(not card.visible, "Walking to a search does not show active status")
	await begin_search(id)
	mission.search_tasks[id].advance(3.0, mission)
	await frames(2)
	check(card.visible, "Real indoor search displays the card")
	check(card.title.text == site.spec.name, "Building name comes from the live site")
	check(card.search_icon.texture != null, "Building icon is bound at runtime")
	check(is_equal_approx(card.progress.value, site.progress * 100), "Progress uses authoritative unrounded value")
	check(card.size == Vector2(262, 96), "Card retains source proportions")
	check(card.progress.size.y == 9, "Theme cannot inflate the thin progress track")
	check(card.action.size == Vector2(96, 32), "Cancel displays at the formal 96 x 32 size")
	check(card.action.get_combined_minimum_size() == Vector2(96, 32), "Parent layout cannot compress cancel below its native size")
	check(card.action.texture_normal.get_size() == card.action.size and card.action.texture_hover.get_size() == card.action.size, "Normal and hover textures render at matching native dimensions")
	check(card.content.size.y >= card.action.position.y + card.action.size.y, "Content height leaves room for the full cancel button")
	for label: Label in [card.detail, card.percent_label]:
		var font: Font = label.get_theme_font("font")
		var text_width: float = font.get_string_size(label.text if label == card.detail else "99%", HORIZONTAL_ALIGNMENT_LEFT, -1, label.get_theme_font_size("font_size")).x
		check(text_width <= label.size.x, "Search status and maximum live percent fit without clipping: " + label.name)
	verify_anchor(card, id, "default", true)
	var labels: Array[Control] = [card.title, card.detail, card.percent_label, card.progress, card.action]
	for control: Control in labels:
		check(card.get_global_rect().encloses(control.get_global_rect()), "Content fits: " + control.name)
	for a: int in range(labels.size()):
		for b: int in range(a + 1, labels.size()):
			check(not labels[a].get_global_rect().intersects(labels[b].get_global_rect()), "Content does not overlap: %s / %s" % [labels[a].name, labels[b].name])
	var card_rect: Rect2 = card.get_global_rect()
	var button_rect: Rect2 = card.action.get_global_rect()
	verify_button_spacing(card, "normal")
	await capture_card("normal", card)
	await hover(button_rect.get_center())
	check(card.action.get_draw_mode() == BaseButton.DRAW_HOVER, "Native hover reaches cancel")
	check(card.get_global_rect() == card_rect and card.action.get_global_rect() == button_rect, "Hover changes no dimensions or positions")
	verify_button_spacing(card, "hover")
	await capture_card("hover", card)
	for resolution: Vector2i in [Vector2i(2560, 1440), Vector2i(1366, 768)]:
		root.size = resolution
		await frames(8)
		check(card.action.size == Vector2(96, 32), "Responsive HUD retains cancel design dimensions " + str(resolution))
		verify_button_spacing(card, str(resolution))
		check(root.get_visible_rect().encloses(card.get_global_rect()), "Card fits " + str(resolution))
		verify_anchor(card, id, str(resolution), true)
		await capture_card(str(resolution.x), card)
	root.size = Vector2i(1920, 1080)
	await frames(8)
	await verify_camera_positions(card, id)
	await click(card.action)
	check(not mission.search_tasks.has(id) and not card.visible, "Cancel releases the task and hides its card")
	await begin_search(id)
	mission.command_move(mission.squad_center() + Vector3(2, 0, 0))
	await frames(1)
	check(not card.visible, "Leaving by movement hides the card on the next rendered frame")
	await begin_search(id)
	var task: RefCounted = mission.search_tasks[id]
	task.advance(100, mission)
	await frames(1)
	check(site.searched and not card.visible, "Completion hides during exit transition")
	await hover(mission.camera.unproject_position(site.spec.entry))
	check(not card.visible, "Hovering completed building cannot revive an old information card")
	await step(.4)
	var orientations: Dictionary = {roundi(rad_to_deg(site.spec.yaw)): true}
	for rotated_id: String in ["corner", "yard_repair"]:
		var rotated_site: Dictionary = mission.city.sites[rotated_id]
		mission.survivors[0].position = rotated_site.spec.entry
		mission.command_search(rotated_id)
		var rotated_task: RefCounted = mission.search_tasks[rotated_id]
		rotated_task.prepare(0.0, mission)
		rotated_task.prepare(.4, mission)
		rotated_task.advance(.01, mission)
		mission.camera_center = rotated_site.spec.entry
		mission.camera_controller.apply()
		mission.exploration.refresh()
		hud.refresh()
		await frames(3)
		var rotated_card: Control = hud.poi_context.cards[rotated_id]
		verify_anchor(rotated_card, rotated_id, "orientation-" + rotated_id, true)
		orientations[roundi(rad_to_deg(rotated_site.spec.yaw))] = true
		await capture_card("orientation-" + rotated_id, rotated_card)
		mission.command_recall(rotated_id)
		await step(.4)
	check(orientations.size() >= 3, "Production building fixtures cover three distinct orientations")
	var vehicle_id: String = "van_south"
	var vehicle: Dictionary = mission.city.sites[vehicle_id]
	mission.survivors[0].position = vehicle.spec.entry
	mission.camera_center = vehicle.spec.entry
	mission.camera_controller.apply()
	mission.command_search(vehicle_id)
	var vehicle_task: RefCounted = mission.search_tasks[vehicle_id]
	vehicle_task.prepare(0.0, mission)
	hud.refresh()
	await frames(2)
	var vehicle_card: Control = hud.poi_context.cards[vehicle_id]
	check(vehicle_card.visible and vehicle_card.title.text == vehicle.spec.name, "Outdoor search uses the same dynamic card")
	vehicle_task.worker.take_damage(1.0)
	await frames(1)
	check(not vehicle_card.visible, "Defending worker is not shown as actively searching")
	vehicle_task.prepare(10.0, mission)
	await frames(2)
	check(vehicle_card.visible, "Card returns when real outdoor searching resumes")
	vehicle_task.worker.take_damage(10000.0)
	await frames(1)
	check(not vehicle_card.visible, "Dead worker cannot leave stale searching UI")
	FileAccess.open(OUTPUT + "runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "positions": positions, "evidence": "Production Mission/HUD; native synthetic input; in-memory campaign; no player save"}, "\t"))
	layer.free()
	mission.free()
	await frames(2)
	print("SEARCH ACTIVE CARD: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func verify_button_spacing(card: Control, state: String) -> void:
	var to_card: Transform2D = card.get_global_transform().affine_inverse()
	var button_left: float = (to_card * card.action.get_global_rect().position).x
	for control: Control in [card.detail, card.percent_label, card.progress]:
		var information_right: float = (to_card * control.get_global_rect().end).x
		check(button_left - information_right >= 11.99, state + ": 12px clear space before cancel / " + control.name)

func begin_search(id: String) -> void:
	await step(.4)
	mission.command_search(id)
	var deadline: float = mission.clock.elapsed + 45
	while mission.search_tasks.has(id) and not mission.search_tasks[id].worker.searching and mission.clock.elapsed < deadline:
		await step(.1)
	await step(.5)
	hud.refresh()
	await frames(3)

func capture_card(label: String, card: Control) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	var pixels: Image = root.get_texture().get_image()
	check(pixels.save_png(OUTPUT + label + "-full.png") == OK, "Full capture " + label)
	var region: Rect2i = Rect2i(root.get_stretch_transform() * card.get_global_rect().grow(6)).intersection(Rect2i(Vector2i.ZERO, pixels.get_size()))
	check(pixels.get_region(region).save_png(OUTPUT + label + ".png") == OK, "Card capture " + label)

func verify_anchor(card: Control, id: String, label: String, centered: bool = false) -> void:
	var anchor: Vector3 = mission.city.sites[id].search_anchor.global_position
	var point: Vector2 = hud.poi_context.get_global_transform().affine_inverse() * mission.camera.unproject_position(anchor)
	var pointer: Vector2 = card.position + Vector2(card.size.x * .5, card.size.y)
	var gap: Vector2 = point - pointer
	check(card.is_visible_in_tree(), label + ": active search card remains visible")
	check(gap.y >= -.75, label + ": card stays above its search point, never across the building")
	check(gap.y <= 24.75 and absf(gap.x) <= 24.75, label + ": pointer remains near the actual search point")
	if centered:
		check(absf(gap.x) <= 1.0 and absf(gap.y - 12.0) <= 1.0, label + ": unobstructed placement is centered above the anchor")
	positions.append({"case": label, "site": id, "yaw": mission.city.sites[id].spec.yaw, "anchor": var_to_str(point), "pointer": var_to_str(pointer), "gap": var_to_str(gap)})

func verify_camera_positions(card: Control, id: String) -> void:
	var original_center: Vector3 = mission.camera_center
	for index: int in range(12):
		mission.camera_controller.pan(Vector2(.2, .1))
		await frames(1)
		verify_anchor(card, id, "pan-" + str(index))
	await capture_card("camera-pan", card)
	for zoom: float in [20.0, 35.0]:
		mission.camera.size = zoom
		await frames(8)
		verify_anchor(card, id, "zoom-" + str(zoom))
	mission.camera.size = 25.0
	mission.camera_center = original_center
	mission.camera_controller.apply()
	await frames(8)
	var original_transform: Transform3D = mission.camera.global_transform
	var to_local: Transform2D = hud.poi_context.get_global_transform().affine_inverse()
	var left: float = (to_local * hud.squad_panel.get_global_rect().end).x + 12.0
	var top: float = (to_local * hud.top_panel.get_global_rect().end).y + 12.0
	var right: float = (to_local * hud.sites_panel.get_global_rect().position).x - 12.0
	var center: Vector2 = hud.size * .5
	var targets: Dictionary = {
		"edge-left": Vector2(left + card.size.x * .5 - 16, center.y),
		"edge-right": Vector2(right - card.size.x * .5 + 16, center.y),
		"edge-top": Vector2(center.x, top + card.size.y + 4)
	}
	for label: String in targets:
		mission.camera.global_transform = original_transform
		place_anchor_on_screen(id, targets[label])
		await frames(8)
		verify_anchor(card, id, label)
		check(root.get_visible_rect().encloses(card.get_global_rect()), label + ": small edge correction keeps card inside viewport")
		await capture_card(label, card)
	mission.camera.global_transform = original_transform
	place_anchor_on_screen(id, Vector2(5, 5))
	await frames(3)
	check(not card.visible, "An anchor without nearby space is hidden instead of displaced across the map")
	mission.camera.global_transform = original_transform
	await frames(8)
	verify_anchor(card, id, "camera-restored", true)

func place_anchor_on_screen(id: String, local_point: Vector2) -> void:
	var anchor: Vector3 = mission.city.sites[id].search_anchor.global_position
	var depth: float = -mission.camera.to_local(anchor).z
	var desired: Vector2 = hud.poi_context.get_global_transform() * local_point
	mission.camera.global_position += anchor - mission.camera.project_position(desired, depth)
