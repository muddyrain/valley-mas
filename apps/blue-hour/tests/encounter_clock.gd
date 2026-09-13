extends SceneTree
var checks: int = 0
var failures: Array[String] = []

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var map: Resource = load("res://data/maps/east_quay.tres").duplicate(true)
	var clock: RefCounted = load("res://time/mission_clock.gd").new(map)
	clock.advance(map.day_seconds - 31)
	check(not clock.get("warning_active"), "Day stays normal before the warning window")
	clock.advance(1)
	check(clock.get("warning_active") == true, "Warning begins 30 seconds before blue hour")
	if clock.has_method("perception_multiplier"):
		var range_before: float = clock.perception_multiplier()
		clock.advance(15)
		check(clock.perception_multiplier() > range_before and clock.perception_multiplier() < 1.16, "Warning perception ramps gradually")
		check(clock.spawn_interval() < map.encounter.daytime_respawn_interval, "Warning raises replenishment frequency")
		var frozen: float = clock.elapsed
		clock.advance(5, true)
		check(clock.elapsed == frozen, "Clock-freeze ability preserves warning time")
		clock.advance(15)
		check(clock.phase == clock.BLUE_HOUR and not clock.warning_active, "Official blue hour follows warning without another countdown")
	clock.set_phase(clock.DAY)
	check(not clock.get("warning_active"), "New day resets warning")
	print("ENCOUNTER CLOCK: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
