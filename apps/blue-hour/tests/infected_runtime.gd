extends "res://tests/world_map_runtime.gd"
## Reuse the complete native menu -> route -> camp -> expedition -> return regression.

func capture(id: String) -> void:
	if app.mission != null and id in ["world-04-day", "world-06-blue-hour", "world-07-night"]:
		var definition: Resource = app.catalog.enemies[0]
		check(app.catalog.enemies.size() == 1, "Only one runtime enemy definition")
		for enemy: Node3D in app.mission.enemies:
			check(enemy.data == definition, "Every live enemy uses the same shared formal definition")
			check(enemy.rig.get_node("Model").scene_file_path == "res://assets/characters/infected_basic_a/model/ENM_001_infected_basic_a.glb", "Actual expedition renders the supplied model")
			check(is_equal_approx(enemy.max_hp, 30.0 * app.mission.clock.hp_multiplier()), "Live enemy HP follows the existing clock")
			check(is_equal_approx(enemy.attack_damage, 8.0 * app.mission.clock.damage_multiplier()), "Live enemy damage follows the existing clock")
		check(is_equal_approx(definition.max_hp, 30.0) and is_equal_approx(definition.attack_damage, 8.0), "Time progression never mutates base data")
	await super.capture(id.replace("world-", "infected-"))
	if id == "world-04-day":
		check(not app.mission.enemies.is_empty(), "Generated initial encounter is visible in the production map")
		if not app.mission.enemies.is_empty():
			var enemy: Node3D = app.mission.enemies[0]
			var camera: Camera3D = app.mission.camera
			var original: Transform3D = camera.global_transform
			var original_size: float = camera.size
			camera.size = 3.4
			camera.global_position = enemy.global_position + Vector3(2.5, 2.0, -4.0)
			camera.look_at(enemy.global_position + Vector3.UP * 0.8)
			await frames(3)
			await super.capture("infected-model-in-expedition")
			camera.global_transform = original
			camera.size = original_size
	if id == "world-09-returned-camp":
		var report: Dictionary = {"checks": checks, "failures": failures,
			"flow": "Production main scene -> new game -> scavenge route -> camp -> expedition -> search -> Blue Hour -> Night -> extraction -> settlement -> camp",
			"mode": "Native Godot renderer; synthetic mouse/keyboard; accelerated real simulation; no invincibility, teleport or forced completion",
			"render_backend": RenderingServer.get_video_adapter_name()}
		FileAccess.open("res://test-output/infected-runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
