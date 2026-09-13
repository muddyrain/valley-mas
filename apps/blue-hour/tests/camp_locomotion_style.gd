extends SceneTree
## Real Camp navigation and CampActor setup, including its normal 2.7m/s travel.
const Camp = preload("res://scenes/camp/camp_main.tscn")
const Actor = preload("res://camp/camp_actor.gd")
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Registry = preload("res://data/weapon_registry.gd")
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	var catalog := Catalog.new()
	var game := Campaign.new(catalog)
	game.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	var camp := Camp.instantiate() as Node3D
	root.add_child(camp)
	for frame in 8:
		await physics_frame
	var actors: Array[CharacterBody3D] = []
	for i in 2:
		var actor := Actor.new()
		camp.add_child(actor)
		actor.setup(game, game.data.members[i])
		actor.position = Vector3(1.8 + i * .6, .02, 1.65)
		actor.visual.equip(catalog.by_id(catalog.weapons, Registry.A21))
		actors.append(actor)
	for frame in 8:
		await physics_frame
	for actor in actors:
		actor.move_to(actor.position + Vector3(2, 0, 0))
	var moving: Dictionary = {}
	var saved: bool = false
	for frame in 120:
		await physics_frame
		await process_frame
		for actor in actors:
			var controller: Node = actor.visual.animation_controller
			if Vector2(actor.velocity.x, actor.velocity.z).length() > 1.9:
				moving[actor.member_id] = true
				check(controller.current_state == &"Walk", "Actual Camp movement selects Walk: " + actor.member_id)
				check(controller.combat_bridge.combat_weight == 0, "Actual Camp keeps the upper body relaxed")
		if moving.size() == 2 and not saved and DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			DirAccess.make_dir_recursive_absolute("res://test-output/mission-style")
			root.get_texture().get_image().save_png("res://test-output/mission-style/camp-walk.png")
			saved = true
	check(moving.size() == 2, "Both formal Camp actors really moved at their original speed")
	for actor in actors:
		check(actor.visual.animation_controller.current_state == &"Idle", "Camp arrival returns to Idle")
		check(is_equal_approx(actor.move_speed, 2.7), "Camp gameplay speed is unchanged")
	camp.free()
	await process_frame
	print("CAMP LOCOMOTION STYLE: ", checks, " checks, ", failures.size(), " failures")
	quit(0 if failures.is_empty() else 1)
