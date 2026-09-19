extends SceneTree
## Run with --main-pack against the exported EXE in an isolated directory.
const App = preload("res://core/main.gd")
var failures: Array[String] = []

class SeededApp extends App:
	func _mission_config(action_id: String) -> Dictionary:
		var config: Dictionary = super._mission_config(action_id)
		config.map_seed = 4101
		config.seed = 4101
		return config

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var app := SeededApp.new()
	app.fresh_test_run = true
	app.save_path = "user://test-runs/ground-pack-%d.json" % OS.get_process_id()
	root.add_child(app)
	await process_frame
	app.campaign.new_run(4101, "", ["xia_zhiyao", "su_wanxing"])
	app.random_mission_counter = 0
	app.start_mission()
	var mission: Node3D = app.mission
	if mission == null:
		printerr("PACK GROUND: mission setup failed")
		quit(1)
		return
	mission.set_physics_process(false)
	mission.director_enabled = false
	await process_frame
	for actor: Node3D in mission.survivors:
		var height: float = mission.city.get_walkable_ground_height(Vector2(actor.position.x, actor.position.z))
		if absf(actor.position.y - height) > .0001 or not is_equal_approx(actor.data.move_speed, 2.8):
			failures.append(actor.data.id + " spawn/speed")
	mission.command_move(mission.city.nearest_open(mission.survivors[0].position + Vector3(0, 0, -8)))
	for frame: int in 240:
		mission._physics_process(1.0 / 60)
		for actor: Node3D in mission.survivors:
			var height: float = mission.city.get_walkable_ground_height(Vector2(actor.position.x, actor.position.z))
			if absf(actor.position.y - height) > .0001 or absf(actor.rig.position.y) > .0001:
				failures.append(actor.data.id + " moving ground/offset")
		if frame % 60 == 0:
			await process_frame
	print("EXPORTED GROUND: both actors / 240 ticks; ", failures)
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
