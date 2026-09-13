extends Node3D
signal damaged
const Visuals = preload("res://vfx/visuals.gd")
const Combat = preload("res://weapons/weapon_combat_controller.gd")
const WeaponVisual = preload("res://weapons/weapon_visual_controller.gd")
var combat := Combat.new()
var weapon_visual: WeaponVisualController
const Modifiers = preload("res://core/effect_modifiers.gd")
const AnimationController = preload("res://survivors/survivor_animation_controller.gd")
const ACCELERATION: float = 10.0
const DECELERATION: float = 14.0
const TURN_SPEED: float = 10.4719755 # 600 degrees/second.
const MOTION_STEP: float = 1.0 / 120.0
var effects: RefCounted = Modifiers.new()
var data: Resource
var talent: Resource
var weapon: Resource
var hp: float = 100.0
var path := PackedVector3Array()
var current_speed: float = 0.0
var actual_velocity := Vector3.ZERO
var _braking: bool = false
var _presentation_frame: int = -1
var _previous_position := Vector3.ZERO
var _current_position := Vector3.ZERO
var _previous_yaw: float = 0.0
var _current_yaw: float = 0.0
var _motion_mission: Node3D
var ammo: int:
	get: return combat.current_ammo
	set(value): combat.current_ammo = value
var cooldown: float:
	get: return combat.cooldown
	set(value): combat.cooldown = value
var reload_left: float:
	get: return combat.reload_left
	set(value): combat.reload_left = value
var rig: Node3D
var hp_bar: MeshInstance3D
var dead: bool = false
var boarding: bool = false
var searching := false
var inside_building: bool = false
var _search_materials: Array[Dictionary] = []
var regrouping := false
var duty_label: Label3D
var duty_ring: MeshInstance3D
var name_label: Label3D
var animation_controller: Node3D
var selection_ring: MeshInstance3D

func setup(spec: Resource, trait_data: Resource, equipment: Resource) -> void:
	data = spec
	talent = trait_data
	hp = data.max_hp

	# 尝试加载 GLB 模型,回退到程序化几何体
	if data.model_path != "" and ResourceLoader.exists(data.model_path):
		var model_scene: PackedScene = load(data.model_path)
		rig = Node3D.new()
		rig.name = "VisualRoot"
		add_child(rig)
		var model := model_scene.instantiate() as Node3D
		rig.add_child(model)
		# Imported humans face +Z; existing movement and weapon mounts face -Z.
		# Keep navigation/weapon facing unchanged and correct only the mesh frame.
		model.rotation.y = PI
		animation_controller = AnimationController.new()
		model.add_child(animation_controller)
		if not animation_controller.initialize(model):
			animation_controller.queue_free()
			animation_controller = null
	else:
		rig = Visuals.body(self, data.color)

	selection_ring = preload("res://ui/expedition/world_marker.gd").create(self, "world_select_ring", 1.25, Vector3(0, .065, 0), true)
	hp_bar = Visuals.box(self, Vector3(1.15, 0.09, 0.1), Vector3(0, 2.3, 0), data.color, true)
	name_label = Visuals.label(self, data.display_name, Vector3(0, 2.65, 0), data.color.lightened(0.25), 18)
	duty_label = Visuals.label(self, "", Vector3(0, 3.3, 0), Color("#ffcf8a"), 19)
	duty_ring = Visuals.ring(self, Vector3(0, 0.12, 0), 0.85, Color("#ffcf8a"))
	duty_ring.visible = false
	equip(equipment)

func equip(equipment: Resource) -> void:
	weapon = equipment
	combat.equip(equipment)
	if weapon_visual == null:
		weapon_visual = WeaponVisual.new()
		add_child(weapon_visual)
		weapon_visual.initialize(animation_controller.target if animation_controller != null else null)
		if animation_controller != null:
			animation_controller.bind_weapon(weapon_visual, combat)
	weapon_visual.set_weapon(equipment)

