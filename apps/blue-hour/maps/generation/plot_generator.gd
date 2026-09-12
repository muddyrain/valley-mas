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
			"poi_type": definition.poi_type, "enemy_profile": definition.enemy_profile,
			"parking_requirement": definition.parking_requirement})
		Loot.apply(site, definition.loot_profile)
		sites.append(site)
	return sites

