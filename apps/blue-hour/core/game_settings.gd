extends RefCounted
## Persistent player preferences with immediate engine application.

signal save_failed(message: String)

const Store = preload("res://core/save_store.gd")
const RESOLUTIONS: Array[Vector2i] = [
	Vector2i(1024, 640),
	Vector2i(1280, 720),
	Vector2i(1366, 768),
	Vector2i(1440, 900),
	Vector2i(1600, 900),
	Vector2i(1920, 1080),
	Vector2i(2560, 1440),
]
const VOLUME_KEYS: Array[String] = ["master_volume", "music_volume", "effects_volume"]

var data: Dictionary = {}
var path: String
var settings_store: RefCounted
var settings_window: Window

func _init(settings_path: String = "user://homeward/settings.json", target_window: Window = null) -> void:
	path = settings_path
	settings_window = target_window
	settings_store = Store.new(path)
	_ensure_audio_bus("Music")
	_ensure_audio_bus("SFX")
	var stored: Dictionary = settings_store.read(valid_state)
	if stored.ok:
		data = stored.data.duplicate(true)
		_apply_all()
	else:
		data = _current_data()
		_apply_audio()

static func valid_state(state: Dictionary) -> bool:
	if state.get("version") != 1 or state.get("window_mode") not in ["windowed", "fullscreen"]:
		return false
	var resolution: Variant = state.get("resolution")
	if not resolution is Array or resolution.size() != 2:
		return false
	for dimension: Variant in resolution:
		if not (dimension is int or dimension is float) or not is_finite(float(dimension)) or float(dimension) != floorf(float(dimension)):
			return false
	if int(resolution[0]) < 1024 or int(resolution[0]) > 3840 or int(resolution[1]) < 640 or int(resolution[1]) > 2160:
		return false
	if not state.get("vsync") is bool:
		return false
	for key: String in VOLUME_KEYS:
		var value: Variant = state.get(key)
		if not (value is int or value is float) or not is_finite(float(value)) or float(value) < 0.0 or float(value) > 1.0:
			return false
	return true

func available_resolutions() -> Array[Vector2i]:
	var result: Array[Vector2i] = RESOLUTIONS.duplicate()
	var selected := resolution()
	if selected not in result:
		result.append(selected)
	return result

func resolution() -> Vector2i:
	var value: Array = data.resolution
	return Vector2i(int(value[0]), int(value[1]))

func set_window_mode(fullscreen: bool) -> bool:
	data.window_mode = "fullscreen" if fullscreen else "windowed"
	_apply_window_mode()
	_apply_resolution()
	return persist()

func set_resolution(value: Vector2i) -> bool:
	if value.x < 1024 or value.x > 3840 or value.y < 640 or value.y > 2160:
		return false
	data.resolution = [value.x, value.y]
	_apply_resolution()
	return persist()

func set_vsync(enabled: bool) -> bool:
	data.vsync = enabled
	_apply_vsync()
	return persist()

func set_volume(key: String, value: float) -> bool:
	if key not in VOLUME_KEYS:
		return false
	data[key] = clampf(value, 0.0, 1.0)
	_apply_audio()
	return true

func reset_defaults() -> bool:
	data = _default_data()
	_apply_all()
	return persist()

func persist() -> bool:
	var message: String = settings_store.write(data, valid_state)
	if not message.is_empty():
		save_failed.emit(message)
		return false
	return true

func _current_data() -> Dictionary:
	var size := settings_window.size if is_instance_valid(settings_window) else Vector2i(1600, 900)
	var fullscreen := is_instance_valid(settings_window) and settings_window.mode in [Window.MODE_FULLSCREEN, Window.MODE_EXCLUSIVE_FULLSCREEN]
	return {
		"version": 1,
		"window_mode": "fullscreen" if fullscreen else "windowed",
		"resolution": [maxi(1024, size.x), maxi(640, size.y)],
		"vsync": DisplayServer.window_get_vsync_mode() != DisplayServer.VSYNC_DISABLED,
		"master_volume": _bus_volume("Master"),
		"music_volume": _bus_volume("Music"),
		"effects_volume": _bus_volume("SFX"),
	}

func _default_data() -> Dictionary:
	return {
		"version": 1,
		"window_mode": "windowed",
		"resolution": [1600, 900],
		"vsync": true,
		"master_volume": 1.0,
		"music_volume": 1.0,
		"effects_volume": 1.0,
	}

func _apply_all() -> void:
	_apply_window_mode()
	_apply_resolution()
	_apply_vsync()
	_apply_audio()

func _apply_window_mode() -> void:
	if not is_instance_valid(settings_window):
		return
	settings_window.mode = Window.MODE_FULLSCREEN if data.window_mode == "fullscreen" else Window.MODE_WINDOWED

func _apply_resolution() -> void:
	if not is_instance_valid(settings_window) or data.window_mode == "fullscreen":
		return
	settings_window.size = resolution()

func _apply_vsync() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if data.vsync else DisplayServer.VSYNC_DISABLED)

func _apply_audio() -> void:
	_set_bus_volume("Master", float(data.master_volume))
	_set_bus_volume("Music", float(data.music_volume))
	_set_bus_volume("SFX", float(data.effects_volume))

func _ensure_audio_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) >= 0:
		return
	AudioServer.add_bus()
	AudioServer.set_bus_name(AudioServer.bus_count - 1, bus_name)

func _bus_volume(bus_name: String) -> float:
	var index := AudioServer.get_bus_index(bus_name)
	if index < 0 or AudioServer.is_bus_mute(index):
		return 0.0
	return clampf(db_to_linear(AudioServer.get_bus_volume_db(index)), 0.0, 1.0)

func _set_bus_volume(bus_name: String, value: float) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index < 0:
		return
	AudioServer.set_bus_mute(index, value <= 0.001)
	AudioServer.set_bus_volume_db(index, linear_to_db(maxf(value, 0.001)))
