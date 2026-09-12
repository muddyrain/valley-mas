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
	check(mission.camera.size == 25, "Action camera narrows the existing orthographic view")
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
	check(mission.city.sites.values().all(func(site: Dictionary): return not site.has("label") and not site.ring.visible), "Unselected POI labels and rings are hidden")
	check(not hud.recall_button.visible and not hud.task_label.visible, "Search-only actions do not occupy idle squad cards")
	check(not hud.toast.visible, "No permanent central tutorial notice")
	check(hud.site_buttons.size() == 18, "All original POI remain reachable through the scroll list")
	for panel: Control in [hud.brand_panel, hud.top_panel, hud.resources_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button]:
		check(root.get_visible_rect().encloses(panel.get_global_rect()), "HUD panel stays inside the reference viewport")
	var center := Rect2(root.get_visible_rect().size * Vector2(.28, .25), root.get_visible_rect().size * Vector2(.44, .5))
	for panel: Control in [hud.brand_panel, hud.top_panel, hud.resources_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button]:
		check(not panel.get_global_rect().intersects(center), "Permanent HUD leaves the central tactical rectangle clear")
	check(hud.squad_panel.size.x >= 170 and hud.squad_panel.size.x <= 190, "Portrait-led squad column stays narrow")
	check(hud.sites_panel.size.x >= 230 and hud.sites_panel.size.x <= 260, "Tracker width stays within the design budget")
	check(hud.command_panel.size.y >= 70 and hud.command_panel.size.y <= 82, "Icon dock height stays 70–82")
	check(hud.site_buttons.values().filter(func(b: Button): return b.visible).size() == 3, "Default tracker reveals only three relevant objectives")
	hud.set_objectives_expanded(true)
	await process_frame
	check(hud.site_buttons.values().all(func(b: Button): return b.visible), "Expanded tracker exposes all eighteen sites")
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
	hud.poi_context.focused_id = "corner"
	hud.refresh()
	check(mission.search_tasks.is_empty(), "POI hover/focus is presentational and never assigns a worker")
	check(hud.poi_context.displayed_id == "corner" and not hud.poi_context.detail.visible, "Hover shows name only")
	mission.command_search("corner")
	hud.refresh()
	check(mission.poi_selected_id == "corner" and hud.poi_context.progress.visible, "Existing search command exposes contextual task progress")
	check(hud.recall_button.visible and mission.search_tasks.has("corner"), "Search cancellation remains available when needed")
	mission.command_recall()
	hud.refresh()
	check(mission.search_tasks.is_empty() and not hud.recall_button.visible, "Cancellation releases the real task and retracts its controls")
	for asset: Resource in WorldAssets.ALL:
		var instance: Node3D = asset.scene.instantiate()
		for mesh: MeshInstance3D in instance.find_children("*", "MeshInstance3D", true, false):
			var material: Material = mesh.get_active_material(0)
			if material is BaseMaterial3D and material.albedo_texture != null:
				check(material.texture_filter == BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC, "World textures keep mipmaps with anisotropic filtering: " + asset.id)
				check(material.albedo_texture.get_image().get_mipmap_count() == 11, "Actual 2K texture includes the full mip chain: " + asset.id)
				check(material.albedo_texture.get_size() == Vector2(2048, 2048), "Original 2K textures retained: " + asset.id)
		instance.free()
	layer.free()
	mission.free()
	print("EXPEDITION VISUAL: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
