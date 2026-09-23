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
	"PRP_CITY_001_shop_sign": Vector2(2.15, 0.42),
	"PRP_CITY_002_ac_unit": Vector2(1.12, 0.55),
	"PRP_CITY_003_power_pole": Vector2(0.72, 0.52),
	"PRP_CITY_004_power_wire_set": Vector2(9.0, 0.18),
	"PRP_CITY_005_traffic_light": Vector2(1.25, 0.6),
	"PRP_CITY_006_bus_shelter": Vector2(4.8, 1.85),
	"PRP_CITY_007_awning": Vector2(3.15, 1.25),
	"PRP_CITY_008_cardboard_stack": Vector2(1.45, 0.98),
	"PRP_CITY_009_fire_hydrant": Vector2(0.62, 0.62),
	"PRP_CITY_010_broken_billboard": Vector2(3.65, 0.52),
	"PRP_CITY_011_planter_box_pair": Vector2(1.65, 0.58),
	"PRP_CITY_012_neighborhood_notice_board": Vector2(1.28, 0.28),
	"PRP_CITY_013_recycling_bin_pair": Vector2(1.08, 0.65),
	"PRP_CITY_014_delivery_lockbox": Vector2(0.72, 0.58),
	"PRP_CITY_015_garden_tool_cart": Vector2(1.16, 0.62),
	"PRP_CITY_016_storefront_menu_stand": Vector2(0.62, 0.48),
	"PRP_CITY_017_beverage_crate_stack": Vector2(1.12, 0.74),
	"PRP_CITY_018_delivery_handcart": Vector2(0.86, 0.62),
	"PRP_CITY_019_sidewalk_banner_stand": Vector2(0.92, 0.44),
	"PRP_CITY_020_storefront_flag_pair": Vector2(1.12, 0.28),
	"PRP_CITY_021_street_bollard_set": Vector2(1.12, 0.42),
	"PRP_CITY_022_utility_cabinet": Vector2(0.76, 0.62),
	"PRP_CITY_023_guardrail_segment": Vector2(2.42, 0.26),
	"PRP_CITY_024_bicycle_parking_rack": Vector2(1.82, 0.54),
	"PRP_CITY_025_bus_stop_post": Vector2(0.48, 0.36),
	"PRP_CITY_026_fallen_market_sign": Vector2(1.42, 0.92),
	"PRP_CITY_027_cloth_tarp_bundle": Vector2(1.34, 0.98),
	"PRP_CITY_028_scattered_box_debris": Vector2(1.46, 1.02),
	"PRP_CITY_029_broken_fence_section": Vector2(2.12, 0.24),
	"PRP_CITY_030_roadside_grass_patch": Vector2(1.42, 1.12),
	"PRP_CITY_031_small_bush_cluster": Vector2(1.42, 1.04),
	"PRP_CITY_032_neglected_planter": Vector2(1.12, 0.76),
	"PRP_CITY_033_small_vine_patch": Vector2(1.12, 0.18),
	"PRP_CITY_034_umbrella_stand": Vector2(0.92, 1.42),
}
const RESIDENTIAL := ["PRP_STREET_001_trash_bin", "PRP_STREET_002_mailbox", "PRP_HOUSE_001_bicycle", "PRP_HOUSE_002_flower_pot_set", "PRP_HOUSE_003_laundry_rack", "PRP_HOUSE_004_patio_table_set", "PRP_HOUSE_005_wood_fence_segment", "PRP_HOUSE_006_package_box_set"]
const COMMERCIAL := ["PRP_STREET_008_vending_machine", "PRP_STREET_007_bench", "PRP_STREET_001_trash_bin", "PRP_STREET_004_traffic_cone", "PRP_STREET_006_bus_stop_sign", "PRP_HOUSE_006_package_box_set", "PRP_RUIN_003_broken_sign"]
const INDUSTRIAL := ["PRP_RUIN_004_tire_stack", "PRP_STREET_005_road_barrier", "PRP_RUIN_001_garbage_bag_pile", "PRP_RUIN_003_broken_sign", "PRP_STREET_001_trash_bin"]
const CITY_COMMERCIAL_SIGN := "PRP_CITY_001_shop_sign"
const CITY_AC_UNIT := "PRP_CITY_002_ac_unit"
const CITY_POWER_POLE := "PRP_CITY_003_power_pole"
const CITY_POWER_WIRE := "PRP_CITY_004_power_wire_set"
const CITY_TRAFFIC_LIGHT := "PRP_CITY_005_traffic_light"
const CITY_BUS_SHELTER := "PRP_CITY_006_bus_shelter"
const CITY_AWNING := "PRP_CITY_007_awning"
const CITY_CARDBOARD := "PRP_CITY_008_cardboard_stack"
const CITY_FIRE_HYDRANT := "PRP_CITY_009_fire_hydrant"
const CITY_BILLBOARD := "PRP_CITY_010_broken_billboard"
const RESIDENTIAL_V2 := ["PRP_CITY_011_planter_box_pair", "PRP_CITY_012_neighborhood_notice_board", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_014_delivery_lockbox", "PRP_CITY_015_garden_tool_cart", "PRP_CITY_031_small_bush_cluster", "PRP_CITY_032_neglected_planter", "PRP_CITY_034_umbrella_stand"]
const COMMERCIAL_V2 := ["PRP_CITY_016_storefront_menu_stand", "PRP_CITY_017_beverage_crate_stack", "PRP_CITY_018_delivery_handcart", "PRP_CITY_019_sidewalk_banner_stand", "PRP_CITY_020_storefront_flag_pair", "PRP_CITY_013_recycling_bin_pair", "PRP_CITY_034_umbrella_stand"]
const ROAD_V2 := ["PRP_CITY_021_street_bollard_set", "PRP_CITY_022_utility_cabinet", "PRP_CITY_023_guardrail_segment", "PRP_CITY_024_bicycle_parking_rack", "PRP_CITY_025_bus_stop_post", "PRP_CITY_030_roadside_grass_patch", "PRP_CITY_031_small_bush_cluster"]
const AFTERMATH_V2 := ["PRP_CITY_026_fallen_market_sign", "PRP_CITY_027_cloth_tarp_bundle", "PRP_CITY_028_scattered_box_debris", "PRP_CITY_029_broken_fence_section"]

var _rng := RandomNumberGenerator.new()
var _occupied: Array[Rect2] = []

func generate(town: Dictionary, baseline: Dictionary = {}) -> Dictionary:
	_rng.seed = int(town.seed) ^ 0x55445253
	_occupied.clear()
	_town_roads = town.get("roads", [])
	_town_buildings = town.get("buildings", [])
	for item: Dictionary in baseline.get("instances", []):
		_occupied.append(item.bounds)
	var result := {"seed": town.seed, "phase": "3C", "max_props": MAX_PROPS, "instances": [], "by_zone": {"RESIDENTIAL": 0, "COMMERCIAL": 0, "INDUSTRIAL": 0, "ARRIVAL": 0}, "by_asset": {}, "rejections": {}}
	_add_arrival(town, result)
	_add_road_dressing(town, result)
	for site_index: int in town.buildings.size():
		var site: Dictionary = town.buildings[site_index]
		var zone := _zone_for_site(site)
		var count := 1 if zone == "RESIDENTIAL" else 2 if zone == "COMMERCIAL" else 1
		for _attempt: int in count:
			var palette: Array = RESIDENTIAL if zone == "RESIDENTIAL" else COMMERCIAL if zone == "COMMERCIAL" else INDUSTRIAL
			var asset: String = palette[_rng.randi_range(0, palette.size() - 1)]
			_add_near_site(site, zone, asset, result)
		if zone == "COMMERCIAL":
			var facade_asset := CITY_COMMERCIAL_SIGN if site_index % 2 == 0 else CITY_AWNING
			_add_facade(site, facade_asset, 3.15 if facade_asset == CITY_COMMERCIAL_SIGN else 2.62, result)
		elif zone == "RESIDENTIAL" and site_index % 3 == 0:
			_add_facade(site, CITY_AC_UNIT, minf(float(site.size.y) * 0.48, 2.6), result)
		elif zone == "INDUSTRIAL":
			_add_city_frontage(site, CITY_CARDBOARD, result)
			if site_index % 3 == 0:
				_add_city_frontage(site, CITY_BILLBOARD, result)
	_ensure_zone(town, "COMMERCIAL", "PRP_STREET_008_vending_machine", result)
	_ensure_zone(town, "INDUSTRIAL", "PRP_RUIN_004_tire_stack", result)
	_ensure_zone(town, "INDUSTRIAL", CITY_CARDBOARD, result)
	_ensure_zone(town, "INDUSTRIAL", CITY_BILLBOARD, result)
	_add_zone_clusters(town, "INDUSTRIAL", result)
	_add_zone_clusters(town, "RESIDENTIAL", result)
	_add_zone_clusters(town, "COMMERCIAL", result)
	_add_arrival_stop(town, result)
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
	if asset.begins_with("PRP_CITY_") and int(result.by_asset.get(asset, 0)) > 0:
		return
	if not asset.begins_with("PRP_CITY_") and int(result.by_zone.get(zone, 0)) > 0:
		return
	for site: Dictionary in town.buildings:
		if _zone_for_site(site) != zone:
			continue
		if asset.begins_with("PRP_CITY_"):
			_add_city_frontage(site, asset, result)
			if int(result.by_asset.get(asset, 0)) > 0:
				return
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

func _add_district_cluster(site: Dictionary, site_index: int, zone: String, result: Dictionary) -> void:
	var pool: Array = RESIDENTIAL_V2 if zone == "RESIDENTIAL" else COMMERCIAL_V2 if zone == "COMMERCIAL" else AFTERMATH_V2
	var frequency := 4 if zone == "RESIDENTIAL" else 3 if zone == "COMMERCIAL" else 4
	if zone != "INDUSTRIAL" and site_index % frequency != 0:
		return
	var entry := Geometry.xz(site.entry)
	var away := (entry - Geometry.xz(site.road_point)).normalized()
	if away.is_zero_approx():
		return
	var tangent := Vector2(-away.y, away.x)
	var first_index := _rng.randi_range(0, pool.size() - 1)
	var second_index := (first_index + _rng.randi_range(1, pool.size() - 1)) % pool.size()
	var yaw := atan2(away.x, away.y)
	for asset: String in [pool[first_index], pool[second_index]]:
		for distance: float in [5.5, 7.0, 8.5, 10.0]:
			var placed := false
			for lateral: float in [1.8, -1.8, 3.8, -3.8, 0.0]:
				var point := entry + away * distance + tangent * lateral
				if _place(asset, point, yaw, zone, site.id, result):
					placed = true
					break
			if placed:
				break

func _add_zone_clusters(town: Dictionary, zone: String, result: Dictionary) -> void:
	var zone_index := 0
	for site: Dictionary in town.buildings:
		if result.instances.size() >= MAX_PROPS - 4:
			return
		if _zone_for_site(site) != zone:
			continue
		_add_district_cluster(site, zone_index, zone, result)
		zone_index += 1

func _add_arrival_stop(town: Dictionary, result: Dictionary) -> void:
	var origin := Geometry.xz(town.arrival.position)
	var road_index := int(town.arrival.get("road_index", -1))
	if road_index < 0 or road_index >= town.roads.size():
		return
	var road: Dictionary = town.roads[road_index]
	var tangent: Vector2 = (road.end - road.start).normalized()
	var normal := Vector2(-tangent.y, tangent.x)
	for distance: float in [9.0, 11.0, 13.0, 15.0, 17.0]:
		for lateral: float in [0.0, 4.0, -4.0, 8.0, -8.0]:
			for side: float in [-1.0, 1.0]:
				var point := origin + normal * side * distance + tangent * lateral
				if _place("PRP_CITY_025_bus_stop_post", point, atan2(-tangent.x, -tangent.y), "ARRIVAL", "arrival", result):
					return

func _add_facade(site: Dictionary, asset: String, height: float, result: Dictionary) -> void:
	var facing := Geometry.xz(site.get("front_direction", Vector3.FORWARD)).normalized()
	if facing.is_zero_approx():
		facing = (Geometry.xz(site.road_point) - Geometry.xz(site.position)).normalized()
	if facing.is_zero_approx():
		return
	var footprint: Vector2 = site.footprint
	var half_depth := absf(facing.x) * footprint.x * 0.5 + absf(facing.y) * footprint.y * 0.5
	var center: Vector2 = Geometry.xz(site.position) + facing * (half_depth + 0.12)
	var yaw := atan2(facing.x, facing.y)
	_place(asset, center, yaw, "COMMERCIAL" if asset != CITY_AC_UNIT else "RESIDENTIAL", site.id, result, height, site.id)

func _add_city_frontage(site: Dictionary, asset: String, result: Dictionary) -> void:
	var entry := Geometry.xz(site.entry)
	var outward := (Geometry.xz(site.road_point) - entry).normalized()
	if outward.is_zero_approx():
		outward = (Geometry.xz(site.road_point) - Geometry.xz(site.position)).normalized()
	if outward.is_zero_approx():
		return
	var tangent := Vector2(-outward.y, outward.x)
	var yaw := atan2(outward.x, outward.y)
	for distance: float in [1.0, 1.7, 2.4, 3.2]:
		for lateral: float in [3.2, -3.2, 5.2, -5.2, 0.0]:
			if _place(asset, entry + outward * distance + tangent * lateral, yaw, "INDUSTRIAL", site.id, result):
				return

func _add_road_dressing(town: Dictionary, result: Dictionary) -> void:
	var wire_number := 0
	for road_index: int in town.roads.size():
		if result.instances.size() >= MAX_PROPS:
			return
		var road: Dictionary = town.roads[road_index]
		var delta: Vector2 = road.end - road.start
		var length := delta.length()
		if length < 2.0:
			continue
		var tangent := delta / length
		var normal := Vector2(-tangent.y, tangent.x)
		var offset := float(road.width) * 0.5 + 1.75
		var side := normal if road_index % 2 == 0 else -normal
		var pole_point: Vector2 = road.start.lerp(road.end, 0.22) + side * offset
		var yaw := -atan2(tangent.y, tangent.x)
		if road_index % 4 == 0:
			_place(CITY_POWER_POLE, pole_point, yaw, "ROAD", road.id, result)
		if length >= 10.0 and wire_number < 8:
			var wire_point: Vector2 = road.start.lerp(road.end, 0.5)
			_place(CITY_POWER_WIRE, wire_point, yaw, "ROAD", road.id, result, 6.15, "", true, true)
			wire_number += 1
		if road_index % 8 == 0:
			var hydrant_point: Vector2 = road.start.lerp(road.end, 0.72) - side * (float(road.width) * 0.5 + 1.45)
			_place(CITY_FIRE_HYDRANT, hydrant_point, atan2(-side.x, -side.y), "ROAD", road.id, result)
		if road_index % 6 == 1:
			var fill_point: Vector2 = road.start.lerp(road.end, 0.72) + side * (float(road.width) * 0.5 + 1.9)
			var fill_asset: String = ROAD_V2[road_index % ROAD_V2.size()]
			_place(fill_asset, fill_point, yaw, "ROAD", road.id, result)
	_add_traffic_lights(town, result)
	_add_bus_shelter(town, result)

func _add_traffic_lights(town: Dictionary, result: Dictionary) -> void:
	var placed: Dictionary = {}
	for first_index: int in town.roads.size():
		var first: Dictionary = town.roads[first_index]
		var tangent: Vector2 = (first.end - first.start).normalized()
		var normal := Vector2(-tangent.y, tangent.x)
		for second_index: int in range(first_index + 1, town.roads.size()):
			var second: Dictionary = town.roads[second_index]
			var crossing: Variant = Geometry2D.segment_intersects_segment(first.start, first.end, second.start, second.end)
			if crossing == null:
				continue
			var point: Vector2 = crossing
			var key := "%d:%d" % [roundi(point.x), roundi(point.y)]
			if placed.has(key):
				continue
			placed[key] = true
			var side_offset := maxf(float(first.width), float(second.width)) * 0.5 + 2.25
			for sign: float in [-1.0, 1.0]:
				var candidate: Vector2 = point + tangent * side_offset + normal * side_offset * sign
				var to_center: Vector2 = point - candidate
				if _place(CITY_TRAFFIC_LIGHT, candidate, atan2(to_center.x, to_center.y), "ROAD", key, result):
					break

func _add_bus_shelter(town: Dictionary, result: Dictionary) -> void:
	for site: Dictionary in town.buildings:
		if _zone_for_site(site) != "COMMERCIAL":
			continue
		var road_point := Geometry.xz(site.road_point)
		var facing := Geometry.xz(site.get("front_direction", Vector3.FORWARD)).normalized()
		var tangent := Vector2(-facing.y, facing.x)
		var candidate := road_point + facing * (float(site.get("road_width", 8.0)) * 0.5 + 1.8) + tangent * 7.0
		if _place(CITY_BUS_SHELTER, candidate, atan2(-facing.x, -facing.y), "COMMERCIAL", site.id, result):
			return

func _place(asset: String, point: Vector2, yaw: float, zone: String, anchor: String, result: Dictionary, height: float = 0.0, mount_site: String = "", allow_road_overlap: bool = false, overhead: bool = false) -> bool:
	if result.instances.size() >= MAX_PROPS or not FOOTPRINTS.has(asset):
		return false
	var footprint: Vector2 = FOOTPRINTS[asset]
	var bounds := _oriented_bounds(point, yaw, footprint)
	if not _clear_of_town(bounds, zone, mount_site, allow_road_overlap, overhead):
		return false
	if mount_site.is_empty() and not overhead:
		for other: Rect2 in _occupied:
			if bounds.grow(0.08).intersects(other):
				return false
	var id := "URBAN_DRESS_%03d" % (result.instances.size() + 1)
	result.instances.append({"id": id, "asset": asset, "position": Vector3(point.x, height, point.y), "yaw": yaw, "scale": 1.0, "bounds": bounds, "zone": zone, "anchor": anchor, "mount_site": mount_site, "overhead": overhead, "allow_road_overlap": allow_road_overlap, "collision": false})
	if mount_site.is_empty() and not overhead:
		_occupied.append(bounds)
	result.by_zone[zone] = int(result.by_zone.get(zone, 0)) + 1
	result.by_asset[asset] = int(result.by_asset.get(asset, 0)) + 1
	return true

func _clear_of_town(bounds: Rect2, zone: String, mount_site: String = "", allow_road_overlap: bool = false, overhead: bool = false) -> bool:
	for road: Dictionary in _town_roads:
		if not allow_road_overlap and bounds.intersects(road.bounds):
			return false
	for building: Dictionary in _town_buildings:
		if overhead or building.id == mount_site:
			continue
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
