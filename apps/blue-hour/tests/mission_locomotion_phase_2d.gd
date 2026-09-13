extends SceneTree
## Transition/phase contracts on the real actor; appearance is reviewed in the films.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const LOCKED_JOG = preload("res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres")
var checks: int = 0
var failures: Array[String] = []
var actor: Node3D
var controller: Node3D

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var stage := Node3D.new()
	root.add_child(stage)
	stage.set_physics_process(false)
	var catalog := Catalog.new()
	var spec: Resource = load("res://data/survivors/xia_zhiyao.tres")
	actor = Survivor.new()
	stage.add_child(actor)
	actor.setup(spec, catalog.by_id(catalog.traits, spec.trait_id), null)
	controller = actor.animation_controller
	controller.use_render_clock(actor, stage)
	var jog_path := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog_v2.tres"
	# Exports remap text resources to binary. Keep the strict source-byte guard
	# and verify every decoded key in both environments rather than skipping the lock.
	var source_locked := FileAccess.get_sha256(jog_path) == "381c4fa0c340c65a6969f253ff5e081db81ecffb6a2a6210b4a11c7e2421ea25" if FileAccess.file_exists(jog_path) else ResourceLoader.exists(jog_path)
	check(source_locked, "Approved source bytes remain intact, or the binary export remap exists")
	check(pose_signature(LOCKED_JOG) == "06dc931c45e7ecd26ea752e784ca0e919ec12da24d464d458139d5aa8c0c3c41", "All approved Jog keyframes and timing remain identical after loading/export")
	check(controller.get("locomotion_layer") != null, "Mission has a dedicated Start/Stop/Turn presentation layer")
	if failures.is_empty():
		await verify(catalog)
	stage.free()
	await process_frame
	print("MISSION LOCOMOTION PHASE 2D: ", checks, " checks, ", failures.size(), " failures")
	quit(0 if failures.is_empty() else 1)

func tick(speed: float, frames: int = 1) -> void:
	for frame in frames:
		actor.actual_velocity = -actor.rig.basis.z * speed
		controller.update_motion(speed, 4.2, 1.0 / 60.0)
		await process_frame

func verify(catalog: RefCounted) -> void:
	var layer: SkeletonModifier3D = controller.locomotion_layer
	actor.path = PackedVector3Array([Vector3(0, 0, -100)])
	await tick(0, 5)
	check(layer.state == &"Idle", "Initial Idle")
	await tick(.12)
	check(layer.state == &"JogStart", "Real start, not only a normal crossfade")
	await tick(2.4, 16)
	check(layer.state == &"Jog", "Start finishes within 0.28 seconds")
	await tick(4.2, 45)
	var phase_before: float = layer.locomotion_phase
	var starts_before: int = layer.start_count
	actor.actual_velocity = Vector3.RIGHT * 4.2
	controller.update_motion(4.2, 4.2, 1.0 / 60.0)
	await process_frame
	check(layer.state == &"Jog" and layer.start_count == starts_before, "A 90 degree direction change does not restart Jog")
	check(fposmod(layer.locomotion_phase - phase_before, 1.0) < .08, "Turn preserves advancing locomotion phase")
	check(absf(layer.lean_degrees) > .1 and absf(layer.lean_degrees) <= 8.0, "Turn has bounded inward lean")
	for frame in 24:
		await tick(3.9 if frame % 2 == 0 else 4.2)
	check(layer.state == &"Jog" and layer.start_count == starts_before, "Navigation speed corrections do not retrigger transitions")
	await tick(.05, 3)
	check(layer.state == &"Jog", "Existing moving hysteresis survives a low-speed correction")
	await tick(0)
	check(layer.state == &"JogStop", "An immediate gameplay stop begins a planted settle")
	var stop_phase: float = layer.locomotion_phase
	await tick(0, 10)
	check(is_equal_approx(layer.locomotion_phase, stop_phase), "Stopped feet cannot continue the Jog cycle")
	await tick(0, 10)
	check(layer.state == &"Idle", "Stop settles to Idle within 0.30 seconds")
	await tick(.06, 12)
	check(layer.state == &"Idle", "Idle noise stays below the existing start threshold")
	await tick(4.2, 30)
	actor._braking = true
	await tick(3.9)
	check(layer.state == &"JogStop", "Gameplay deceleration starts the visual brake before zero speed")
	actor._braking = false
	await tick(4.1)
	check(layer.state == &"Jog", "A resumed command cancels the brake without another start")
	await tick(0, 25)
	await tick(.2)
	await tick(0)
	await tick(0, 20)
	check(layer.state == &"Idle", "A cancelled start cannot leave the actor jogging")
	controller.set_jog_cadence(&"polish")
	await tick(4.2, 90)
	var cycles := 0.0
	for frame in 240:
		var previous_phase: float = layer.locomotion_phase
		await tick(4.2)
		cycles += fposmod(layer.locomotion_phase - previous_phase, 1.0)
	check(absf(cycles - 8.0) < .01, "Contact-matched B performs eight complete cycles in four seconds")
	for fps: int in [30, 144]:
		cycles = 0.0
		for frame in fps * 2:
			var previous_phase: float = layer.locomotion_phase
			controller.update_motion(4.2, 4.2, 1.0 / float(fps))
			await process_frame
			cycles += fposmod(layer.locomotion_phase - previous_phase, 1.0)
		check(absf(cycles - 4.0) < .01, "Cadence and phase boundaries are independent of render rate: " + str(fps))
	var phase_b: float = layer.locomotion_phase
	controller.set_jog_cadence(&"current")
	await tick(4.2)
	check(fposmod(layer.locomotion_phase - phase_b, 1.0) < .08, "Changing runtime cadence also preserves phase")
	await tick(4.2, 60)
	check(absf(.7 / controller.playback_rate - .44486466) < .001, "A retains the approved cadence")
	check(actor.position == Vector3.ZERO and actor.current_speed == 0, "Presentation never writes gameplay movement")
	actor.equip(catalog.weapons[0])
	await tick(4.2, 20)
	check(not layer.presenting, "Equipped locomotion bypasses Phase 2D")
	controller.use_render_clock(actor, null)
	controller.use_camp_style()
	await tick(2.7, 20)
	check(controller.current_state == &"Walk" and not layer.presenting, "Camp remains on its existing Walk")

func pose_signature(library: AnimationLibrary) -> String:
	var values: Array = []
	for name in library.get_animation_list():
		var clip := library.get_animation(name)
		values.append([String(name), clip.length, clip.loop_mode, clip.get_meta("nominal_speed", 0.0)])
		for track in clip.get_track_count():
			values.append([String(clip.track_get_path(track)), clip.track_get_type(track), clip.track_get_interpolation_type(track)])
			for key in clip.track_get_key_count(track):
				values.append([clip.track_get_key_time(track, key), clip.track_get_key_value(track, key)])
	return var_to_bytes(values).hex_encode().sha256_text()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)
