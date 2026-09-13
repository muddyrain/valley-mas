extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")

static func build(city: Node3D, sites: Array[Dictionary]) -> void:
	for site: Dictionary in sites:
		var wrapper: Node3D = Assets.asset(site.asset).scene.instantiate()
		city.add_child(wrapper)
		wrapper.rotation.y = site.yaw
		# The source orientation is exclusively owned by ModelRoot.
		wrapper.position = site.road_anchor - wrapper.basis * wrapper.get_node("Anchors/RoadAnchor").position
		wrapper.set_meta("building_id", site.id)
		city.buildings[site.id] = wrapper
		if site.searchable:
			wrapper.bind_site(site.id)
			city.register_site(site, wrapper, false)
