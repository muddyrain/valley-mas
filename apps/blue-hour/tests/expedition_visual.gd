extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const WorldAssets = preload("res://data/world_asset_catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok:
		failures.append(message)
		push_error(message)

func run() -> void:
	root.size = Vector2i(1600, 900)
	await process_frame
	var mission := Mission.new()
	root.add_child(mission)
	mission.setup(Catalog.new(), Ledger.new(), ["pistol", "smg"], 20260912)
	mission.set_physics_process(false)
	check(ProjectSettings.get_setting("display/window/size/window_width_override") == 1600, "Default window width is 1600")
	check(ProjectSettings.get_setting("display/window/size/window_height_override") == 900, "Default window height is 900")
	check(mission.camera.size == 23, "Default camera makes the squad readable without changing its scale")
	check(mission.camera_center.distance_to(mission.squad_center()) < 10, "Arrival camera frames the squad instead of the map origin")
	check(mission.camera.projection == Camera3D.PROJECTION_ORTHOGONAL, "Existing 3/4 projection retained")
	check(mission.catalog.map.base_seed == 20260912, "Same formal base map seed")
	var layer := CanvasLayer.new()
	root.add_child(layer)
	var hud := HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	for i in range(4):
		await process_frame
	check(mission.city.sites.values().all(func(site: Dictionary): return not site.has("label") and (site.discovered or not site.ring.visible)), "Undiscovered POI markers remain hidden")
	check(hud.squad_cards.all(func(card: Control): return card.size.y <= 128), "Idle survivor cards keep the compact read-only layout")
	check(not hud.toast.visible, "No permanent central tutorial notice")
	check(hud.site_buttons.size() == mission.city.sites.size(), "All original POI remain reachable through the scroll list")
	for panel: Control in [hud.brand_panel, hud.top_panel, hud.resources_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button]:
		check(root.get_visible_rect().encloses(panel.get_global_rect()), "HUD panel stays inside the reference viewport")
	var center := Rect2(root.get_visible_rect().size * Vector2(.28, .25), root.get_visible_rect().size * Vector2(.44, .5))
	for panel: Control in [hud.brand_panel, hud.top_panel, hud.resources_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button]:
		check(not panel.get_global_rect().intersects(center), "Permanent HUD leaves the central tactical rectangle clear")
	check(hud.squad_panel.size.x >= 280 and hud.squad_panel.size.x <= 306, "HUD 2 party column uses the supplied horizontal card")
	check(hud.sites_panel.size.x >= 300 and hud.sites_panel.size.x <= 320, "HUD 2 tracker fits its supplied panel")
	check(hud.command_panel.size.y >= 124 and hud.command_panel.size.y <= 132, "Action dock reserves a readable shortcut row beneath its artwork")
	check(hud.site_buttons.values().filter(func(b: Button): return b.visible).size() == mini(3, mission.city.sites.values().filter(func(site: Dictionary): return site.discovered and not site.searched).size()), "Default tracker reveals only three relevant objectives")
	hud.set_objectives_expanded(true)
	await process_frame
	check(hud.site_buttons.keys().all(func(id: String): return hud.site_buttons[id].visible == mission.city.sites[id].discovered), "Expanded tracker exposes only discovered POIs")
	hud.set_objectives_expanded(false)
	for member: Node3D in mission.survivors:
		check(member.rig.scale == Vector3.ONE, "Camera redesign does not inflate character rigs")
	mission.camera_controller.zoom(500)
	check(mission.camera.size == 35, "Zoom out stops before an entire-map overview")
	mission.camera_controller.zoom(-500)
	check(mission.camera.size == 20, "Zoom in has a readable tactical lower bound")
	mission.pan_camera(Vector2(2, 0))
	check(not mission.camera_controller.following, "Manual pan takes control from automatic tracking")
	mission.center_squad()
	check(mission.camera_controller.following, "Locate squad resumes tracking")
	mission.camera_center = mission.city.sites.corner.spec.entry
	mission.camera_controller.following = false
	mission.camera_controller.apply()
	mission.survivors[0].position = mission.city.sites.corner.spec.entry
	mission.exploration.refresh()
	hud.poi_context.focused_id = "corner"
	hud.refresh()
	check(mission.search_tasks.is_empty(), "POI hover/focus is presentational and never assigns a worker")
	check(hud.poi_context.displayed_id == "corner" and not hud.poi_context.detail.visible, "Hover shows name only")
	var card: PanelContainer = hud.poi_context._focus_card
	check(not card.search_icon.get_rect().intersects(card.title.get_rect()), "Search icon %s never overlaps the building name %s" % [card.search_icon.get_rect(), card.title.get_rect()])
	mission.command_search("corner")
	hud.refresh()
	check(mission.poi_selected_id == "corner" and hud.poi_context.progress.visible, "Existing search command exposes contextual task progress")
	check(hud.squad_cards.all(func(card: Control): return card.size.y <= 128), "Active search keeps survivor cards compact")
	mission.command_recall()
	hud.refresh()
	check(mission.search_tasks.is_empty() and hud.squad_cards.all(func(card: Control): return card.size.y <= 128), "Search release keeps the read-only roster compact")
	hud.size = Vector2(320, 180)
	hud.poi_context.refresh()
	check(not hud.poi_context._focus_card.visible, "Small or not-yet-laid-out viewports safely suppress world cards")
	hud._fit_window()
	for asset: Resource in WorldAssets.ALL:
		var instance: Node3D = asset.scene.instantiate()
		for mesh: MeshInstance3D in instance.find_children("*", "MeshInstance3D", true, false):
			var material: Material = mesh.get_active_material(0)
			if material is BaseMaterial3D and material.albedo_texture != null:
				check(material.texture_filter == BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC, "World textures keep mipmaps with anisotropic filtering: " + asset.id)
				check(material.albedo_texture.get_image().get_mipmap_count() == 11, "Actual 2K texture includes the full mip chain: " + asset.id)
				check(material.albedo_texture.get_size() == Vector2(2048, 2048), "Original 2K textures retained: " + asset.id)
		instance.free()
	# Expedition overrides must not leak into the shared Camp/source PackedScenes.
	var source: Node3D = WorldAssets.asset("BLD_002_house_small_a").scene.instantiate()
	var original: MeshInstance3D = source.find_children("*", "MeshInstance3D", true, false)[0]
	var field_mesh: MeshInstance3D = mission.city.sites.arrival_house.body.find_children("*", "MeshInstance3D", true, false)[0]
	check(original.get_active_material(0) is BaseMaterial3D, "Source wrapper retains its original material")
	check(field_mesh.get_active_material(0) is ShaderMaterial, "Formal expedition uses the unified environment material")
	check(original.mesh == field_mesh.mesh, "Styling reuses source geometry without making a replacement model")
	check(mission.city.get_node_or_null("RoadNetwork/Curbs") != null, "Road perimeter has continuous authored curbs")
	source.free()
	layer.free()
	mission.free()
	print("EXPEDITION VISUAL: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
