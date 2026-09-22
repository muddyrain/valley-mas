extends RefCounted

const LEGACY_SURVIVOR_TEMPLATES: Dictionary = {
	"lin": "lin_jianyue",
	"qiao": "xia_zhiyao",
	"yan": "su_wanxing",
}
const Equipment = preload("res://core/equipment.gd")
const Modifiers = preload("res://core/effect_modifiers.gd")
const WeaponInventoryData = preload("res://weapons/weapon_inventory.gd")
const WeaponInstanceData = preload("res://weapons/weapon_instance.gd")
const SurvivorProgressionData = preload("res://data/survivor_progression.gd")
const SurvivorRosterManagerData = preload("res://data/survivor_roster_manager.gd")
var weapon_inventory: WeaponInventory
var catalog: RefCounted
var gear: RefCounted
var data: Dictionary = {}
var survivor_roster: SurvivorRosterManager

func _init(content: RefCounted) -> void:
	catalog = content
	gear = Equipment.new(content)
	weapon_inventory = WeaponInventoryData.new(self)
	survivor_roster = SurvivorRosterManagerData.new(catalog)

func new_run(seed_value: int = 0, specialization: String = "combat", fixture_templates: Array = []) -> void:
	data = {"version": 5, "seed": seed_value if seed_value != 0 else int(Time.get_ticks_usec()) % 2147483647, "day": 1, "status": "shelter", "food": catalog.loop.initial_food, "scrap": 0, "hunger": 0, "members": [], "roster": {}, "survivor_states": {}, "inventory": [], "equipment": {}, "day_rewards": {}, "shop": [], "pending": {}, "history": [], "modified": false, "specialization": specialization, "passive_slots": [], "power_slots": [], "passive_items": {}, "power_items": {}, "passive_capacity": 1, "power_capacity": 1}
	survivor_roster = SurvivorRosterManagerData.new(catalog)
	var choice: Resource = catalog.by_id(catalog.specializations, specialization)
	if choice != null:
		grant_effect("passive", choice.passive_id)
		grant_effect("power", choice.power_id)
		data.passive_slots = [choice.passive_id]
		data.power_slots = [choice.power_id]
	var templates: Array = fixture_templates.duplicate()
	if templates.is_empty():
		var pool: Array = catalog.start_rules.starter_pool.duplicate()
		var rng := RandomNumberGenerator.new()
		rng.seed = int(data.seed)
		for i in range(catalog.start_rules.starting_count):
			var selected := rng.randi_range(0, pool.size() - 1)
			templates.append(pool.pop_at(selected))
	data.initial_count = templates.size()
	for i in range(templates.size()):
		var template: String = templates[i]
		var id: String = template if not fixture_templates.is_empty() else "crew:%d" % i
		var uid := "initial:" + id
		data.members.append(id)
		data.roster[id] = {"template": template, "level": 1, "current_level": 1, "current_xp": 0, "total_xp": 0, "xp_to_next_level": SurvivorProgressionData.xp_required_for_level(1)}
		weapon_inventory.add_weapon(WeaponInstanceData.from_dict({"uid": uid, "kind": catalog.start_rules.starting_weapons[template]}))
		data.equipment[id] = uid
	survivor_roster.sync_members(data.members)
	data.survivor_states = survivor_roster.to_state()
	_prepare_day()

func roster_manager() -> SurvivorRosterManager:
	return survivor_roster

func discover_survivor(id: String) -> bool:
	var changed := survivor_roster.discover_survivor(id)
	if changed:
		data.survivor_states = survivor_roster.to_state()
	return changed

func recruit_survivor(id: String) -> bool:
	var changed := survivor_roster.recruit_survivor(id)
	if changed:
		data.survivor_states = survivor_roster.to_state()
	return changed

func is_survivor_recruited(id: String) -> bool:
	return survivor_roster.is_recruited(id)

func member_template(id: String) -> Resource:
	return catalog.by_id(catalog.survivors, str(data.roster.get(id, {}).get("template", id)))

func member_level(id: String) -> int:
	return member_progression(id).get_level()

func member_progression(id: String) -> SurvivorProgression:
	return SurvivorProgressionData.from_state(id, data.roster.get(id, {}))

