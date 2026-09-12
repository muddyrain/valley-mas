extends SceneTree

const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")

class MovementContext extends Node3D:
	var manual_aim := false
	var aim_point := Vector3(0, 0, -20)
	var attacks := 0

	func movement_speed(_member: Node3D, _point: Vector3, _delta: float) -> float:
		return 2.0

	func task_for(_member: Node3D) -> RefCounted:
		return null

	func guards() -> Array[Node3D]:
		return []

	func member_status(_member: Node3D) -> String:
		return ""

	func choose_target(_member: Node3D) -> Node3D:
		return self

	func attack(_member: Node3D, _target: Node3D) -> void:
		attacks += 1

var failures: Array[String] = []
var checks := 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)

func run() -> void:
	var catalog := Catalog.new()
	var context := MovementContext.new()
	root.add_child(context)
	for id: String in ["xia_zhiyao", "su_wanxing", "lin"]:
		var member := Survivor.new()
		root.add_child(member)
		var spec: Resource = load("res://data/survivors/" + id + ".tres")
		member.setup(spec, catalog.traits[0], catalog.weapons[3])
		var rest_position: Vector3 = member.rig.position
		var rest_scale: Vector3 = member.rig.scale
		member.path = PackedVector3Array([Vector3(0.8, 0, 0), Vector3(0.8, 0, -1.2)])
		var max_height_error := 0.0
		for frame in range(90):
			member._move(1.0 / 60, context)
			max_height_error = maxf(max_height_error, absf(member.rig.position.y - rest_position.y))
		check(max_height_error < 0.00001, id + ": movement keeps the mesh grounded")
		check(member.path.is_empty() and member.position.is_equal_approx(Vector3(0.8, 0, -1.2)), id + ": path corners and destination still work")
		var attacks_before: int = context.attacks
		member.tick(1.0 / 60, context)
		check(context.attacks == attacks_before + 1, id + ": attack callback exercised")
		check(member.rig.scale.is_equal_approx(rest_scale), id + ": attack keeps the authored scale")
		await create_timer(0.2).timeout
		check(member.rig.scale.is_equal_approx(rest_scale), id + ": no delayed scale reset")
		member.queue_free()
	context.queue_free()
	await process_frame
	var report := {"checks": checks, "failures": failures}
	var output := FileAccess.open("res://test-output/rig/visual-stability.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("SURVIVOR VISUAL STABILITY: ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
