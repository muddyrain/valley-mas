extends SceneTree

const Generator = preload("res://maps/town/town_generator.gd")
const EnvironmentPass = preload("res://maps/town/environment/town_environment_pass.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Catalog = preload("res://data/world_asset_catalog.gd")
const Rules = preload("res://maps/town/environment/town_environment_rules.gd")
var output: String = "res://test-output/medium-town-environment-m00"
var street_life: bool = false
var polish: bool = false
const Reuse = preload("res://maps/town/environment/town_reuse_rules.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("_run")

func _check(valid: bool, label: String) -> void:
	checks += 1
	if not valid:
		failures.append(label)
		push_error(label)

func _run() -> void:
	polish = OS.get_cmdline_user_args().has("--polish")
	street_life = polish or OS.get_cmdline_user_args().has("--street-life")
	if street_life:
		output = "res://test-output/medium-town-environment-m01"
	if polish:
		output = "res://test-output/medium-town-environment-m01-1"
		_validate_materials()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	var cases: Array[Dictionary] = []
	var signatures: Array[String] = []
	var orientations: Dictionary = {}
	for seed_value: int in [4101, 4102, 4103, 4104, 4105, 4106, 4110, 4201]:
		var town := Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		_check(town.ok, "Town generation %d" % seed_value)
		var before := var_to_str(town)
		_check(before == var_to_str(Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")), "Town seed determinism")
		var pass_instance: RefCounted = preload("res://maps/town/environment/town_street_life_pass.gd").new() if street_life else EnvironmentPass.new()
		if polish:
			pass_instance = preload("res://maps/town/environment/town_environment_polish.gd").new()
		var started := Time.get_ticks_msec()
		var result: Dictionary = pass_instance.generate(town)
		var elapsed := Time.get_ticks_msec() - started
		_check(before == var_to_str(town), "Input town unchanged")
		_check(var_to_str(result) == var_to_str(pass_instance.generate(town)), "Environment seed determinism")
		_check(town.exploration_routes.size() == 3, "Three frozen routes")
		if seed_value == 4101:
			var frozen := FileAccess.get_file_as_string("res://test-output/medium-town-blueprint/generated-town.txt")
			_check(before == frozen, "Exact frozen Blueprint town snapshot")
			FileAccess.open(output.path_join("environment.txt"), FileAccess.WRITE).store_string(var_to_str(result))
		if street_life:
			var original := EnvironmentPass.new().generate(town)
			if polish:
				_validate_polish(town, result)
			else:
				_check(var_to_str(result.instances.slice(0, result.base_instances)) == var_to_str(original.instances), "M00 instances retained exactly")
			if seed_value == 4101:
				_check(var_to_str(original) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m00/environment.txt"), "Exact frozen M00 environment snapshot")
			for key: String in ["benches", "pallets", "metal_crates", "low_fence_segments", "direction_signs", "vending_machines"]:
				_check(result.statistics[key] > 0, "Core reuse present: " + key)
			for group: Dictionary in result.groups:
				var members: Array = result.instances.filter(func(item: Dictionary) -> bool: return item.id in group.members)
				_check(members.size() == group.members.size(), "Composition fully committed")
				if group.kind == "cargo":
					var pallets: Array = members.filter(func(item: Dictionary) -> bool: return item.asset == Reuse.PALLET)
					_check(pallets.size() >= 1 and pallets.size() <= 3, "Cargo uses 1-3 grouped pallets")
			for opening: Dictionary in result.openings:
				_check(is_equal_approx(opening.width, 2.0) and opening.members.size() == 2, "Two independent fence segments with 2m gap")
				for item: Dictionary in result.instances:
					_check(not opening.bounds.intersects(item.bounds), "Open entry remains unobstructed")
		var slots: Dictionary = {}
		for slot: Dictionary in result.slots:
			slots[slot.id] = slot
			_check(slot.type in Rules.SLOT_TYPES, "Supported semantic slot")
		var measured: Array[Rect2] = []
		for item: Dictionary in result.instances:
			if street_life and Reuse.COUNTS.has(item.asset):
				_check(Reuse.permits(item.asset, slots[item.slot_id]), "Whitelist land use and slot restrictions")
				_check(not Catalog.asset(item.asset).searchable, "Decorative assets do not imply search gameplay")
				_check(item.slot_type != "PARKING", "Empty painted parking bays stay available")
			_check(item.asset not in Reuse.EXCLUDED, "Special and gameplay props excluded")
			var instance: Node3D = Catalog.asset(item.asset).scene.instantiate()
			var actual := Geometry.footprint(Geometry.bounds(instance).merge(Geometry.bounds(instance, true)), Geometry.xz(item.position), item.yaw, item.scale)
			instance.free()
			_check(actual.is_equal_approx(item.bounds), "Actual runtime footprint")
			_check(Geometry.contains(slots[item.slot_id].polygon, actual), "Full object inside assigned slot")
			for other: Rect2 in measured:
				_check(not actual.intersects(other), "Environment pair overlap")
			measured.append(actual)
			for zone: Dictionary in result.clear_zones:
				_check(not actual.intersects(zone.bounds), "Clear " + zone.kind)
			# Direct town checks do not rely on the pass's reported clear zones.
			for road: Dictionary in town.roads:
				_check(not actual.intersects(road.bounds), "Road vehicle corridor")
				var pavement: Rect2 = road.bounds.grow(2.2)
				var curbs: Rect2 = road.bounds.grow(0.65)
				var walk_segments: Array[Rect2] = [Rect2(pavement.position, Vector2(pavement.size.x, 1.5)), Rect2(Vector2(pavement.position.x, pavement.end.y - 1.5), Vector2(pavement.size.x, 1.5)), Rect2(Vector2(pavement.position.x, curbs.position.y), Vector2(1.5, curbs.size.y)), Rect2(Vector2(pavement.end.x - 1.5, curbs.position.y), Vector2(1.5, curbs.size.y))]
				for walk: Rect2 in walk_segments:
					_check(not actual.intersects(walk), "Continuous sidewalk >=1.5m")
			for building: Dictionary in town.buildings:
				_check(not actual.intersects(building.bounds), "Environment-building collision")
				var entry := Geometry.xz(building.entry)
				_check(entry.distance_to(entry.clamp(actual.position, actual.end)) >= 2.0, "Entrance >=2m")
			for route: Dictionary in town.exploration_routes:
				for index: int in range(1, route.points.size()):
					var segment_box := Rect2(route.points[index - 1], Vector2.ZERO).expand(route.points[index]).grow(0.75)
					_check(not actual.intersects(segment_box), "Route corridor >=1.5m")
			if item.asset == Rules.FENCE:
				_check(item.slot_type in ["SERVICE_YARD", "LOADING_YARD", "INDUSTRIAL_EDGE", "TOWN_EDGE"], "Fence restricted to service edges")
			if item.asset.begins_with("VEH_"):
				_check(is_zero_approx(fmod(item.yaw, PI / 2)), "Vehicles aligned to street axes")
		var signature := var_to_str(result.instances).sha256_text()
		_check(result.parking_legal == 0 or (result.parking_occupancy >= 0.25 and result.parking_occupancy <= 0.55), "Legal parking occupancy 25-55 percent when available")
		_check(not signatures.has(signature), "Different seeds produce different environment")
		signatures.append(signature)
		orientations[town.orientation_quarters] = true
		cases.append({"seed": seed_value, "orientation": town.orientation_quarters, "instances": result.instances.size(), "statistics": result.statistics, "by_land_use": result.by_land_use, "parking_legal": result.parking_legal, "parking_occupied": result.parking_occupied, "parking_occupancy": result.parking_occupancy, "generate_ms": elapsed, "environment_sha256": signature, "rejections": result.rejections})
		print("ENVIRONMENT seed=%d instances=%d parking=%d/%d ms=%d" % [seed_value, result.instances.size(), result.parking_occupied, result.parking_legal, elapsed])
	_check(orientations.size() == 4, "All four frozen town orientations covered")
	FileAccess.open(output.path_join("validation.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "cases": cases, "orientations": orientations.keys(), "visual_qa": "PENDING HUMAN REVIEW"}, "\t"))
	print("TOWN ENVIRONMENT: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func _validate_polish(town: Dictionary, result: Dictionary) -> void:
	var baseline := preload("res://maps/town/environment/town_street_life_pass.gd").new().generate(town)
	if town.seed == 4101:
		_check(var_to_str(baseline) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-m01/environment.txt"), "Exact frozen M01 baseline")
	var originals: Dictionary = {}
	var current: Dictionary = {}
	var ledger: Dictionary = {}
	for item: Dictionary in baseline.instances:
		originals[item.id] = item
	for change: Dictionary in result.preservation.changes:
		_check(not ledger.has(change.id), "One ledger record per changed instance")
		ledger[change.id] = change
	for item: Dictionary in result.instances:
		current[item.id] = item
		_check(originals.has(item.id), "No new environment instance")
		var old: Dictionary = originals[item.id]
		_check(item.asset == old.asset and item.scale == old.scale, "Original asset and scale retained")
		if var_to_str(item) != var_to_str(old):
			_check(item.asset in [Reuse.BENCH, Reuse.PALLET, Reuse.METAL, Reuse.WOOD, Reuse.VENDING] or (item.asset.begins_with("VEH_") and item.land_use.begins_with("RESIDENTIAL")), "Only authorized instance types moved")
			_check(ledger.has(item.id) and var_to_str(ledger[item.id].before) == var_to_str(old) and var_to_str(ledger[item.id].after) == var_to_str(item), "Exact placement delta recorded")
	for old: Dictionary in baseline.instances:
		if not current.has(old.id):
			_check(old.asset == Rules.BUSH and ledger.has(old.id) and ledger[old.id].after.is_empty(), "Only documented bushes removed")
	var residential: Array = result.instances.filter(func(item: Dictionary) -> bool: return item.land_use.begins_with("RESIDENTIAL") and item.asset.begins_with("VEH_"))
	_check(result.driveways.size() == residential.size(), "Every residential vehicle has a ground surface")
	for surface: Dictionary in result.driveways:
		var car: Dictionary = current[surface.vehicle_id]
		_check(surface.pad.encloses(car.bounds), "Parking pad contains actual vehicle footprint")
		_check(is_zero_approx(car.position.y - surface.surface_y), "Vehicle grounded")
		_check(surface.pad.get_area() < 40, "Small individual parking pad")
		for item: Dictionary in result.instances:
			if item.id != car.id:
				_check(not surface.pad.intersects(item.bounds), "Parking pad clear of other props and vegetation")
		for building: Dictionary in town.buildings:
			_check(not surface.pad.intersects(building.bounds), "Parking pad clear of buildings")
		if surface.connector.has_area():
			_check(surface.connector.intersects(surface.pad), "Driveway connected to parking pad")
			for item: Dictionary in result.instances:
				if item.id != car.id:
					_check(not surface.connector.intersects(item.bounds), "Driveway clear of vegetation and other props")
			for building: Dictionary in town.buildings:
				_check(not surface.connector.intersects(building.bounds), "Driveway clear of buildings")
	for node: Dictionary in result.park_nodes:
		if node.kind != "rest":
			continue
		_check(node.members.size() >= 1 and node.members.size() <= 2, "Rest node has 1-2 benches")
		for id: String in node.members:
			var bench: Dictionary = current[id]
			var forward := Vector2(-sin(bench.yaw), -cos(bench.yaw))
			var block: Dictionary = town.blocks.filter(func(value: Dictionary) -> bool: return value.id == bench.block_id)[0]
			var point := Geometry.xz(bench.position)
			var center: Vector2 = block.bounds.get_center()
			var nearest := Vector2(point.x, center.y) if absf(point.y - center.y) < absf(point.x - center.x) else Vector2(center.x, point.y)
			var target: Vector2 = nearest - point
			_check(forward.dot(target.normalized()) > 0.5, "Bench faces park path")
	for group: Dictionary in result.groups:
		if group.kind == "cargo":
			for id: String in group.members:
				_check(current[id].position.distance_to(group.center) < 5.0, "Cargo node compact")
	print("POLISH seed=%d changes=%s driveways=%d park_nodes=%d" % [town.seed, str([result.preservation.unchanged, result.preservation.moved, result.bush_removed]), result.driveways.size(), result.park_nodes.size()])

func _validate_materials() -> void:
	var view := preload("res://maps/town/environment/town_polish_view.gd")
	for asset: String in [Reuse.BENCH, Reuse.PALLET, Reuse.WOOD, Reuse.METAL]:
		var wrapper: Node3D = Catalog.asset(asset).scene.instantiate()
		var before := Geometry.bounds(wrapper)
		var sources: Array[Dictionary] = []
		for mesh: MeshInstance3D in wrapper.find_children("*", "MeshInstance3D", true, false):
			for index: int in mesh.mesh.get_surface_count():
				var source := mesh.get_active_material(index) as StandardMaterial3D
				sources.append({"mesh": mesh, "surface": index, "material": source, "color": source.albedo_color, "roughness": source.roughness})
		view.style(wrapper)
		_check(Geometry.bounds(wrapper).is_equal_approx(before), "Material polish preserves source geometry")
		var changed := 0
		for surface: Dictionary in sources:
			var source: StandardMaterial3D = surface.material
			var active: StandardMaterial3D = surface.mesh.get_active_material(surface.surface)
			_check(source.albedo_color == surface.color and source.roughness == surface.roughness, "Shared source material untouched")
			if view.COLORS.get(asset, {}).has(source.resource_name):
				_check(active != source and active.albedo_color == Color(view.COLORS[asset][source.resource_name]), "Scoped target color override")
				changed += 1
			else:
				_check(active == source, "Non-target material unchanged")
		_check(changed > 0 if asset != Reuse.METAL else changed == 0, "Expected material override coverage")
		wrapper.free()