func member_xp(id: String) -> int:
	var progression: SurvivorProgression = member_progression(id)
	return progression.current_xp

func member_total_xp(id: String) -> int:
	var progression: SurvivorProgression = member_progression(id)
	return progression.total_xp

func member_xp_to_next_level(id: String) -> int:
	var progression: SurvivorProgression = member_progression(id)
	return progression.xp_to_next_level

func member_trait(id: String) -> Resource:
	var template := member_template(id)
	var base: Resource = catalog.by_id(catalog.traits, template.trait_id)
	return base.at_level(member_trait_level(id))

func member_trait_level(id: String) -> int:
	var progression: SurvivorProgression = member_progression(id)
	return progression.get_trait_level()

func add_xp(id: String, amount: int) -> int:
	if not data.roster.has(id):
		return 0
	var progression: SurvivorProgression = member_progression(id)
	var gained: int = progression.add_xp(amount)
	while progression.apply_level_up():
		pass
	_write_progression(id, progression)
	return gained

func record_xp_event(id: String, event_type: SurvivorProgression.EventType, amount: int = 0) -> int:
	var value: int = amount if amount > 0 else SurvivorProgressionData.default_event_xp(event_type)
	return add_xp(id, value)

func get_level(id: String) -> int:
	return member_level(id)

func get_trait_level(id: String) -> int:
	return member_trait_level(id)

func can_level_up(id: String) -> bool:
	return member_progression(id).can_level_up()

func apply_level_up(id: String) -> bool:
	if not data.roster.has(id):
		return false
	var progression: SurvivorProgression = member_progression(id)
	if not progression.apply_level_up():
		return false
	_write_progression(id, progression)
	return true

func _write_progression(id: String, progression: SurvivorProgression) -> void:
	var member: Dictionary = data.roster[id]
	member.level = progression.current_level
	member.current_level = progression.current_level
	member.current_xp = progression.current_xp
	member.total_xp = progression.total_xp
	member.xp_to_next_level = progression.xp_to_next_level

func effect_definition(category: String, id: String) -> Resource:
	if category not in ["passive", "power"] or not data.get(category + "_items", {}).has(id):
		return null
	var definition: Resource = catalog.by_id(catalog.passives if category == "passive" else catalog.powers, id)
	return definition.at_upgrade(data[category + "_items"][id].upgraded) if definition != null else null

func equipped_effects(category: String) -> Array[Resource]:
	var result: Array[Resource] = []
	for id: String in data.get(category + "_slots", []):
		var definition := effect_definition(category, id)
		if definition != null:
			result.append(definition)
	return result

func passive_modifiers() -> RefCounted:
	var result := Modifiers.new()
	for definition: Resource in equipped_effects("passive"):
		result.set_source("passive:" + definition.id, definition.modifiers())
	return result

func grant_effect(category: String, id: String) -> bool:
	if category not in ["passive", "power"] or data.get("status") not in ["shelter", "mission"]:
		return false
	if catalog.by_id(catalog.passives if category == "passive" else catalog.powers, id) == null or data[category + "_items"].has(id):
		return false
	data[category + "_items"][id] = {"upgraded": false}
	return true

func equip_effect(category: String, id: String) -> bool:
	if data.get("status") != "shelter" or effect_definition(category, id) == null:
		return false
	var slots: Array = data[category + "_slots"]
	if id in slots or slots.size() >= data[category + "_capacity"]:
		return false
	slots.append(id)
	return true

func unequip_effect(category: String, id: String) -> bool:
	if data.get("status") != "shelter" or category not in ["passive", "power"] or id not in data[category + "_slots"]:
		return false
	data[category + "_slots"].erase(id)
	return true

func expand_effect_slots(category: String, count: int = 1) -> bool:
	if data.get("status") != "shelter" or category not in ["passive", "power"] or count <= 0:
		return false
	data[category + "_capacity"] += count
	return true

func upgrade_effect(category: String, id: String) -> bool:
	var definition := effect_definition(category, id)
	if data.get("status") != "shelter" or definition == null or definition.is_upgraded:
		return false
	data[category + "_items"][id].upgraded = true
	return true

