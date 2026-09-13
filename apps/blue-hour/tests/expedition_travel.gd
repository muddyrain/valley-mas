extends "res://tests/day_loop_runtime.gd"
## Isolated travel measurement: normal roster, equipment, navigation and movement rules.
## Combat is excluded from this benchmark, and remains enabled in world_map_runtime.gd.
func run() -> void:
	root.unfocusable = true
	root.add_child(InputGate.new())
	app = load("res://core/main.tscn").instantiate()
	app.save_path = "user://test-runs/travel-%d.json" % Time.get_ticks_usec()
	root.add_child(app)
	await frames(12)
	await click(button("开始游戏"))
	await click(app.screen.tabs.scavenge)
	await click(app.screen.confirm_button)
	await click(app.screen.departure)
	await click(app.screen.cards.commercial)
	await click(app.screen.confirm_button)
	app.mission.set_physics_process(false)
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	if "record" in OS.get_cmdline_user_args():
		await record_districts()
		app.free()
		await frames()
		quit(0 if failures.is_empty() else 1)
		return
	var report: Array[Dictionary] = []
	for id: String in ["garage", "north_depot", "bus"]:
		var target: Vector3 = app.catalog.map.bus_position if id == "bus" else app.mission.city.sites[id].spec.entry
		var start: Vector3 = app.mission.squad_center()
		var path: PackedVector3Array = app.mission.city.path(start, target)
		var distance: float = 0
		for i: int in range(1, path.size()):
			distance += path[i].distance_to(path[i-1])
		app.mission.command_move(target)
		var seconds: float = 0
		var arrivals: Dictionary = {}
		while seconds < 120:
			app.mission._physics_process(1.0 / 60.0)
			seconds += 1.0 / 60.0
			for member: Node3D in app.mission.survivors:
				if member.path.is_empty() and not arrivals.has(member.data.id):
					arrivals[member.data.id] = seconds
			if arrivals.size() == app.mission.survivors.size():
				break
			if int(seconds * 60) % 120 == 0:
				await process_frame
		check(seconds < 120, "Squad completes measured travel leg: " + id)
		report.append({"destination":id, "path_metres":distance, "squad_seconds":seconds, "member_seconds":arrivals})
	FileAccess.open("res://test-output/expedition-travel.json", FileAccess.WRITE).store_string(JSON.stringify({"legs":report,"day_seconds":app.catalog.map.day_seconds,"blue_seconds":app.catalog.map.blue_seconds,"method":"Existing movement, no teleport; excludes combat, search and boarding; scavenge specialization"}, "\t"))
	print("EXPEDITION TRAVEL: ", report)
	app.free()
	await frames()
	quit(0 if failures.is_empty() else 1)

func record_districts() -> void:
	var directory: String = "res://test-output/expedition-motion/districts"
	DirAccess.make_dir_recursive_absolute(directory)
	var frame: int = 0
	var route: Array[Dictionary] = []
	for id: String in ["arrival_house", "market", "garage", "fuel"]:
		var target: Vector3 = app.mission.city.sites[id].spec.entry
		app.mission.command_move(target)
		var elapsed: float = 0
		while elapsed < 45:
			app.mission._physics_process(1.0 / 30.0)
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(directory + "/%04d.png" % frame)
			frame += 1
			elapsed += 1.0 / 30.0
			if app.mission.survivors.all(func(member: Node3D): return member.path.is_empty()):
				break
		check(elapsed < 45, "Production navigation reaches district: " + id)
		await frames(20)
		await capture("expedition-district-" + id)
		route.append({"site": id, "arrival_frame": frame, "travel_seconds": elapsed})
	# Detail compositions follow real arrival; only the camera is repositioned for these stills.
	app.mission.camera_controller.following = false
	for shot: Dictionary in [
		{"id": "expedition-materials", "at": app.mission.city.sites.fuel.spec.position, "size": 18.0},
		{"id": "expedition-garden", "at": Vector3(-18, 0, 27), "size": 20.0},
	]:
		app.mission.camera_center = shot.at
		app.mission.camera.size = shot.size
		app.mission.camera_controller.apply()
		await frames(8)
		await capture(shot.id)
	FileAccess.open(directory + "/route.json", FileAccess.WRITE).store_string(JSON.stringify({"frames": frame, "fps": 30, "route": route, "checks": checks, "failures": failures, "method": "Formal departure, normal squad navigation and animation, no teleport; combat excluded for visual travel evidence"}, "\t"))
	print("EXPEDITION DISTRICTS: %d frames; %d checks, %d failures" % [frame, checks, failures.size()])
