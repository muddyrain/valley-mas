extends RefCounted
signal phase_changed(phase: int)
signal warning_changed(active: bool)
enum { DAY, BLUE_HOUR, NIGHT }
var elapsed: float = 0.0
var phase: int = DAY
var settings: Resource
var warning_active: bool:
	get:
		return phase == DAY and remaining() <= settings.encounter.blue_hour_warning_seconds
var _last_warning: bool = false

func _init(map: Resource) -> void:
	settings = map

func advance(delta: float, freeze_day_clock: bool = false) -> void:
	if freeze_day_clock and phase != NIGHT:
		return
	elapsed += maxf(delta, 0.0)
	var next_phase := DAY
	if elapsed >= settings.day_seconds + settings.blue_seconds:
		next_phase = NIGHT
	elif elapsed >= settings.day_seconds:
		next_phase = BLUE_HOUR
	if next_phase != phase:
		phase = next_phase
		phase_changed.emit(phase)
	_sync_warning()

func set_phase(value: int) -> void:
	elapsed = 0.0 if value == DAY else settings.day_seconds
	if value == NIGHT:
		elapsed += settings.blue_seconds
	phase = clampi(value, DAY, NIGHT)
	phase_changed.emit(phase)
	_sync_warning()

func _sync_warning() -> void:
	if warning_active != _last_warning:
		_last_warning = warning_active
		warning_changed.emit(warning_active)

func warning_progress() -> float:
	if not warning_active:
		return 0.0
	return clampf(1.0 - remaining() / maxf(.001, settings.encounter.blue_hour_warning_seconds), 0, 1)

func encounter_phase_name() -> String:
	if warning_active:
		return "BLUE_HOUR_WARNING"
	return "DAY" if phase == DAY else "BLUE_HOUR" if phase == BLUE_HOUR else "NIGHT"

func perception_multiplier(hearing: bool = false) -> float:
	if phase != DAY:
		return settings.encounter.blue_hour_hearing_multiplier if hearing else settings.encounter.blue_hour_visual_multiplier
	return lerpf(1.0, settings.encounter.warning_perception_multiplier, warning_progress())

func movement_multiplier() -> float:
	return 1.0 if phase == DAY else settings.encounter.blue_hour_speed_multiplier

func remaining() -> float:
	if phase == DAY:
		return maxf(0.0, settings.day_seconds - elapsed)
	if phase == BLUE_HOUR:
		return maxf(0.0, settings.day_seconds + settings.blue_seconds - elapsed)
	return night_elapsed()

func night_elapsed() -> float:
	return maxf(0.0, elapsed - settings.day_seconds - settings.blue_seconds)

func threat_level() -> int:
	return 0 if phase != NIGHT else 1 + int(night_elapsed() / settings.night_threat_seconds)

func enemy_threat_level() -> int:
	# Preserve the HUD's zero daytime alert while using level one as the combat baseline.
	return maxi(1, threat_level())

func hp_multiplier() -> float:
	return (1.0 + (enemy_threat_level() - 1) * settings.threat_hp_step) * settings.enemy_phase_hp[phase]

func damage_multiplier() -> float:
	return (1.0 + (enemy_threat_level() - 1) * settings.threat_damage_step) * settings.enemy_phase_damage[phase]

func spawn_multiplier() -> float:
	return settings.encounter.blue_hour_spawn_multiplier if phase != DAY else lerpf(1.0, settings.encounter.warning_spawn_multiplier, warning_progress())

func spawn_interval() -> float:
	if phase == DAY:
		return settings.encounter.daytime_respawn_interval / lerpf(1.0, settings.encounter.warning_spawn_multiplier, warning_progress())
	var config: Resource = settings.encounter
	var pressure: float = 1.0 + floorf(maxf(0, elapsed - settings.day_seconds) / config.horde_pressure_seconds) * config.horde_interval_step
	return maxf(config.horde_min_interval, config.blue_hour_spawn_interval / (spawn_multiplier() * pressure))
