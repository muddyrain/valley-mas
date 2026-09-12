extends SceneTree
const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const Registry = preload("res://data/weapon_registry.gd")
const Instance = preload("res://weapons/weapon_instance.gd")
const Combat = preload("res://weapons/weapon_combat_controller.gd")
const Modifiers = preload("res://weapons/weapon_modifiers.gd")
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

func near(actual: float, expected: float, label: String) -> void:
	check(is_equal_approx(actual, expected), label + " (%s / %s)" % [actual, expected])

func run() -> void:
	var content := Catalog.new()
	check(content.weapons.size() == 8 and content.validate().is_empty(), "Eight valid formal definitions")
	var expected := [
		[28, 1.6, 1.65, 0, 0, 1.0, 0.0, 1, 0, 1],
		[18, 2.0, 14, 15, 1.5, 0.88, 0.0, 1, 0, 0],
		[34, 1.15, 15, 6, 2.1, 0.92, 0.0, 1, 0, 2],
		[7, 6.5, 12, 30, 1.8, 0.76, -0.02, 1, 0, 0],
		[7, 0.9, 8, 6, 2.6, 0.7, -0.04, 7, 0, 3],
		[13, 4.5, 18, 30, 2.0, 0.85, -0.04, 1, 0, 0],
		[58, 0.72, 25, 5, 2.5, 0.97, -0.05, 1, 1, 2],
		[10, 6, 17, 60, 3.6, 0.79, -0.08, 1, 0, 0]
	]
	var stats := ["damage", "attack_rate", "range", "magazine_size", "reload_time", "accuracy", "move_speed_modifier", "pellet_count", "penetration", "knockback"]
	for i in range(8):
		var definition: Resource = content.weapons[i]
		for j in range(stats.size()):
			near(float(definition.get(stats[j])), float(expected[i][j]), definition.id + " " + stats[j])
		var texture: Texture2D = definition.icon()
		check(texture != null and texture.get_size() == Vector2(200, 200), "Correct icon " + definition.id)
		check(texture.get_image().detect_alpha() != Image.ALPHA_NONE, "Transparent icon " + definition.id)
		if definition.id in [Registry.KNIFE, Registry.P9, Registry.A21]:
			check(ResourceLoader.exists(definition.model_path, "PackedScene"), "Formal model " + definition.id)
		else:
			check(definition.model_path.is_empty(), "Empty model allowed " + definition.id)
		check(definition.weapon_type == definition.animation_profile, "Profile metadata " + definition.id)
	var game := Campaign.new(content)
	game.new_run(52)
	for member: String in game.data.members:
		var template: String = game.member_template(member).id
		check(game.get_equipped_weapon(member).weapon_definition_id == (Registry.KNIFE if template == "su_wanxing" else Registry.P9), "Starter equipment " + template)
	var rng := RandomNumberGenerator.new()
	rng.seed = 72
	for quality in range(4):
		for definition: Resource in content.weapons:
			var instance: WeaponInstance = game.gear.create(definition.id, "quality:%d:%s" % [quality, definition.id], rng, quality)
			check(instance.modifiers.size() == quality, "Quality modifier count")
			check(game.weapon_inventory.add_weapon(instance), "Acquire real instance")
			check(not game.weapon_inventory.add_weapon(instance), "Reject duplicate instance")
			var derived: Resource = game.weapon(instance.instance_id)
			check(derived != definition and derived.rarity == quality, "Derived definition isolated")
	var original: Resource = content.by_id(content.weapons, Registry.P9)
	for id: String in Modifiers.RULES:
		var instance := Instance.from_dict({"uid": id, "kind": Registry.P9, "rarity": 1, "modifiers": [id]})
		var modified: Resource = game.gear.resource(instance.to_dict())
		var rule: Dictionary = Modifiers.RULES[id]
		var value: float = float(original.get(rule.stat)) * rule.factor
		near(float(modified.get(rule.stat)), ceili(value) if rule.stat == "magazine_size" else minf(1, value) if rule.stat == "accuracy" else value, id)
	near(original.damage, 18, "Shared template never modified")
	var a: String = game.data.members[0]
	var b: String = game.data.members[1]
	var a_uid: String = game.data.equipment[a]
	var b_uid: String = game.data.equipment[b]
	check(game.equip_weapon(b, a_uid), "Transfer to another survivor")
	check(game.data.equipment[a] == "" and game.data.equipment[b] == a_uid, "One holder; displaced weapon returns to stock")
	check(game.weapon_inventory.has_weapon(b_uid) and b_uid in game.weapon_inventory.get_all_weapons(true).map(func(v: WeaponInstance) -> String: return v.instance_id), "Old weapon available")
	check(not game.weapon_inventory.remove_weapon(a_uid), "Cannot delete equipped weapon")
	check(game.unequip_weapon(b) and game.get_equipped_weapon(b) == null, "Unequip")
	check(game.weapon_inventory.remove_weapon(a_uid) and not game.weapon_inventory.has_weapon(a_uid), "Remove available instance")
	check(not game.equip_weapon(a, "missing"), "Unknown instance rejected")
	var saved: Dictionary = JSON.parse_string(JSON.stringify(game.data))
	var restored := Campaign.new(content)
	check(restored.restore(saved) and restored.data.equipment == game.data.equipment, "Restore empty slots")
	game.equip_weapon(a, b_uid)
	var store := Store.new("user://test-runs/weapons-v4.json")
	check(store.write(game.data, game.valid_state).is_empty(), "Save equipment")
	var readback: Dictionary = store.read(game.valid_state)
	check(readback.ok and restored.restore(readback.data), "Load weapon save")
	check(restored.get_equipped_weapon(a).instance_id == b_uid, "Restore equipped identity")
	check(restored.data.inventory == game.data.inventory, "Restore quality and modifiers")
	var legacy: Dictionary = game.data.duplicate(true)
	legacy.version = 3
	legacy.inventory = [{"uid": "old-pistol", "kind": "pistol", "affix": "extended"}]
	for id: String in legacy.members:
		legacy.equipment[id] = ""
	legacy.equipment[a] = "old-pistol"
	check(restored.restore(legacy), "v3 Demo save migrates")
	check(restored.weapon("old-pistol").id == Registry.P9 and restored.weapon("old-pistol").magazine_size == 21, "Legacy ID and affix preserved")
	check(restored.data.version == 4 and restored.data.inventory[0].rarity == 1, "Schema upgrade")
	var migration_store := Store.new("user://test-runs/weapons-v3-backup.json")
	check(migration_store.write(legacy, restored.valid_state).is_empty(), "Save v3 migration fixture")
	check(migration_store.write(restored.data, restored.valid_state).is_empty(), "Write upgraded v4 with original backup")
	check(FileAccess.file_exists(migration_store.path + ".v3.bak"), "Original v3 backup exists")
	var old_backup: Dictionary = migration_store._read_file(migration_store.path + ".v3.bak")
	check(old_backup.version == 3 and old_backup.inventory[0].kind == "pistol", "Backup retains original Demo ID")
	var bad: Dictionary = game.data.duplicate(true)
	bad.equipment[b] = b_uid
	check(not game.valid_state(bad), "Corrupted duplicate equipment rejected")
	bad = game.data.duplicate(true)
	bad.inventory[0].modifiers = ["UNKNOWN"]
	check(not game.valid_state(bad), "Unknown modifier rejected")

	var mission := Mission.new()
	root.add_child(mission)
	mission.setup(content, Ledger.new(), [Registry.P9], 42)
	mission.set_physics_process(false)
	mission.set_process(false)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var member: Node3D = mission.survivors[0]
	member.position = Vector3(0, 0, 10)
	member.talent.damage_multiplier = 1.0
	for id: String in [Registry.P9, Registry.R6, Registry.K9, Registry.L56]:
		member.equip(content.by_id(content.weapons, id))
		for shot in range(member.weapon.magazine_size):
			if shot > 0:
				member.combat.tick(member.weapon.cooldown)
			check(member.combat.try_attack(member, mission, Vector3(0, 0, 5)), "Shot " + id)
		check(member.ammo == 0 and member.reload_left > 0, "Last round immediately starts reload " + id)
		var duration: float = member.weapon.reload_time
		near(member.reload_left, duration, "Exact reload time " + id)
		check(not member.combat.try_attack(member, mission, Vector3(0, 0, 5)), "Reload blocks attack")
		member.combat.tick(duration - 0.01)
		check(member.ammo == 0, "Reload cannot refill early")
		member.combat.tick(0.01)
		check(member.ammo == member.weapon.magazine_size and member.reload_left == 0, "Unlimited reserve refill")
	var target: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, 8.5))
	target.hp = 10000
	target.think_left = 99
	member.equip(content.by_id(content.weapons, Registry.KNIFE))
	check(member.combat.try_attack(member, mission, target.position, target), "Knife hits inside 1.65m")
	near(target.hp, 9972, "Knife damage")
	check(member.ammo == 0 and member.reload_left == 0, "Knife never reloads")
	target.position = Vector3(0, 0, 8.34)
	member.combat.tick(1)
	check(not member.combat.try_attack(member, mission, target.position, target), "Knife rejects 1.66m")
	mission.debug_clear_enemies()
	member.equip(content.by_id(content.weapons, Registry.H7))
	member.combat.rng.seed = 71
	var targets: Array[Node3D] = []
	for z: float in [7.0, 5.0, 3.0]:
		var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(0, 0, z))
		enemy.hp = 1000
		targets.append(enemy)
	check(member.combat.try_attack(member, mission, targets[0].position, targets[0]), "H7 fires")
	near(targets[0].hp, 942, "First penetration hit 58")
	near(targets[1].hp, 965.2, "Second penetration hit 60 percent")
	near(targets[2].hp, 1000, "Third enemy untouched")
	mission.debug_clear_enemies()
	member.equip(content.by_id(content.weapons, Registry.S12))
	member.combat.rng.seed = 10
	targets.clear()
	for x: float in [-0.65, 0, 0.65]:
		var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", Vector3(x, 0, 7.0))
		enemy.position = Vector3(x, 0, 7.0)
		enemy.hp = 1000
		targets.append(enemy)
	member.combat.try_attack(member, mission, Vector3(0, 0, 7))
	check(member.combat.last_pellets.size() == 7 and member.ammo == 5, "Seven rays cost one shell")
	check(targets.filter(func(enemy: Node3D) -> bool: return enemy.hp < 1000).size() >= 2, "Shotgun strikes multiple enemies")
	for pellet: Dictionary in member.combat.last_pellets:
		check(pellet.hits.size() <= 1, "Each shotgun pellet stops at first enemy")
		for hit: Dictionary in pellet.hits:
			near(hit.damage, 7, "Independent pellet damage")
	mission.debug_clear_enemies()
	var near_damage: float = _shotgun_single(mission, member, 1.0)
	var far_damage: float = _shotgun_single(mission, member, 7.0)
	check(near_damage > far_damage and near_damage <= 49, "Spread naturally lowers distant damage")
	member.equip(null)
	member.tick(1, mission)
	check(member.ammo == 0 and not member.combat.try_attack(member, mission, Vector3.ZERO), "Unarmed runtime is safe")
	await create_timer(0.3).timeout
	mission.free()
	# Let the audio thread release stopped playback before the test process exits.
	await create_timer(0.25).timeout
	print("WEAPONS: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _shotgun_single(mission: Node3D, member: Node3D, distance: float) -> float:
	mission.debug_clear_enemies()
	member.equip(mission.catalog.by_id(mission.catalog.weapons, Registry.S12))
	member.combat.rng.seed = 31
	var enemy: Node3D = mission.spawn_enemy("ENM_001_infected_basic_a", member.position + Vector3(0, 0, -distance))
	enemy.hp = 1000
	member.combat.try_attack(member, mission, enemy.position)
	return 1000 - enemy.hp
