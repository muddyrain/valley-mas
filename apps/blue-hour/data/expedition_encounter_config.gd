class_name ExpeditionEncounterConfig
extends Resource
## Metres and simulation seconds. A mission owns a private copy via MapData.
@export_group("Initial population")
@export var initial_zombie_min: int = 18
@export var initial_zombie_max: int = 30
@export var arrival_population: int = 4
@export var arrival_spawn_min: float = 22.0
@export var arrival_spawn_max: float = 26.0
@export var spawn_safe_radius: float = 14.0
@export var spawn_spacing: float = 1.2
@export var spawn_attempts: int = 80
@export var edge_inset: float = 3.0
@export var offscreen_margin: float = 100.0
@export var population_limit: int = 85
@export_group("Perception and movement")
@export var visual_range_day: float = 14.0
@export var visual_fov: float = 120.0
@export var hearing_multiplier: float = 1.0
@export var wander_radius: float = 6.0
@export var wander_speed_multiplier: float = 0.45
@export var investigate_speed_multiplier: float = 0.65
@export var wander_idle_min: float = 1.5
@export var wander_idle_max: float = 5.0
@export var investigate_wait: float = 3.0
@export var target_memory_seconds: float = 4.0
@export var perception_tick_min: float = 0.15
@export var perception_tick_max: float = 0.35
@export var far_distance: float = 38.0
@export var far_tick: float = 0.9
@export var path_update_interval: float = 0.7
@export var far_path_interval: float = 1.8
@export var path_target_distance: float = 1.5
@export_group("Noise")
@export var arrival_noise_radius: float = 28.0
@export var melee_noise_radius: float = 6.0
@export var pistol_noise_radius: float = 22.0
@export var rifle_noise_radius: float = 30.0
@export var shotgun_noise_radius: float = 38.0
@export var footstep_noise_radius: float = 0.0
@export var explosion_noise_radius: float = 45.0
@export var noise_obstacle_multiplier: float = 0.8
@export var noise_lifetime: float = 0.8
@export var noise_memory_seconds: float = 12.0
@export var noise_event_limit: int = 64
@export var interest_refresh_seconds: float = 1.5
@export_group("Daytime")
@export var daytime_min_population: int = 10
@export var daytime_respawn_batch: int = 3
@export var daytime_respawn_interval: float = 35.0
@export_group("Blue hour")
@export var blue_hour_warning_seconds: float = 30.0
@export var warning_perception_multiplier: float = 1.15
@export var warning_spawn_multiplier: float = 1.5
@export var blue_hour_speed_multiplier: float = 1.2
@export var blue_hour_visual_multiplier: float = 1.4
@export var blue_hour_hearing_multiplier: float = 1.4
@export var blue_hour_spawn_multiplier: float = 2.5
@export var blue_hour_spawn_batch: int = 4
@export var blue_hour_spawn_interval: float = 25.0
@export var horde_interest_radius: float = 10.0
@export var horde_pressure_seconds: float = 30.0
@export var horde_interval_step: float = 0.15
@export var horde_min_interval: float = 4.0
@export_group("Arrival")
@export var arrival_stop_seconds: float = 0.7
@export var disembark_seconds: float = 1.5
@export var disembark_spacing: float = 0.3

func validation_errors() -> Array[String]:
	var errors: Array[String] = []
	for property: Dictionary in get_property_list():
		if int(property.usage) & PROPERTY_USAGE_SCRIPT_VARIABLE == 0:
			continue
		var value: Variant = get(property.name)
		if value is float and (not is_finite(value) or value < 0.0):
			errors.append("Invalid encounter value: " + str(property.name))
		elif value is int and value < 0:
			errors.append("Negative encounter value: " + str(property.name))
	if initial_zombie_max < initial_zombie_min or arrival_population > initial_zombie_min or initial_zombie_max > population_limit:
		errors.append("Invalid encounter population bounds")
	if arrival_spawn_min <= spawn_safe_radius or arrival_spawn_max < arrival_spawn_min or spawn_spacing < 0.65:
		errors.append("Invalid encounter spawn safety")
	if visual_fov <= 0 or visual_fov > 360 or perception_tick_min <= 0 or perception_tick_max < perception_tick_min:
		errors.append("Invalid encounter perception")
	if wander_idle_max < wander_idle_min or daytime_respawn_interval <= 0 or blue_hour_spawn_interval <= 0 or blue_hour_spawn_multiplier <= 0 or horde_pressure_seconds <= 0 or horde_min_interval <= 0:
		errors.append("Invalid encounter timing")
	for interval: float in [noise_lifetime, arrival_stop_seconds, disembark_seconds, path_update_interval, far_path_interval, far_tick]:
		if interval <= 0:
			errors.append("Encounter duration must be positive")
	return errors
