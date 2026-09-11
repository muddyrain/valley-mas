extends SceneTree

var failures: Array[String] = []
var checks := 0

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	# Load dynamically so missing implementation is a visible failing baseline.
	var catalog_script = load("res://data/catalog.gd")
	var clock_script = load("res://time/mission_clock.gd")
	var ledger_script = load("res://core/run_ledger.gd")
	if catalog_script == null or clock_script == null or ledger_script == null:
		printerr("FAIL: slice modules are not implemented")
		quit(1)
		return
	var catalog = catalog_script.new()
	check(catalog.validate().is_empty(), "All data references and numeric parameters must be valid")
	var source_map: Resource = catalog.map
	catalog.map = source_map.duplicate()
	catalog.map.search_resume_seconds = 0
	check(not catalog.validate().is_empty(), "Search requires a positive recovery delay")
	catalog.map.search_resume_seconds = source_map.search_resume_seconds
	catalog.map.search_radius = catalog.map.pickup_radius
	check(not catalog.validate().is_empty(), "Search completion stays inside the pickup radius")
	catalog.map = source_map
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var roundtrip_path := "res://test-output/map-roundtrip.res"
	check(ResourceSaver.save(catalog.map, roundtrip_path) == OK, "Map data can be serialized for export")
	var reloaded: Resource = ResourceLoader.load(roundtrip_path, "", ResourceLoader.CACHE_MODE_IGNORE)
	check(reloaded.initial_weapons == catalog.map.initial_weapons, "Binary resource conversion preserves the starting loadout")
	check(catalog.survivors.size() == 5 and catalog.traits.size() == 5, "Five survivors and five distinct traits")
	check(catalog.weapons.size() == 4 and catalog.enemies.size() == 4, "Four weapons and four enemy types")
	var clock = clock_script.new(catalog.map)
	clock.advance(catalog.map.day_seconds - 0.1)
	check(clock.phase == clock.DAY, "Day lasts for the configured duration")
	clock.advance(0.2)
	check(clock.phase == clock.BLUE_HOUR, "Crossing daylight boundary enters BLUE HOUR")
	clock.advance(catalog.map.blue_seconds)
	check(clock.phase == clock.NIGHT, "BLUE HOUR leads to Night")
	var early_speed: float = clock.speed_multiplier()
	var early_interval: float = clock.spawn_interval()
	clock.advance(90.0)
	check(clock.threat_level() > 1, "Night threat grows with time")
	check(clock.speed_multiplier() > early_speed, "Staying at night increases enemy speed")
	check(clock.spawn_interval() < early_interval, "Staying at night increases spawn pressure")
	clock.set_phase(clock.DAY)
	check(clock.threat_level() == 0 and clock.elapsed == 0.0, "Debug Day resets temporary night pressure")
	clock.advance(catalog.map.day_seconds + catalog.map.blue_seconds + 5.0)
	check(clock.phase == clock.NIGHT and is_equal_approx(clock.night_elapsed(), 5.0), "Large time steps preserve both transitions")
	var ledger = ledger_script.new()
	ledger.begin()
	ledger.add_loot(7, 9)
	var result: Dictionary = ledger.finish(["lin", "qiao"], ["yan"], 180.0, 2, false)
	check(result.food == 7 and result.scrap == 9 and result.returned.size() == 2, "Evacuation keeps carried loot and reports casualties")
	ledger.finish(["lin"], [], 200.0, 3, false)
	check(ledger.stored_food == 7 and ledger.stored_scrap == 9, "Repeated settlement never duplicates loot")
	ledger.begin()
	ledger.add_loot(100, 100)
	result = ledger.finish([], ["lin", "qiao", "yan"], 240.0, 4, true)
	check(result.food == 0 and result.scrap == 0 and ledger.stored_food == 7, "A wipe loses carried loot but never takes previous stock")
	ledger.begin()
	check(ledger.food == 0 and ledger.scrap == 0 and not ledger.settled, "A new sortie clears only mission state")
	print("RULES: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
