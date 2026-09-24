extends SceneTree
## Checks the accepted Expedition library on every production survivor rig.

const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const Registry = preload("res://data/weapon_registry.gd")
const Library = preload("res://assets/characters/survivors/animations/survivor_animations.tres")
const OUTPUT: String = "res://test-output/survivor-animation/batch"
const IDS: Array[String] = [
	"SUR_001", "SUR_002", "SUR_003", "SUR_004", "SUR_005", "SUR_006",
	"SUR_007", "SUR_008", "SUR_009", "SUR_010", "SUR_011", "SUR_012",
]
const CLIPS: Array[StringName] = [
	&"survivor_idle", &"survivor_walk", &"survivor_run", &"rifle_idle",
	&"rifle_run", &"rifle_shoot", &"unarmed_idle", &"knife_idle",
	&"knife_attack", &"hit_reaction", &"death",
]

var checks: int = 0
var failures: Array[String] = []
var actors: Array[Node3D] = []
var rows: Array[Dictionary] = []
var capture_enabled: bool = false
var artifact_path: String = OUTPUT

func _initialize() -> void:
	capture_enabled = "capture" in OS.get_cmdline_user_args() and DisplayServer.get_name() != "headless"
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--artifact-path="):
			artifact_path = argument.trim_prefix("--artifact-path=")
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	root.size = Vector2i(1600, 900)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(artifact_path))
	_setup_stage()
	var catalog := Catalog.new()
	var definitions: Dictionary = {}
	for definition: Resource in catalog.survivors:
		definitions[definition.survivor_id] = definition
	check(definitions.size() == IDS.size(), "The formal roster has twelve unique survivor IDs")
	for index: int in IDS.size():
		var survivor_id: String = IDS[index]
		check(definitions.has(survivor_id), survivor_id + " is bound by SurvivorDefinition")
		if not definitions.has(survivor_id):
			continue
		var definition: Resource = definitions[survivor_id]
		var actor := Survivor.new()
		var stage: Node3D = root.get_child(0)
		stage.add_child(actor)
		actor.position = Vector3((index % 4 - 1.5) * 2.55, 0.0, (index / 4 - 1) * 2.55)
		var label := Label3D.new()
		label.text = survivor_id
		label.font_size = 36
		label.pixel_size = 0.003
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		stage.add_child(label)
		label.position = actor.position + Vector3(0.0, 0.02, -0.95)
		actor.setup(definition, definition.trait_definition.at_level(1), null)
		actor.hp_bar.hide()
		actor.name_label.hide()
		actor.duty_label.hide()
		actors.append(actor)
		var controller: Node3D = actor.animation_controller
		check(controller != null, survivor_id + " Expedition controller initializes")
		if controller == null:
			continue
		check(controller.get_script().resource_path == "res://survivors/survivor_expedition_animation_controller.gd", survivor_id + " selects the Expedition controller")
		check(controller.player.get_animation_library(&"Survivor") == Library, survivor_id + " reuses the accepted eleven-clip library")
		check(controller.library.get_animation_list().size() == CLIPS.size(), survivor_id + " loads all eleven clips")
		controller.tree.active = false
		for clip: StringName in CLIPS:
			check(controller.player.has_animation(&"Survivor/" + clip), survivor_id + " loads " + clip)
			controller.player.play(&"Survivor/" + clip)
			controller.player.advance(0.05)
			check(controller.player.current_animation == &"Survivor/" + clip, survivor_id + " plays " + clip)
		controller.player.stop()
		controller.tree.active = true
		controller.preview(&"IDLE")
		var skeleton: Skeleton3D = controller.target
		check(skeleton.get_bone_count() == 23, survivor_id + " keeps the 23-bone rig")
		var left_attachment := BoneAttachment3D.new()
		left_attachment.name = "BatchLeftHand"
		left_attachment.bone_name = &"LeftHand"
		skeleton.add_child(left_attachment)
		if index > 0:
			var reference: Skeleton3D = actors[0].animation_controller.target
			for bone: int in reference.get_bone_count():
				check(skeleton.get_bone_name(bone) == reference.get_bone_name(bone), survivor_id + " bone name " + str(bone))
				check(skeleton.get_bone_parent(bone) == reference.get_bone_parent(bone), survivor_id + " bone parent " + str(bone))
				check(skeleton.get_bone_rest(bone).is_equal_approx(reference.get_bone_rest(bone)), survivor_id + " bone rest " + str(bone))
		check(actor.rig.position.is_zero_approx() and actor.rig.scale.is_equal_approx(Vector3.ONE), survivor_id + " has no character scale or ground offset")
		rows.append({"survivor_id": survivor_id, "name": definition.display_name, "model": definition.model_resource, "failures": []})
	await _step(12, 0.0)
	await _capture("idle")
	for actor: Node3D in actors:
		var controller: Node3D = actor.animation_controller
		check(controller.active_state == &"IDLE", actor.data.survivor_id + " plays Idle")
		check(_foot_height(actor) < 0.32, actor.data.survivor_id + " feet remain near ground in Idle")
	await _step(40, 2.8)
	await _capture("run")
	for actor: Node3D in actors:
		check(actor.animation_controller.active_state == &"RUN", actor.data.survivor_id + " plays Run")
		check(_hand_elevation(actor) < 0.12, actor.data.survivor_id + " Run hands stay below head level")
		check(_foot_height(actor) < 0.6, actor.data.survivor_id + " Run feet remain within grounded gait")
	var rifle: Resource = catalog.by_id(catalog.weapons, Registry.K9)
	for actor: Node3D in actors:
		actor.equip(rifle)
		actor.animation_controller.combat_bridge.set_gameplay_state(true, false, Vector3.ZERO, actor.position)
	await _step(35, 0.0)
	await _capture("rifle_idle")
	for actor: Node3D in actors:
		_check_rifle(actor, &"RIFLE_IDLE")
	await _step(40, 2.8)
	await _capture("rifle_run")
	for actor: Node3D in actors:
		_check_rifle(actor, &"RIFLE_RUN")
		actor.combat.fired.emit([])
	await _step(4, 2.8)
	await _capture("rifle_shoot")
	for actor: Node3D in actors:
		check(actor.animation_controller.combat_bridge.shoot_requests > 0, actor.data.survivor_id + " plays Rifle Shoot after a fired event")
		_check_rifle(actor, &"RIFLE_RUN")
	var knife: Resource = catalog.by_id(catalog.weapons, Registry.KNIFE)
	for actor: Node3D in actors:
		actor.equip(knife)
		actor.animation_controller.combat_bridge.set_gameplay_state(true, false, Vector3.ZERO, actor.position)
	await _step(24, 0.0)
	await _capture("knife_idle")
	for actor: Node3D in actors:
		check(actor.animation_controller.active_state == &"KNIFE_IDLE", actor.data.survivor_id + " plays Knife Idle")
		check(actor.weapon_visual.model != null, actor.data.survivor_id + " has an attached knife")
		actor.combat.fired.emit([])
	await _step(4, 0.0)
	await _capture("knife_attack")
	for actor: Node3D in actors:
		check(actor.animation_controller.active_state == &"ATTACK", actor.data.survivor_id + " plays Knife Attack after a fired event")
		actor.take_damage(5.0)
	await _step(4, 0.0)
	await _capture("hit")
	for actor: Node3D in actors:
		check(bool(actor.animation_controller.tree.get("parameters/Hit/active")), actor.data.survivor_id + " plays Hit after real damage")
		actor.take_damage(10000.0)
	var death_length: float = Library.get_animation(&"death").length
	await _step(ceili((death_length + 0.3) * 30.0), 0.0)
	await _capture("death")
	for actor: Node3D in actors:
		check(actor.dead and actor.animation_controller.active_state == &"DEATH", actor.data.survivor_id + " plays and holds Death")
		check(is_zero_approx(actor.rig.rotation.z), actor.data.survivor_id + " avoids legacy corpse tilt")
		check(_foot_height(actor) < 0.32, actor.data.survivor_id + " Death feet settle near ground")
	for row: Dictionary in rows:
		var prefix: String = row.survivor_id
		row.failures = failures.filter(func(label: String) -> bool: return label.begins_with(prefix))
		row.status = "PASS" if row.failures.is_empty() else "FAIL"
	FileAccess.open(artifact_path + "/batch-qa.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "characters": rows, "capture": capture_enabled}, "\t"))
	print("SURVIVOR ANIMATION BATCH: %d checks; failures=%s" % [checks, failures])
	quit(0 if failures.is_empty() else 1)

func _setup_stage() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#202b35")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.8
	stage.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45.0, 20.0, 0.0)
	stage.add_child(light)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 9.0
	camera.position = Vector3(0.0, 12.5, -13.0)
	stage.add_child(camera)
	camera.look_at(Vector3(0.0, 0.8, 0.0))
	camera.make_current()
	var floor := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(13.0, 10.0)
	floor.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#65717b")
	floor.material_override = material
	stage.add_child(floor)

