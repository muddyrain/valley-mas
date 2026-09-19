extends RefCounted
## Both formal and legacy expeditions build their world through this boundary.

const TownAdapter = preload("res://maps/expedition/town_runtime_adapter.gd")
const City = preload("res://maps/city.gd")
const FIXED_LEGACY: String = "FIXED_LEGACY"
const MEDIUM_TOWN_V1: String = "MEDIUM_TOWN_V1"

static func create_runtime_staged(mission_type: String, map_seed: int, map: Resource, parent: Node3D, profile: RefCounted) -> Dictionary:
	var town := TownAdapter.new()
	town.name = "MediumTownRuntime"
	town.set_meta("runtime_provider", MEDIUM_TOWN_V1)
	town.set_meta("debug_scene", false)
	parent.add_child(town)
	if not await town.build_runtime_staged(mission_type, map_seed, map, profile):
		town.queue_free()
		return {"ok": false, "error": "Medium Town generation failed"}
	return {"ok": true, "root": town, "runtime": town.runtime_data, "map": town.data}

static func create_runtime(mode: String, mission_type: String, map_seed: int, map: Resource, parent: Node3D) -> Dictionary:
	if mode == MEDIUM_TOWN_V1:
		var town := TownAdapter.new()
		town.name = "MediumTownRuntime"
		town.set_meta("runtime_provider", MEDIUM_TOWN_V1)
		town.set_meta("debug_scene", false)
		parent.add_child(town)
		if not town.build_runtime(mission_type, map_seed, map):
			town.queue_free()
			return {"ok": false, "error": "Medium Town generation failed"}
		return {"ok": true, "root": town, "runtime": town.runtime_data, "map": town.data}
	if mode != FIXED_LEGACY:
		return {"ok": false, "error": "Unknown map provider: " + mode}
	var city := City.new()
	city.name = "LegacyWorld"
	parent.add_child(city)
	city.build(map)
	return {"ok": true, "root": city, "map": map, "runtime": {"provider": FIXED_LEGACY, "seed": map_seed, "town_bounds": Rect2(-map.half_width, -map.half_depth, map.half_width * 2, map.half_depth * 2), "arrival_point": map.bus_position, "arrival_forward": Vector3.FORWARD, "world_root": city, "environment_root": city, "navigation_available": true, "gameplay_available": true}}
