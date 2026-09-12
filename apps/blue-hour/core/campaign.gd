extends RefCounted
const Equipment = preload("res://core/equipment.gd")
const Modifiers = preload("res://core/effect_modifiers.gd")
var catalog: RefCounted
var gear: RefCounted
var data: Dictionary = {}

func _init(content: RefCounted) -> void:
	catalog = content
	gear = Equipment.new(content)

func new_run(seed_value: int = 0, specialization: String = "combat", fixture_templates: Array = []) -> void:
	data = {"version": 3, "seed": seed_value if seed_value != 0 else int(Time.get_ticks_usec()) % 2147483647, "day": 1, "status": "shelter", "food": catalog.loop.initial_food, "scrap": 0, "hunger": 0, "members": [], "roster": {}, "inventory": [], "equipment": {}, "day_rewards": {}, "shop": [], "pending": {}, "history": [], "modified": false, "specialization": specialization, "passive_slots": [], "power_slots": [], "passive_items": {}, "power_items": {}, "passive_capacity": 1, "power_capacity": 1}
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
		data.roster[id] = {"template": template, "level": 1}
		data.inventory.append({"uid": uid, "kind": catalog.start_rules.starting_weapons[template], "affix": ""})
		data.equipment[id] = uid
	_prepare_day()

func member_template(id: String) -> Resource:
	return catalog.by_id(catalog.survivors, str(data.roster.get(id, {}).get("template", id)))

func member_level(id: String) -> int:
	return int(data.roster.get(id, {}).get("level", 1))

func member_trait(id: String) -> Resource:
	var template := member_template(id)
	var base: Resource = catalog.by_id(catalog.traits, template.trait_id)
	return base.at_level(member_level(id))

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
	data.roster[id].level += 1
	return true

func _prepare_day() -> void:
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
	if data.status != "shelter" or member not in data.members or item(uid).is_empty():
		return false
	var old: String = data.equipment[member]
	for other in data.equipment:
		if data.equipment[other] == uid:
			data.equipment[other] = old
	data.equipment[member] = uid
	return true

func buy(uid: String) -> bool:
	if data.status != "shelter":
		return false
	for offer in data.shop:
		if offer.uid == uid and not offer.sold and data.scrap >= offer.price:
			data.scrap -= offer.price
			offer.sold = true
			data.inventory.append({"uid": offer.uid, "kind": offer.kind, "affix": offer.affix})
			return true
	return false

func start_action() -> bool:
	if data.status != "shelter" or data.members.is_empty():
		return false
	data.status = "mission"
	return true

func stage_result(outcome: Dictionary) -> bool:
	if data.status != "mission" or not _valid_outcome(outcome, data):
		return false
	data.pending = outcome.duplicate(true)
	data.status = "pending"
	return true

func preview() -> Dictionary:
	if data.status != "pending":
		return {}
	var result: Dictionary = data.pending
	var total: int = int(data.food) + (0 if result.wiped else int(result.food))
	var need: int = result.returned_ids.size() * catalog.loop.food_per_member
	var shortage := total < need
	return {"total": total, "need": need, "remaining": maxi(0, total - need), "shortage": shortage, "fatal": shortage and data.hunger > 0, "slots": mini(result.returned_ids.size(), total / catalog.loop.food_per_member), "members": result.returned_ids.duplicate()}

func commit_day(fed: Array = []) -> bool:
	if data.status != "pending":
		return false
	var view := preview()
	if view.fatal and (fed.size() != view.slots or not _unique_subset(fed, view.members)):
		return false
	var result: Dictionary = data.pending.duplicate(true)
	var starved: Array = []
	var next_members: Array = []
	for id in result.returned_ids:
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
			var price: int = catalog.loop.weapon_prices.get(value.kind, 0) + (catalog.start_rules.affix_value_bonus if not value.affix.is_empty() else 0)
			if price > best_value:
				best = value
				best_value = price
		var copy: Dictionary = best.duplicate(true)
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
	if joined.size() != state.members.size() or not _unique_subset(joined, state.members):
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
	if state.get("version") == 1:
		return _valid_legacy(state)
	# JSON numbers are floats; Array.has uses strict Variant types.
	if (state.get("version") != 2 and state.get("version") != 3) or not state.get("roster") is Dictionary:
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
		mapping[id] = member.template
	var compatible: Dictionary = state.duplicate(true)
	compatible.version = 1
	if not compatible.get("members") is Array or not compatible.get("equipment") is Dictionary or not compatible.get("history") is Array or not compatible.get("pending") is Dictionary:
		return false
	compatible.members = compatible.members.map(func(id): return mapping.get(id, "invalid"))
	compatible.equipment = {}
	for id in state.equipment:
		if id not in mapping:
			return false
		compatible.equipment[mapping[id]] = state.equipment[id]
	for entry in compatible.history + [compatible.pending]:
		if not entry is Dictionary:
			return false
		for key in ["returned_ids", "lost_ids", "starved_ids"]:
			if entry.get(key) is Array:
				entry[key] = entry[key].map(func(id): return mapping.get(id, "invalid"))
	return _valid_legacy(compatible)

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
		if not _unique_subset(entry.returned_ids + entry.lost_ids, member_ids) or not _unique_subset(entry.starved_ids, entry.returned_ids):
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
	if not valid_state(state):
		return false
	data = state.duplicate(true)
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
	for category: String in ["passive", "power"]:
		data[category + "_capacity"] = int(data[category + "_capacity"])
	for key in ["seed", "day", "food", "scrap", "hunger"]:
		data[key] = int(data[key])
	if data.status == "mission":
		data.status = "shelter"
	return true
