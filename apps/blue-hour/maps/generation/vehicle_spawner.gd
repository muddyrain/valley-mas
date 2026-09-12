extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")
const Loot = preload("res://maps/generation/loot_spawner.gd")

static func resolve(placements: Array[Dictionary]) -> Array[Dictionary]:
	var sites: Array[Dictionary] = []
	for placement: Dictionary in placements:
		var definition: Resource = Assets.asset(placement.asset)
		var site: Dictionary = placement.duplicate(true)
		var basis := Basis(Vector3.UP, site.yaw)
		var entry: Vector3 = site.position + basis * definition.entrance_offset
		site.entry = Vector3(roundf(entry.x), 0, roundf(entry.z))
		site.size = definition.bounding_size
		site.poi_type = "vehicle"
		site.enemy_profile = "street"
		Loot.apply(site, site.loot_profile)
		sites.append(site)
	return sites

static func build(city: Node3D, sites: Array[Dictionary]) -> void:
	for site: Dictionary in sites:
		var wrapper: Node3D = Assets.asset(site.asset).scene.instantiate()
		city.add_child(wrapper)
		wrapper.position = site.position
		wrapper.rotation.y = site.yaw
		if site.lootable:
			wrapper.bind_site(site.id)
			city.register_site(site, wrapper, true)
		else:
			wrapper.get_node("InteractionArea").collision_layer = 0

