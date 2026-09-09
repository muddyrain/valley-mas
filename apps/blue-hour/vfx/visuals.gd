extends RefCounted
const Assets = preload("res://vfx/generated_assets.gd")
# Placeholder geometry is presentation only; gameplay owns positions and radii.
static var materials: Dictionary = {}

static func loot_crate(parent: Node3D) -> Node3D:
	var view := Assets.spawn("BH_Searchable_Crate", parent)
	view.scale = Vector3.ONE * .65
	return view

static func material(color: Color, emissive: bool = false) -> StandardMaterial3D:
	var key := str(color) + str(emissive)
	if materials.has(key):
		return materials[key]
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = 0.92
	if emissive:
		result.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	materials[key] = result
	return result

static func box(parent: Node3D, size: Vector3, pos: Vector3, color: Color, emissive: bool = false) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var view := MeshInstance3D.new()
	view.mesh = mesh
	view.material_override = material(color, emissive)
	parent.add_child(view)
	view.position = pos
	return view

static func cylinder(parent: Node3D, radius: float, height: float, pos: Vector3, color: Color) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	var view := MeshInstance3D.new()
	view.mesh = mesh
	view.material_override = material(color)
	parent.add_child(view)
	view.position = pos
	return view

static func label(parent: Node3D, text: String, pos: Vector3, color: Color = Color.WHITE, font_size: int = 40) -> Label3D:
	var view := Label3D.new()
	view.text = text
	view.position = pos
	view.font_size = font_size
	view.pixel_size = 0.034
	view.modulate = color
	view.outline_size = 3
	view.no_depth_test = true
	view.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	parent.add_child(view)
	return view

static func ring(parent: Node3D, pos: Vector3, radius: float, color: Color) -> MeshInstance3D:
	var mesh := TorusMesh.new()
	mesh.inner_radius = radius - 0.045
	mesh.outer_radius = radius + 0.045
	mesh.rings = 24
	mesh.ring_segments = 6
	var view := MeshInstance3D.new()
	view.mesh = mesh
	view.material_override = material(color, true)
	parent.add_child(view)
	view.position = pos
	return view

static func body(parent: Node3D, color: Color, enemy: bool = false) -> Node3D:
	var rig := Node3D.new()
	parent.add_child(rig)
	cylinder(rig, 0.35, 0.8, Vector3(0, 0.95, 0), color)
	box(rig, Vector3(0.45, 0.48, 0.43), Vector3(0, 1.59, 0), Color(0.82, 0.76, 0.68) if not enemy else color.lightened(0.13))
	box(rig, Vector3(0.49, 0.16, 0.49), Vector3(0, 1.87, 0), color.darkened(0.5))
	for x in [-0.18, 0.18]:
		box(rig, Vector3(0.23, 0.5, 0.25), Vector3(x, 0.3, 0), Color(0.13, 0.19, 0.24))
	box(rig, Vector3(0.55, 0.07, 0.08), Vector3(0, 1.62, -0.24), Color(1, 0.25, 0.25) if enemy else Color(0.12, 0.22, 0.28), true)
	return rig

static func hit_area(parent: Node3D, meta_key: String, value: Variant, radius: float = 0.8) -> void:
	var area := Area3D.new()
	area.collision_layer = 2
	area.collision_mask = 0
	area.set_meta(meta_key, value)
	var collision := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = radius
	shape.height = 2.7
	collision.shape = shape
	collision.position.y = 1.2
	area.add_child(collision)
	parent.add_child(area)

static func tracer(parent: Node3D, from: Vector3, to: Vector3, color: Color, melee: bool = false) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var distance := from.distance_to(to)
	if distance < 0.05:
		return
	var beam := box(parent, Vector3(0.06 if not melee else 0.15, 0.06, distance), (from + to) * 0.5, color, true)
	beam.look_at(to, Vector3.UP)
	parent.get_tree().create_timer(0.075 if not melee else 0.13).timeout.connect(beam.queue_free)
