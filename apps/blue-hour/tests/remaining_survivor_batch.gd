extends SceneTree
## Production resources only: shared locomotion, definitions, sockets and visual QA.

const Catalog = preload("res://data/catalog.gd")
const Survivor = preload("res://survivors/survivor.gd")
const PUBLIC = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
const IDS: Array[String] = [
	"lin_jianyue",
	"lu_qinghe",
	"shen_yanchuan",
	"tang_zhi",
	"gu_yuan",
	"cheng_mo",
	"zhou_ye",
	"xu_zhaoning",
	"he_linchuan",
	"song_shiyu",
]
const CLIPS: Array[StringName] = [&"public_idle", &"public_walking", &"public_running"]
const PHASE_A_HOOKS: Dictionary = {
	"lin_jianyue": "damage",
	"shen_yanchuan": "interaction",
	"lu_qinghe": "periodic_effect",
	"gu_yuan": "damage",
	"zhou_ye": "max_hp",
	"xu_zhaoning": "loot_quality",
	"tang_zhi": "aura",
	"he_linchuan": "aura",
	"song_shiyu": "power_cooldown",
}
const OUTPUT: String = "res://test-output/survivor-batch-integration/runtime-qa/"

var failures: Array[String] = []
var checks: int = 0
var catalog: RefCounted
var viewport: SubViewport
var camera: Camera3D


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)


func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child: Node in node.get_children():
		var result := find_skeleton(child)
		if result != null:
			return result
	return null


func bone_contract(skeleton: Skeleton3D) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for bone: int in skeleton.get_bone_count():
		var parent := skeleton.get_bone_parent(bone)
		result.append({
			"name": skeleton.get_bone_name(bone),
			"parent": skeleton.get_bone_name(parent) if parent >= 0 else &"",
			"rest": skeleton.get_bone_rest(bone),
		})
	return result


func setup_stage() -> void:
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#293442")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color.WHITE
	environment.environment.ambient_light_energy = 0.45
	root.add_child(environment)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40.0, -25.0, 0.0)
	light.light_energy = 0.8
	light.shadow_enabled = true
	root.add_child(light)
	var floor := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(8.0, 8.0)
	floor.mesh = plane
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#68727b")
	material.roughness = 1.0
	floor.material_override = material
	root.add_child(floor)
	viewport = SubViewport.new()
	viewport.size = Vector2i(720, 900)
	viewport.world_3d = root.world_3d
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_4X
	root.add_child(viewport)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 1.95
	viewport.add_child(camera)
	camera.make_current()


func capture(actor: Node3D, skeleton: Skeleton3D, player: AnimationPlayer, clip: StringName, time: float, view: String, path: String) -> void:
	player.play(&"Public/" + clip)
	player.seek(time, true)
	skeleton.force_update_all_bone_transforms()
	var target := Vector3(0.0, 0.82, 0.0)
	camera.size = 1.95
	match view:
		"front":
			camera.position = Vector3(0.0, 0.88, 4.0)
		"side":
			camera.position = Vector3(4.0, 0.88, 0.0)
		"three_quarter":
			camera.position = Vector3(2.8, 1.10, 3.6)
	camera.look_at(target)
	actor.visible = true
	await process_frame
	await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	check(image.save_png(path) == OK, "Save visual QA: " + path)
	actor.visible = false


func loop_contract() -> Dictionary:
	var result: Dictionary = {}
	for clip_name: StringName in CLIPS:
		var clip := PUBLIC.get_animation(clip_name)
		var maximum_position_error := 0.0
		var maximum_rotation_error := 0.0
		for track: int in clip.get_track_count():
			var key_count := clip.track_get_key_count(track)
			check(key_count >= 2, str(clip_name) + " keyed track")
			var first: Variant = clip.track_get_key_value(track, 0)
			var last: Variant = clip.track_get_key_value(track, key_count - 1)
			if clip.track_get_type(track) == Animation.TYPE_POSITION_3D:
				maximum_position_error = maxf(maximum_position_error, (first as Vector3).distance_to(last as Vector3))
			elif clip.track_get_type(track) == Animation.TYPE_ROTATION_3D:
				maximum_rotation_error = maxf(maximum_rotation_error, (first as Quaternion).angle_to(last as Quaternion))
		check(clip.loop_mode == Animation.LOOP_LINEAR, str(clip_name) + " is intrinsic loop")
		result[clip_name] = {
			"length": clip.length,
			"step": clip.step,
			"nominal_speed": clip.get_meta("nominal_speed", 0.0),
			"maximum_position_endpoint_error": maximum_position_error,
			"maximum_rotation_endpoint_error_radians": maximum_rotation_error,
		}
	return result


