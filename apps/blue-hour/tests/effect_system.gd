extends SceneTree

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Mission = preload("res://missions/mission.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Store = preload("res://core/save_store.gd")

var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)

func near(actual: float, expected: float, label: String) -> void:
	check(is_equal_approx(actual, expected), "%s (%.5f / %.5f)" % [label, actual, expected])

func run() -> void:
	var content: RefCounted = Catalog.new()
	check(content.passives.size() == 8, "Eight official passive items are registered")
	check(content.powers.size() == 6, "Six official special powers are registered")
	var game: RefCounted = Campaign.new(content)
	check(game.has_method("grant_effect") and game.has_method("upgrade_effect"), "Run supports multiple owned effects and one upgrade")
	if not failures.is_empty():
		_finish()
		return
	_check_content(content)
	_check_storage(content)
	for upgraded: bool in [false, true]:
		_check_combat(upgraded)
		_check_search(upgraded)
		_check_watch(upgraded)
		_check_clock_and_heal(upgraded)
		_check_rewards(upgraded)
		await process_frame
	await create_timer(0.15).timeout
	_finish()

func _check_content(content: RefCounted) -> void:
	var expected: Dictionary = {
		"shooting_target": ["combat", {"ranged_damage": 1.25}, {"ranged_damage": 1.4}, 0, 0],
		"spare_magazine": ["combat", {"ranged_attack_speed": 1.18}, {"ranged_attack_speed": 1.3}, 0, 0],
		"armor_plate": ["combat", {"incoming_damage": 0.82}, {"incoming_damage": 0.72}, 0, 0],
		"replicator": ["scavenge", {"weapon_copy_chance": 0.4}, {"weapon_copy_chance": 0.65}, 0, 0],
		"tool_belt": ["scavenge", {"search_time": 0.7}, {"search_time": 0.55}, 0, 0],
		"folding_cart": ["scavenge", {"resource_yield": 1.35, "move_speed": 0.92}, {"resource_yield": 1.5, "move_speed": 0.95}, 0, 0],
		"early_start": ["survey", {"day_extension": 20.0}, {"day_extension": 35.0}, 0, 0],
		"old_watch": ["survey", {"warning_seconds": 30.0, "return_speed": 1.12}, {"warning_seconds": 45.0, "return_speed": 1.18}, 0, 0],
		"rage": ["combat", {"damage": 2.0}, {"damage": 2.0}, 8, 12],
		"focus_fire": ["combat", {"focus_damage": 1.5}, {"focus_damage": 1.7}, 10, 14],
		"sprint": ["scavenge", {"move_speed": 1.5}, {"move_speed": 1.5}, 10, 15],
		"scavenge_frenzy": ["scavenge", {"search_time": 0.3}, {"search_time": 0.15}, 12, 18],
		"aid": ["survey", {"heal_fraction": 0.4}, {"heal_fraction": 0.6}, 0, 0],
		"dusk_delay": ["survey", {"freeze_day_clock": 1.0}, {"freeze_day_clock": 1.0}, 12, 18],
	}
	for effect: Resource in content.passives + content.powers:
		check(expected.has(effect.id), "Only official effects registered: " + effect.id)
		if not expected.has(effect.id):
			continue
		var row: Array = expected[effect.id]
		check(effect.specialization == row[0], "Specialization: " + effect.id)
		check(effect.normal_modifiers == row[1] and effect.upgraded_modifiers == row[2], "Exact normal/upgraded values: " + effect.id)
		near(effect.duration, row[3], "Normal duration: " + effect.id)
		near(effect.upgraded_duration, row[4], "Upgraded duration: " + effect.id)
		check(effect.icon != null and effect.icon.get_size() == Vector2(100, 100), "100px icon loaded: " + effect.id)
		var upgraded: Resource = effect.at_upgrade(true)
		check(upgraded != effect and upgraded.is_upgraded and not effect.is_upgraded, "Upgrade is run-local: " + effect.id)
		check(upgraded.modifiers() == row[2] and upgraded.description() == effect.upgraded_description, "Upgrade resolves effects and text together: " + effect.id)
	check(content.validate().is_empty(), "All registered definitions pass validation")
	var invalid: Resource = content.passives[0].duplicate(true)
	invalid.normal_modifiers = {"move_speed": -1.0}
	check(not invalid.validation_errors().is_empty(), "Negative modifiers rejected")
	invalid.normal_modifiers = {"unknown_stat": 1.0}
	check(not invalid.validation_errors().is_empty(), "Unknown modifier rejected")
	invalid.normal_modifiers = {"ranged_damage": INF}
	check(not invalid.validation_errors().is_empty(), "Non-finite modifier rejected")

