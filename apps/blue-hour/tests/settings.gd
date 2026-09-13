extends SceneTree

const Settings = preload("res://core/game_settings.gd")

var failures: Array[String] = []
var checks := 0
var settings_path := "user://test-runs/settings-model.json"

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	_cleanup()
	var preferences := Settings.new(settings_path, root)
	check(Settings.valid_state(preferences.data), "Defaults form a valid settings state")
	check(not preferences.set_volume("unknown", 0.5), "Unknown volume channels are rejected")
	check(preferences.set_volume("master_volume", 0.35), "Master volume accepts a normalized value")
	check(preferences.set_volume("music_volume", 0.45), "Music volume accepts a normalized value")
	check(preferences.set_volume("effects_volume", 0.55), "Effects volume accepts a normalized value")
	check(preferences.persist(), "Settings persist through the protected store")
	var restored := Settings.new(settings_path, root)
	check(is_equal_approx(restored.data.master_volume, 0.35), "Master volume survives reload")
	check(is_equal_approx(restored.data.music_volume, 0.45), "Music volume survives reload")
	check(is_equal_approx(restored.data.effects_volume, 0.55), "Effects volume survives reload")
	check(restored.set_resolution(Vector2i(1280, 720)), "Supported window resolution persists")
	var reloaded := Settings.new(settings_path, root)
	check(reloaded.resolution() == Vector2i(1280, 720), "Window resolution survives reload")
	check(not reloaded.set_resolution(Vector2i(800, 600)), "Resolution below the supported viewport is rejected")
	check(reloaded.reset_defaults(), "Defaults can be restored")
	check(reloaded.resolution() == Vector2i(1600, 900) and reloaded.data.window_mode == "windowed", "Reset restores the production display defaults")
	print("SETTINGS: %d checks, %d failures" % [checks, failures.size()])
	_cleanup()
	quit(0 if failures.is_empty() else 1)

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _cleanup() -> void:
	for suffix: String in ["", ".bak", ".tmp"]:
		var target := settings_path + suffix
		if FileAccess.file_exists(target):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(target))
