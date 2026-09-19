extends "res://tests/expedition_navigation.gd"
## Diagnostic counterfactual: compare with the pre-ground-contract navigation.
class FlatGround extends RefCounted:
	func project(point: Vector3) -> Vector3:
		return Vector3(point.x, .08, point.z)
	func get_walkable_ground_height(_point: Vector2) -> float:
		return .08

func run() -> void:
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	if mission == null:
		push_error("Diagnostic fixture could not start mission")
		quit(1)
		return
	mission.set_physics_process(false)
	await process_frame
	if "--baseline" in OS.get_cmdline_user_args():
		var source := FileAccess.get_file_as_string("res://test-output/ground-contract/navigation-before.txt")
		var script := GDScript.new()
		script.source_code = source.replace("extends RefCounted", "extends RefCounted\nvar ground: RefCounted")
		check(script.reload() == OK, "Load exact Git baseline navigation")
		var nav: RefCounted = script.new()
		nav.ground = FlatGround.new()
		nav.build(mission.city, mission.runtime_data.town_bounds)
		mission.city.navigation = nav
		mission.city.grid = nav.grid
		for actor: Node3D in mission.survivors:
			actor.position.y = .08
	await walk(mission, mission.city.navigation_targets.residential, "residential")
	await walk(mission, mission.city.navigation.nearest(mission.runtime_data.arrival_exit), "return_to_arrival")
	print("NAV GROUND CONTROL baseline=", "--baseline" in OS.get_cmdline_user_args(), ": ", failures)
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
