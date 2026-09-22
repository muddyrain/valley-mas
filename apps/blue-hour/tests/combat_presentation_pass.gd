extends "res://tests/expedition_combat_capture.gd"
## Presentation pass reuses the verified formal Expedition capture mode.

const PRESENTATION_DIR := "res://test-output/combat_presentation_pass"

func _initialize() -> void:
	output_dir = PRESENTATION_DIR
	call_deferred("run")

func _capture(name: String) -> void:
	var presentation_name: String = str({
		"01_expedition_scale.png": "01_exploration_camera.png",
		"02_real_combat_view.png": "02_combat_camera.png",
		"03_weapon_vfx_view.png": "03_weapon_vfx.png",
		"04_multi_enemy_view.png": "04_multi_enemy_combat.png",
	}.get(name, name))
	await super._capture(presentation_name)
