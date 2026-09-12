extends RefCounted
signal phase_changed(phase: int)
enum { DAY, BLUE_HOUR, NIGHT }
var elapsed: float = 0.0
var phase: int = DAY
var settings: Resource

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

func set_phase(value: int) -> void:
	elapsed = 0.0 if value == DAY else settings.day_seconds
	if value == NIGHT:
		elapsed += settings.blue_seconds
	phase = clampi(value, DAY, NIGHT)
	phase_changed.emit(phase)

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

func speed_multiplier() -> float:
	if phase == DAY:
		return 1.0
	if phase == BLUE_HOUR:
		return 1.12
	return settings.night_speed_multiplier + minf(12, threat_level() - 1) * settings.threat_speed_step

func damage_multiplier() -> float:
	return 1.0 + minf(16, threat_level()) * settings.threat_damage_step

func spawn_interval() -> float:
	if phase == DAY:
		return settings.day_spawn_interval
	if phase == BLUE_HOUR:
		return settings.blue_spawn_interval
	return maxf(settings.minimum_spawn_interval, settings.night_spawn_interval / (1.0 + threat_level() * 0.22))
