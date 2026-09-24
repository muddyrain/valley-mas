extends SceneTree

const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const BaseContext = preload("res://tests/survivor_visual_stability.gd")
var checks: int = 0
var failures: Array[String] = []

class MotionContext extends BaseContext.MovementContext:
	var speed: float = 4.2

	func movement_speed(_member: Node3D, _point: Vector3, _delta: float) -> float:
		return speed

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func run() -> void:
	var catalog := Catalog.new()
	var context := MotionContext.new()
	root.add_child(context)
	context.manual_aim = false
	# Xia's Expedition locomotion is exercised through the formal Mission test.
	for id: String in ["su_wanxing"]:
		var member := Survivor.new()
		root.add_child(member)
		member.setup(load("res://data/survivors/" + id + ".tres"), catalog.traits[0], catalog.weapons[3])
		var controller: Node3D = member.animation_controller
		check(controller != null, id + ": game uses shared controller")
		check(is_equal_approx(controller.visual_scale, 1), id + ": original metre scale restored")
		member.searching = true
		var dt := 1.0 / 60
		for speed: float in [0.0, 1.3, 4.2, 1.3, 0.0]:
			context.speed = speed
			member.path = PackedVector3Array([member.position + Vector3(0, 0, -100)]) if speed > 0 else PackedVector3Array()
			# Measure steady travel after the acceleration/deceleration ramp.
			for frame in 60:
				member.tick(dt, context)
			var start: Vector3 = member.position
			for frame in 60:
				member.tick(dt, context)
				await process_frame
			var expected: StringName = &"Idle" if speed == 0 else (&"Walk" if speed < 2 else &"Run")
			check(controller.playback.get_current_node() == expected, id + ": actual movement selects " + expected)
			check(absf(member.position.distance_to(start) - speed) < .001, id + ": animation does not change movement speed")
			check(absf(member.rig.position.y) < .00001 and member.rig.scale.is_equal_approx(Vector3.ONE), id + ": no whole-model bob or scale bounce")
			if speed > 0:
				check((controller.target.global_basis * Vector3.BACK).normalized().dot(Vector3.FORWARD) > .99, id + ": imported model faces travel direction")
		var before_pause: float = controller.playback.get_current_play_position()
		controller.update_motion(4.2, 4.2, 0)
		check(is_equal_approx(before_pause, controller.playback.get_current_play_position()), id + ": paused gameplay does not advance animation")
		member.queue_free()
		await process_frame
	context.queue_free()
	await process_frame
	var report := {"checks": checks, "failures": failures}
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion")
	FileAccess.open("res://test-output/locomotion/survivor-validation.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("SURVIVOR LOCOMOTION: ", report)
	quit(0 if failures.is_empty() else 1)
