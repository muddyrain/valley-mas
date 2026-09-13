extends SceneTree
const Survivor = preload("res://survivors/survivor.gd")
const Registry = preload("res://data/weapon_registry.gd")
const VisualController = preload("res://weapons/weapon_visual_controller.gd")
var checks := 0
var failures: Array[String] = []
var stage: Node3D
var camera: Camera3D
var actors: Array[Node3D] = []
var capture_enabled := false
var socket_poses: Dictionary = {}
var artifact_path := "res://test-output/weapon-visuals"

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func frames(count: int) -> void:
	for i in count:
		await process_frame

func capture(label: String) -> void:
	if capture_enabled:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(artifact_path.path_join(label + ".png"))

func run() -> void:
	capture_enabled = "capture" in OS.get_cmdline_user_args()
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--artifact-path="):
			artifact_path = argument.trim_prefix("--artifact-path=")
	DirAccess.make_dir_recursive_absolute(artifact_path)
	stage = Node3D.new()
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
	light.light_energy = 1.25
	stage.add_child(light)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.4
	stage.add_child(camera)
	set_view(Vector3(2.5, 2.6, -4))
	for i in 2:
		var id: String = ["xia_zhiyao", "su_wanxing"][i]
		var actor := Survivor.new()
		stage.add_child(actor)
		actor.position.x = -.65 if i == 0 else .65
		actor.setup(load("res://data/survivors/" + id + ".tres"), null, null)
		actor.hp_bar.hide()
		actor.name_label.hide()
		actor.duty_label.hide()
		actors.append(actor)
		var skeleton: Skeleton3D = actor.animation_controller.target
		skeleton.skeleton_updated.connect(func() -> void:
			socket_poses[id] = skeleton.global_transform * skeleton.get_bone_global_pose(skeleton.find_bone("RightHand")))
	await frames(3)
	for definition in Registry.definitions():
		for actor in actors:
			actor.equip(definition)
		await frames(3)
		for actor in actors:
			var visual: WeaponVisualController = actor.weapon_visual
			check(visual.definition == actor.combat.weapon and visual.definition == actor.weapon, "Same visual/combat/equipped definition")
			check(visual.socket.bone_name == "RightHand" and visual.socket.name == "WeaponSocket_R", "Formal right-hand socket")
			check(visual.socket.get_parent() == actor.animation_controller.target, "Skinned target, not retarget reference")
			if definition.model_path.is_empty():
				check(visual.model == null and visual.get_muzzle_point() == null and visual.pose_modifier.profile == null, "No model path removes old model and pose")
			else:
				check(visual.model != null, "Imported model " + definition.id)
				if visual.model != null:
					check(visual.model.get_node_or_null("Mesh") is MeshInstance3D, "Named Mesh")
					check(visual.get_muzzle_point() != null and visual.get_support_grip() != null, "Both future seams exist")
		if definition.model_path.is_empty() or actors[0].weapon_visual.model == null:
			continue
		for clip in [&"Idle", &"Walk", &"Run"]:
			for actor in actors:
				actor.animation_controller.preview(clip)
				# Equip now blends into combat over .16 s; check settled grip direction.
				actor.animation_controller.advance_preview(.2)
			for frame in 18:
				for actor in actors:
					actor.animation_controller.advance_preview(.08)
				await frames(2)
				for actor in actors:
					var visual: WeaponVisualController = actor.weapon_visual
					var bone: Transform3D = socket_poses[actor.data.id]
					check(visual.socket.global_position.distance_to(bone.origin) < .001, "Socket follows modified right hand")
					var grip := visual.model.get_node("GripPoint_R") as Node3D
					check(grip.global_position.distance_to(bone.origin) < .10, "Grip within palm reach")
					var front := -visual.model.global_basis.z.normalized()
					check(front.dot(-actor.rig.global_basis.z.normalized()) > .88, "Weapon faces forward during " + clip)
					check(visual.model.global_transform.is_finite(), "Finite model pose")
				if frame == 8:
					await capture(definition.id + "-" + clip)
		set_view(Vector3(4, 1.5, -.3))
		await frames(2)
		await capture(definition.id + "-side")
		set_view(Vector3(-2.5, 2.6, 4))
		await frames(2)
		await capture(definition.id + "-back")
		set_view(Vector3(2.5, 2.6, -4))
	for actor in actors:
		actor.equip(null)
	await frames(3)
	for actor in actors:
		check(actor.weapon_visual.model == null and actor.weapon_visual.socket.get_child_count() == 0, "Unequip clears model immediately")
		check(actor.weapon_visual.pose_modifier.profile == null, "Unequip restores public pose")
	# A missing/unsupported rig is an intentionally safe presentation no-op.
	var empty := VisualController.new()
	stage.add_child(empty)
	empty.initialize(null)
	empty.set_weapon(Registry.definitions()[0])
	check(empty.model == null, "No skeleton keeps combat independent")
	stage.free()
	await frames(3)
	FileAccess.open(artifact_path.path_join("results.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("WEAPON VISUALS: ", checks, " checks, ", failures.size(), " failures")
	quit(0 if failures.is_empty() else 1)

func set_view(eye: Vector3) -> void:
	camera.position = eye
	camera.look_at(Vector3(0, .84, 0))
