extends SceneTree
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const BaseContext = preload("res://tests/survivor_visual_stability.gd")
var checks: int = 0
var failures: Array[String] = []
var metrics: Array = []

class MotionContext extends BaseContext.MovementContext:
	var speed: float = 4.2
	func movement_speed(_member: Node3D, _point: Vector3, _delta: float) -> float:
		return speed

class GridContext extends Node3D:
	var obstructed: bool = false
	func path(from: Vector3, to: Vector3) -> PackedVector3Array:
		return PackedVector3Array([Vector3(roundf(from.x), 0, roundf(from.z)), to])
	func line_clear(_from: Vector3, _to: Vector3) -> bool:
		return not obstructed

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)

func advance(member: Node3D, context: Node3D, seconds: float, dt: float = 1.0 / 60) -> void:
	for frame in roundi(seconds / dt):
		member.tick(dt, context)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output/locomotion-polish")
	var catalog := Catalog.new()
	var context := MotionContext.new()
	var city := GridContext.new()
	root.add_child(context)
	root.add_child(city)
	context.manual_aim = false
	var rates: Array[float] = []
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var member := Survivor.new()
		root.add_child(member)
		member.setup(load("res://data/survivors/" + id + ".tres"), catalog.traits[0], catalog.weapons[0])
		member.searching = true
		member.path = PackedVector3Array([Vector3(0, 0, -100)])
		context.speed = 4.2
		advance(member, context, .2)
		check(absf(member.current_speed - 2) < .001, id + ": progressive acceleration")
		check(absf(member.position.z + .2) < .001, id + ": integrated acceleration distance")
		advance(member, context, .8)
		check(absf(member.current_speed - 4.2) < .001, id + ": original top speed")
		check(absf(member.position.z + 3.318) < .002, id + ": one-second distance includes only start ramp")
		var stop_start := member.position
		member.request_stop()
		advance(member, context, .5)
		check(member.path.is_empty() and member.current_speed == 0, id + ": stop finishes promptly")
		check(absf(member.position.distance_to(stop_start) - .63) < .002, id + ": player brakes along safe path")
		for distance: float in [.01, .1, .5, 1.0, 5.0]:
			member.stop()
			member.position = Vector3.ZERO
			member.path = PackedVector3Array([Vector3(0, 9, -distance)])
			var seconds := 0.0
			while not member.path.is_empty() and seconds < 3:
				member.tick(1.0 / 60, context)
				seconds += 1.0 / 60
			check(member.path.is_empty() and absf(member.position.z + distance) < .0001, id + ": arrival without crawl " + str(distance))
			check(member.position.y == 0 and member.rig.position.y == 0, id + ": movement is XZ only")
			metrics.append({"id": id, "arrival_distance": distance, "seconds": seconds})
		member.position = Vector3(0, 0, -.3)
		member.order_move(Vector3(0, 0, -20), city)
		check(member.path[0].z == -20, id + ": no stale rounded origin")
		var before := member.position
		for frame in 180:
			if frame % 5 == 0:
				member.order_move(Vector3(0, 0, -20), city)
			member.tick(1.0 / 60, context)
		check(before.z - member.position.z > 11, id + ": held destination keeps moving forward")
		member.stop()
		member.position = Vector3(.3, 0, .3)
		city.obstructed = true
		member.order_move(Vector3(10, 0, 10), city)
		check(member.path.size() == 2 and member.path[0] == Vector3.ZERO, id + ": obstructed origin segment retained")
		city.obstructed = false
		member.stop()
		member.position = Vector3.ZERO
		member.rig.rotation.y = PI - .02
		var yaw := member.rig.rotation.y
		member.path = PackedVector3Array([Vector3(.01, 0, 10)])
		member.tick(1.0 / 60, context)
		check(absf(angle_difference(yaw, member.rig.rotation.y)) < .04, id + ": PI boundary takes shortest angle")
		member.path = PackedVector3Array([Vector3(10, 0, 0)])
		for frame in 20:
			yaw = member.rig.rotation.y
			member.tick(1.0 / 60, context)
			check(absf(angle_difference(yaw, member.rig.rotation.y)) <= deg_to_rad(10.01), id + ": turn bounded at 600 degrees/s")
		check(member.position.x > .1, id + ": movement does not wait for turning")
		var controller: Node3D = member.animation_controller
		controller.preview(&"Idle")
		for speed: float in [.03, .06, .07, .04]:
			controller.update_motion(speed, 4.2, .1)
			check(controller.current_state == &"Idle", id + ": idle entrance hysteresis")
		controller.update_motion(.1, 4.2, .1)
		for speed: float in [.07, .04, .06]:
			controller.update_motion(speed, 4.2, .1)
			check(controller.current_state == &"Idle", id + ": below Expedition move threshold")
		controller.update_motion(2, 4.2, .1)
		for speed: float in [1.85, 1.7, 1.8]:
			controller.update_motion(speed, 4.2, .1)
			check(controller.current_state == &"Run", id + ": run exit hysteresis")
		controller.update_motion(1.6, 4.2, .1)
		controller.update_motion(1.8, 4.2, .1)
		check(controller.current_state == &"Run", id + ": Expedition uses Run above move threshold")
		for frame in 120:
			controller.update_motion(1.3, member.data.move_speed, 1.0 / 60)
		rates.append(controller.playback_rate)
		check(is_equal_approx(controller.playback_rate, 0.55), id + ": cadence follows actual speed")
		var play_position: float = controller.playback.get_current_play_position()
		controller.update_motion(4.2, 4.2, 0)
		check(is_equal_approx(play_position, controller.playback.get_current_play_position()), id + ": pause does not advance animation")
		member.free()
	check(absf(rates[0] - rates[1]) < .0001, "Both models share cadence at equal speed")
	context.free()
	city.free()
	FileAccess.open("res://test-output/locomotion-polish/checks.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "metrics": metrics}, "\t"))
	print("LOCOMOTION POLISH: ", checks, " checks; failures=", failures)
	quit(0 if failures.is_empty() else 1)
