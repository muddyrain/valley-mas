extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	create_timer(45).timeout.connect(func(): quit(2))
	var game: RefCounted = load("res://core/campaign.gd").new(load("res://data/catalog.gd").new())
	game.new_run(77, "", ["xia_zhiyao", "su_wanxing"])
	var camp: Node3D = load("res://scenes/camp/camp_main.tscn").instantiate()
	root.add_child(camp)
	camp.configure(game)
	for frame: int in range(15):
		await physics_frame
	var ambient: Node = camp.ambient_behavior
	check(ambient.get("navigation") != null, "Ambient has a ground-only navigation map")
	if ambient.get("navigation") == null:
		quit(1)
		return
	var nav: Node = ambient.navigation
	check(ambient.pois.size() >= 7, "Seven independent safe anchors")
	for poi: Dictionary in ambient.pois:
		check(poi.enabled, "Enabled safe anchor: " + str(poi.id))
		for other: Dictionary in ambient.pois:
			if poi.id != other.id:
				check(not nav.valid_path(poi.position, other.position).is_empty(), "Connected anchors: %s -> %s" % [poi.id, other.id])
	for point: Vector3 in [Vector3(0, 0, -3.8), Vector3(0, 0, -6.75), Vector3(-7.9, 0, -4.5), Vector3(9.6, 0, -2.6), Vector3(-2.3, 0, -4.12), Vector3(7.45, 0, -3.25), Vector3(-7.15, 0, 3)]:
		check(not nav.is_safe(point), "Forbidden geometry excluded: %s" % point)
	var actor: Node3D = camp.members.xia_zhiyao
	check(not ambient.request_poi(actor, "missing"), "Missing POI never enters MOVE")
	check(ambient.request_poi(actor, "main_station"), "Reachable anchor accepts reservation")
	check(not ambient.request_poi(camp.members.su_wanxing, "main_station"), "Capacity one rejects duplicate reservation")
	actor.set_physics_process(false)
	await create_timer(4.5).timeout
	check(ambient.state_for(actor.member_id) == "IDLE", "Blocked motion returns to IDLE within two bounded windows")
	check(not actor.moving and ambient.reservations.is_empty(), "Stuck recovery stops navigation and releases reservation")
	check(int(ambient.repath_count.get(actor.member_id, 0)) == 1, "Stuck motion repaths exactly once")
	actor.set_physics_process(true)
	var party: Array[String] = ["xia_zhiyao", "su_wanxing"]
	camp.begin_departure(party)
	check(ambient.state_for(actor.member_id) == "DEPARTURE_OVERRIDE", "Departure owns actors synchronously")
	check(actor.agent.get_navigation_map() == camp.get_world_3d().navigation_map, "Departure restores original map")
	print("AMBIENT NAVIGATION: failures=", failures)
	camp.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
