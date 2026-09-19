extends SceneTree
## Controller contract on real survivor instances; gameplay recording is separate.

const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const OUT: String = "res://test-output/xia-locomotion-gameplay/"

var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func tick(actor: Node3D, speed: float, frames: int = 30) -> void:
	for frame: int in frames:
		actor.actual_velocity = Vector3(0, 0, -speed)
		actor.animation_controller.update_motion(speed, actor.data.move_speed, 1.0 / 60.0)
		await process_frame

func verify_pose(controller: Node3D) -> void:
	var layer: Node = controller.character_locomotion
	var clip: Animation = layer.player.get_animation(layer.current_state)
	check(clip.get_track_count() > 0, str(layer.current_state) + " keeps approved target tracks")
	for track: int in clip.get_track_count():
		check(clip.track_get_path(track).get_subname_count() == 1, str(layer.current_state) + " binds directly to Xia bones")

func run() -> void:
	create_timer(60).timeout.connect(func(): printerr("XIA CONTROLLER TIMEOUT"); quit(2))
	DirAccess.make_dir_recursive_absolute(OUT)
	var stage: Node3D = Node3D.new()
	root.add_child(stage)
	stage.set_physics_process(false)
	var catalog: RefCounted = Catalog.new()
	var actor: Node3D = Survivor.new()
	stage.add_child(actor)
	var spec: Resource = load("res://data/survivors/xia_zhiyao.tres")
	actor.setup(spec, catalog.by_id(catalog.traits, spec.trait_id), null)
	var controller: Node3D = actor.animation_controller
	controller.use_render_clock(actor, stage)
	check(controller.get("character_locomotion") != null, "Xia has a dedicated approved-clip layer")
	if controller.get("character_locomotion") == null:
		stage.free()
		quit(1)
		return
	var locomotion: Node = controller.character_locomotion
	await tick(actor, 0)
	check(controller.current_state == &"Idle" and locomotion.active, "Unarmed Expedition uses new Idle")
	check(not controller.retarget.active and not controller.tree.active, "Legacy retarget cannot overwrite approved target poses")
	verify_pose(controller)
	await tick(actor, 1.262)
	check(controller.current_state == &"Walk", "Low physical speed selects Walking")
	check(absf(controller.playback_rate - 1.0) < .002, "Walking uses character-specific nominal speed")
	verify_pose(controller)
	await tick(actor, 4.2)
	check(controller.current_state == &"Run", "Normal gameplay speed selects Running")
	check(absf(controller.playback_rate - 4.2 / 2.30655212) < .002, "Run matches 4.2m/s without changing gameplay")
	verify_pose(controller)
	for speed: float in [1.7, 1.82, 1.65, 1.8]:
		await tick(actor, speed, 1)
		check(controller.current_state == &"Run", "Run threshold hysteresis")
	await tick(actor, 1.5)
	check(controller.current_state == &"Walk", "Run decelerates into Walk")
	await tick(actor, 0)
	check(controller.current_state == &"Idle", "Walk fades to Idle")
	check(locomotion.playback.get_fading_from_node() == &"", "Stop fade completes")
	await tick(actor, 4.2, 20)
	check(controller.current_state == &"Run", "Direct Idle to Run supported")
	await tick(actor, 0, 20)
	check(controller.current_state == &"Idle", "Direct Run to Idle supported")
	check(actor.position == Vector3.ZERO and actor.data.move_speed == 4.2, "Animation does not move or rescale gameplay actor")
	check(controller.target.get_bone_count() == 23, "Original Skeleton retained")
	check(controller.target.get_bone_pose_position(controller.target.find_bone("Root")).is_zero_approx(), "No Root offset")
	controller.set_enabled(false)
	check(not locomotion.active and not controller.tree.active and not controller.retarget.active, "Disable suspends both pipelines")
	controller.set_enabled(true)
	await tick(actor, 4.2)
	controller.set_enabled(true)
	check(locomotion.active and not controller.tree.active and not controller.retarget.active, "Repeated enable keeps single pose owner")
	var registry: Script = load("res://data/weapon_registry.gd")
	actor.equip(catalog.by_id(catalog.weapons, registry.A21))
	await tick(actor, 4.2, 30)
	check(not locomotion.active and controller.current_state == &"mission_jog", "Armed Xia retains existing Combat Jog")
	check(controller.retarget.active and controller.tree.active, "Original armed animation pipeline restored")
	actor.equip(null)
	await tick(actor, 1.262, 30)
	check(locomotion.active and controller.current_state == &"Walk", "Unequip restores target locomotion")
	controller.use_render_clock(actor, null)
	controller.use_camp_style()
	await tick(actor, 2.7, 30)
	check(not locomotion.active and controller.current_state == &"Walk", "Camp retains old Walk")
	var other: Node3D = Survivor.new()
	stage.add_child(other)
	var other_spec: Resource = load("res://data/survivors/su_wanxing.tres")
	other.setup(other_spec, catalog.by_id(catalog.traits, other_spec.trait_id), null)
	other.animation_controller.use_render_clock(other, stage)
	await tick(other, 4.2)
	check(other.animation_controller.get("character_locomotion") == null, "Su has no Xia layer")
	check(other.animation_controller.current_state == &"mission_jog", "Su's original locomotion unchanged")
	var file: FileAccess = FileAccess.open(OUT + "controller-validation.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	file.close()
	print("XIA GAMEPLAY CONTROLLER: ", checks, " checks; failures=", failures)
	stage.free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
