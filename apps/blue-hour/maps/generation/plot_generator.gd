extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")
const Loot = preload("res://maps/generation/loot_spawner.gd")

static func resolve(plots: Array[Dictionary]) -> Array[Dictionary]:
	var sites: Array[Dictionary] = []
	for plot: Dictionary in plots:
		var definition: Resource = Assets.asset(plot.asset)
		var basis := Basis(Vector3.UP, plot.yaw)
		var position: Vector3 = plot.road_anchor - basis * definition.road_offset
		var entry: Vector3 = position + basis * definition.entrance_offset
		# The current mission uses meter cells; author the runtime entrance at a cell center.
		entry = Vector3(roundf(entry.x), 0, roundf(entry.z))
		var site: Dictionary = plot.duplicate(true)
		site.merge({"position": position, "entry": entry, "size": definition.bounding_size,
			"searchable": plot.get("searchable", true), "footprint": definition.footprint,
			"poi_type": definition.poi_type, "enemy_profile": definition.enemy_profile,
			"parking_requirement": definition.parking_requirement,
			"building_type": _building_type(definition.poi_type)})
		Loot.apply(site, definition.loot_profile)
		sites.append(site)
	return sites

static func _building_type(poi_type: String) -> String:
	match poi_type:
		"house": return "RESIDENTIAL"
		"supermarket", "restaurant": return "STORE"
		"pharmacy": return "PHARMACY"
		"warehouse", "auto_repair", "gas_station": return "SPECIAL"
	return "GENERIC"

static func frontage(blocks: Array[Dictionary]) -> Array[Dictionary]:
	var plots: Array[Dictionary] = []
	for block: Dictionary in blocks:
		var cursor: float = block.start
		for lot: Dictionary in block.lots:
			var definition: Resource = Assets.asset(lot.asset)
			# Runtime bounds include roof overhang, unlike the collision footprint.
			var width: float = maxf(definition.bounding_size.x, definition.footprint.x)
			if cursor + width > float(block.end):
				push_error("Frontage exceeds block: " + str(block.id))
				break
			var plot: Dictionary = lot.duplicate(true)
			plot.merge({"block_id": block.id, "road_anchor": Vector3(cursor + width * .5, 0, block.road_z), "yaw": block.yaw})
			plots.append(plot)
			cursor += width + float(block.gap)
	return plots
