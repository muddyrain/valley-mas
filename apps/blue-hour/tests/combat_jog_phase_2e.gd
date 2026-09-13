extends SceneTree
## Identical motion input on two real rigs isolates upper-body changes from the locked gait.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const Registry = preload("res://data/weapon_registry.gd")
const LOWER: Array[String] = ["Root", "Hips", "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "LeftToes", "RightUpperLeg", "RightLowerLeg", "RightFoot", "RightToes"]
var failures: Array[String] = []
var checks: int = 0
var poses: Dictionary = {}
var metrics: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var catalog := Catalog.new()
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var stage := Node3D.new()
		root.add_child(stage)
		stage.set_physics_process(false)
		var actor := Survivor.new()
		var reference := Survivor.new()
		stage.add_child(actor)
		stage.add_child(reference)
		var spec: Resource = load("res://data/survivors/" + id + ".tres")
		var gun: Resource = catalog.by_id(catalog.weapons, Registry.A21)
		actor.setup(spec, catalog.traits[0], gun)
		reference.setup(spec, catalog.traits[0], null)
		var controller: Node3D = actor.animation_controller
		var baseline: Node3D = reference.animation_controller
		controller.use_render_clock(actor, stage)
		baseline.use_render_clock(reference, stage)
		var skeleton: Skeleton3D = controller.target
		skeleton.skeleton_updated.connect(func() -> void:
			for name: String in ["LeftHand", "RightHand", "Spine", "Chest", "LeftShoulder", "RightShoulder", "RightLowerArm", "Head"]:
				poses[name] = skeleton.get_bone_global_pose(skeleton.find_bone(name)))
		var bridge: Node = controller.combat_bridge
		var max_grip := 0.0
		var max_phase_error := 0.0
		var min_aim_dot := 1.0
		var start_count := 0
		var weights: Dictionary = {}
		for segment: String in ["ready", "aim", "shoot", "ready-again", "search", "unequip", "equip", "turn", "stop"]:
			var samples: Array[Dictionary] = []
			var segment_grip := 0.0
			for frame in 72:
				var speed := 4.2 if segment != "stop" else maxf(0, 4.2 - frame * .3)
				var yaw := minf(frame / 35.0, 1.0) * PI * .5 if segment == "turn" else 0.0
				for member: Node3D in [actor, reference]:
					member.path = PackedVector3Array([Vector3(0, 0, -100)]) if segment != "stop" else PackedVector3Array()
					member.actual_velocity = Basis(Vector3.UP, yaw) * Vector3.FORWARD * speed
					member.rig.rotation.y = yaw
				if frame == 0 and segment == "unequip":
					actor.equip(null)
				if frame == 0 and segment == "equip":
					actor.equip(gun)
				bridge.set_gameplay_state(segment != "search", segment in ["aim", "shoot"], Vector3(0, 0, -10), actor.position)
				if segment == "shoot" and frame in [2, 18, 34, 50]:
					actor.combat.fired.emit([])
				controller.update_motion(speed, 4.2, 1.0 / 60)
				baseline.update_motion(speed, 4.2, 1.0 / 60)
				await process_frame
				if frame < 20:
					continue
				for name in LOWER:
					var bone: int = controller.source.find_bone(name)
					check(controller.source.get_bone_pose(bone).is_equal_approx(baseline.source.get_bone_pose(bone)), id + ": " + segment + " preserves " + name)
				max_phase_error = maxf(max_phase_error, absf(controller.locomotion_layer.locomotion_phase - baseline.locomotion_layer.locomotion_phase))
				if actor.weapon != null and segment != "search":
					var palm: Vector3 = skeleton.global_transform * ((poses.LeftHand as Transform3D) * Vector3(0, .045, 0))
					max_grip = maxf(max_grip, palm.distance_to(actor.weapon_visual.get_support_grip().global_position))
					segment_grip = maxf(segment_grip, palm.distance_to(actor.weapon_visual.get_support_grip().global_position))
					check(actor.weapon_visual.get_muzzle_point().global_transform.is_finite(), "Finite MuzzlePoint")
					if segment == "aim":
						min_aim_dot = minf(min_aim_dot, (-actor.weapon_visual.get_muzzle_point().global_basis.z.normalized()).dot(bridge.aim_direction))
				samples.append(poses.duplicate())
			var chest_arc := 0.0
			var elbow_arc := 0.0
			for a in samples.size():
				for b in samples.size():
					chest_arc = maxf(chest_arc, samples[a].Chest.basis.get_rotation_quaternion().angle_to(samples[b].Chest.basis.get_rotation_quaternion()))
					elbow_arc = maxf(elbow_arc, samples[a].RightLowerArm.basis.get_rotation_quaternion().angle_to(samples[b].RightLowerArm.basis.get_rotation_quaternion()))
			weights[segment] = {"chest_arc_degrees": rad_to_deg(chest_arc), "elbow_arc_degrees": rad_to_deg(elbow_arc), "grip_error_m": segment_grip}
			if segment == "ready":
				start_count = controller.locomotion_layer.start_count
				check(chest_arc > deg_to_rad(1), "Ready torso visibly absorbs the running cycle")
				check(elbow_arc > deg_to_rad(.5), "Ready elbow absorbs steps")
			if segment in ["aim", "shoot", "unequip", "equip"]:
				check(controller.locomotion_layer.start_count == start_count, "Combat changes never restart Jog")
		check(max_phase_error < .00001, id + ": exact unarmed/combat Jog phase")
		check(max_grip < .008, id + ": support grip remains below 8mm")
		check(min_aim_dot > .99, id + ": aimed muzzle stays aligned")
		check(float(weights.aim.chest_arc_degrees) < float(weights.ready.chest_arc_degrees) * .65, "Aim reduces chest feedback")
		metrics.append({"character": id, "max_grip_error_m": max_grip, "max_phase_error": max_phase_error, "min_aim_dot": min_aim_dot, "motion": weights})
		stage.free()
		await process_frame
	DirAccess.make_dir_recursive_absolute("res://test-output/phase-2e")
	FileAccess.open("res://test-output/phase-2e/combat-contract.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "metrics": metrics}, "\t"))
	print("PHASE 2E COMBAT: ", checks, " checks; failures=", failures, "; metrics=", metrics)
	quit(0 if failures.is_empty() else 1)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value and not failures.has(message):
		failures.append(message)
		push_error(message)
