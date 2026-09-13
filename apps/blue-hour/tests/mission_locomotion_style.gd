extends "res://tests/combat_animation_mission.gd"
## Exercise the style through the formal Mission, at its unchanged camera scale.
const JOG_PATH := "res://assets/animations/humanoid/locomotion/bh_humanoid_mission_jog.tres"
var observed_flashes: Dictionary = {}
var flash_captures: Dictionary = {}
var max_grip_error: Dictionary = {}
var film: String = ""
var film_frame: int = 0

func run() -> void:
	# Headless windows otherwise start too small for the formal HUD's POI cards.
	root.size = Vector2i(1600, 900)
	await process_frame
	await super.run()

func verify() -> void:
	check(ResourceLoader.exists(JOG_PATH), "Public in-place mission_jog exists")
	if not ResourceLoader.exists(JOG_PATH):
		return
	var library := load(JOG_PATH) as AnimationLibrary
	var jog := library.get_animation(&"mission_jog")
	check(jog.loop_mode == Animation.LOOP_LINEAR, "Jog loops")
	for track in jog.get_track_count():
		var bone := String(jog.track_get_path(track).get_subname(0))
		check(jog.track_get_type(track) in [Animation.TYPE_ROTATION_3D, Animation.TYPE_POSITION_3D], "Jog contains only bone poses")
		if jog.track_get_type(track) == Animation.TYPE_POSITION_3D:
			check(bone == "Hips", "Only the pelvis has a vertical weight shift")
			for key in jog.track_get_key_count(track):
				var position: Vector3 = jog.track_get_key_value(track, key)
				check(is_zero_approx(position.x) and is_zero_approx(position.z), "In-place: no horizontal travel")
	# Use the same actors without a Mission clock to check the existing Camp gait.
	for member in mission.survivors:
		var controller: Node = member.animation_controller
		controller.use_render_clock(member, null)
		controller.use_camp_style()
		for frame in 30:
			controller.update_motion(2.7, 4.2, 1.0 / 60)
			await process_frame
		check(controller.current_state == &"Walk", member.data.id + ": Camp retains Walk")
		check(controller.combat_bridge.combat_weight == 0, "Camp remains relaxed with a long gun equipped")
		controller.preview(&"Run")
		controller.advance_preview(.1)
		check(controller.current_state == &"Run", "Existing Run remains available")
		controller.use_render_clock(member, mission)
		member.equip(null)
	mission.command_move(Vector3(0, 0, -22))
	await advance(12)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"mission_jog", "Mission jog starts during acceleration")
	await advance(35)
	await capture("style-unarmed-jog")
	await capture_close("style-unarmed-jog-detail")
	film = "unarmed-jog"
	await advance(36)
	film = ""
	for member in mission.survivors:
		check(is_equal_approx(member.current_speed, member.data.move_speed), "Gameplay speed is unchanged")
		check(member.animation_controller.combat_bridge.combat_weight == 0, "Unarmed jogging uses full-body swing")
	mission.command_move(mission.squad_center() + Vector3(8, 0, -2))
	await advance(20)
	await capture("style-jog-turn")
	mission.command_stop()
	await advance(40)
	for member in mission.survivors:
		check(member.animation_controller.current_state == &"Idle", "Jog brakes to Idle")
		check(member.actual_velocity.is_zero_approx(), "Jog never continues gameplay movement after stopping")
		member.equip(mission.catalog.by_id(mission.catalog.weapons, Registry.A21))
	await advance(30)
	for member in mission.survivors:
		var site: Dictionary = mission.city.sites.van_south
		member.position = site.spec.entry
		mission.command_search("van_south")
		mission.command_reassign(mission.survivors.find(member))
		await advance(30)
		check(member.searching and member.animation_controller.combat_bridge.combat_weight == 0.0, "Gameplay search exits Combat without unequipping")
		mission.command_recall("van_south")
		await advance(30)
		check(member.animation_controller.combat_bridge.visual_state == 1, "Gameplay recall restores Ready")
	# Restore the base fixture's start so its target, path and camera checks are identical.
	for i in mission.survivors.size():
		mission.survivors[i].position = mission.city.nearest_open(Vector3(0, 0, 15) + mission.formation(i))
	mission.center_squad()
	# Existing 15-scene combat coverage uses real targets, confirmed shots, ammo and damage.
	await super.verify()
	for member in mission.survivors:
		check(observed_flashes.get(member.data.id, 0) == shots[member.data.id], "Each real fired event retriggers exactly one flash: " + member.data.id)
		check(float(max_grip_error.get(member.data.id, 1.0)) < .008, "LeftGrip remains attached across Jog/Aim/Shoot transitions")
		check(member.weapon_visual.muzzle_flash == null, "Unequip removes the flash")
		metrics.append({"character": member.data.id, "flash_pulses": observed_flashes.get(member.data.id, 0), "transition_grip_error_m": max_grip_error.get(member.data.id, 0)})
	check(flash_captures.has("idle") and flash_captures.has("jog"), "Real Shoot and Shoot + Jog were observed at the muzzle")

func advance(frames: int) -> void:
	for frame in frames:
		mission._physics_process(1.0 / 60)
		await process_frame
		await process_frame
		for member in mission.survivors:
			var visual: WeaponVisualController = member.weapon_visual
			var flash: MeshInstance3D = visual.muzzle_flash
			if flash == null:
				continue
			observed_flashes[member.data.id] = maxi(int(observed_flashes.get(member.data.id, 0)), flash.pulses)
			if member.is_visible_in_tree() and member.animation_controller.combat_bridge.combat_weight >= 1.0:
				var left: Transform3D = snapshots[member.data.id].left
				var error := (left * Vector3(0, .045, 0)).distance_to(visual.get_support_grip().global_position)
				max_grip_error[member.data.id] = maxf(float(max_grip_error.get(member.data.id, 0)), error)
			if flash.visible:
				check(flash.global_position.distance_to(visual.get_muzzle_point().global_position) < .00001, "Flash is attached to the actual MuzzlePoint")
				var state := "idle" if member.animation_controller.current_state == &"Idle" else "jog"
				if not flash_captures.has(state):
					flash_captures[state] = true
					await capture("style-" + state + "-muzzle-flash")
		if not film.is_empty():
			await capture("film/" + film + "-%03d" % film_frame)
			film_frame += 1
	await process_frame

func capture(label: String) -> void:
	if capture_enabled:
		var path := "res://test-output/mission-style/" + label + ".png"
		DirAccess.make_dir_recursive_absolute(path.get_base_dir())
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(path)
		if label == "mission-run-ready":
			film = "combat-jog"
			film_frame = 0
			await advance(36)
			film = ""
