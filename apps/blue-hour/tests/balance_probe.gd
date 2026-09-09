extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Mission = preload("res://missions/mission.gd")
var reports: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func step(mission: Node3D, seconds: float) -> void:
	for i in range(ceili(seconds * 30)):
		if not mission.active:
			break
		mission._physics_process(1.0 / 30.0)
		if i % 60 == 0:
			await process_frame

func probe(title: String, route: Array[String], seed_value: int) -> void:
	var mission := Mission.new()
	root.add_child(mission)
	var catalog := Catalog.new()
	var ledger := Ledger.new()
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(catalog, ledger, loadout, seed_value)
	mission.set_physics_process(false)
	var visits: Array[Dictionary] = []
	for id in route:
		if not mission.active:
			break
		mission.command_search(id)
		# Dispatch reserves one worker; guards must be sent to cover the entrance explicitly.
		mission.command_move(mission.city.sites[id].spec.entry + Vector3(0, 0, 3))
		var started: float = mission.clock.elapsed
		while mission.active and not mission.city.sites[id].searched and mission.clock.elapsed < started + 120:
			await step(mission, 1.0)
		visits.append({"site": id, "at": snappedf(mission.clock.elapsed, 0.1), "searched": mission.city.sites[id].searched, "alive": mission.living().size()})
	if mission.active:
		mission.command_extract()
		await step(mission, 80)
	var report: Dictionary = {
		"route": title, "seed": seed_value, "invincible": mission.invincible,
		"seconds": snappedf(mission.clock.elapsed, 0.1), "alive": mission.living().size(),
		"phase": mission.clock.phase, "threat": mission.clock.threat_level(),
		"visits": visits, "settlement": ledger.last_result,
		"hp": mission.survivors.map(func(member): return snappedf(member.hp, 0.1))
	}
	reports.append(report)
	print(JSON.stringify(report))
	mission.queue_free()
	await create_timer(0.1).timeout

func run() -> void:
	for seed_value in [772, 773, 774]:
		await probe("early", ["corner", "van_south", "garage"], seed_value)
		await probe("blue_return", ["corner", "market", "car_west"], seed_value)
		await probe("one_more", ["corner", "market", "car_west", "van_north", "depot"], seed_value)
		await probe("greedy", ["corner", "market", "car_west", "pharmacy", "van_north", "depot", "garage", "van_south"], seed_value)
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var output := FileAccess.open("res://test-output/balance-probe.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(reports, "\t"))
	# Diagnostic only: route feel and difficulty are not binary test assertions.
	await create_timer(0.1).timeout
	quit()
