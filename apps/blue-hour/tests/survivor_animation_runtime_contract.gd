extends "res://tests/expedition_minimap.gd"
## Observe real bone motion over repeated cycles and the production render consumer.
const SurvivorActor = preload("res://survivors/survivor.gd")
const Content = preload("res://data/catalog.gd")
const AnimationLibraryResource: AnimationLibrary = preload("res://assets/characters/survivors/animations/survivor_animations.tres")
const LOOP_CLIPS: Array[StringName] = [&"survivor_idle", &"survivor_walk", &"survivor_run", &"rifle_idle", &"rifle_run", &"knife_idle", &"unarmed_idle"]
const ONCE_CLIPS: Array[StringName] = [&"rifle_shoot", &"knife_attack", &"hit_reaction", &"death"]
var coverage: Array[Dictionary] = []
var timing: Array[Dictionary] = []

func run() -> void:
	create_timer(180.0).timeout.connect(func() -> void: quit(2))
	var content := Content.new()
	for clip_name: StringName in LOOP_CLIPS + ONCE_CLIPS:
		var clip: Animation = AnimationLibraryResource.get_animation(clip_name)
		check(clip.loop_mode == (Animation.LOOP_LINEAR if clip_name in LOOP_CLIPS else Animation.LOOP_NONE), str(clip_name) + " has its explicit playback contract")
	for definition: Resource in content.survivors:
		var actor := SurvivorActor.new()
		root.add_child(actor)
		actor.setup(definition.duplicate(), definition.trait_definition.at_level(1), null)
		var c: Node3D = actor.animation_controller
		check(c != null and c.target.get_bone_count() == 23, definition.survivor_id + " retains the formal rig")
		if c == null:
			actor.free()
			continue
		var row: Dictionary = {"survivor_id": definition.survivor_id, "model": definition.model_path, "clips": []}
		c.tree.active = false
		c.player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
		for name: StringName in LOOP_CLIPS:
			var clip: Animation = AnimationLibraryResource.get_animation(name)
			c.player.play(&"Survivor/" + name)
			c.player.advance(clip.length * 0.25)
			var phase_pose: Array[Transform3D] = bone_pose(c.target)
			var minimum_motion: float = INF
			for cycle: int in 3:
				c.player.advance(clip.length * 0.5)
				var moved: float = pose_difference(phase_pose, bone_pose(c.target))
				minimum_motion = minf(minimum_motion, moved)
				check(moved > 0.0001, "%s %s cycle %d actually changes bones" % [definition.survivor_id, name, cycle + 1])
				c.player.advance(clip.length * 0.5)
				check(pose_difference(phase_pose, bone_pose(c.target)) < 0.001, "%s %s repeats its quarter-cycle pose" % [definition.survivor_id, name])
			row.clips.append({"name": name, "cycles": 3, "minimum_bone_motion": minimum_motion, "phase": c.player.current_animation_position})
		for name: StringName in ONCE_CLIPS:
			c.player.play(&"Survivor/" + name)
			c.player.advance(AnimationLibraryResource.get_animation(name).length + 0.1)
			var final_pose: Array[Transform3D] = bone_pose(c.target)
			c.player.advance(1.0)
			check(pose_difference(final_pose, bone_pose(c.target)) < 0.00001, definition.survivor_id + " " + name + " holds rather than loops")
		c.player.stop()
		c.tree.active = true
		for speed: float in [0.0, 1.4, 2.8, 4.2]:
			c.update_motion(speed, 2.8, 0.2)
			var expected: float = 1.0 if speed == 0.0 else clampf(speed / 2.8, 0.55, 1.6) * 1.45
			check(is_equal_approx(c.playback_rate, expected), definition.survivor_id + " Run keeps an independent 1.45 cadence factor")
		c.use_camp_style()
		c.update_motion(1.15, 2.8, 0.2)
		check(c.active_state == &"WALK" and is_equal_approx(c.playback_rate, 0.55), definition.survivor_id + " Camp Walk rate is unchanged")
		c.use_render_clock(actor, null)
		c._camp_style = false
		actor.equip(content.by_id(content.weapons, "WPN_004_K9_SMG"))
		c.combat_bridge.set_gameplay_state(true, false, Vector3.ZERO, actor.position)
		c.update_motion(2.8, 2.8, 0.2)
		check(c.active_state == &"RIFLE_RUN" and is_equal_approx(c.playback_rate, 1.45), definition.survivor_id + " Rifle Run uses 1.45")
		c.update_motion(0.0, 2.8, 0.2)
		check(c.active_state == &"RIFLE_IDLE" and is_equal_approx(c.playback_rate, 1.0), definition.survivor_id + " Rifle Idle rate is unchanged")
		coverage.append(row)
		actor.free()
	for provider: String in ["MEDIUM_TOWN_V1", "FIXED_LEGACY"]:
		var app: Node = await create_app(4101, provider)
		var m: Node3D = app.mission
		for frame: int in 600:
			if m.survivor_commands_enabled:
				break
			await process_frame
		m.director_enabled = false
		m.debug_clear_enemies()
		for member: Node3D in m.survivors:
			member.equip(null)
		var actor: Node3D = m.survivors[0]
		var start: Vector3 = actor.position
		for scale_value: float in [1.0, 2.0, 4.0]:
			for render_hz: float in [20.0, 30.0, 144.0]:
				actor.stop()
				actor.position = start
				actor.order_move(m.city.nearest_open(start + Vector3(0, 0, -25)), m.city)
				m.time_scale = scale_value
				m.set_physics_process(true)
				var clock_before: float = m.clock.elapsed
				var render_left: float = 0.0
				var moving_renders: int = 0
				for frame: int in 60:
					m._physics_process(1.0 / 60.0)
					render_left += 1.0 / 60.0
					while render_left + 0.000000001 >= 1.0 / render_hz:
						actor.animation_controller._process(1.0 / render_hz)
						render_left -= 1.0 / render_hz
						if actor.current_speed > 0.5 and actor.remaining_distance() > 1.0:
							moving_renders += 1
							check(actor.animation_controller.active_state == &"RUN", "%s x%d @%dHz moving render stays RUN" % [provider, int(scale_value), int(render_hz)])
				check(moving_renders > 5, "Each timing case observes multiple moving render frames")
				check(absf(m.clock.elapsed - clock_before - scale_value) < 0.00001, "Render cadence does not alter simulation time")
				timing.append({"provider": provider, "scale": scale_value, "render_hz": render_hz, "distance": start.distance_to(actor.position), "moving_renders": moving_renders, "rate": actor.animation_controller.playback_rate})
				m.time_scale = 0.0
				var paused_position: Vector3 = actor.position
				var paused_phase: float = actor.animation_controller.playback.get_current_play_position()
				m._physics_process(0.9)
				actor.animation_controller._process(0.6)
				check(actor.position == paused_position and is_equal_approx(paused_phase, actor.animation_controller.playback.get_current_play_position()), "Pause freezes position and animation phase")
				m.time_scale = scale_value
				m.command_stop()
				for frame: int in 60:
					m._physics_process(1.0 / 60.0)
					actor.animation_controller._process(1.0 / 60.0)
				check(actor.current_speed == 0.0 and actor.animation_controller.active_state == &"IDLE", "Resume and stop return to Idle")
		m.set_physics_process(false)
		app.free()
		await process_frame
	DirAccess.make_dir_recursive_absolute("res://test-output/animation-runtime-contract")
	FileAccess.open("res://test-output/animation-runtime-contract/report.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "coverage": coverage, "timing": timing}, "\t"))
	print("ANIMATION RUNTIME CONTRACT: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func bone_pose(skeleton: Skeleton3D) -> Array[Transform3D]:
	var result: Array[Transform3D] = []
	for i: int in skeleton.get_bone_count():
		result.append(skeleton.get_bone_pose(i))
	return result

func pose_difference(a: Array[Transform3D], b: Array[Transform3D]) -> float:
	var difference: float = 0.0
	for i: int in a.size():
		difference = maxf(difference, a[i].origin.distance_to(b[i].origin))
		# Compare stored transforms directly; quaternion angle can be nonzero for identical non-unit conversions.
		difference = maxf(difference, a[i].basis.x.distance_to(b[i].basis.x))
		difference = maxf(difference, a[i].basis.y.distance_to(b[i].basis.y))
		difference = maxf(difference, a[i].basis.z.distance_to(b[i].basis.z))
	return difference
