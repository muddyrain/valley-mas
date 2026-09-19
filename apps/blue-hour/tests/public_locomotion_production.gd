extends SceneTree
## Production resource identity, frozen rig, movement clock and weapon boundaries.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const Controller = preload("res://survivors/survivor_animation_controller.gd")
const PUBLIC = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
const Registry = preload("res://data/weapon_registry.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	checks += 1
	if not ok and not failures.has(label):
		failures.append(label)
		printerr(label)

func run() -> void:
	var catalog := Catalog.new()
	var frozen: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://tests/fixtures/canonical_survivor_rest.json"))
	check(FileAccess.get_sha256("res://art/blender/rigs/BH_Humanoid_Rig_v1.blend") == frozen.rig_sha256, "Frozen Blender rig hash")
	var actors: Array[Node3D] = []
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		var actor := Survivor.new()
		root.add_child(actor)
		actor.setup(load("res://data/survivors/" + id + ".tres"), catalog.traits[0], null)
		actors.append(actor)
		var c: Node3D = actor.animation_controller
		check(c != null, id + " has animation controller")
		if c == null:
			continue
		check(is_equal_approx(actor.data.move_speed, 2.8), id + " speed 2.8")
		check(c.player.has_animation_library(&"Public"), id + " direct public library")
		if not c.player.has_animation_library(&"Public"):
			continue
		check(c.player.get_animation_library(&"Public") == PUBLIC, id + " shared library identity")
		check(c.source == c.target, id + " one native skeleton")
		var s: Skeleton3D = c.target
		check(s.get_bone_count() == 23, id + " 23 bones")
		for expected_bone: Dictionary in frozen.bones:
			var b := s.find_bone(expected_bone.name)
			check(b >= 0, id + " bone " + expected_bone.name)
			if b < 0:
				continue
			var p := s.get_bone_parent(b)
			var fp: int = expected_bone.parent
			check((s.get_bone_name(p) if p >= 0 else "") == (frozen.bones[fp].name if fp >= 0 else ""), id + " hierarchy " + str(b))
			var m: Array = expected_bone.rest
			var expected := Transform3D(Basis(Vector3(m[0][0], m[1][0], m[2][0]), Vector3(m[0][1], m[1][1], m[2][1]), Vector3(m[0][2], m[1][2], m[2][2])), Vector3(m[0][3], m[1][3], m[2][3]))
			check(s.get_bone_rest(b).is_equal_approx(expected), id + " frozen rest " + str(b))
		check(s.scale.is_equal_approx(Vector3.ONE), id + " skeleton scale")
		check(actor.rig.position.is_zero_approx() and actor.rig.scale.is_equal_approx(Vector3.ONE), id + " no visual offset")
		check(actor.find_children("*", "RetargetModifier3D", true, false).is_empty(), id + " no runtime retarget")
		for name: StringName in PUBLIC.get_animation_list():
			check(c.player.get_animation(&"Public/" + name) == PUBLIC.get_animation(name), id + " same clip " + name)
			var clip := PUBLIC.get_animation(name)
			check(clip.loop_mode == Animation.LOOP_LINEAR, str(name) + " loops")
			for track: int in clip.get_track_count():
				var path := clip.track_get_path(track)
				check(c.player.get_node(c.player.root_node).get_node(NodePath(path.get_concatenated_names())) == s, id + " native track target")
				var a: Variant = clip.track_get_key_value(track, 0)
				var z: Variant = clip.track_get_key_value(track, clip.track_get_key_count(track) - 1)
				if a is Quaternion:
					check(a.angle_to(z) < .0015, str(name) + " rotation loop")
				elif a is Vector3:
					check(a.distance_to(z) < .00002, str(name) + " position loop")
		for speed: float in [0.0, 1.24486, 2.8, 1.24486, 0.0]:
			for frame: int in 24:
				c.update_motion(speed, 2.8, 1.0 / 60)
				await process_frame
			var expected: StringName = &"Idle" if speed == 0.0 else &"Walk" if speed < 1.85 else &"Run"
			check(c.current_state == expected and c.playback.get_current_node() == expected, id + " state " + expected)
			var rate := 1.0 if speed == 0.0 else speed / (1.24486 if expected == &"Walk" else 2.27623)
			check(absf(c.playback_rate - rate) < .00001, id + " exact speed ratio")
		var before: float = c.playback.get_current_play_position()
		c.update_motion(2.8, 2.8, 0.0)
		check(is_equal_approx(before, c.playback.get_current_play_position()), id + " pause")
		c.set_enabled(false)
		c.update_motion(2.8, 2.8, .1)
		check(is_equal_approx(before, c.playback.get_current_play_position()), id + " disabled clock")
		c.set_enabled(true)
		actor.equip(catalog.by_id(catalog.weapons, Registry.A21))
		c.combat_bridge.set_gameplay_state(true, true, Vector3(0, 0, -10), actor.position)
		for frame: int in 30:
			c.update_motion(2.8, 2.8, 1.0 / 60)
			await process_frame
		check(c.current_state == &"Run", id + " armed uses public Run")
		check(actor.weapon_visual.socket.bone_name == &"RightHand", id + " RightHand socket")
		check(actor.weapon_visual.socket.global_position.distance_to(actor.position) > .5, id + " socket not world origin")
		check(actor.weapon_visual.get_muzzle_point() != null, id + " weapon owns muzzle")
		check(actor.weapon_visual.get_muzzle_point().global_transform.is_finite(), id + " finite muzzle")
		c.use_camp_style()
		for frame: int in 24:
			c.update_motion(2.7, 2.8, 1.0 / 60)
			await process_frame
		check(c.current_state == &"Walk", id + " Camp walking context")
		check(c.combat_bridge.combat_weight == 0.0, id + " Camp relaxed upper body")
	var report := {"checks": checks, "failures": failures}
	DirAccess.make_dir_recursive_absolute("res://test-output/survivor-production")
	FileAccess.open("res://test-output/survivor-production/contract.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	for actor: Node3D in actors:
		actor.queue_free()
	await process_frame
	print("PUBLIC LOCOMOTION PRODUCTION: ", checks, " checks; ", failures)
	quit(0 if failures.is_empty() else 1)
