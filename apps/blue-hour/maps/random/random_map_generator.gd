extends RefCounted
## Pure seeded plan; the city and gameplay consume this same snapshot.
const Assets = preload("res://data/world_asset_catalog.gd")
const Layouts = preload("res://maps/random/district_layout.gd")

static func generate(mission_type: String, seed_value: int, layout: String = "", density: float = 1.0) -> Dictionary:
	if mission_type not in ["supply_search", "food_supply", "rescue"]:
		return {"ok": false, "error": "Unknown mission: " + mission_type}
	if not is_finite(density) or density <= 0:
		return {"ok": false, "error": "Invalid zombie density"}
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var chosen := layout if not layout.is_empty() else Layouts.IDS[rng.randi_range(0, 2)]
	var template: Dictionary = Layouts.get_layout(chosen)
	if template.is_empty():
		return {"ok": false, "error": "Unknown layout: " + chosen}
	var slots: Array[Dictionary] = template.slots.duplicate(true)
	var sites: Array[Dictionary] = []
	var used: Dictionary = {}
	var target_slot := ""
	var target_asset := ""
	# Reserve the mission target before sampling any ordinary buildings.
	for slot: Dictionary in slots:
		var candidates: Array[Resource] = []
		if slot.allow_poi and target_slot.is_empty() and mission_type != "supply_search":
			var preferred: Array[String] = []
			if mission_type == "food_supply":
				preferred = ["BLD_001", "BLD_015"]
			else:
				preferred = ["BLD_009", "BLD_010", "BLD_011", "BLD_012", "BLD_013", "BLD_014"]
			for id: String in preferred:
				var definition: Resource = Assets.asset(id)
				if _fits(definition, slot):
					candidates.append(definition)
			if candidates.is_empty():
				return {"ok": false, "error": "Required POI cannot fit " + slot.slot_id}
			if mission_type == "food_supply":
				candidates.resize(1)
			target_slot = slot.slot_id
		else:
			var category: String = slot.category
			if category == "mixed":
				var roll := rng.randf()
				category = "residential" if roll < .45 else "commercial" if roll < .80 else "industrial" if roll < .90 else "special"
			candidates = _candidates(category, slot, used)
			if candidates.is_empty():
				candidates = _candidates("residential", slot, used, 3)
		if candidates.is_empty():
			return {"ok": false, "error": "No legal building for " + slot.slot_id}
		var d: Resource = _pick(candidates, rng)
		used[d.id] = int(used.get(d.id, 0)) + 1
		if slot.slot_id == target_slot:
			target_asset = d.id
		sites.append({"id": slot.slot_id, "slot_id": slot.slot_id, "asset": d.id,
			"name": d.display_name, "yaw": slot.rotation, "size": d.bounding_size,
			"footprint": d.footprint, "searchable": true, "poi": slot.slot_id == target_slot,
			"block_id": slot.block_id, "category": d.category})
	# Compact frontages use measured visual bounds; buildings are never scaled to fit.
	for row: int in range(3):
		var indices: Array[int] = []
		var total := 0.0
		for i: int in sites.size():
			if slots[i].row == row:
				indices.append(i)
				total += sites[i].size.x + 2.0
		var cursor := -(total - 2.0) * .5
		if total > (template.half_width - 15) * 2:
			return {"ok": false, "error": "Frontage exceeds layout width"}
		for i: int in indices:
			var site: Dictionary = sites[i]
			var d: Resource = Assets.asset(site.asset)
			var road := Vector3(cursor + d.bounding_size.x * .5, 0, slots[i].road_z)
			slots[i].position = road
			var basis := Basis(Vector3.UP, site.yaw)
			site.road_anchor = road
			site.position = road - basis * d.road_offset
			site.entry = site.position + basis * d.entrance_offset
			site.entry = Vector3(roundf(site.entry.x), 0, roundf(site.entry.z))
			site.search_point = site.position + basis * d.search_offset
			preload("res://maps/generation/loot_spawner.gd").apply(site, d.loot_profile)
			site.building_type = "RESIDENTIAL" if d.category == "residential" else "STORE"
			cursor += d.bounding_size.x + 2.0
	var loot: Array[Vector3] = []
	for site: Dictionary in sites:
		loot.append(site.search_point)
	var zombies: Array[Vector3] = []
	var available: Array[Vector3] = template.zombie_slots.duplicate()
	while zombies.size() < ceili(8 * density) and not available.is_empty():
		var index := rng.randi_range(0, available.size() - 1)
		zombies.append(available[index])
		available.remove_at(index)
	return {"ok": true, "mission_type": mission_type, "seed": seed_value,
		"layout": chosen, "buildings": sites, "slots": slots, "poi": target_asset,
		"target_building_id": target_asset, "mission_target_building": target_slot,
		"spawn": template.spawn, "extraction": template.extraction,
		"loot_spawns": loot, "zombie_spawns": zombies, "roads": template.roads,
		"half_width": template.half_width, "half_depth": 48}

static func _fits(d: Resource, slot: Dictionary) -> bool:
	return d.footprint.x <= slot.max_footprint.x and d.footprint.y <= slot.max_footprint.y and d.bounding_size.x <= slot.max_footprint.x and d.bounding_size.z <= slot.max_footprint.y

static func _candidates(category: String, slot: Dictionary, used: Dictionary, residential_limit: int = 2) -> Array[Resource]:
	var result: Array[Resource] = []
	for d: Resource in Assets.get_buildings_by_category(category):
		var limit := 1 if d.building_id in ["BLD_001", "BLD_004", "BLD_007"] else residential_limit if category == "residential" else 2
		if _fits(d, slot) and int(used.get(d.id, 0)) < limit:
			result.append(d)
	return result

static func _pick(candidates: Array[Resource], rng: RandomNumberGenerator) -> Resource:
	var total := 0.0
	for d: Resource in candidates:
		total += maxf(.001, d.spawn_weight)
	var roll := rng.randf() * total
	for d: Resource in candidates:
		roll -= maxf(.001, d.spawn_weight)
		if roll <= 0:
			return d
	return candidates.back()