func _check_storage(content: RefCounted) -> void:
	var game: RefCounted = Campaign.new(content)
	game.new_run(772, "combat")
	check(game.data.passive_slots == ["shooting_target"] and game.data.power_slots == ["rage"], "Start still grants exactly one passive and power")
	check(game.grant_effect("passive", "tool_belt"), "Can own an additional cross-specialization passive")
	check(not game.equip_effect("passive", "tool_belt"), "Owning an item does not bypass capacity")
	check(not game.grant_effect("passive", "rage"), "Power cannot be granted as a passive")
	check(not game.grant_effect("power", "reserved_bed"), "Reserved/unknown content cannot be granted")
	for category: String in ["passive", "power"]:
		var definitions: Array = content.passives if category == "passive" else content.powers
		check(game.expand_effect_slots(category, definitions.size() - 1), "Expand slots: " + category)
		for effect: Resource in definitions:
			game.grant_effect(category, effect.id)
			game.equip_effect(category, effect.id)
			check(game.upgrade_effect(category, effect.id), "First upgrade succeeds: " + effect.id)
			var once: Dictionary = game.data.duplicate(true)
			check(not game.upgrade_effect(category, effect.id) and game.data == once, "Second upgrade is rejected without mutation: " + effect.id)
		check(game.equipped_effects(category).size() == definitions.size(), "All slots read, not only first: " + category)
	var snapshot: Dictionary = game.data.duplicate(true)
	var resumed: RefCounted = Campaign.new(content)
	check(resumed.restore(JSON.parse_string(JSON.stringify(snapshot))), "Expanded upgraded loadout survives JSON save/restore")
	check(resumed.data.passive_items == snapshot.passive_items and resumed.data.power_slots == snapshot.power_slots, "Owned upgrade flags and multi-slot order survive")
	check(game.unequip_effect("passive", "shooting_target") and game.effect_definition("passive", "shooting_target").is_upgraded, "Unequip retains ownership and upgrade")
	near(game.passive_modifiers().multiplier("ranged_damage"), 1.0, "Unequipped passive stops contributing")
	check(game.equip_effect("passive", "shooting_target"), "Upgraded item can be re-equipped")
	for field: String in ["passive", "power"]:
		var bad: Dictionary = snapshot.duplicate(true)
		bad[field + "_slots"].append(bad[field + "_slots"][0])
		check(not game.valid_state(bad), "Reject duplicate equipped IDs: " + field)
		bad = snapshot.duplicate(true)
		bad[field + "_capacity"] = 1.5
		check(not game.valid_state(bad), "Reject fractional capacity: " + field)
		bad = snapshot.duplicate(true)
		bad[field + "_items"][bad[field + "_slots"][0]].upgraded = 2
		check(not game.valid_state(bad), "Reject non-boolean upgrade: " + field)
		bad = snapshot.duplicate(true)
		bad[field + "_slots"][0] = "unknown"
		check(not game.valid_state(bad), "Reject unknown equipped ID: " + field)
	game.new_run(773, "survey")
	var v2: Dictionary = game.data.duplicate(true)
	v2.version = 2
	for category: String in ["passive", "power"]:
		v2.erase(category + "_items")
		v2.erase(category + "_capacity")
	var old_bytes := JSON.stringify(v2)
	check(resumed.restore(v2) and resumed.data.version == 3, "v2 migrates to v3")
	check(JSON.stringify(v2) == old_bytes and resumed.data.members == v2.members and resumed.data.inventory == v2.inventory, "Migration preserves source bytes, members and weapons")
	check(not resumed.effect_definition("power", "aid").is_upgraded, "Legacy starter retains normal state")
	var store: RefCounted = Store.new("user://test-runs/effect-v2-%d.json" % Time.get_ticks_usec())
	check(store.write(v2, resumed.valid_state).is_empty(), "Write isolated v2 fixture")
	var original_file := FileAccess.get_file_as_string(store.path)
	check(store.write(resumed.data, resumed.valid_state).is_empty(), "Save migrated state")
	check(FileAccess.get_file_as_string(store.path + ".v2.bak") == original_file, "First v3 write keeps exact v2 backup")
	check(game.start_action(), "Begin action for state boundary")
	check(not game.upgrade_effect("power", "aid") and not game.expand_effect_slots("power"), "Active mission cannot upgrade or change capacity")