func order_move(point: Vector3, city: Node3D) -> void:
	if dead or boarding:
		return
	# Held commands repeat every .08 s. Do not restart a route to the same cell.
	if not _braking and not path.is_empty() and path[-1].is_equal_approx(point):
		return
	_braking = false
	path = city.path(position, point)
	# AStar includes the rounded start cell, which may now be behind the actor.
	# Keep it when the next segment is obstructed; never shortcut a building.
	if path.size() > 1 and position.distance_to(path[0]) < .75 and city.line_clear(position, path[1]):
		path.remove_at(0)

func stop() -> void:
	# Search, manual aim, death and boarding require an immediate gameplay stop.
	path.clear()
	current_speed = 0.0
	actual_velocity = Vector3.ZERO
	_braking = false

func request_stop() -> void:
	# A player stop brakes along the existing safe route, never off its corridor.
	_braking = true
	if current_speed <= 0 or path.is_empty():
		stop()

func enable_motion_presentation(mission: Node3D) -> void:
	_motion_mission = mission
	if animation_controller != null:
		animation_controller.use_render_clock(self, mission)

func tick(delta: float, mission: Node3D) -> void:
	var assigned: bool = mission.task_for(self) != null and not dead
	name_label.visible = not assigned
	duty_label.text = ""
	duty_ring.visible = assigned and not inside_building
	if dead or boarding or inside_building:
		return
	combat.tick(delta)
	var manual: bool = mission.manual_aim and not assigned
	if manual:
		stop()
	# Select once per gameplay tick, including cooldown/reload, so visual aim persists.
	var directed: bool = manual and weapon != null and not weapon.melee
	var target: Node3D = mission.choose_target(self) if weapon != null and not searching and not directed else null
	var has_aim := not searching and (target != null or (directed and position.distance_to(mission.aim_point) >= .1))
	var target_point: Vector3 = mission.aim_point if directed else (target.position if target != null else position)
	if animation_controller != null:
		animation_controller.combat_bridge.set_gameplay_state(weapon != null and not searching, has_aim, target_point, position)
	var movement_start := position
	_move(delta, mission)
	if animation_controller != null:
		var offset := position - movement_start
		var actual_speed := Vector2(offset.x, offset.z).length() / maxf(delta, .000001)
		animation_controller.update_motion(actual_speed, data.move_speed, delta)
	hp_bar.scale.x = maxf(0.01, hp / data.max_hp)
	if weapon == null or searching or cooldown > 0 or reload_left > 0:
		return
	if (not directed and target == null) or (directed and position.distance_to(mission.aim_point) < 0.1):
		return
	if directed:
		combat.try_attack(self, mission, mission.aim_point)
	else:
		mission.attack(self, target)