func training_cost(id: String) -> int:
	var index := member_level(id) - 1
	return int(catalog.start_rules.training_costs[index]) if index < catalog.start_rules.training_costs.size() else -1

func train(id: String) -> bool:
	if data.status != "shelter" or id not in data.members:
		return false
	var cost := training_cost(id)
	if cost < 0 or data.food < cost:
		return false
	data.food -= cost
	var progression: SurvivorProgression = member_progression(id)
	var required: int = progression.xp_to_next_level
	if required <= 0:
		data.food += cost
		return false
	progression.add_xp(required)
	_write_progression(id, progression)
	return apply_level_up(id)

func _prepare_day() -> void:
	data.selected_action = ""
	data.selected_party = data.members.duplicate()
	var rng := RandomNumberGenerator.new()
	rng.seed = int(data.seed) + int(data.day) * 1009
	data.day_rewards = {}
	for site in catalog.loop.reward_pools:
		data.day_rewards[site] = gear.roll(catalog.loop.reward_pools[site], "loot:%d:%s" % [data.day, site], rng)
	data.shop = []
	var kinds: Array = catalog.loop.weapon_prices.keys()
	for i in range(mini(catalog.loop.shop_size, kinds.size())):
		var index := rng.randi_range(0, kinds.size() - 1)
		var offer: Dictionary = gear.roll([kinds[index]], "shop:%d:%d" % [data.day, i], rng, false)
		offer.price = catalog.loop.weapon_prices[kinds[index]]
		offer.sold = not item(offer.uid).is_empty()
		data.shop.append(offer)
		kinds.remove_at(index)

func item(uid: String) -> Dictionary:
	for value in data.inventory:
		if value.uid == uid:
			return value
	return {}

func weapon(uid: String) -> Resource:
	return gear.resource(item(uid))

func health_multiplier() -> float:
	return catalog.loop.hunger_health_multiplier if data.hunger > 0 else 1.0

func equip(member: String, uid: String) -> bool:
	return equip_weapon(member, uid)

func equip_weapon(member: String, uid: String) -> bool:
	if data.status != "shelter" or member not in data.members or item(uid).is_empty():
		return false
	for other in data.equipment:
		if other != member and data.equipment[other] == uid:
			data.equipment[other] = ""
	data.equipment[member] = uid
	return true

func unequip_weapon(member: String) -> bool:
	if data.status != "shelter" or member not in data.members:
		return false
	data.equipment[member] = ""
	return true

func get_equipped_weapon(member: String) -> WeaponInstance:
	return weapon_inventory.get_weapon(str(data.equipment.get(member, "")))

func buy(uid: String) -> bool:
	if data.status != "shelter":
		return false
	for offer in data.shop:
		if offer.uid == uid and not offer.sold and data.scrap >= offer.price:
			data.scrap -= offer.price
			offer.sold = true
			weapon_inventory.add_weapon(WeaponInstanceData.from_dict(offer))
			return true
	return false

func start_action(action_id: String = "", party: Array = []) -> bool:
	if data.status != "shelter" or data.members.is_empty():
		return false
	if not action_id.is_empty() and catalog.by_id(catalog.today_actions, action_id) == null:
		return false
	var chosen: Array = data.members if party.is_empty() else party
	if not _unique_subset(chosen, data.members):
		return false
	data.selected_action = action_id
	data.selected_party = chosen.duplicate()
	data.status = "mission"
	return true

func abandon_action() -> bool:
	if data.status != "mission":
		return false
	data.status = "shelter"
	return true

func stage_result(outcome: Dictionary) -> bool:
	if data.status != "mission" or not _valid_outcome(outcome, data):
		return false
	data.pending = outcome.duplicate(true)
	_award_outcome_xp(outcome)
	_normalize_weapons(data)
	data.status = "pending"
	return true

func _award_outcome_xp(outcome: Dictionary) -> void:
	for id: String in data.selected_party:
		record_xp_event(id, SurvivorProgressionData.EventType.MISSION_COMPLETE)
	for id: String in outcome.returned_ids:
		record_xp_event(id, SurvivorProgressionData.EventType.EXTRACTION_SUCCESS)