func _sortie(passives: Array, powers: Array, upgraded: bool = false) -> Node3D:
	var content: RefCounted = Catalog.new()
	var game: RefCounted = Campaign.new(content)
	game.new_run(772, "", ["lin", "qiao", "yan"])
	for category: String in ["passive", "power"]:
		var ids: Array = passives if category == "passive" else powers
		if ids.size() > 1:
			game.expand_effect_slots(category, ids.size() - 1)
		for id: String in ids:
			game.grant_effect(category, id)
			game.equip_effect(category, id)
			if upgraded:
				game.upgrade_effect(category, id)
	game.start_action()
	var mission: Node3D = Mission.new()
	root.add_child(mission)
	var loadout: Array[String] = []
	mission.setup(content, Ledger.new(), loadout, 0, game)
	mission.completed.connect(game.stage_result)
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	return mission

func _check_combat(upgraded: bool) -> void:
	var mission := _sortie(["shooting_target", "spare_magazine", "armor_plate"], ["rage", "focus_fire", "sprint"], upgraded)
	var member: Node3D = mission.survivors[0]
	member.position = Vector3(0, 0, 10)
	for actor: Node3D in mission.survivors:
		actor.position = member.position
	var enemy: Node3D = mission.spawn_enemy("shambler", Vector3(0, 0, 6))
	enemy.hp = 10000
	var base: float = member.weapon.damage * member.talent.damage_multiplier
	var damage_bonus := 1.4 if upgraded else 1.25
	near(mission.damage_to(member, enemy), base * damage_bonus, "Ranged passive damage")
	var before: float = enemy.hp
	mission.attack(member, enemy)
	near(before - enemy.hp, base * damage_bonus, "Automatic attack consumes unified damage")
	before = enemy.hp
	load("res://survivors/aim_fire.gd").fire(member, mission, enemy.position)
	near(before - enemy.hp, base * damage_bonus, "Directed fire consumes the same damage")
	member.cooldown = 0
	member.tick(0.001, mission)
	near(member.cooldown, member.weapon.cooldown / (1.3 if upgraded else 1.18), "Ranged rate modifies shot interval")
	member.cooldown = 0
	member.ammo = 0
	member.tick(0.001, mission)
	near(member.reload_left, member.weapon.reload_seconds, "Magazine passive does not alter reload")
	var hp: float = member.hp
	member.take_damage(20)
	near(hp - member.hp, 20 * member.talent.incoming_damage_multiplier * (0.72 if upgraded else 0.82), "Armor modifies final received damage once")
	mission.debug_equip(0, mission.catalog.by_id(mission.catalog.weapons, "crowbar"))
	base = member.weapon.damage * member.talent.damage_multiplier
	near(mission.damage_to(member, enemy), base, "Ranged damage excludes melee")
	near(mission.effects.attack_interval(member.weapon.cooldown, true), member.weapon.cooldown, "Ranged speed excludes melee")
	check(mission.powers.activate("rage") and mission.powers.activate("sprint"), "Different powers can overlap")
	near(mission.damage_to(member, enemy), base * 2, "Rage includes melee")
	var elite: Node3D = mission.spawn_enemy("siren", Vector3(0, 0, 3))
	elite.hp = 10000
	check(mission.powers.activate("focus_fire"), "Activate focus independently")
	check(mission.powers.target() == elite, "Elite outranks nearer ordinary enemy")
	var boss: Node3D = mission.spawn_enemy("runner", Vector3(0, 0, 1))
	boss.data = boss.data.duplicate()
	boss.data.threat_rank = 2
	boss.hp = 10000
	mission.powers.refresh_target()
	check(mission.powers.target() == boss, "Boss outranks Elite")
	boss.active = false
	check(mission.powers.target() == elite, "Dead target is replaced immediately")
	mission.debug_equip(0, mission.catalog.by_id(mission.catalog.weapons, "pistol"))
	base = member.weapon.damage * member.talent.damage_multiplier
	check(mission.choose_target(member) == elite, "Auto-fire prioritizes the designated target in range")
	near(mission.damage_to(member, elite), base * damage_bonus * 2 * (1.7 if upgraded else 1.5), "Focus bonus stacks with rage and ranged passive")
	near(mission.damage_to(member, enemy), base * damage_bonus * 2, "Other targets do not receive focus bonus")
	before = elite.hp
	load("res://survivors/aim_fire.gd").fire(member, mission, elite.position)
	# Ordinary enemy blocks this hitscan first; it must still use its own damage multiplier.
	near(before - elite.hp, 0, "Directed fire respects intervening targets")
	enemy.active = false
	before = elite.hp
	load("res://survivors/aim_fire.gd").fire(member, mission, elite.position)
	near(before - elite.hp, base * damage_bonus * 2 * (1.7 if upgraded else 1.5), "Directed hit on focus target gains focus bonus")
	mission.powers.advance(12 if upgraded else 8)
	near(mission.effects.multiplier("damage"), 1, "Rage expires independently")
	near(mission.effects.multiplier("move_speed"), 1.5, "Sprint survives rage expiry")
	check(not mission.powers.activate("rage"), "Expired power cannot be used twice that day")
	mission.powers.advance(20)
	near(mission.effects.multiplier("move_speed"), 1, "Movement restores without rewriting templates")
	near(mission.effects.multiplier("ranged_damage"), damage_bonus, "Passive survives all temporary expiry")
	check(not mission.powers.start_day(mission.campaign.data.day, mission.campaign.equipped_effects("power")), "Same-day refresh cannot recharge powers")
	mission._finish(false)
	check(mission.campaign.commit_day(), "Effects sortie reaches real day settlement")
	var next: Node3D = Mission.new()
	root.add_child(next)
	var empty: Array[String] = []
	next.setup(mission.catalog, Ledger.new(), empty, 0, mission.campaign)
	check(next.powers.states.values().all(func(state: RefCounted) -> bool: return not state.used_today and not state.active), "Next mission refreshes all equipped powers together")
	next.free()
	mission.free()

