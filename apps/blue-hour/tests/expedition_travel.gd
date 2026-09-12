extends "res://tests/day_loop_runtime.gd"
## Isolated travel measurement: normal roster, equipment, navigation and movement rules.
## Combat is excluded from this benchmark, and remains enabled in world_map_runtime.gd.
func run() -> void:
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
