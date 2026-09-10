extends Node3D
signal damaged
const Visuals = preload("res://vfx/visuals.gd")
const Assets = preload("res://vfx/generated_assets.gd")
const AimFire = preload("res://survivors/aim_fire.gd")
var data: Resource
var talent: Resource
var weapon: Resource
var hp: float = 100.0
var path := PackedVector3Array()
var ammo: int = 0
var cooldown: float = 0.0
var reload_left: float = 0.0
var rig: Node3D
var gun: Node3D
var hp_bar: MeshInstance3D
var dead: bool = false
var boarding: bool = false
var pulse: float = 0.0
var searching := false
var regrouping := false
var duty_label: Label3D
var duty_ring: MeshInstance3D
var name_label: Label3D

func setup(spec: Resource, trait_data: Resource, equipment: Resource) -> void:
	data = spec
	talent = trait_data
	hp = data.max_hp

	# 尝试加载 GLB 模型,回退到程序化几何体
	if data.model_path != "" and ResourceLoader.exists(data.model_path):
		var model_scene: PackedScene = load(data.model_path)
		rig = model_scene.instantiate()
		add_child(rig)
		rig.scale = Vector3.ONE * 0.5  # GLB 模型通常较大,缩小到游戏尺度
	else:
		rig = Visuals.body(self, data.color)

	Visuals.ring(self, Vector3(0, 0.08, 0), 0.6, data.color)
	hp_bar = Visuals.box(self, Vector3(1.15, 0.09, 0.1), Vector3(0, 2.3, 0), data.color, true)
	name_label = Visuals.label(self, data.display_name, Vector3(0, 2.65, 0), data.color.lightened(0.25), 24)
	duty_label = Visuals.label(self, "", Vector3(0, 3.3, 0), Color("#ffcf8a"), 19)
	duty_ring = Visuals.ring(self, Vector3(0, 0.12, 0), 0.85, Color("#ffcf8a"))
	duty_ring.visible = false
	equip(equipment)

func equip(equipment: Resource) -> void:
	weapon = equipment
	ammo = weapon.magazine
	reload_left = 0.0
	cooldown = 0.0
	if gun:
		gun.free()
	var models := {"pistol":"BH_Pistol_01", "smg":"BH_SMG_01", "shotgun":"BH_Shotgun_01"}
	if models.has(weapon.id):
		gun = Assets.spawn(models[weapon.id], rig, Vector3(.32, 1.10, -.18))
	else:
		gun = Visuals.box(rig, Vector3(.08,.08,1.0), Vector3(.32,1.02,-.43), weapon.color)

func order_move(point: Vector3, city: Node3D) -> void:
	if not dead:
		path = city.path(position, point)

func stop() -> void:
	path.clear()

func tick(delta: float, mission: Node3D) -> void:
	var assigned: bool = mission.task_for(self) != null and not dead
	name_label.visible = not assigned
	duty_label.text = data.display_name + "\n" + mission.member_status(self) if assigned else ("归队中" if regrouping else "")
	duty_ring.visible = assigned
	if dead or boarding:
		return
	cooldown = maxf(0, cooldown - delta)
	if reload_left > 0:
		reload_left = maxf(0, reload_left - delta)
		if reload_left == 0:
			ammo = weapon.magazine
	var manual: bool = mission.manual_aim and not assigned
	if manual:
		stop()
	_move(delta)
	hp_bar.scale.x = maxf(0.01, hp / data.max_hp)
	if searching or cooldown > 0 or reload_left > 0:
		return
	var directed: bool = manual and not weapon.melee
	var target = null if directed else mission.choose_target(self)
	if (not directed and target == null) or (directed and position.distance_to(mission.aim_point) < 0.1):
		return
	if ammo <= 0 and not weapon.melee:
		reload_left = weapon.reload_seconds
		return
	cooldown = weapon.cooldown
	if not weapon.melee:
		ammo -= 1
	var direction: Vector3 = (mission.aim_point if directed else target.position) - position
	rig.rotation.y = atan2(-direction.x, -direction.z)
	if directed:
		AimFire.fire(self, mission, mission.aim_point)
	else:
		mission.attack(self, target)
	rig.scale = Vector3(1.03, 0.95, 1.03)
	if is_inside_tree():
		create_tween().tween_property(rig, "scale", Vector3.ONE, 0.13)

func _move(delta: float) -> void:
	if path.is_empty():
		rig.position.y = 0.0
		return
	var budget: float = data.move_speed * delta
	while not path.is_empty() and budget > 0:
		var distance := position.distance_to(path[0])
		if distance <= budget:
			position = path[0]
			path.remove_at(0)
			budget -= distance
		else:
			var direction := position.direction_to(path[0])
			position += direction * budget
			rig.rotation.y = atan2(-direction.x, -direction.z)
			budget = 0
	pulse += delta * 13
	rig.position.y = absf(sin(pulse)) * 0.075

func take_damage(amount: float, invincible: bool = false) -> void:
	if dead or invincible or boarding:
		return
	hp = maxf(0, hp - amount * talent.incoming_damage_multiplier)
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
