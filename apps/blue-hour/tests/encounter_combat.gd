extends "res://tests/search_dispatch.gd"

func run() -> void:
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg", "crowbar"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 319762786)
	mission.director_enabled = false
	var first_shot: float = -1
	for i: int in range(450):
		mission._physics_process(1.0 / 30)
		if int(mission.noise.counts.get("PISTOL", 0)) > 0:
			first_shot = mission.action_elapsed
			break
	check(first_shot >= 5 and first_shot <= 15, "Natural first shot occurs 5-15 seconds after arrival (%.2f)" % first_shot)
	await advance(15)
	check(mission.kills > 0, "Existing automatic weapon damage kills initial infected")
	mission.debug_clear_enemies()
	mission.arrival_noise_pending = false
	var member: Node3D = mission.survivors[0]
	member.position = Vector3(0, 0, 0)
	member.stop()
	member.combat.equip(mission.catalog.by_id(mission.catalog.weapons, "pistol"))
	var listener: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, -20))
	listener.rig.rotation.y = 0
	var before: int = mission.noise.total_emitted
	check(member.combat.try_attack(member, mission, Vector3(0, 0, 8)), "Directed fire goes through the same production weapon controller")
	check(mission.noise.total_emitted == before + 1, "Actual shot emits one event")
	check(listener.state == listener.State.INVESTIGATE and listener.target == null and listener.heard_noise == "PISTOL", "Gunshot attracts an unseen group without target knowledge")
	member.combat.try_attack(member, mission, Vector3(0, 0, 8))
	check(mission.noise.total_emitted == before + 1, "Blocked cooldown emits no fake noise")
	mission.debug_clear_enemies()
	var entry: Vector3 = mission.city.sites.arrival_house.spec.entry
	member.position = entry
	for other: Node3D in mission.survivors.slice(1):
		other.position = Vector3(0, 0, -40)
		other.stop()
	mission.command_search("arrival_house")
	await advance(1)
	var progress: float = mission.city.sites.arrival_house.progress
	check(progress > 0 and member.inside_building, "Building search starts after clearing the entrance")
	listener = mission.spawn_enemy("ENM_001_infected_basic_a", entry + Vector3(0, 0, -0.8))
	listener.hp = 10000
	await advance(.6)
	check(not member.searching and not member.inside_building and mission.search_task.phase == mission.search_task.Phase.DEFEND, "Threat at the door brings the searching survivor out to defend")
	check(mission.city.sites.arrival_house.progress == progress, "Search progress pauses under threat")
	mission.debug_clear_enemies()
	await advance(3)
	check(mission.city.sites.arrival_house.progress > progress, "Search resumes after danger clears")
	print("ENCOUNTER COMBAT: %d checks, %d failures" % [checks, failures.size()])
	mission.free()
	quit(0 if failures.is_empty() else 1)
