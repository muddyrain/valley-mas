extends RefCounted
## Deterministic, additive street-life placement over the frozen town result.

const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const MAX_PROPS := 96
const ARRIVAL_RADIUS := 20.0
const FOOTPRINTS := {
	"PRP_STREET_001_trash_bin": Vector2(0.72, 0.72),
	"PRP_STREET_002_mailbox": Vector2(0.62, 0.58),
	"PRP_STREET_003_street_lamp_b": Vector2(1.5, 0.5),
	"PRP_STREET_004_traffic_cone": Vector2(0.48, 0.48),
	"PRP_STREET_005_road_barrier": Vector2(2.25, 0.55),
	"PRP_STREET_006_bus_stop_sign": Vector2(0.7, 0.3),
	"PRP_STREET_007_bench": Vector2(2.0, 0.75),
	"PRP_STREET_008_vending_machine": Vector2(1.08, 0.82),
	"PRP_HOUSE_001_bicycle": Vector2(1.05, 0.82),
	"PRP_HOUSE_002_flower_pot_set": Vector2(1.45, 0.7),
	"PRP_HOUSE_003_laundry_rack": Vector2(1.95, 0.7),
	"PRP_HOUSE_004_patio_table_set": Vector2(2.0, 1.1),
	"PRP_HOUSE_005_wood_fence_segment": Vector2(3.15, 0.24),
	"PRP_HOUSE_006_package_box_set": Vector2(1.1, 0.7),
	"PRP_RUIN_001_garbage_bag_pile": Vector2(1.15, 0.85),
	"PRP_RUIN_002_fallen_bicycle": Vector2(1.05, 0.82),
	"PRP_RUIN_003_broken_sign": Vector2(1.0, 0.24),
	"PRP_RUIN_004_tire_stack": Vector2(0.95, 0.95),
}
const RESIDENTIAL := ["PRP_STREET_001_trash_bin", "PRP_STREET_002_mailbox", "PRP_HOUSE_001_bicycle", "PRP_HOUSE_002_flower_pot_set", "PRP_HOUSE_003_laundry_rack", "PRP_HOUSE_004_patio_table_set", "PRP_HOUSE_005_wood_fence_segment", "PRP_HOUSE_006_package_box_set"]
const COMMERCIAL := ["PRP_STREET_008_vending_machine", "PRP_STREET_007_bench", "PRP_STREET_001_trash_bin", "PRP_STREET_004_traffic_cone", "PRP_STREET_006_bus_stop_sign", "PRP_HOUSE_006_package_box_set", "PRP_RUIN_003_broken_sign"]
const INDUSTRIAL := ["PRP_RUIN_004_tire_stack", "PRP_STREET_005_road_barrier", "PRP_RUIN_001_garbage_bag_pile", "PRP_RUIN_003_broken_sign", "PRP_STREET_001_trash_bin"]

var _rng := RandomNumberGenerator.new()
var _occupied: Array[Rect2] = []

func generate(town: Dictionary, baseline: Dictionary = {}) -> Dictionary:
	_rng.seed = int(town.seed) ^ 0x55445253
	_occupied.clear()
	_town_roads = town.get("roads", [])
	_town_buildings = town.get("buildings", [])
	for item: Dictionary in baseline.get("instances", []):
		_occupied.append(item.bounds)
	var result := {"seed": town.seed, "phase": "3A", "max_props": MAX_PROPS, "instances": [], "by_zone": {"RESIDENTIAL": 0, "COMMERCIAL": 0, "INDUSTRIAL": 0, "ARRIVAL": 0}, "rejections": {}}
	_add_arrival(town, result)
	for site: Dictionary in town.buildings:
		var zone := _zone_for_site(site)
		var count := 1 if zone == "RESIDENTIAL" else 2 if zone == "COMMERCIAL" else 1
		for _attempt: int in count:
			var palette: Array = RESIDENTIAL if zone == "RESIDENTIAL" else COMMERCIAL if zone == "COMMERCIAL" else INDUSTRIAL
			var asset: String = palette[_rng.randi_range(0, palette.size() - 1)]
			_add_near_site(site, zone, asset, result)
	_ensure_zone(town, "COMMERCIAL", "PRP_STREET_008_vending_machine", result)
	_ensure_zone(town, "INDUSTRIAL", "PRP_RUIN_004_tire_stack", result)
	return result

func _zone_for_site(site: Dictionary) -> String:
	var use := str(site.get("land_use_type", ""))
	if use.begins_with("RESIDENTIAL"):
		return "RESIDENTIAL"
	if use in ["COMMERCIAL_CORE", "MIXED_TRANSITION"]:
		return "COMMERCIAL"
	return "INDUSTRIAL"

