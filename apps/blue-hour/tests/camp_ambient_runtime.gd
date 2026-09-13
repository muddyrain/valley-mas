extends "res://tests/day_loop_runtime.gd"
## Real rendered Camp, real campaign members; isolated save and synthetic native input.
var camp: Node3D
var ambient: Node
var _recording := false
var _capturing := false
var _next_capture := 0
var _started := 0
var _directory := ""
var _frames: Array[Dictionary] = []
var _jobs: Array[int] = []
var _events: Array[Dictionary] = []
var _samples: Array[Dictionary] = []
var _moving: Dictionary = {}
var _last_position: Dictionary = {}
var _unsafe: Array[String] = []
var _minimum_separation := INF
var _max_stuck := 0.0
var _mode := "stability"

func _process(_delta: float) -> bool:
	if _recording and not _capturing and Time.get_ticks_msec() >= _next_capture:
		_next_capture = Time.get_ticks_msec() + 100
		_record_frame()
	return false

func _record_frame() -> void:
	_capturing = true
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	var name := "frame_%05d.jpg" % _frames.size()
	_frames.append({"file": name, "seconds": (Time.get_ticks_msec() - _started) / 1000.0})
	var path := _directory + "/" + name
	_jobs.append(WorkerThreadPool.add_task(func(): image.save_jpg(path, 0.88)))
	_capturing = false

