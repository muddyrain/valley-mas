extends "res://tests/world_map_runtime.gd"
## Exercises the actual production loop, with extra visual/layout evidence at its checkpoints.
var search_captured: bool = false
var visual_evidence: Array[Dictionary] = []

func snapshot(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://test-output/" + id + ".png") == OK, "Visual screenshot: " + id)

func hover(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.device = 42
	event.position = point
	root.push_input(event, true)
	await create_timer(.15).timeout

func layout_check(resolution: Vector2i) -> void:
	root.size = resolution
	await frames(15)
	var viewport_rect: Rect2 = root.get_visible_rect()
	var center := Rect2(viewport_rect.size * Vector2(.28, .25), viewport_rect.size * Vector2(.44, .5))
	var panels: Dictionary = {}
	for panel: Control in [app.hud.brand_panel, app.hud.top_panel, app.hud.resources_panel, app.hud.squad_panel, app.hud.sites_panel, app.hud.command_panel, app.hud.extract_button]:
		var rect := panel.get_global_rect()
		check(viewport_rect.encloses(rect), "%s stays inside %s" % [panel.name, resolution])
		check(not rect.intersects(center), "%s leaves central action space at %s" % [panel.name, resolution])
		panels[panel.name] = var_to_str(rect)
	for control: Control in app.hud.power_buttons.values() + [app.hud.extract_button, app.hud.pause_button]:
		check(viewport_rect.encloses(control.get_global_rect()), "Action remains on screen at " + str(resolution))
	var silhouette_heights: Array[float] = []
	for member: Node3D in app.mission.survivors:
		var head: Vector2 = app.mission.camera.unproject_position(member.position + Vector3.UP * 1.6)
		var foot: Vector2 = app.mission.camera.unproject_position(member.position)
		silhouette_heights.append(absf(head.y - foot.y) * root.get_stretch_transform().get_scale().y)
	visual_evidence.append({"window": str(resolution), "viewport": var_to_str(viewport_rect), "panels": panels,
		"camera_size": app.mission.camera.size, "camera_position": var_to_str(app.mission.camera.position),
		"camera_rotation": var_to_str(app.mission.camera.rotation_degrees), "character_1_6m_projected_pixels": silhouette_heights})
	var pixel_scale: Vector2 = app.hud.get_global_transform().get_scale() * root.get_stretch_transform().get_scale()
	check(pixel_scale.distance_to(Vector2.ONE) < .01, "HUD text stays at readable pixel sizes instead of shrinking the entire layout")
	check(app.mission.camera.size == 25, "Every resolution uses the production 25 camera")
	await snapshot("expedition-day-%dx%d" % [resolution.x, resolution.y])

func capture(id: String) -> void:
	await super.capture(id)
	if id == "world-04-day":
		for resolution: Vector2i in [Vector2i(1600, 900), Vector2i(1920, 1080), Vector2i(1366, 768)]:
			await layout_check(resolution)
		root.size = Vector2i(1600, 900)
		await frames(15)
		check(app.hud.squad_cards.all(func(card: Control): return card.portrait.texture != null), "Production roster uses its original model portraits")
		await click(app.hud.expand_button)
		check(app.hud.objectives_expanded and app.hud.site_buttons.values().all(func(b: Button): return b.visible), "Actual expand click exposes the full objective list")
		await snapshot("expedition-objectives-expanded")
		await click(app.hud.expand_button)
		check(not app.hud.objectives_expanded, "Actual fold click restores the compact tracker")
		await hover(app.hud.brand_panel.get_global_rect().get_center())
	elif id == "world-05-search":
		# A controlled encounter uses the real infection, damage, ammo and focus systems after normal departure.
		# No player teleport, invincibility or altered combat statistics.
		var location: Vector3 = app.mission.city.nearest_open(app.mission.squad_center() + Vector3(0, 0, -4))
		var enemy: Node3D = app.mission.spawn_enemy(app.catalog.enemies[0].id, location)
		var initial_hp: float = enemy.hp
		await key(KEY_F)
		check(app.mission.focus_target == enemy, "Formal anime squad responds to F against a real infection")
		await step(.4)
		await create_timer(.2).timeout
		check(enemy.hp < initial_hp or enemy.dead, "Existing combat deals real damage during the formal expedition")
		await snapshot("expedition-combat-formal-1600x900")
		await step(3)
	elif id == "world-06-blue-hour":
		check(app.hud.phase_label.text == "BLUE HOUR", "Top indicator reflects the original Blue Hour clock")
		check(app.hud.extract_button.caption.text.contains("立即归航"), "Blue Hour raises the return command priority")
		await snapshot("expedition-blue-hour-1600x900")
	elif id == "world-09-returned-camp":
		FileAccess.open("res://test-output/expedition-runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "resolutions": visual_evidence, "search_captured": search_captured}, "\t"))

func step(seconds: float) -> void:
	if is_equal_approx(seconds, 90.0) and app.mission != null and app.mission.extraction:
		await create_timer(.2).timeout
		await snapshot("expedition-return-1600x900")
	await super.step(seconds)
	if is_equal_approx(seconds, 4.0):
		# Time-compressed walking finishes before the real-time follow spring settles.
		await create_timer(1.2).timeout
		await snapshot("expedition-squad-action")
		var entry: Vector3 = app.mission.city.sites.arrival_house.spec.entry
		await hover(app.mission.camera.unproject_position(entry + Vector3.UP * .2))
		check(app.mission.search_tasks.is_empty(), "Actual world hover does not dispatch workers")
		check(app.hud.poi_context.displayed_id == "arrival_house", "Actual world hover identifies the building entrance")
		check(not app.hud.poi_context.detail.visible, "World hover keeps resource details folded")
		await snapshot("expedition-poi-hover")
		await hover(app.hud.brand_panel.get_global_rect().get_center())
		check(not app.hud.poi_context.visible, "Ordinary POI context disappears when the pointer leaves")
	if app.mission == null or search_captured or not app.mission.search_tasks.has("arrival_house"):
		return
	if app.mission.city.sites.arrival_house.progress <= .05:
		return
	app.hud.refresh()
	check(app.hud.poi_context.progress.visible and app.hud.recall_button.visible, "Active search shows progress and contextual cancel")
	await snapshot("expedition-poi-search")
	search_captured = true
