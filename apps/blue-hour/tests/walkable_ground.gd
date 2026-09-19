extends SceneTree
const Ground = preload("res://maps/expedition/walkable_ground.gd")
const Navigation = preload("res://maps/expedition/town_navigation.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func plane(parent: Node3D, size: Vector2, position: Vector3, registered: bool = true) -> MeshInstance3D:
	var view := MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = size
	view.mesh = mesh
	view.position = position
	view.set_meta(Ground.SURFACE_META, registered)
	parent.add_child(view)
	return view

func run() -> void:
	var world := Node3D.new()
	root.add_child(world)
	plane(world, Vector2(30, 30), Vector3(0, -.37, 0))
	var raised := plane(world, Vector2(4, 4), Vector3(3, .19, 0))
	plane(world, Vector2(30, 30), Vector3(0, 8, 0), false)
	var ramp := plane(world, Vector2(4, 4), Vector3(-4, .65, 0))
	ramp.rotation.z = .15
	var ground := Ground.new()
	ground.build(world)
	check(absf(ground.get_walkable_ground_height(Vector2.ZERO) + .37) < .00001, "Authored base height, unregistered roof ignored")
	check(absf(ground.get_walkable_ground_height(Vector2(3, 0)) - .19) < .00001, "Highest overlapping walkable surface")
	check(absf(ground.get_walkable_ground_height(Vector2(-3.5, 0)) - (.65 + tan(.15) * .5)) < .00001, "Sloped triangle interpolation")
	check(is_nan(ground.get_walkable_ground_height(Vector2(40, 40))), "No fabricated height outside terrain")
	raised.position.y = .43
	ground.build(world)
	check(absf(ground.get_walkable_ground_height(Vector2(3, 0)) - .43) < .00001, "Changed render mesh height propagates without navigation constants")
	var nav := Navigation.new()
	nav.build(world, Rect2(-14, -14, 28, 28))
	var route: PackedVector3Array = nav.path(Vector3(0, 99, 0), Vector3(3, -99, 0))
	check(route.size() >= 2, "Existing XZ navigation reaches raised surface")
	for point: Vector3 in route:
		check(absf(point.y - ground.get_walkable_ground_height(Vector2(point.x, point.z))) < .00001, "Path point carries render height")
	check(absf(nav.nearest(Vector3(3, 99, 0)).y - .43) < .00001, "Nearest projects regardless of incoming Y")
	world.position = Vector3(-21, 2.31, 16)
	ground.build(world)
	check(absf(ground.get_walkable_ground_height(Vector2(-18, 16)) - 2.74) < .00001, "World-space transform and negative spatial buckets")
	world.queue_free()
	await process_frame
	print("WALKABLE GROUND: ", checks, " checks; ", failures)
	quit(0 if failures.is_empty() else 1)