func _move(delta: float, mission: Node3D) -> void:
	if delta <= 0:
		return
	var start := position
	var native_tick := _motion_mission != null and _motion_mission.is_physics_processing() and Engine.is_in_physics_frame()
	if native_tick and _presentation_frame != Engine.get_physics_frames():
		# Teleports/setup do not interpolate from an unrelated old location.
		if _presentation_frame < 0 or not position.is_equal_approx(_current_position):
			_current_yaw = rig.rotation.y
		_previous_position = position
		_previous_yaw = _current_yaw
		_presentation_frame = Engine.get_physics_frames()
	elif not native_tick:
		_current_yaw = rig.rotation.y
	var left := delta
	while left > .000001 and not path.is_empty():
		var dt := minf(left, MOTION_STEP)
		var remaining := remaining_distance()
		var maximum := maxf(0, mission.movement_speed(self, path[0], dt))
		var desired := 0.0 if _braking else minf(maximum, sqrt(2.0 * DECELERATION * remaining))
		var old_speed := current_speed
		current_speed = move_toward(current_speed, desired, (ACCELERATION if desired > current_speed else DECELERATION) * dt)
		# Trapezoidal integration makes start/stop distance independent of tick rate.
		var budget := minf(remaining, (old_speed + current_speed) * .5 * dt)
		while not path.is_empty():
			var offset := path[0] - position
			offset.y = 0
			var distance := offset.length()
			if distance <= budget + .000001:
				position.x = path[0].x
				position.z = path[0].z
				budget = maxf(0, budget - distance)
				path.remove_at(0)
			else:
				position += offset / distance * budget
				break
		left -= dt
		if _braking and current_speed <= 0:
			stop()
	if path.is_empty():
		current_speed = 0
	actual_velocity = (position - start) / delta
	if actual_velocity.length_squared() > .000001:
		var desired_yaw := atan2(-actual_velocity.x, -actual_velocity.z)
		_current_yaw += clampf(angle_difference(_current_yaw, desired_yaw), -TURN_SPEED * delta, TURN_SPEED * delta)
		_current_yaw = wrapf(_current_yaw, -PI, PI)
	elif animation_controller != null and animation_controller.combat_bridge.aiming and animation_controller.combat_bridge.uses_long_gun():
		var facing: Vector3 = animation_controller.combat_bridge.aim_direction
		var desired_yaw := atan2(-facing.x, -facing.z)
		_current_yaw = rotate_toward(_current_yaw, desired_yaw, TURN_SPEED * delta)
	_current_position = position
	if not native_tick:
		rig.rotation.y = _current_yaw

func remaining_distance() -> float:
	var total := 0.0
	var previous := position
	for point in path:
		total += Vector2(point.x - previous.x, point.z - previous.z).length()
		previous = point
	return total

func _process(_delta: float) -> void:
	if _presentation_frame < 0 or rig == null or dead or boarding:
		return
	# Only the imported visual is interpolated. Gameplay and camera use the actor.
	var fraction := Engine.get_physics_interpolation_fraction() if _presentation_frame == Engine.get_physics_frames() else 1.0
	var offset := _previous_position.lerp(_current_position, fraction) - position
	rig.position.x = offset.x
	rig.position.z = offset.z
	rig.rotation.y = lerp_angle(_previous_yaw, _current_yaw, fraction)

func take_damage(amount: float, invincible: bool = false) -> void:
	if dead or invincible or boarding or inside_building:
		return
	hp = maxf(0, hp - effects.incoming_damage(amount * talent.incoming_damage_multiplier))
	damaged.emit()
	if hp <= 0:
		dead = true
		searching = false
		regrouping = false
		duty_label.text = ""
		duty_ring.visible = false
		path.clear()
		rig.rotation.z = PI * 0.5
		rig.position.y = -0.5
		hp_bar.visible = false


func set_search_opacity(alpha: float) -> void:
	# Temporary instance materials support Compatibility without changing shared assets.
	if alpha < 1 and _search_materials.is_empty():
		for mesh: MeshInstance3D in find_children("*", "MeshInstance3D", true, false):
			for index: int in range(mesh.mesh.get_surface_count()):
				var original: Material = mesh.get_surface_override_material(index)
				var source := mesh.get_active_material(index) as BaseMaterial3D
				if source == null or mesh.material_override != null:
					continue
				var faded: BaseMaterial3D = source.duplicate()
				faded.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				mesh.set_surface_override_material(index, faded)
				_search_materials.append({"mesh": mesh, "surface": index, "original": original, "faded": faded, "alpha": source.albedo_color.a})
	for record: Dictionary in _search_materials:
		if alpha >= 1:
			record.mesh.set_surface_override_material(record.surface, record.original)
		else:
			record.faded.albedo_color.a = alpha * record.alpha
	if alpha >= 1:
		_search_materials.clear()
	name_label.visible = alpha >= 1 and not inside_building
	duty_ring.visible = alpha >= 1 and not inside_building
	hp_bar.visible = alpha >= 1 and not inside_building and not dead
