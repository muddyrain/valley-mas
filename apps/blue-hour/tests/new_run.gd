extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Store = preload("res://core/save_store.gd")
const Mission = preload("res://missions/mission.gd")
const Ledger = preload("res://core/run_ledger.gd")
var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func run() -> void:
	var content = Catalog.new()
	var game = Campaign.new(content)
	game.new_run(420, "combat")
	check(game.data.members.size() == 2, "A new run starts with two members")
	check(game.valid_state(game.data), "New run is serializable")
	var original: Dictionary = game.data.duplicate(true)
	var resumed = Campaign.new(content)
	check(resumed.restore(JSON.parse_string(JSON.stringify(original))), "JSON round trip restores run")
	check(resumed.data.members == original.members and resumed.data.equipment == original.equipment and resumed.data.power_slots == original.power_slots, "Continue never rerolls team or equipment")
	var ids: Array = game.data.members
	check(game.member_template(ids[0]).id != game.member_template(ids[1]).id, "Starter templates do not repeat")
	var id: String = ids[0]
	var old_trait: Resource = game.member_trait(id)
	check(game.train(id), "Food can train a living member at shelter")
	check(game.member_level(id) == 2 and game.data.food == original.food - 1, "Training persists level and exact cost")
	check(game.member_trait(id) != old_trait, "Derived trait never mutates shared resource")
	game.data.food = 0
	var unfunded: Dictionary = game.data.duplicate(true)
	check(not game.train(id) and game.data == unfunded, "Unaffordable training is atomic")
	var bad: Dictionary = original.duplicate(true)
	bad.roster[id].level = 999
	check(not game.valid_state(bad), "Out of range member level is rejected")
	var legacy := {"version":1,"seed":772,"day":1,"status":"shelter","food":6,"scrap":0,"hunger":0,"members":["lin","qiao","yan"],"inventory":[],"equipment":{},"day_rewards":{},"shop":[],"pending":{},"history":[],"modified":false}
	for i in range(3):
		var member: String = legacy.members[i]
		legacy.inventory.append({"uid":"initial:" + member,"kind":content.map.initial_weapons[i],"affix":""})
		legacy.equipment[member] = "initial:" + member
	check(game.valid_state(legacy), "Legacy accepted before restore by SaveStore validator")
	check(game.restore(legacy) and game.data.members == legacy.members, "Migration preserves legacy three members")
	check(game.data.inventory.map(func(v): return v.uid) == legacy.inventory.map(func(v): return v.uid) and game.data.specialization == "", "Migration preserves equipment without gifting a specialization")
	var store = Store.new("user://test-runs/new-run-migration.json")
	check(store.write(legacy, game.valid_state).is_empty(), "Legacy fixture saved")
	check(store.write(game.data, game.valid_state).is_empty(), "Migrated state saved")
	check(FileAccess.file_exists(store.path + ".v1.bak"), "Original schema backup survives migration")
	var copied := false
	for seed_value in range(1, 30):
		game.new_run(seed_value, "scavenge")
		game.start_action()
		game.stage_result({"returned_ids":game.data.members.duplicate(),"lost_ids":[],"food":2,"scrap":0,"weapons":[],"wiped":false,"seconds":30,"kills":0})
		var pending: Dictionary = game.data.duplicate(true)
		game.commit_day()
		if game.data.inventory.size() == 3:
			copied = true
			var once: Dictionary = game.data.duplicate(true)
			check(game.data.inventory[2].uid != game.data.inventory[0].uid and game.data.inventory[2].uid != game.data.inventory[1].uid, "Copy creates a separate weapon identity")
			check(not game.commit_day() and game.data == once, "Settlement cannot duplicate the copy")
			resumed.restore(pending)
			resumed.commit_day()
			check(resumed.data.inventory == once.inventory, "Retrying pending settlement produces identical copy")
			break
	check(copied, "Scavenge passive produces an actual inventory reward")
	for specialization in ["combat", "scavenge", "survey"]:
		game.new_run(420, specialization)
		var mission = Mission.new()
		root.add_child(mission)
		var loadout: Array[String] = []
		mission.setup(content, Ledger.new(), loadout, 0, game)
		mission.director_enabled = false
		mission.debug_clear_enemies()
		mission.set_physics_process(false)
		var member: Node3D = mission.survivors[0]
		var base_damage: float = mission.damage_to(member, null)
		var base_speed: float = member.data.move_speed
		member.hp = 10
		check(mission.powers.activate(), "Special power activates: " + specialization)
		check(not mission.powers.activate(), "Special power is once per action: " + specialization)
		if specialization == "combat":
			check(mission.damage_to(member, null) > base_damage, "Burst changes real damage")
			for actor in mission.survivors:
				var unboosted: Resource = game.member_trait(actor.data.id)
				check(is_equal_approx(mission.damage_to(actor, null), actor.weapon.damage * unboosted.damage_multiplier * 2.0 * (1.0 if actor.weapon.melee else 1.25)), "Burst combines with passive only on ranged weapons")
		elif specialization == "scavenge":
			check(mission.movement_speed(member, member.position + Vector3.FORWARD, 0.1) > base_speed, "Speed power changes movement")
		else:
			check(member.hp > 10, "Global aid heals real members")
			check(mission.clock.settings.day_seconds > content.map.day_seconds, "Survey passive extends only instance day")
		mission.powers.advance(100)
		check(is_equal_approx(mission.damage_to(member, null), base_damage), "Temporary damage clears")
		check(is_equal_approx(mission.movement_speed(member, member.position + Vector3.FORWARD, 0.1), base_speed), "Temporary speed clears")
		if specialization == "combat":
			mission.debug_equip(0, content.by_id(content.weapons, "crowbar"))
			check(is_equal_approx(member.talent.damage_multiplier, game.member_trait(member.data.id).damage_multiplier), "Debug melee switch removes ranged-only passive")
		mission.free()
		await process_frame
	check(content.validate().is_empty(), "Content remains valid and reusable")
	await create_timer(0.1).timeout
	print("NEW RUN: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
