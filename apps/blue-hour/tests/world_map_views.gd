extends SceneTree
const Mission = preload("res://missions/mission.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	root.unfocusable = true
	var mission := Mission.new()
	root.add_child(mission)
	mission.setup(Catalog.new(), Ledger.new(), ["pistol", "smg"], 20260912)
	mission.set_physics_process(false)
	mission.camera_controller.following = false
	if "motion" in OS.get_cmdline_user_args():
		await material_motion(mission)
		mission.free()
		quit()
		return
	for view: Dictionary in [
		{"name": "overview", "at": Vector3(-10, 0, 4), "size": 110.0},
		{"name": "residential", "at": Vector3(-17, 0, 27), "size": 22.0},
		{"name": "commercial", "at": mission.city.sites.market.spec.position, "size": 22.0},
		{"name": "gas", "at": mission.city.sites.fuel.spec.position, "size": 24.0},
		{"name": "repair", "at": mission.city.sites.garage.spec.position, "size": 22.0},
		{"name": "materials", "at": Vector3(-16, 0, 28), "size": 18.0},
		{"name": "garden", "at": Vector3(-57, 0, 24), "size": 22.0},
	]:
		mission.camera_center = view.at
		mission.camera.size = view.size
		mission._update_camera()
		for i: int in range(12):
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/world-detail-" + view.name + ".png")
	mission.free()
	print("WORLD DETAIL VIEWS: 7 native captures (isolated visual fixture)")
	quit()

func material_motion(mission: Node3D) -> void:
	var surfaces: Array[Dictionary] = []
	for mesh: MeshInstance3D in mission.city.find_children("*", "MeshInstance3D", true, false):
		for index: int in range(mesh.mesh.get_surface_count()):
			var material: Material = mesh.get_surface_override_material(index)
			if material is ShaderMaterial:
				surfaces.append({"mesh": mesh, "index": index, "material": material})
	var sun: DirectionalLight3D = mission.atmosphere.sun
	for variant: String in ["source", "styled", "cascades", "no-shadows"]:
		for surface: Dictionary in surfaces:
			surface.mesh.set_surface_override_material(surface.index, null if variant == "source" else surface.material)
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS if variant == "cascades" else DirectionalLight3D.SHADOW_ORTHOGONAL
		sun.shadow_enabled = variant != "no-shadows"
		var directory: String = "res://test-output/expedition-motion/" + variant
		DirAccess.make_dir_recursive_absolute(directory)
		var metadata: Array[Dictionary] = []
		for frame: int in range(72):
			mission.camera_center = Vector3(-16 + frame * .018, 0, 25 + frame * .012)
			mission.camera.size = 22
			mission.camera_controller.apply()
			await process_frame
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(directory + "/%04d.png" % frame)
			var roof: Vector2 = mission.camera.unproject_position(Vector3(-16, 3.9, 29))
			var road: Vector2 = mission.camera.unproject_position(Vector3(-18, 0, 39))
			metadata.append({"roof": [roof.x, roof.y], "road": [road.x, road.y]})
		FileAccess.open(directory + "/frames.json", FileAccess.WRITE).store_string(JSON.stringify(metadata))
	print("MATERIAL MOTION: 288 native frames, fixed geometry/camera/light; material and shadow diagnostics")
