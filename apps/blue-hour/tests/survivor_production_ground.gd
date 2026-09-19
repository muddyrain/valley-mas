extends "res://tests/survivor_production_gameplay.gd"
## Compare captured world-space soles with the actual rendered town surfaces.

func run() -> void:
	app = SeededApp.new()
	app.fixture_seed = 4101
	app.fresh_test_run = true
	app.save_path = "user://test-runs/survivor-ground-%d.json" % OS.get_process_id()
	root.add_child(app)
	await process_frame
	app.campaign.new_run(4101, "", ["xia_zhiyao"])
	app.random_mission_counter = 0
	app.start_mission()
	mission = app.mission
	mission.set_physics_process(false)
	mission.set_process(false)
	var road: Node = mission.find_child("RoadNetwork", true, false)
	check(road != null, "Actual town road geometry found")
	if road == null:
		quit(1)
		return
	var town: Node = road.get_parent()
	var surfaces: Array[Dictionary] = []
	for node: Node in town.find_children("*", "MeshInstance3D", true, false):
		if node.name == &"ReturnZone":
			continue
		# UrbanView puts terrain directly under the town and open-space polygons
		# under Blocks; exclude buildings, props and bus geometry.
		if node.get_parent() != town and not str(node.get_path()).contains("/Blocks/"):
			continue
		var mesh := node as MeshInstance3D
		var points: Array = []
		for vertex: Vector3 in mesh.mesh.get_faces():
			var world: Vector3 = mesh.global_transform * vertex
			points.append([world.x, world.y, world.z])
		surfaces.append({"path": str(mesh.get_path()), "vertices": points})
	check(surfaces.size() >= 2, "Actual terrain surfaces found")
	FileAccess.open("res://test-output/survivor-production/ground-surfaces.json", FileAccess.WRITE).store_string(JSON.stringify(surfaces))
	print("SURVIVOR GROUND SURFACES: ", surfaces.size(), "; ", failures)
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
