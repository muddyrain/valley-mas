extends SceneTree
## Public layer contract; the Mission integration is exercised separately.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const Registry = preload("res://data/weapon_registry.gd")
const LIBRARY_PATH := "res://assets/animations/humanoid/combat/bh_humanoid_long_gun.tres"
var checks: int = 0
var failures: Array[String] = []
var poses: Dictionary = {}
var metrics: Array[Dictionary] = []
var capture_enabled: bool = false
var camera: Camera3D
var stage: Node3D
var artifact_path := "res://test-output/combat-animation"

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	capture_enabled = "capture" in OS.get_cmdline_user_args()
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--artifact-path="):
			artifact_path = argument.trim_prefix("--artifact-path=")
	DirAccess.make_dir_recursive_absolute(artifact_path)
	check(ResourceLoader.exists(LIBRARY_PATH), "Shared long_gun library exists")
	if not ResourceLoader.exists(LIBRARY_PATH):
		quit(1)
		return
	var library := load(LIBRARY_PATH) as AnimationLibrary
	check(library.get_animation_list().size() == 3, "Only the three requested public combat clips")
	for clip: StringName in [&"long_gun_ready", &"long_gun_aim", &"long_gun_shoot"]:
		check(library.has_animation(clip), "Public " + clip)
		var animation := library.get_animation(clip)
		for track in animation.get_track_count():
			check(animation.track_get_type(track) == Animation.TYPE_ROTATION_3D, "Combat cannot change root, scale, or invoke gameplay")
			var bone := String(animation.track_get_path(track).get_subname(0))
			check(bone not in ["Root", "Hips"] and not "Leg" in bone and not "Foot" in bone and not "Toes" in bone, "Upper body track: " + bone)
	var catalog := Catalog.new()
	stage = Node3D.new()
	stage.set_physics_process(false)
	root.add_child(stage)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#29333d")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = .75
	stage.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40, -30, 0)
	stage.add_child(light)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.15
	stage.add_child(camera)
	camera.position = Vector3(2.7, 2.5, -4)
	camera.look_at(Vector3(0, .84, 0))
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var actor := Survivor.new()
		stage.add_child(actor)
		actor.setup(load("res://data/survivors/" + id + ".tres"), catalog.traits[0], catalog.by_id(catalog.weapons, Registry.A21))
		actor.hp_bar.hide()
		actor.name_label.hide()
		var controller: Node = actor.animation_controller
		check(controller.get("combat_bridge") != null, id + ": gameplay animation bridge")
		var bridge: Node = controller.combat_bridge
		var skeleton: Skeleton3D = controller.target
		skeleton.skeleton_updated.connect(func() -> void: snapshot(skeleton))
		var reference := Survivor.new()
		stage.add_child(reference)
		reference.setup(actor.data, catalog.traits[0], null)
		reference.hide()
		var baseline: Node = reference.animation_controller
		var graph: AnimationNodeBlendTree = controller.tree.tree_root
		var layer := graph.get_node("CombatLayer") as AnimationNodeBlend2
		for bone in controller.source.get_bone_count():
			var name: String = controller.source.get_bone_name(bone)
			var lower := name in ["Root", "Hips"] or "Leg" in name or "Foot" in name or "Toes" in name
			check(layer.is_path_filtered(NodePath("Skeleton3D:" + name)) != lower, "Mask follows actual hierarchy: " + name)
		check(controller.player.get_animation_library(&"Combat") == library, id + ": shared library identity")
		var max_grip_error := 0.0
		var min_muzzle_dot := 1.0
		for aiming: bool in [false, true]:
			for speed: float in [0.0, 1.3, 4.2]:
				bridge.set_gameplay_state(true, aiming, Vector3(0, 0, -10), actor.position)
				for frame in 36:
					controller.update_motion(speed, 4.2, 1.0 / 60)
					baseline.update_motion(speed, 4.2, 1.0 / 60)
					await process_frame
					if frame < 16:
						continue
					var hand: Transform3D = poses.LeftHand
					var marker := actor.weapon_visual.get_support_grip()
					var palm := hand * Vector3(0, .045, 0)
					max_grip_error = maxf(max_grip_error, palm.distance_to(marker.global_position))
					var muzzle := actor.weapon_visual.get_muzzle_point()
					var forward := -muzzle.global_basis.z.normalized()
					if aiming:
						min_muzzle_dot = minf(min_muzzle_dot, forward.dot(Vector3.FORWARD))
					check((poses.RightHand as Transform3D).origin.distance_to(actor.weapon_visual.socket.global_position) < .001, "Socket uses final right hand")
					check(muzzle.global_transform.is_finite() and hand.is_finite(), "Finite marker and constraint")
					for bone_name: String in ["Root", "Hips", "LeftUpperLeg", "LeftLowerLeg", "RightUpperLeg", "RightLowerLeg", "LeftFoot", "RightFoot"]:
						var bone: int = controller.source.find_bone(bone_name)
						check(controller.source.get_bone_pose(bone).is_equal_approx(baseline.source.get_bone_pose(bone)), "Combat preserves locomotion: " + bone_name)
				check(controller.playback_rate == baseline.playback_rate, "Same gait cadence")
				check(bridge.visual_state == (bridge.VisualState.AIM if aiming else bridge.VisualState.READY), "Settled combat state")
				await capture(id + ("-aim-" if aiming else "-ready-") + String.num(speed, 1))
				if speed == 0:
					camera.position = Vector3(4, 1.45, -.3)
					camera.look_at(Vector3(0, .9, 0))
					await capture(id + ("-aim-side" if aiming else "-ready-side"))
					camera.position = Vector3(-2.5, 2.5, 4)
					camera.look_at(Vector3(0, .84, 0))
					await capture(id + ("-aim-back" if aiming else "-ready-back"))
					camera.position = Vector3(2.7, 2.5, -4)
					camera.look_at(Vector3(0, .84, 0))
		# Compare identical Mission jogging clocks through fire: the upper layer must
		# never disturb the pelvis/leg keys, even at the recoil peak.
		# Phase 2E shares V2.2/C with the unarmed reference through fire and transitions.
		baseline.combat_bridge.set_gameplay_state(false, false, Vector3.ZERO, reference.position)
		controller.use_render_clock(actor, stage)
		baseline.use_render_clock(reference, stage)
		controller.preview(&"Idle")
		baseline.preview(&"Idle")
		for frame in 72:
			bridge.set_gameplay_state(true, frame >= 24, Vector3(0, 0, -10), actor.position)
			if frame in [40, 52]:
				actor.combat.fired.emit([])
			controller.update_motion(4.2, 4.2, 1.0 / 60)
			baseline.update_motion(4.2, 4.2, 1.0 / 60)
			await process_frame
			if frame >= 20:
				for bone_name: String in ["Root", "Hips", "LeftUpperLeg", "LeftLowerLeg", "RightUpperLeg", "RightLowerLeg", "LeftFoot", "RightFoot"]:
					var bone: int = controller.source.find_bone(bone_name)
					check(controller.source.get_bone_pose(bone).is_equal_approx(baseline.source.get_bone_pose(bone)), "Shoot + Jog preserves " + bone_name)
				var palm := (poses.LeftHand as Transform3D) * Vector3(0, .045, 0)
				max_grip_error = maxf(max_grip_error, palm.distance_to(actor.weapon_visual.get_support_grip().global_position))
		check(controller.current_state == &"Run", "Shared public Run selected")
		check(is_equal_approx(controller.playback_rate, baseline.playback_rate), "Combat and unarmed share cadence")
		check(controller.player.get_animation_library(&"Public") == baseline.player.get_animation_library(&"Public"), "Public locomotion resource is shared")
		controller.use_render_clock(actor, null)
		baseline.use_render_clock(reference, null)
		# Aim can differ from travel without changing the locomotion root.
		bridge.set_gameplay_state(true, true, Vector3(7, 0, -7), actor.position)
		for frame in 25:
			controller.update_motion(1.3, 4.2, 1.0 / 60)
			await process_frame
		await process_frame
		var diagonal := Vector3(1, 0, -1).normalized()
		check((-actor.weapon_visual.get_muzzle_point().global_basis.z.normalized()).dot(diagonal) > .99, "Walk aims 45 degrees across travel")
		check(is_zero_approx(actor.rig.rotation.y), "Upper aim never rotates the movement root")
		bridge.set_gameplay_state(true, true, Vector3(0, 0, -10), actor.position)
		for frame in 25:
			controller.update_motion(4.2, 4.2, 1.0 / 60)
			await process_frame
		check(max_grip_error < .008, id + ": palm follows LeftGrip (<8mm): " + str(max_grip_error))
		check(min_muzzle_dot > .99, id + ": stable aimed muzzle direction: " + str(min_muzzle_dot))
		# OneShot is driven by confirmed events only and can retrigger before finishing.
		var ammo_before: int = actor.ammo
		var cooldown_before: float = actor.cooldown
		var rest_muzzle: Vector3 = actor.weapon_visual.get_muzzle_point().global_position
		actor.combat.fired.emit([])
		controller.update_motion(4.2, 4.2, .001)
		controller.update_motion(4.2, 4.2, .025)
		await process_frame
		await process_frame
		check(bool(controller.tree.get("parameters/Shot/active")), "Confirmed fire starts visual OneShot")
		var recoil_distance := rest_muzzle.distance_to(actor.weapon_visual.get_muzzle_point().global_position)
		for frame in 6:
			controller.update_motion(4.2, 4.2, .01)
			await process_frame
			await process_frame
			recoil_distance = maxf(recoil_distance, rest_muzzle.distance_to(actor.weapon_visual.get_muzzle_point().global_position))
		check(recoil_distance > .015 and recoil_distance < .11, "Readable restrained recoil: " + str(recoil_distance))
		await capture(id + "-shoot")
		for shot in 8:
			actor.combat.fired.emit([])
			controller.update_motion(4.2, 4.2, .06)
			await process_frame
			check(bool(controller.tree.get("parameters/Shot/active")), "Repeated shoot remains active")
		for frame in 24:
			controller.update_motion(0, 4.2, 1.0 / 60)
			await process_frame
		check(bridge.visual_state == bridge.VisualState.AIM, "Shoot returns to Aim after stopping")
		check(actor.ammo == ammo_before and actor.cooldown == cooldown_before, "Animation never owns ammo or cooldown")
		bridge.set_gameplay_state(true, false, Vector3.ZERO, actor.position)
		actor.combat.fired.emit([])
		for frame in 24:
			controller.update_motion(0, 4.2, 1.0 / 60)
			await process_frame
		check(bridge.visual_state == bridge.VisualState.READY, "Shoot returns to Ready without aim")
		# Move one marker on this instance to prove the constraint is not an A21 pose.
		var support := actor.weapon_visual.get_support_grip()
		support.position.z += .04
		for frame in 4:
			controller.update_motion(0, 4.2, 1.0 / 60)
			await process_frame
		var adjusted_error: float = ((poses.LeftHand as Transform3D) * Vector3(0, .045, 0)).distance_to(support.global_position)
		check(adjusted_error < .008, "Different fore-end length follows the marker")
		actor.rig.scale = Vector3.ZERO
		for frame in 3:
			controller.update_motion(0, 4.2, 1.0 / 60)
			await process_frame
		check(actor.weapon_visual.model.global_transform.is_finite(), "Extraction may scale the visual to zero")
		actor.rig.scale = Vector3.ONE
		for frame in 3:
			controller.update_motion(0, 4.2, 1.0 / 60)
			await process_frame
		bridge.set_gameplay_state(false, false, Vector3.ZERO, actor.position)
		controller.update_motion(1.3, 4.2, .08)
		check(bridge.combat_weight > 0 and bridge.combat_weight < 1, "Exploration transition has an intermediate blend")
		for frame in 15:
			controller.update_motion(1.3, 4.2, 1.0 / 60)
			await process_frame
		check(bridge.combat_weight == 0 and bridge.visual_state == bridge.VisualState.EXPLORATION, "Combat to Exploration")
		actor.equip(null)
		check(actor.weapon_visual.model == null, "Unequip removes the one weapon visual")
		for definition: Resource in [catalog.by_id(catalog.weapons, Registry.P9), catalog.by_id(catalog.weapons, Registry.KNIFE)]:
			actor.equip(definition)
			actor.combat.fired.emit([])
			controller.update_motion(0, 4.2, .2)
			check(bridge.combat_weight == 0 and not bool(controller.tree.get("parameters/Shot/active")), "Existing non-long_gun fallback")
		metrics.append({"character": id, "max_left_grip_error_m": max_grip_error, "min_aim_direction_dot": min_muzzle_dot, "recoil_m": recoil_distance, "alternate_grip_error_m": adjusted_error})
		reference.free()
		actor.free()
	await process_frame
	stage.free()
	FileAccess.open(artifact_path.path_join("animations.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "metrics": metrics}, "\t"))
	print("COMBAT ANIMATIONS: ", checks, " checks, ", failures.size(), " failures")
	quit(0 if failures.is_empty() else 1)

func snapshot(skeleton: Skeleton3D) -> void:
	for bone: String in ["LeftHand", "RightHand", "LeftUpperArm", "LeftLowerArm"]:
		poses[bone] = skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone(bone))

func capture(label: String) -> void:
	if capture_enabled:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(artifact_path.path_join(label + ".png"))