func _add_arrival(town: Dictionary, result: Dictionary) -> void:
	var origin := Geometry.xz(town.arrival.position)
	var road_index := int(town.arrival.get("road_index", -1))
	var tangent := Vector2.RIGHT
	if road_index >= 0 and road_index < town.roads.size():
		var road: Dictionary = town.roads[road_index]
		tangent = (road.end - road.start).normalized()
	var normal := Vector2(-tangent.y, tangent.x)
	var mandatory: Array[String] = ["PRP_STREET_003_street_lamp_b", "PRP_STREET_003_street_lamp_b", "PRP_STREET_001_trash_bin", "PRP_STREET_007_bench", "PRP_HOUSE_002_flower_pot_set"]
	for index: int in mandatory.size():
		var side := normal if index % 2 == 0 else -normal
		var point := origin + side * 7.5 + tangent * float(index - 2) * 3.0
		if not _place(mandatory[index], point, atan2(tangent.x, tangent.y), "ARRIVAL", "arrival", result):
			var fallback_side := side
			for retry: int in 8:
				var fallback := origin + fallback_side * (7.0 + retry * 0.55) + tangent * float(retry - 3)
				if _place(mandatory[index], fallback, 0.0, "ARRIVAL", "arrival", result):
					break

func _ensure_zone(town: Dictionary, zone: String, asset: String, result: Dictionary) -> void:
	if int(result.by_zone.get(zone, 0)) > 0:
		return
	for site: Dictionary in town.buildings:
		if _zone_for_site(site) != zone:
			continue
		var entry := Geometry.xz(site.entry)
		var away := (entry - Geometry.xz(site.road_point)).normalized()
		if away.is_zero_approx():
			away = Vector2.UP
		var tangent := Vector2(-away.y, away.x)
		for distance: float in [5.5, 7.0, 8.5, 10.0]:
			for lateral: float in [0.0, 2.0, -2.0, 4.0, -4.0]:
				if _place(asset, entry + away * distance + tangent * lateral, atan2(away.x, away.y), zone, site.id, result):
					return

func _add_near_site(site: Dictionary, zone: String, asset: String, result: Dictionary) -> void:
	var entry := Geometry.xz(site.entry)
	var road_point := Geometry.xz(site.road_point)
	var away := (entry - road_point).normalized()
	if away.is_zero_approx():
		away = Vector2.UP
	var tangent := Vector2(-away.y, away.x)
	for distance: float in [2.6, 3.4, 4.2, 5.0]:
		for lateral: float in [0.0, 1.2, -1.2]:
			var point := entry + away * distance + tangent * lateral
			if _place(asset, point, atan2(away.x, away.y), zone, site.id, result):
				return
	result.rejections[zone] = int(result.rejections.get(zone, 0)) + 1

func _place(asset: String, point: Vector2, yaw: float, zone: String, anchor: String, result: Dictionary) -> bool:
	if result.instances.size() >= MAX_PROPS or not FOOTPRINTS.has(asset):
		return false
	var footprint: Vector2 = FOOTPRINTS[asset]
	var bounds := _oriented_bounds(point, yaw, footprint)
	if not _clear_of_town(bounds, zone):
		return false
	for other: Rect2 in _occupied:
		if bounds.grow(0.08).intersects(other):
			return false
	var id := "URBAN_DRESS_%03d" % (result.instances.size() + 1)
	result.instances.append({"id": id, "asset": asset, "position": Vector3(point.x, 0, point.y), "yaw": yaw, "scale": 1.0, "bounds": bounds, "zone": zone, "anchor": anchor, "collision": false})
	_occupied.append(bounds)
	result.by_zone[zone] = int(result.by_zone.get(zone, 0)) + 1
	return true

func _clear_of_town(bounds: Rect2, zone: String) -> bool:
	for road: Dictionary in _town_roads:
		if bounds.intersects(road.bounds):
			return false
	for building: Dictionary in _town_buildings:
		if bounds.intersects(building.bounds.grow(0.18)):
			return false
	return true

var _town_roads: Array = []
var _town_buildings: Array = []

func _oriented_bounds(point: Vector2, yaw: float, size: Vector2) -> Rect2:
	var half := size * 0.5
	var c := absf(cos(yaw)); var s := absf(sin(yaw))
	var extent := Vector2(c * half.x + s * half.y, s * half.x + c * half.y)
	return Rect2(point - extent, extent * 2.0)