func _check_search(upgraded: bool) -> void:
	var mission := _sortie(["tool_belt", "folding_cart"], ["scavenge_frenzy"], upgraded)
	var belt := 0.55 if upgraded else 0.7
	var frenzy := 0.15 if upgraded else 0.3
	for index: int in range(2):
		var id: String = ["corner", "garage"][index]
		mission.survivors[index].position = mission.city.sites[id].spec.entry
		mission.command_search(id)
	check(mission.powers.activate(), "Search frenzy activates")
	mission._physics_process(1)
	for id: String in ["corner", "garage"]:
		var site: Dictionary = mission.city.sites[id]
		var worker: Node3D = mission.search_tasks[id].worker
		var expected: float = site.spec.search_seconds / worker.talent.search_multiplier * belt * frenzy
		near(site.progress, 1.0 / expected, "Parallel worker uses multiplicative search time: " + id)
	mission.effects.set_source("minimum_fixture", {"search_time": 0.000001})
	near(mission.effects.search_seconds(46), 0.2, "Search duration has a positive 0.2 second floor")
	mission.effects.remove_source("minimum_fixture")
	mission.powers.advance(18 if upgraded else 12)
	near(mission.effects.search_seconds(10), 10 * belt, "Frenzy expiry leaves belt modifier intact")
	var member: Node3D = mission.survivors[2]
	near(mission.movement_speed(member, member.position + Vector3.FORWARD, 0.1), member.data.move_speed * (0.95 if upgraded else 0.92), "Cart applies movement penalty")
	var weapon := {"uid":"fixture-weapon", "kind":"shotgun", "affix":"weighted"}
	mission.drop_loot(member.position, 20, 20, weapon)
	mission._update_pickups()
	check(mission.ledger.food == (30 if upgraded else 27) and mission.ledger.scrap == (30 if upgraded else 27), "Cart affects stackable resources only")
	check(mission.ledger.weapons.size() == 1 and mission.ledger.weapons[0] == weapon, "Cart never copies a weapon identity")
	mission._update_pickups()
	check(mission.ledger.weapons.size() == 1, "Pickup cannot be collected twice")
	var ledger: RefCounted = Ledger.new()
	ledger.begin()
	for index: int in range(20):
		ledger.collect_resources(1, 1, 1.5 if upgraded else 1.35)
	check(ledger.food == (30 if upgraded else 27), "Small drops carry fractions instead of losing yield")
	ledger.begin()
	near(ledger.resource_remainders.x, 0, "Fraction carry resets each action")
	mission.command_extract()
	for actor: Node3D in mission.survivors:
		actor.position = mission.catalog.map.bus_position
		actor.stop()
	mission._update_extraction(1)
	near(mission.extraction_left, mission.catalog.map.extraction_seconds - 1, "Search modifiers do not change boarding timer")
	mission.free()