func run() -> void:
	Engine.max_fps = 30
	root.size = Vector2i(1600, 900)
	root.content_scale_size = root.size
	root.unfocusable = true
	root.add_child(InputGate.new())
	var duration := 300.0
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--ambient-mode="):
			_mode = arg.get_slice("=", 1)
		if arg.begins_with("--ambient-seconds="):
			duration = float(arg.get_slice("=", 1))
	create_timer(duration + 120.0).timeout.connect(func(): printerr("AMBIENT RUNTIME TIMEOUT"); quit(2))
	await launch(true)
	app.campaign.new_run(77, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(20)
	await key(KEY_ESCAPE)
	camp = app.camp_view.camp
	ambient = camp.ambient_behavior
	check(camp.members.size() == 2, "Actual two-member Camp")
	for id: String in camp.members:
		_moving[id] = 0.0
		_last_position[id] = camp.members[id].global_position
	ambient.state_changed.connect(func(id: String, state: String):
		_events.append({"seconds": (Time.get_ticks_msec() - _started) / 1000.0,
			"id": id, "state": state, "poi": ambient.poi_for(id)}))
	_directory = "res://test-output/camp-ambient-" + _mode
	DirAccess.make_dir_recursive_absolute(_directory)
	_started = Time.get_ticks_msec()
	_recording = DisplayServer.get_name() != "headless"
	if _mode == "stuck":
		await _stuck_case()
	elif _mode == "departure":
		await _departure_case()
	else:
		await _observe(duration)
		check(_unsafe.is_empty(), "No static overlap or forbidden ground entry")
		check(_minimum_separation >= 0.53, "Actors never overlap")
		check(ambient.recoveries.values().all(func(n: int): return n == 0), "No stuck recovery needed during normal camp life")
		check(_events.any(func(e: Dictionary): return e.state == "POI_IDLE"), "Normal life reaches POI and rests")
	var elapsed := (Time.get_ticks_msec() - _started) / 1000.0
	_recording = false
	while _capturing:
		await process_frame
	for job: int in _jobs:
		WorkerThreadPool.wait_for_task_completion(job)
	var report := {"mode": _mode, "seconds": elapsed, "checks": checks, "failures": failures,
		"moving_seconds": _moving, "min_separation": _minimum_separation, "max_stuck_timer": _max_stuck,
		"unsafe": _unsafe, "repaths": ambient.repath_count if is_instance_valid(ambient) else {},
		"events": _events, "samples": _samples, "frames": _frames}
	FileAccess.open(_directory + "/runtime.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("AMBIENT RUNTIME: ", _mode, " seconds=", elapsed, " moving=", _moving, " min_gap=", _minimum_separation,
		" unsafe=", _unsafe, " failures=", failures)
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func _observe(seconds: float) -> void:
	var start := Time.get_ticks_msec()
	var previous := start
	var next_sample := start
	while Time.get_ticks_msec() - start < seconds * 1000.0:
		await physics_frame
		var now := Time.get_ticks_msec()
		var delta := (now - previous) / 1000.0
		previous = now
		var positions: Array[Vector3] = []
		for id: String in camp.members:
			var actor: Node3D = camp.members[id]
			var offset: Vector3 = actor.global_position - Vector3(_last_position[id])
			if Vector2(offset.x, offset.z).length() > 0.002:
				_moving[id] += delta
			_last_position[id] = actor.global_position
			positions.append(actor.global_position)
			_max_stuck = maxf(_max_stuck, ambient.stuck_for(id))
			if not ambient.navigation.is_safe(actor.global_position):
				var message := "Forbidden ground: " + id
				if message not in _unsafe:
					_unsafe.append(message)
			var query := PhysicsShapeQueryParameters3D.new()
			var capsule := CapsuleShape3D.new()
			capsule.radius = 0.26
			capsule.height = 1.35
			query.shape = capsule
			query.transform = Transform3D(Basis.IDENTITY, actor.global_position + Vector3.UP * 0.9)
			query.collision_mask = 1
			if not actor.get_world_3d().direct_space_state.intersect_shape(query).is_empty():
				var message := "Static overlap: " + id
				if message not in _unsafe:
					_unsafe.append(message)
			if now >= next_sample:
				_samples.append({"t": (now - _started) / 1000.0, "id": id,
					"position": actor.global_position, "state": ambient.state_for(id), "poi": ambient.poi_for(id)})
		_minimum_separation = minf(_minimum_separation, positions[0].distance_to(positions[1]))
		if now >= next_sample:
			next_sample = now + 1000

func _stuck_case() -> void:
	var actor: Node3D = camp.members.xia_zhiyao
	check(not ambient.request_poi(actor, "vehicle"), "Removed unsafe vehicle target cannot move")
	check(ambient.request_poi(actor, "main_station"), "Reserve reachable target before blocker")
	check(not ambient.request_poi(camp.members.su_wanxing, "main_station"), "Occupied target rejected")
	# Add a real static collision cage after path validation to simulate a blocked passage.
	var body := StaticBody3D.new()
	body.name = "RuntimeBlockedPassage"
	camp.add_child(body)
	for offset: Vector3 in [Vector3(0.42, 0.8, 0), Vector3(-0.42, 0.8, 0), Vector3(0, 0.8, 0.42), Vector3(0, 0.8, -0.42)]:
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(0.10, 1.6, 0.9) if absf(offset.x) > 0 else Vector3(0.9, 1.6, 0.10)
		shape.shape = box
		body.add_child(shape)
		shape.global_position = actor.global_position + offset
	await create_timer(5.5).timeout
	check(not actor.moving and ambient.state_for(actor.member_id) == "IDLE", "Physical blocker stops movement within bounded recovery")
	check(ambient.repath_count[actor.member_id] == 1, "Physical blocker repaths exactly once")
	check(ambient.reservations.is_empty(), "Physical blocker releases target")
	body.queue_free()
	await frames(3)
	await create_timer(3.0).timeout

func _departure_case() -> void:
	while not camp.members.values().any(func(a: Node3D): return a.moving):
		await process_frame
	await create_timer(1.0).timeout
	await click(button("今日行动"))
	check(camp.members.values().all(func(a: Node3D): return not a.moving), "Today Action click immediately cancels Ambient movement")
	check(ambient.reservations.is_empty(), "Today Action click immediately releases reservations")
	await click(button("商业街"))
	var actors: Array = camp.members.values()
	var warnings: Array[String] = []
	camp.departure.fallback_used.connect(func(reason: String): warnings.append(reason))
	await click_at(button("确认出发").get_global_rect().get_center())
	check(app.state == "departure", "Native confirm input starts departure")
	check(ambient.reservations.is_empty(), "Departure immediately releases reservations")
	check(actors.all(func(a: Node3D): return ambient.state_for(a.member_id) == "DEPARTURE_OVERRIDE"), "Ambient immediately yields ownership")
	var deadline := Time.get_ticks_msec() + 35000
	while app.state == "departure" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "mission", "Assembly, boarding and departure reach Mission")
	check(warnings.is_empty(), "Normal departure needs no timeout correction")
	await create_timer(1.0).timeout
