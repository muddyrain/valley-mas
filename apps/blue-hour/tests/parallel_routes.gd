extends "res://tests/balance_probe.gd"

func parallel_probe(title: String, route: Array[String], seed_value: int) -> void:
	var mission := Mission.new()
	root.add_child(mission)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	var ledger := Ledger.new()
	mission.setup(Catalog.new(), ledger, loadout, seed_value)
	mission.set_physics_process(false)
	mission.set_process(false)
	var pending := route.duplicate()
	var visits: Array[Dictionary] = []
	var recorded: Array[String] = []
	while mission.active and mission.clock.elapsed < 360:
		# Commit free survivors in route order; active workers are never replaced.
		while not pending.is_empty() and not mission.guards().is_empty():
			var id: String = pending.pop_front()
			mission.command_search(id)
		await step(mission, 1)
		for id in route:
			if mission.city.sites[id].searched and id not in recorded:
				recorded.append(id)
				visits.append({"site": id, "at": snappedf(mission.clock.elapsed, 0.1)})
		if pending.is_empty() and mission.search_tasks.is_empty():
			break
	if mission.active:
		mission.command_extract()
		await step(mission, 80)
	var report := {"route": title, "seed": seed_value, "invincible": mission.invincible,
		"director_enabled": mission.director_enabled, "seconds": snappedf(mission.clock.elapsed, 0.1),
		"alive": mission.living().size(), "phase": mission.clock.phase, "threat": mission.clock.threat_level(),
		"visits": visits, "settlement": ledger.last_result,
		"hp": mission.survivors.map(func(member): return snappedf(member.hp, 0.1))}
	reports.append(report)
	print(JSON.stringify(report))
	mission.queue_free()
	await create_timer(0.1).timeout

func run() -> void:
	create_timer(120).timeout.connect(func(): quit(2))
	for seed_value in [772, 773, 774]:
		await probe("serial_three", ["corner", "van_south", "garage"], seed_value)
		await parallel_probe("parallel_three", ["corner", "van_south", "garage"], seed_value)
		await parallel_probe("parallel_greedy", ["corner", "van_south", "garage", "market", "car_west", "pharmacy", "van_north", "depot"], seed_value)
	var output := FileAccess.open("res://test-output/parallel-routes.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(reports, "\t"))
	quit()
