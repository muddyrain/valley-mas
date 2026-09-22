class_name CombatVFXResolver
extends Node
## Presentation-only bridge from combat events to short-lived, generic effects.

const MuzzleFlash = preload("res://vfx/muzzle_flash.gd")

var source: Node3D
var visual: WeaponVisualController
var mission: Node3D
var combat: WeaponCombatController
var enabled: bool = true

func setup(source_node: Node3D, visual_controller: WeaponVisualController, combat_controller: WeaponCombatController, mission_node: Node3D) -> void:
	source = source_node
	visual = visual_controller
	combat = combat_controller
	mission = mission_node
	if not combat.fired.is_connected(_on_fired):
		combat.fired.connect(_on_fired)
	if not combat.hit_resolved.is_connected(_on_hit_resolved):
		combat.hit_resolved.connect(_on_hit_resolved)

func _on_fired(pellets: Array) -> void:
	if not enabled:
		return
	if visual != null and source != null and source.weapon != null and not source.weapon.melee:
		visual.flash_muzzle()
	if mission == null or DisplayServer.get_name() == "headless":
		return
	var origin := _muzzle_origin()
	var color: Color = source.weapon.color if source != null and source.weapon != null else Color("#ffd27a")
	for pellet: Dictionary in pellets:
		var endpoint: Vector3 = pellet.get("endpoint", origin)
		CombatVFXResolver.tracer(mission, origin, endpoint + Vector3.UP, color, 0.16)

func _on_hit_resolved(event: RefCounted) -> void:
	if not enabled or event == null:
		return
	var target: Node = event.get("target") as Node
	if is_instance_valid(target) and target.has_method("apply_hit_feedback"):
		target.apply_hit_feedback(event)
	if mission == null or DisplayServer.get_name() == "headless":
		return
	var heavy := float(event.damage) >= 15.0 or int(event.knockback) >= 2
	CombatVFXResolver.hit_burst(mission, event.hit_position + Vector3.UP, heavy, event.direction)

func _muzzle_origin() -> Vector3:
	if visual != null:
		var muzzle := visual.get_vfx_muzzle_point()
		if muzzle != null:
			return muzzle.global_position
	return source.global_position + Vector3.UP

static func tracer(parent: Node3D, from: Vector3, to: Vector3, color: Color, lifetime: float = 0.16) -> void:
	var distance := from.distance_to(to)
	if distance < 0.05:
		return
	var beam_root := Node3D.new()
	parent.add_child(beam_root)
	beam_root.global_position = (from + to) * 0.5
	beam_root.look_at(to, Vector3.UP)
	var glow := MeshInstance3D.new()
	var glow_mesh := BoxMesh.new()
	glow_mesh.size = Vector3(0.14, 0.14, distance)
	glow.mesh = glow_mesh
	glow.material_override = _effect_material(color.lightened(0.16), true, 2.5)
	glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam_root.add_child(glow)
	var core := MeshInstance3D.new()
	var core_mesh := BoxMesh.new()
	core_mesh.size = Vector3(0.055, 0.055, distance)
	core.mesh = core_mesh
	core.material_override = _effect_material(Color.WHITE.lerp(color, 0.3), true, 2.0)
	core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam_root.add_child(core)
	var tween := parent.create_tween()
	tween.tween_property(glow, "scale", Vector3(0.18, 0.18, 1.0), lifetime)
	tween.parallel().tween_property(glow, "transparency", 1.0, lifetime)
	tween.parallel().tween_property(core, "scale", Vector3(0.45, 0.45, 1.0), lifetime * 0.82)
	tween.parallel().tween_property(core, "transparency", 1.0, lifetime * 0.82)
	tween.tween_callback(beam_root.queue_free)

static func hit_burst(parent: Node3D, position: Vector3, heavy: bool, direction: Vector3 = Vector3.FORWARD) -> void:
	var burst := Node3D.new()
	burst.name = "CombatHitBurst"
	parent.add_child(burst)
	burst.global_position = position
	var flat_direction := Vector3(direction.x, 0.0, direction.z)
	if flat_direction.length_squared() > 0.0001:
		burst.look_at(position + flat_direction.normalized(), Vector3.UP)
	var core := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.095 if not heavy else 0.14
	sphere.height = sphere.radius * 2.0
	core.mesh = sphere
	core.material_override = _effect_material(Color("#ffe0a0") if not heavy else Color("#ffedc4"), true, 1.45)
	core.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	burst.add_child(core)
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.10 if not heavy else 0.15
	torus.outer_radius = 0.15 if not heavy else 0.23
	torus.rings = 12
	torus.ring_segments = 5
	ring.mesh = torus
	ring.material_override = _effect_material(Color("#f4b35f") if not heavy else Color("#ffcf7a"), true)
	ring.rotation.x = PI * 0.5
	ring.scale = Vector3.ZERO
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	burst.add_child(ring)
	for index in 4:
		var spark := MeshInstance3D.new()
		var spark_mesh := BoxMesh.new()
		spark_mesh.size = Vector3(0.032, 0.032, 0.28 if not heavy else 0.4)
		spark.mesh = spark_mesh
		spark.material_override = _effect_material(Color("#ffe2a1") if not heavy else Color("#ffefc2"), true, 1.8)
		spark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		spark.rotation.y = TAU * float(index) / 4.0 + 0.2
		spark.scale = Vector3(0.25, 0.25, 0.25)
		burst.add_child(spark)
	var duration := 0.18 if not heavy else 0.24
	var tween := parent.create_tween()
	tween.set_parallel(true)
	tween.tween_property(core, "scale", Vector3.ONE * (1.7 if not heavy else 2.4), duration)
	tween.tween_property(core, "transparency", 1.0, duration)
	tween.tween_property(ring, "scale", Vector3.ONE * (2.2 if not heavy else 3.0), duration)
	tween.tween_property(ring, "transparency", 1.0, duration)
	for spark: Node3D in burst.get_children():
		if spark is MeshInstance3D and spark != core and spark != ring:
			tween.tween_property(spark, "scale", Vector3.ONE, duration * 0.72)
			tween.parallel().tween_property(spark, "transparency", 1.0, duration)
	tween.set_parallel(false)
	tween.tween_callback(burst.queue_free)

static func _effect_material(color: Color, additive: bool, energy: float = 2.2) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = energy
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if additive:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	return material
