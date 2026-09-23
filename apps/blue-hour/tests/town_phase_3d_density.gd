extends SceneTree
## Phase 3D acceptance for denser frontage, district continuity, and seeded stability.

const Generator = preload("res://maps/town/town_generator.gd")
const SEEDS: Array[int] = [4101, 4102, 4103, 4104, 4105]

var checks := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for seed_value: int in SEEDS:
		_audit_seed(seed_value)
	print("TOWN PHASE 3D DENSITY: %d checks, %d failures" % [checks, failures.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _audit_seed(seed_value: int) -> void:
	var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(bool(town.get("ok", false)), "Seed %d generates" % seed_value)
	if not bool(town.get("ok", false)):
		printerr("PHASE_3D seed=%d generation_error=%s" % [seed_value, str(town.get("error", "unknown"))])
		return
	var repeated: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
	_check(var_to_str(town) == var_to_str(repeated), "Seed %d remains deterministic" % seed_value)
	_check(bool(town.town_metrics.connectivity), "Seed %d street graph remains connected" % seed_value)
	_check(int(town.composition.dead_end_count) >= 2, "Seed %d keeps neighborhood side streets" % seed_value)
	var residential_buildings := 0
	var commercial_buildings := 0
	var industrial_buildings := 0
	for block: Dictionary in town.blocks:
		var residential_row_count := 0
		for row: Dictionary in block.rows:
			if row.category == "residential":
				residential_row_count += int(row.count)
				_check(float(row.gap) <= 2.1, "Seed %d residential frontage gap is compact" % seed_value)
			elif row.category == "commercial":
				_check(float(row.gap) <= 1.1, "Seed %d commercial frontage stays continuous" % seed_value)
			elif row.category == "industrial":
				_check(float(row.gap) <= 4.0, "Seed %d industrial frontage is grouped" % seed_value)
		if str(block.type).begins_with("RESIDENTIAL"):
			_check(residential_row_count >= 3 and residential_row_count <= 5,
				"Seed %d residential block has three to five homes" % seed_value)
		for site: Dictionary in town.buildings:
			if site.block_id != block.id:
				continue
			if site.category == "residential":
				residential_buildings += 1
			elif site.category == "commercial":
				commercial_buildings += 1
			elif site.category == "industrial":
				industrial_buildings += 1
	_check(residential_buildings >= 25, "Seed %d keeps a substantial residential district" % seed_value)
	_check(commercial_buildings >= 15, "Seed %d keeps a continuous commercial strip" % seed_value)
	_check(industrial_buildings >= 4, "Seed %d forms a grouped industrial district" % seed_value)
	_check(float(town.blueprint.residential_frontage_occupancy) >= 0.58,
		"Seed %d residential frontage occupancy is dense" % seed_value)
	_check(float(town.blueprint.commercial_frontage_occupancy) >= 0.65,
		"Seed %d commercial frontage occupancy is dense" % seed_value)
	for site: Dictionary in town.buildings:
		var entrance_forward := Vector2(site.primary_entrance_forward.x, site.primary_entrance_forward.z).normalized()
		var frontage_forward := Vector2(site.front_direction.x, site.front_direction.z).normalized()
		_check(entrance_forward.dot(frontage_forward) > 0.999, "Seed %d entrances face their assigned street" % seed_value)
	print("PHASE_3D seed=%d buildings=%d residential=%d commercial=%d industrial=%d frontage=%.2f/%.2f" % [
		seed_value, town.buildings.size(), residential_buildings, commercial_buildings, industrial_buildings,
		town.blueprint.residential_frontage_occupancy, town.blueprint.commercial_frontage_occupancy])

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