func _check_watch(upgraded: bool) -> void:
	var mission := _sortie(["old_watch", "early_start"], [], upgraded)
	var window := 45.0 if upgraded else 30.0
	var boost := 1.18 if upgraded else 1.12
	near(mission.clock.settings.day_seconds - mission.catalog.map.day_seconds, 35 if upgraded else 20, "Coffee extends daylight only")
	near(mission.clock.settings.blue_seconds, mission.catalog.map.blue_seconds, "Coffee leaves blue-hour duration intact")
	mission.clock.advance(mission.clock.settings.day_seconds - window - 1)
	check(not mission.watch_warning_active, "Watch idle before threshold")
	var changes: Array[bool] = []
	mission.watch_warning_changed.connect(func(value: bool): changes.append(value))
	mission._physics_process(1)
	check(mission.watch_warning_active and changes == [true], "Watch threshold exposes state and one signal")
	var member: Node3D = mission.survivors[0]
	var origin: Vector3 = mission.catalog.map.bus_position + Vector3(0, 0, -15)
	member.position = origin
	var speed: float = member.data.move_speed
	near(mission.movement_speed(member, origin + Vector3(0, 0, 8), 0.1), speed * boost, "Approaching evacuation gains speed")
	near(mission.movement_speed(member, origin + Vector3(0, 0, -8), 0.1), speed, "Moving away never gains speed")
	near(mission.movement_speed(member, origin + Vector3(8, 0, 0), 0.1), speed, "Transverse movement never gains speed")
	member.stop()
	member.tick(0.1, mission)
	check(member.position == origin, "Stationary watch cannot move the character")
	member.path = PackedVector3Array([origin + Vector3(0, 0, 8)])
	member.tick(0.1, mission)
	near(member.position.distance_to(origin), speed * boost * 0.1, "Actual path movement consumes watch speed")
	member.position = origin
	member.path = PackedVector3Array([origin + Vector3(0, 0, -2), mission.catalog.map.bus_position])
	member.tick(0.1, mission)
	near(member.position.distance_to(origin), speed * 0.1, "Detour away from bus gets no boost despite final destination")
	mission.clock.set_phase(mission.clock.BLUE_HOUR)
	mission._physics_process(0.01)
	check(not mission.watch_warning_active and changes == [true, false], "Warning ends at blue hour and signals once")
	mission.free()