func preview() -> Dictionary:
	if data.status != "pending":
		return {}
	var result: Dictionary = data.pending
	var total: int = int(data.food) + (0 if result.wiped else int(result.food))
	var alive: Array = data.members.filter(func(id: String) -> bool: return id not in result.lost_ids)
	var need: int = alive.size() * catalog.loop.food_per_member
	var shortage := total < need
	return {"total": total, "need": need, "remaining": maxi(0, total - need), "shortage": shortage, "fatal": shortage and data.hunger > 0, "slots": mini(alive.size(), total / catalog.loop.food_per_member), "members": alive}

func commit_day(fed: Array = []) -> bool:
	if data.status != "pending":
		return false
	var view := preview()
	if view.fatal and (fed.size() != view.slots or not _unique_subset(fed, view.members)):
		return false
	var result: Dictionary = data.pending.duplicate(true)
	result.stayed_ids = data.members.filter(func(id: String) -> bool: return id not in data.selected_party)
	var starved: Array = []
	var next_members: Array = []
	for id in view.members:
		if view.fatal and id not in fed:
			starved.append(id)
		else:
			next_members.append(id)
	for id in result.lost_ids:
		var lost_item: Dictionary = item(data.equipment[id])
		data.inventory.erase(lost_item)
	for id in result.lost_ids + starved:
		data.equipment.erase(id)
	data.members = next_members
	if not result.wiped:
		data.scrap += int(result.scrap)
		for value in result.weapons:
			data.inventory.append(value.duplicate(true))
	data.food = view.remaining
	data.hunger = int(data.hunger) + 1 if view.shortage else 0
	result.day = data.day
	result.starved_ids = starved
	result.food_spent = mini(view.total, view.need)
	result.copied_weapons = _copy_reward() if not result.wiped and not data.members.is_empty() else []
	data.history.append(result)
	data.pending = {}
	data.selected_party = data.members.duplicate()
	if data.members.is_empty():
		data.status = "lost"
	elif data.day >= catalog.loop.end_day:
		data.status = "won"
	else:
		data.day += 1
		data.status = "shelter"
		_prepare_day()
	return true

func _copy_reward() -> Array:
	var output: Array = []
	for passive_id in data.passive_slots:
		var passive := effect_definition("passive", passive_id)
		var probability: float = passive.modifiers().get("weapon_copy_chance", 0.0)
		if probability <= 0 or data.inventory.is_empty():
			continue
		var rng := RandomNumberGenerator.new()
		rng.seed = int(data.seed) + int(data.day) * 7919
		if rng.randf() >= probability:
			continue
		var best: Dictionary = {}
		var best_value := -1
		for value in data.inventory:
			var price: int = catalog.loop.weapon_prices.get(WeaponInstanceData.Registry.canonical_id(value.kind), 0) + int(value.get("rarity", int(not value.get("affix", "").is_empty()))) * catalog.start_rules.affix_value_bonus
			if price > best_value:
				best = value
				best_value = price
		var copy: Dictionary = WeaponInstanceData.from_dict(best).to_dict()
		copy.uid = "copy:%d:%s" % [data.day, passive_id]
		data.inventory.append(copy)
		output.append(copy.duplicate(true))
	return output

func _unique_subset(values: Array, allowed: Array) -> bool:
	var seen: Array = []
	for value in values:
		if value not in allowed or value in seen:
			return false
		seen.append(value)
	return true

func _valid_outcome(result: Dictionary, state: Dictionary) -> bool:
	for key in ["returned_ids", "lost_ids", "weapons"]:
		if not result.get(key) is Array:
			return false
	var joined: Array = result.returned_ids + result.lost_ids
	var deployed: Array = state.get("selected_party", state.members)
	if joined.size() != deployed.size() or not _unique_subset(joined, deployed):
		return false
	for key in ["food", "scrap", "kills", "seconds"]:
		if not _nonnegative(result.get(key)):
			return false
	if not result.get("wiped") is bool or result.wiped != result.returned_ids.is_empty():
		return false
	var seen: Array = []
	for value in result.weapons:
		if not value is Dictionary or not gear.valid(value) or value.uid in seen:
			return false
		if value.uid in state.inventory.map(func(entry): return entry.uid):
			return false
		seen.append(value.uid)
	return true

