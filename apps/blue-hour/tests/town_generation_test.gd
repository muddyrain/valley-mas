extends SceneTree
const Generator = preload("res://maps/town/town_generator.gd")
const Profiles = preload("res://maps/town/town_skeleton.gd")
func _initialize() -> void:
	var failures: Array[String] = []; var checks := 0
	for profile: String in Profiles.IDS:
		for seed_value: int in [4101, 4102, 4103]:
			var a := Generator.generate("food_supply", seed_value, profile); var b := Generator.generate("food_supply", seed_value, profile); checks += 1
			if not a.ok or not b.ok: failures.append("generation %s" % profile); continue
			if var_to_str(a) != var_to_str(b): failures.append("determinism %s" % profile)
			if a.blocks.size() < 10 or a.blocks.size() > 16: failures.append("block count %s" % profile)
			var maximum_buildings: int = 60 if profile == Profiles.IDS[0] else 50
			if a.buildings.size() < 30 or a.buildings.size() > maximum_buildings: failures.append("building count %s=%d" % [profile, a.buildings.size()])
			var metrics: Dictionary = a.town_metrics
			if metrics.intersection_count < 5: failures.append("intersections %s" % profile)
			if profile == Profiles.IDS[0]:
				if not metrics.connectivity or a.composition.dead_end_count < 2: failures.append("connected side streets %s" % profile)
			elif metrics.dead_end_count < 1 or metrics.dead_end_count > 3:
				failures.append("dead ends %s" % profile)
			if metrics.loop_count < 1 or metrics.alternative_route_count < 2: failures.append("routes %s" % profile)
			if a.road_distance_to_poi < 45.0: failures.append("poi distance %s" % profile)
	print("MEDIUM TOWN PHASE A: %d cases, %d failures" % [checks, failures.size()]); print(failures)
	quit(0 if failures.is_empty() else 1)
