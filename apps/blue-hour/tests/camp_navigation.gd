extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	create_timer(55).timeout.connect(func(): printerr("CAMP WALK TIMEOUT"); quit(2))
	var catalog: RefCounted = load("res://data/catalog.gd").new()
	var campaign: RefCounted = load("res://core/campaign.gd").new(catalog)
	campaign.new_run(77, "", ["xia_zhiyao"])
	var camp: Node3D = load("res://scenes/camp/camp_main.tscn").instantiate()
	root.add_child(camp)
	camp.configure(campaign)
	for frame: int in range(10):
		await physics_frame
	var actor: Node3D = camp.members.xia_zhiyao
	var entrance: Vector3 = camp.get_node("NavigationSource/MainBuilding/EntrancePoint").global_position
	var vehicle_entry: Vector3 = camp.get_node("NavigationSource/BlueHourBerth/VehicleEntryPoint").global_position
	var points: Array[Vector3] = [entrance, Vector3(-4.7, 0, -2.1), Vector3(-2, 0, 0.3), Vector3(4.8, 0, -1.5), vehicle_entry]
	for target: Vector3 in points:
		actor.move_to(target)
		var deadline := Time.get_ticks_msec() + 9000
		while not actor.arrived() and Time.get_ticks_msec() < deadline:
			await physics_frame
		if not actor.arrived():
			failures.append("Cannot walk to %s; stopped at %s" % [target, actor.position])
		print("CAMP WALK: ", target, " -> ", actor.position, " arrived=", actor.arrived())
	print("CAMP NAVIGATION: %d routes, %d failures" % [points.size(), failures.size()])
	for message: String in failures:
		push_error(message)
	camp.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