func _step(frames: int, speed: float) -> void:
	for frame: int in frames:
		for actor: Node3D in actors:
			actor.animation_controller.update_motion(speed, actor.data.move_speed, 1.0 / 30.0)
		await process_frame

func _capture(label: String) -> void:
	if not capture_enabled:
		return
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	check(image != null and image.save_png(artifact_path + "/" + label + ".png") == OK, "Batch screenshot " + label)

func _hand_elevation(actor: Node3D) -> float:
	var skeleton: Skeleton3D = actor.animation_controller.target
	var shoulder: float = skeleton.get_bone_global_pose(skeleton.find_bone("LeftShoulder")).origin.y
	var left: float = skeleton.get_bone_global_pose(skeleton.find_bone("LeftHand")).origin.y
	var right: float = skeleton.get_bone_global_pose(skeleton.find_bone("RightHand")).origin.y
	return maxf(left, right) - shoulder

func _foot_height(actor: Node3D) -> float:
	var skeleton: Skeleton3D = actor.animation_controller.target
	var left: float = skeleton.get_bone_global_pose(skeleton.find_bone("LeftFoot")).origin.y
	var right: float = skeleton.get_bone_global_pose(skeleton.find_bone("RightFoot")).origin.y
	return maxf(left, right)

func _check_rifle(actor: Node3D, state: StringName) -> void:
	var survivor_id: String = actor.data.survivor_id
	var controller: Node3D = actor.animation_controller
	check(controller.active_state == state, survivor_id + " plays " + state)
	var visual: WeaponVisualController = actor.weapon_visual
	check(visual.model != null and visual.get_support_grip() != null, survivor_id + " has K9 and support grip")
	if visual.model == null or visual.get_support_grip() == null:
		return
	var attachment: BoneAttachment3D = controller.target.get_node("BatchLeftHand")
	var palm: Vector3 = attachment.global_transform * Vector3(0.0, 0.045, 0.0)
	var gap: float = palm.distance_to(visual.get_support_grip().global_position)
	check(gap < 0.03, survivor_id + " support hand holds K9 in %s (%.3f m)" % [state, gap])
	check(visual.model.global_transform.is_finite(), survivor_id + " K9 transform stays finite in " + state)