func _check_clock_and_heal(upgraded: bool) -> void:
	var mission := _sortie([], ["dusk_delay", "sprint", "aid", "scavenge_frenzy"], upgraded)
	var duration := 18.0 if upgraded else 12.0
	var worker: Node3D = mission.survivors[0]
	worker.position = mission.city.sites.corner.spec.entry
	mission.command_search("corner")
	var mover: Node3D = mission.survivors[1]
	mover.position = Vector3(0, 0, 10)
	mover.path = PackedVector3Array([Vector3(0, 0, 18)])
	mover.ammo = 0
	mover.reload_left = 2
	var enemy: Node3D = mission.spawn_enemy("shambler", Vector3(3, 0, 10))
	enemy.hp = 10000
	check(mission.powers.activate("dusk_delay") and mission.powers.activate("sprint") and mission.powers.activate("scavenge_frenzy"), "Clock freeze overlaps other powers")
	var start_clock: float = mission.clock.elapsed
	var start_position: Vector3 = mover.position
	mission._physics_process(1)
	near(mission.clock.elapsed, start_clock, "Only phase countdown freezes")
	near(mission.action_elapsed, 1, "Real action time continues during freeze")
	check(mover.position != start_position and mover.reload_left == 1, "Movement and reload continue during freeze")
	check(mission.city.sites.corner.progress > 0, "Search continues during freeze")
	check(enemy.position != Vector3(3, 0, 10) or enemy.hp < 10000, "Enemy simulation/combat continues during freeze")
	near(mission.powers.states.dusk_delay.remaining_duration, duration - 1, "Power duration uses world time")
	mission.time_scale = 0
	var paused_position: Vector3 = mover.position
	var paused_progress: float = mission.city.sites.corner.progress
	mission._physics_process(5)
	near(mission.powers.states.dusk_delay.remaining_duration, duration - 1, "Tactical pause freezes active duration")
	check(mover.position == paused_position and mission.city.sites.corner.progress == paused_progress, "Tactical pause freezes the world")
	worker.hp = 1
	mover.hp = mover.data.max_hp - 1
	var dead: Node3D = mission.survivors[2]
	dead.take_damage(100000)
	check(mission.powers.activate("aid"), "Healing may be cast in tactical pause")
	near(worker.hp, 1 + worker.data.max_hp * (0.6 if upgraded else 0.4), "Searching member heals exact max-HP fraction")
	near(mover.hp, mover.data.max_hp, "Healing is capped at max HP")
	check(dead.dead and dead.hp == 0, "Healing cannot resurrect")
	check(mission.powers.states.aid.used_today and not mission.powers.states.aid.active, "Instant healing still consumes today's one use")
	mission.time_scale = 1
	mission.debug_clear_enemies()
	mission._physics_process(duration + 1)
	near(mission.clock.elapsed - start_clock, 2, "Large frame resumes countdown only after remaining freeze expires")
	check(not mission.powers.states.dusk_delay.active and mission.powers.states.dusk_delay.used_today, "Freeze expiry does not recharge power")
	mission.free()
	mission = _sortie([], ["dusk_delay"], upgraded)
	mission.clock.set_phase(mission.clock.BLUE_HOUR)
	check(mission.powers.activate(), "Freeze can start in blue hour")
	var before: float = mission.clock.remaining()
	mission._physics_process(duration)
	near(mission.clock.remaining(), before, "Blue-hour countdown frozen for exact duration")
	mission._physics_process(0.25)
	near(mission.clock.remaining(), before - 0.25, "Blue-hour countdown resumes")
	mission.free()
	mission = _sortie([], ["dusk_delay"], upgraded)
	mission.clock.set_phase(mission.clock.NIGHT)
	check(not mission.powers.activate() and not mission.powers.states.dusk_delay.used_today, "Night cast rejected without spending usage")
	mission.free()

func _check_rewards(upgraded: bool) -> void:
	var found := false
	var content: RefCounted = Catalog.new()
	for seed_value: int in range(1, 30):
		var game: RefCounted = Campaign.new(content)
		game.new_run(seed_value, "scavenge")
		if upgraded:
			game.upgrade_effect("passive", "replicator")
		game.data.inventory.append({"uid":"owned-best", "kind":"shotgun", "affix":"longbarrel"})
		game.start_action()
		game.stage_result({"returned_ids":game.data.members.duplicate(), "lost_ids":[], "food":3, "scrap":0, "weapons":[], "wiped":false, "seconds":10, "kills":0})
		var pending: Dictionary = game.data.duplicate(true)
		game.commit_day()
		var copies: Array = game.data.history.back().copied_weapons
		if copies.is_empty():
			continue
		found = true
		check(copies.size() == 1 and copies[0].kind == "shotgun" and copies[0].affix == "longbarrel" and copies[0].uid != "owned-best", "Replicator copies highest-value existing inventory without new loot")
		var resumed: RefCounted = Campaign.new(content)
		check(resumed.restore(pending) and resumed.commit_day(), "Pending reward can be recovered")
		check(resumed.data.inventory == game.data.inventory, "Pending retry cannot reroll copy")
		var once: Dictionary = game.data.duplicate(true)
		check(not game.commit_day() and game.data == once, "Copy settlement commits only once")
		break
	check(found, "Replicator produces a copy")
	var wiped: RefCounted = Campaign.new(content)
	wiped.new_run(772, "scavenge")
	wiped.start_action()
	wiped.stage_result({"returned_ids":[], "lost_ids":wiped.data.members.duplicate(), "food":3, "scrap":3, "weapons":[], "wiped":true, "seconds":10, "kills":0})
	wiped.commit_day()
	check(wiped.data.history.back().copied_weapons.is_empty(), "Wipe never triggers the copy passive")

func _finish() -> void:
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var report := FileAccess.open("res://test-output/effect-system.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("EFFECT SYSTEM: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
