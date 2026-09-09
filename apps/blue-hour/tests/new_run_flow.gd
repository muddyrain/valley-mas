extends "res://tests/day_loop_flow.gd"

func run() -> void:
	create_timer(100).timeout.connect(func(): printerr("NEW RUN FLOW TIMEOUT"); quit(2))
	var catalog := Catalog.new()
	var traces: Array = []
	for specialty in ["combat", "scavenge", "survey"]:
		var game := Campaign.new(catalog)
		game.new_run(772, specialty)
		var member: String = game.data.members[0]
		check(game.train(member), "Train starter before five-day run")
		for day in range(1, 6):
			if game.data.status != "shelter":
				break
			var mission := sortie(game)
			for id in ["corner", "van_south"]:
				mission.command_search(id)
				mission.command_move(mission.city.sites[id].spec.entry + Vector3(0, 0, 3))
				var deadline: float = mission.clock.elapsed + 125
				while mission.active and not mission.city.sites[id].searched and mission.clock.elapsed < deadline:
					await step(mission, 1)
				check(mission.city.sites[id].searched, "Two-member team searches " + id)
			if mission.active:
				mission.powers.activate()
				mission.command_extract()
				await step(mission, 80)
			check(game.data.status == "pending", "Two-member action reaches settlement")
			if game.data.status == "pending":
				check(game.commit_day(), "Two-member return commits once")
				check(game.member_level(member) == 2, "Training persists through real sortie")
				traces.append({"specialization": specialty,"day":day,"seconds":mission.clock.elapsed,"food":game.data.food,"alive":game.data.members.size(),"hp":mission.survivors.map(func(actor): return actor.hp),"invincible":mission.invincible})
			mission.queue_free()
			await process_frame
			var loaded := Campaign.new(catalog)
			check(loaded.restore(JSON.parse_string(JSON.stringify(game.data))), "New schema restores between real sorties")
			game = loaded
		check(game.data.status == "won" and game.data.history.size() == 5, "Specialization completes five real days: " + specialty)
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var output := FileAccess.open("res://test-output/new-run-flow.json", FileAccess.WRITE)
	output.store_string(JSON.stringify({"checks": checks, "failures":failures, "runs":traces}, "\t"))
	await create_timer(0.1).timeout
	print("NEW RUN FLOW: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
