extends SceneTree
## Run against the exported embedded pack, never the workspace resource loader.
const Survivor = preload("res://survivors/survivor.gd")
const Catalog = preload("res://data/catalog.gd")
const PUBLIC = preload("res://assets/animations/public_locomotion/public_locomotion.tres")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, label: String) -> void:
	checks += 1
	if not ok:
		failures.append(label)
		printerr(label)

func run() -> void:
	var catalog := Catalog.new()
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		check(not ResourceLoader.exists("res://assets/characters/" + id + "/source/" + id + ".glb"), "Obsolete source not shipped: " + id)
		check(not ResourceLoader.exists("res://assets/characters/" + id + "/animations/idle.tres"), "Personal locomotion not shipped: " + id)
		var actor := Survivor.new()
		root.add_child(actor)
		actor.setup(load("res://data/survivors/" + id + ".tres"), catalog.traits[0], null)
		var c: Node3D = actor.animation_controller
		check(c.target.get_bone_count() == 23, "Pack canonical bones: " + id)
		check(c.player.get_animation_library(&"Public") == PUBLIC, "Pack shared library: " + id)
		check(is_equal_approx(actor.data.move_speed, 2.8), "Pack speed: " + id)
		check(actor.find_children("*", "RetargetModifier3D", true, false).is_empty(), "Pack no retarget: " + id)
		for i: int in 30:
			c.update_motion(2.8, 2.8, 1.0 / 60)
			await process_frame
		check(c.current_state == &"Run" and absf(c.playback_rate - 1.230103) < .00001, "Pack public Run playback: " + id)
		actor.queue_free()
		await process_frame
	print("SURVIVOR PRODUCTION PACK: ", checks, " checks; ", failures)
	quit(0 if failures.is_empty() else 1)
