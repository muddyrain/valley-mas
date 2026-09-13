extends "res://tests/search_dispatch.gd"

func run() -> void:
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 20260912)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var fog: Node = mission.exploration
	var start: Vector3 = mission.squad_center()
	check(fog.is_visible(start) and not fog.is_visible(Vector3(-60, 0, -40)), "Start reveals the party neighborhood only")
	check(not mission.city.sites.north_market.discovered and mission.city.sites.arrival_house.discovered, "Unknown ordinary POIs do not appear at start")
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(-60, 0, -32))
	fog.refresh()
	check(enemy.active and not enemy.visible, "Hidden enemies remain active simulation instances")
	enemy.think_left = 2.0
	mission._physics_process(.1)
	check(enemy.think_left < 2.0 and not enemy.visible, "Hidden enemy decision timers continue in the actual mission simulation")
	mission.survivors[0].position = Vector3(-58, 0, -32)
	mission.survivors[1].position = Vector3(15, 0, 0)
	fog.refresh()
	check(fog.is_visible(enemy.position) and fog.is_visible(mission.survivors[1].position), "Dispersed survivors reveal a union of areas")
	check(enemy.visible and mission.city.sites.north_market.discovered, "Approaching reveals both enemy and ordinary POI")
	check(fog.state_at(start) == fog.Visibility.EXPLORED, "Leaving retains explored map memory")
	mission.survivors[0].position = start
	fog.refresh()
	check(not enemy.visible and mission.city.sites.north_market.discovered, "Explored buildings persist without leaking live enemies")
	var radius: float = fog.config.radius
	mission.clock.advance(mission.clock.remaining() + .01)
	fog.refresh()
	check(fog.config.radius == radius, "Blue Hour changes atmosphere without changing sight radius")
	print("EXPLORATION: %d checks, %d failures" % [checks, failures.size()])
	mission.free()
	quit(0 if failures.is_empty() else 1)