func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	var capture_visuals: bool = "capture" in OS.get_cmdline_user_args()
	if capture_visuals:
		setup_stage()
	catalog = Catalog.new()
	check(catalog.validate().is_empty(), "Catalog validates with twelve Survivors")
	check(catalog.survivors.size() == 12, "Production roster contains twelve Survivors")
	check(catalog.traits.size() == 12, "Production roster contains twelve Trait definitions")
	var reference_bones: Array[Dictionary] = []
	var rows: Array[Dictionary] = []
	for id: String in IDS:
		print("BATCH QA START ", id)
		var definition: Resource = catalog.by_id(catalog.survivors, id)
		check(definition is SurvivorDefinition, id + " has SurvivorDefinition")
		check(definition.survivor_id.begins_with("SUR_"), id + " stable content ID")
		check(definition.trait_levels.size() == 5, id + " five Trait levels")
		if PHASE_A_HOOKS.has(id):
			check(definition.trait_definition.modifier_hook == PHASE_A_HOOKS[id], id + " Phase A Trait hook")
		else:
			check(definition.trait_definition.modifier_hook.is_empty(), id + " Phase B Trait remains data-only")
		check(is_equal_approx(definition.base_move_speed, 2.8), id + " frozen 2.8m/s")
		check(ResourceLoader.exists(definition.model_resource), id + " production GLB resolves")

		var scene := load(definition.model_resource) as PackedScene
		var model := scene.instantiate() as Node3D
		root.add_child(model)
		model.visible = false
		var skeleton := find_skeleton(model)
		check(skeleton != null and skeleton.get_bone_count() == 23, id + " exact 23 bones")
		check(skeleton.find_bone("RightHand") >= 0 and skeleton.find_bone("LeftHand") >= 0, id + " socket bones")
		var bones := bone_contract(skeleton)
		if reference_bones.is_empty():
			reference_bones = bones
		else:
			check(bones == reference_bones, id + " exact shared hierarchy/rest")
		check(model.find_children("*", "RetargetModifier3D", true, false).is_empty(), id + " no runtime retarget")
		check(model.find_children("*", "SkeletonIK3D", true, false).is_empty(), id + " no runtime IK")
		var player := AnimationPlayer.new()
		model.add_child(player)
		player.root_node = player.get_path_to(skeleton.get_parent())
		player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
		check(player.add_animation_library(&"Public", PUBLIC) == OK, id + " shares Public library")
		for clip_name: StringName in CLIPS:
			check(player.get_animation(&"Public/" + clip_name) == PUBLIC.get_animation(clip_name), id + " no clip copy " + str(clip_name))

		if capture_visuals:
			await capture(model, skeleton, player, &"public_idle", 4.5, "front", OUTPUT + id + "_idle_front.png")
			await capture(model, skeleton, player, &"public_running", 0.18, "side", OUTPUT + id + "_run_side.png")
			await capture(model, skeleton, player, &"public_running", 0.50, "three_quarter", OUTPUT + id + "_run_three_quarter.png")
		model.queue_free()
		await process_frame

		var actor := Survivor.new()
		root.add_child(actor)
		actor.setup(definition, definition.trait_definition.at_level(1), catalog.weapons[0])
		check(actor.animation_controller != null, id + " gameplay animation controller")
		var controller: Node3D = actor.animation_controller
		check(controller.player.get_animation_library(&"Public") == PUBLIC, id + " gameplay uses shared library")
		controller.update_motion(0.0, 2.8, 1.0 / 60.0)
		check(controller.current_state == &"Idle", id + " Idle state")
		controller.update_motion(1.2, 2.8, 1.0 / 60.0)
		check(controller.current_state == &"Walk", id + " Walk state")
		controller.update_motion(2.8, 2.8, 1.0 / 60.0)
		check(controller.current_state == &"Run", id + " Run state")
		check(absf(controller.playback_rate - 2.8 / float(PUBLIC.get_animation(&"public_running").get_meta("nominal_speed"))) < 0.00001, id + " playback multiplier")
		controller.update_motion(0.0, 2.8, 1.0 / 60.0)
		check(controller.current_state == &"Idle", id + " Run to Stop to Idle")
		check(actor.selection_ring != null, id + " selection ring")
		check(actor.weapon_visual != null and actor.weapon_visual.socket != null, id + " weapon socket created")
		check(actor.weapon_visual.socket.bone_name == &"RightHand", id + " weapon socket binds RightHand")
		check(actor.weapon_visual.global_position.is_finite(), id + " weapon does not resolve to invalid world position")
		rows.append({
			"id": id,
			"survivor_id": definition.survivor_id,
			"model": definition.model_resource,
			"trait": definition.trait_id,
			"bones": controller.target.get_bone_count(),
			"movement_speed": definition.base_move_speed,
			"run_playback": 2.8 / float(PUBLIC.get_animation(&"public_running").get_meta("nominal_speed")),
			"weapon_socket": str(actor.weapon_visual.socket.bone_name),
		})
		actor.queue_free()
		await process_frame
		print("BATCH QA PASS ", id)

	var report := {
		"engine": Engine.get_version_info().string,
		"checks": checks,
		"failures": failures,
		"public_library_path": "res://assets/animations/public_locomotion/public_locomotion.tres",
		"public_library_sha256": FileAccess.get_sha256("res://assets/animations/public_locomotion/public_locomotion.tres"),
		"loop_contract": loop_contract(),
		"characters": rows,
	}
	FileAccess.open(OUTPUT + "runtime-qa.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("REMAINING SURVIVOR BATCH: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