func _nonnegative(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and value >= 0

func valid_state(state: Dictionary) -> bool:
	if _has_legacy_survivor_references(state):
		return valid_state(_migrate_legacy_survivor_references(state))
	if state.has("selected_party"):
		if not state.selected_party is Array or not state.get("members") is Array or not _unique_subset(state.selected_party, state.members):
			return false
		if state.get("status") in ["shelter", "mission", "pending", "won"] and state.selected_party.is_empty():
			return false
	var action_id: Variant = state.get("selected_action", "")
	if not action_id is String:
		return false
	if not action_id.is_empty() and catalog.by_id(catalog.today_actions, action_id) == null:
		return false
	if state.get("version") == 1:
		return _valid_legacy(state)
	# JSON numbers are floats; Array.has uses strict Variant types.
	if (state.get("version") != 2 and state.get("version") != 3 and state.get("version") != 4 and state.get("version") != 5) or not state.get("roster") is Dictionary:
		return false
	if state.has("survivor_states") and not state.survivor_states is Dictionary:
		return false
	if state.has("survivor_states"):
		var roster_probe := SurvivorRosterManagerData.new(catalog)
		if not roster_probe.restore_state(state.survivor_states):
			return false
	if not _nonnegative(state.get("initial_count")) or state.initial_count != state.roster.size() or state.roster.is_empty():
		return false
	var choice: Resource = catalog.by_id(catalog.specializations, str(state.get("specialization", "invalid")))
	if choice == null and state.get("specialization") != "":
		return false
	if state.version == 2:
		if state.get("passive_slots") != ([] if choice == null else [choice.passive_id]) or state.get("power_slots") != ([] if choice == null else [choice.power_id]):
			return false
	elif not _valid_effects(state):
		return false
	var mapping: Dictionary = {}
	for id in state.roster:
		var member = state.roster[id]
		if not id is String or id.is_empty() or not member is Dictionary or catalog.by_id(catalog.survivors, str(member.get("template", ""))) == null:
			return false
		if not _nonnegative(member.get("level")) or float(member.level) != floor(float(member.level)) or member.level < 1 or member.level > catalog.start_rules.training_costs.size() + 1:
			return false
		if member.template in mapping.values():
			return false
		if state.version >= 5 and not _valid_progression_member(id, member):
			return false
		mapping[id] = member.template
	var compatible: Dictionary = state.duplicate(true)
	compatible.version = 1
	if not compatible.get("members") is Array or not compatible.get("equipment") is Dictionary or not compatible.get("history") is Array or not compatible.get("pending") is Dictionary:
		return false
	compatible.members = compatible.members.map(func(id): return mapping.get(id, "invalid"))
	if compatible.has("selected_party"):
		compatible.selected_party = compatible.selected_party.map(func(id): return mapping.get(id, "invalid"))
	compatible.equipment = {}
	for id in state.equipment:
		if id not in mapping:
			return false
		compatible.equipment[mapping[id]] = state.equipment[id]
	for entry in compatible.history + [compatible.pending]:
		if not entry is Dictionary:
			return false
		for key in ["returned_ids", "lost_ids", "starved_ids", "stayed_ids"]:
			if entry.get(key) is Array:
				entry[key] = entry[key].map(func(id): return mapping.get(id, "invalid"))
	return _valid_legacy(compatible)

func _valid_progression_member(id: String, member: Dictionary) -> bool:
	for key: String in ["current_level", "current_xp", "total_xp", "xp_to_next_level"]:
		if not _nonnegative(member.get(key)) or float(member[key]) != floor(float(member[key])):
			return false
	var progression: SurvivorProgression = SurvivorProgressionData.from_state(id, member)
	return member.get("level") == progression.current_level and member.get("current_level") == progression.current_level and member.get("xp_to_next_level") == progression.xp_to_next_level and progression.total_xp >= SurvivorProgressionData.total_xp_for_level(progression.current_level) + progression.current_xp and progression.is_valid()

func _valid_effects(state: Dictionary) -> bool:
	for category: String in ["passive", "power"]:
		var owned: Variant = state.get(category + "_items")
		var slots: Variant = state.get(category + "_slots")
		var capacity: Variant = state.get(category + "_capacity")
		if not owned is Dictionary or not slots is Array or not _nonnegative(capacity):
			return false
		if capacity != floor(float(capacity)) or capacity < 1 or slots.size() > capacity:
			return false
		if not _unique_subset(slots, owned.keys()):
			return false
		for id: Variant in owned:
			if not id is String or catalog.by_id(catalog.passives if category == "passive" else catalog.powers, id) == null:
				return false
			if not owned[id] is Dictionary or owned[id].size() != 1 or not owned[id].get("upgraded") is bool:
				return false
	return true

func _valid_legacy(state: Dictionary) -> bool:
	if state.get("version") != 1 or state.get("status") not in ["shelter", "mission", "pending", "won", "lost"]:
		return false
	for key in ["seed", "day", "food", "scrap", "hunger"]:
		if not _nonnegative(state.get(key)) or float(state[key]) != floor(float(state[key])):
			return false
	if state.day < 1 or state.day > catalog.loop.end_day:
		return false
	for key in ["members", "inventory", "shop", "history"]:
		if not state.get(key) is Array:
			return false
	for key in ["equipment", "pending", "day_rewards"]:
		if not state.get(key) is Dictionary:
			return false
	if not state.get("modified") is bool:
		return false
	var member_ids: Array = catalog.survivors.map(func(member): return member.id)
	if not _unique_subset(state.members, member_ids) or state.equipment.size() != state.members.size():
		return false
	if state.status in ["shelter", "mission", "pending", "won"] and state.members.is_empty():
		return false
	if state.status == "won" and state.day != catalog.loop.end_day:
		return false
	if state.status == "lost" and not state.members.is_empty():
		return false
	var item_ids: Array = []
	for value in state.inventory:
		if not value is Dictionary or not gear.valid(value) or value.uid in item_ids:
			return false
		item_ids.append(value.uid)
	var equipped: Array = []
	for member in state.members:
		if state.equipment.get(member) == "":
			continue
		if state.equipment.get(member) not in item_ids or state.equipment[member] in equipped:
			return false
		equipped.append(state.equipment[member])
	var offer_ids: Array = []
	for offer in state.shop:
		if not offer is Dictionary or not gear.valid(offer) or not _nonnegative(offer.get("price")) or not offer.get("sold") is bool or offer.uid in offer_ids:
			return false
		offer_ids.append(offer.uid)
	for value in state.day_rewards.values():
		if not value is Dictionary or not gear.valid(value):
			return false
	for entry in state.history:
		if not entry is Dictionary:
			return false
		for key in ["returned_ids", "lost_ids", "starved_ids", "weapons"]:
			if not entry.get(key) is Array:
				return false
		var stayed: Variant = entry.get("stayed_ids", [])
		if not stayed is Array or not _unique_subset(entry.returned_ids + entry.lost_ids + stayed, member_ids) or not _unique_subset(entry.starved_ids, entry.returned_ids + stayed):
			return false
		for key in ["day", "food", "scrap", "seconds", "kills", "food_spent"]:
			if not _nonnegative(entry.get(key)):
				return false
		if not entry.get("wiped") is bool or entry.day < 1 or entry.day > catalog.loop.end_day:
			return false
		for value in entry.weapons:
			if not value is Dictionary or not gear.valid(value):
				return false
	return _valid_outcome(state.pending, state) if state.status == "pending" else state.pending.is_empty()

func restore(state: Dictionary) -> bool:
	var compatible_state := _migrate_legacy_survivor_references(state)
	if not valid_state(compatible_state):
		return false
	data = compatible_state.duplicate(true)
	survivor_roster = SurvivorRosterManagerData.new(catalog, data.get("survivor_states", {}))
	data.selected_party = data.get("selected_party", data.members).duplicate()
	data.selected_action = str(data.get("selected_action", ""))
	if data.version == 1:
		data.version = 2
		data.specialization = ""
		data.passive_slots = []
		data.power_slots = []
		data.roster = {}
		for template in catalog.survivors:
			data.roster[template.id] = {"template": template.id, "level": 1}
		data.initial_count = data.roster.size()
	if data.version == 2:
		for category: String in ["passive", "power"]:
			data[category + "_items"] = {}
			data[category + "_capacity"] = 1
			for id: String in data[category + "_slots"]:
				data[category + "_items"][id] = {"upgraded": false}
		data.version = 3
	_normalize_weapons(data)
	_ensure_progression_fields()
	survivor_roster.sync_members(data.members)
	data.survivor_states = survivor_roster.to_state()
	data.version = 5
	for category: String in ["passive", "power"]:
		data[category + "_capacity"] = int(data[category + "_capacity"])
	for key in ["seed", "day", "food", "scrap", "hunger"]:
		data[key] = int(data[key])
	if data.status == "mission":
		data.status = "shelter"
	return true

func _ensure_progression_fields() -> void:
	for id: String in data.roster:
		var member: Dictionary = data.roster[id]
		var progression: SurvivorProgression = SurvivorProgressionData.from_state(id, member)
		if not member.has("current_level"):
			progression.current_xp = 0
			progression.total_xp = SurvivorProgressionData.total_xp_for_level(progression.current_level)
			progression.xp_to_next_level = SurvivorProgressionData.xp_required_for_level(progression.current_level) if progression.current_level < SurvivorProgressionData.MAX_LEVEL else 0
		_write_progression(id, progression)

func _has_legacy_survivor_references(state: Dictionary) -> bool:
	if state.get("version") == 1:
		var members: Variant = state.get("members")
		if members is Array:
			for id: Variant in members:
				if LEGACY_SURVIVOR_TEMPLATES.has(str(id)):
					return true
	var roster: Variant = state.get("roster")
	if not roster is Dictionary:
		return false
	for member: Variant in roster.values():
		if member is Dictionary and LEGACY_SURVIVOR_TEMPLATES.has(str(member.get("template", ""))):
			return true
	return false

func _migrate_legacy_survivor_references(state: Dictionary) -> Dictionary:
	var migrated := state.duplicate(true)
	if migrated.get("version") == 1:
		_migrate_legacy_member_ids(migrated)
	var roster: Variant = migrated.get("roster")
	if not roster is Dictionary:
		return migrated
	for id: Variant in roster:
		var member: Variant = roster[id]
		if member is Dictionary:
			var template: String = str(member.get("template", ""))
			if LEGACY_SURVIVOR_TEMPLATES.has(template):
				member["template"] = LEGACY_SURVIVOR_TEMPLATES[template]
	return migrated

func _migrate_legacy_member_ids(state: Dictionary) -> void:
	for key: String in ["members", "selected_party"]:
		if state.get(key) is Array:
			state[key] = state[key].map(func(id: Variant) -> String: return LEGACY_SURVIVOR_TEMPLATES.get(str(id), str(id)))
	if state.get("equipment") is Dictionary:
		var equipment: Dictionary = {}
		for id: Variant in state.equipment:
			equipment[LEGACY_SURVIVOR_TEMPLATES.get(str(id), str(id))] = state.equipment[id]
		state.equipment = equipment
	var outcomes: Array = []
	if state.get("history") is Array:
		outcomes.append_array(state.history)
	outcomes.append(state.get("pending", {}))
	for entry: Variant in outcomes:
		if not entry is Dictionary:
			continue
		for key: String in ["returned_ids", "lost_ids", "starved_ids", "stayed_ids"]:
			if entry.get(key) is Array:
				entry[key] = entry[key].map(func(id: Variant) -> String: return LEGACY_SURVIVOR_TEMPLATES.get(str(id), str(id)))

func _normalize_weapons(value: Variant) -> void:
	# Includes fixed daily rewards, shop and pending/history so retries keep identities.
	if value is Dictionary:
		if value.has("uid") and value.has("kind"):
			value.merge(WeaponInstanceData.from_dict(value).to_dict(), true)
		else:
			for child: Variant in value.values():
				_normalize_weapons(child)
	elif value is Array:
		for child: Variant in value:
			_normalize_weapons(child)
