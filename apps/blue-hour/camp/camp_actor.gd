extends CharacterBody3D

## A disposable camp representation. Campaign owns identity, health and equipment.
const Survivor = preload("res://survivors/survivor.gd")
var member_id := ""
var visual: Node3D
var agent: NavigationAgent3D
var boarded := false
var moving := false
var destination := Vector3.ZERO
var move_speed := 2.7
var pulse := 0.0
var _equipment: Dictionary = {}

func setup(game: RefCounted, id: String) -> void:
	member_id = id
	collision_layer = 2
	collision_mask = 1
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.27
	capsule.height = 1.6
	collision.shape = capsule
	# Frozen camp collision surface is 5 cm beneath its visible ground plane.
	collision.position.y = 0.75
	add_child(collision)
	agent = NavigationAgent3D.new()
	# Recast's existing camp bake places ground polygons 0.4 m above the visible ground.
	agent.path_height_offset = 0.4
	agent.path_desired_distance = 0.2
	agent.target_desired_distance = 0.16
	agent.radius = 0.3
	add_child(agent)
	visual = Survivor.new()
	add_child(visual)
	visual.setup(game.member_template(id).duplicate(), game.member_trait(id), game.weapon(game.data.equipment[id]))
	_disable_legacy_ground_planes()
	if visual.animation_controller != null:
		visual.animation_controller.use_camp_style()
	_equipment = game.item(game.data.equipment[id]).duplicate(true)
	visual.hp_bar.hide()
	visual.name_label.hide()
	visual.duty_label.hide()
	add_to_group("camp_party_actor")

func _disable_legacy_ground_planes() -> void:
	# Imported survivor wrappers occasionally contain a legacy Quad/Plane used as
	# a ground indicator. Camp has one shared selection component, so remove
	# every such plane uniformly while preserving the formal world_select_ring.
	for node: Node in visual.find_children("*", "MeshInstance3D", true, false):
		if node == visual.selection_ring:
			continue
		var mesh_instance := node as MeshInstance3D
		if mesh_instance.mesh is QuadMesh or mesh_instance.mesh is PlaneMesh:
			mesh_instance.visible = false

func refresh_equipment(game: RefCounted) -> void:
	visual.talent = game.member_trait(member_id)
	var equipped: Dictionary = game.item(game.data.equipment[member_id])
	if equipped != _equipment:
		_equipment = equipped.duplicate(true)
		visual.equip(game.weapon(game.data.equipment[member_id]))

func move_to(point: Vector3) -> void:
	destination = point
	agent.target_position = point
	moving = true

func cancel_navigation() -> void:
	moving = false
	velocity = Vector3.ZERO
	if agent != null:
		agent.target_position = global_position

func arrived() -> bool:
	return Vector2(global_position.x, global_position.z).distance_to(Vector2(destination.x, destination.z)) < 0.2

func _physics_process(delta: float) -> void:
	if boarded or agent == null:
		return
	var previous_position := global_position
	velocity.x = 0
	velocity.z = 0
	if moving and not arrived() and NavigationServer3D.map_get_iteration_id(agent.get_navigation_map()) > 0:
		var next := agent.get_next_path_position()
		var direction := Vector3(next.x - global_position.x, 0, next.z - global_position.z)
		if agent.is_navigation_finished():
			moving = false
		elif direction.length() > 0.02:
			direction = direction.normalized()
			velocity.x = direction.x * move_speed
			velocity.z = direction.z * move_speed
			face(global_position + direction)
			pulse += delta * 13
			if visual.animation_controller == null:
				visual.rig.position.y = absf(sin(pulse)) * 0.045
	else:
		moving = false
		visual.rig.position.y = 0
	velocity.y = -1 if is_on_floor() else velocity.y - 18 * delta
	move_and_slide()
	if visual.animation_controller != null:
		var offset := global_position - previous_position
		visual.animation_controller.update_motion(Vector2(offset.x, offset.z).length() / delta, visual.data.move_speed, delta)

func face(point: Vector3) -> void:
	var direction := point - global_position
	if direction.length_squared() > 0.001:
		visual.rig.global_rotation.y = atan2(-direction.x, -direction.z)

func board() -> void:
	boarded = true
	moving = false
	visual.hide()
	collision_layer = 0
	collision_mask = 0
	agent.avoidance_enabled = false
	set_physics_process(false)

func face_smooth(point: Vector3, delta: float) -> void:
	var direction := point - global_position
	if direction.length_squared() > 0.001 and is_instance_valid(visual.rig):
		visual.rig.global_rotation.y = rotate_toward(visual.rig.global_rotation.y,
				atan2(-direction.x, -direction.z), delta * 2.4)

func correct_to_safe_position(point: Vector3) -> bool:
	# Only the timeout path uses correction, and never inside a static wall or the bus.
	var query := PhysicsShapeQueryParameters3D.new()
	query.shape = get_child(0).shape
	query.collision_mask = 1
	for offset: Vector3 in [Vector3.ZERO, Vector3.RIGHT * 0.4, Vector3.BACK * 0.4, Vector3.LEFT * 0.4]:
		var candidate := point + offset
		candidate.y = 0.02
		query.transform = Transform3D(Basis.IDENTITY, candidate + Vector3.UP * 0.8)
		if get_world_3d().direct_space_state.intersect_shape(query).is_empty():
			global_position = candidate
			destination = candidate
			moving = false
			velocity = Vector3.ZERO
			return true
	return false
