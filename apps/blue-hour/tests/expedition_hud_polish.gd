extends "res://tests/expedition_hud_2.gd"
## Identical production route and camera checkpoints for the 2.0 / 2.0.1 comparison.
const OUTPUT: String = "expedition-hud-2_0_1/"
var measurements: Dictionary = {}
const SHOTS: Dictionary = {
	"01_expediton_hud_overview_1920x1080": "01_hud_polish_overview",
	"01_expediton_hud_overview_2560x1440": "01_hud_polish_overview_2560x1440",
	"01_expediton_hud_overview_1366x768": "01_hud_polish_overview_1366x768",
	"01_expediton_hud_overview_1024x640": "01_hud_polish_overview_1024x640",
	"02_character_selected_move_marker": "08_move_select_markers",
	"03_building_compact": "04_world_interaction_compact",
	"03_building_search": "05_world_interaction_searching",
	"03_vehicle_search": "05_world_interaction_vehicle",
	"04_objective_action_interaction": "06_action_bar_states",
	"04_skill_active": "06_action_bar_active",
	"04_skill_disabled": "06_action_bar_disabled",
	"04_loot_marker": "09_loot_marker",
	"04_danger_marker": "09_danger_marker",
	"05_return_bus": "07_return_zone"
}

func output_folder() -> String:
	return OUTPUT + ("before/" if "--before" in OS.get_cmdline_user_args() else "after/")

func snap(id: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var folder: String = output_folder()
	DirAccess.make_dir_recursive_absolute("res://test-output/" + folder)
	if id in ["04_skill_active", "04_skill_disabled"]:
		await hover(hud.brand_panel.get_global_rect().get_center())
	await create_timer(.24).timeout
	if not "--before" in OS.get_cmdline_user_args():
		_check_polish(id)
	await capture(folder + SHOTS.get(id, id))
	if id == "01_expediton_hud_overview_1920x1080":
		await capture(folder + "02_party_hud")
		await capture(folder + "07_return_zone_idle")
	if id == "04_objective_action_interaction":
		await capture(folder + "03_objective_hud")
	var panels: Dictionary = {}
	for panel: Control in [hud.top_panel, hud.squad_panel, hud.sites_panel, hud.command_panel, hud.extract_button, hud.poi_context._focus_card]:
		panels[panel.name] = var_to_str(root.get_stretch_transform() * panel.get_global_rect())
	measurements[SHOTS.get(id, id)] = {"physical_rects": panels, "camera_transform": var_to_str(mission.camera.global_transform), "camera_size": mission.camera.size}
	FileAccess.open("res://test-output/" + folder + "measurements.json", FileAccess.WRITE).store_string(JSON.stringify(measurements, "\t"))

func results_path() -> String:
	return "res://test-output/" + output_folder() + "runtime.json"

func _check_polish(id: String) -> void:
	var zone: MeshInstance3D = mission.city.get_node("ReturnZone")
	if id == "01_expediton_hud_overview_1920x1080":
		check(hud.top_panel.scale.x >= .75 and hud.top_panel.scale.x <= .82, "Time panel shrinks into the requested range")
		check(hud.squad_cards[0].portrait.get_global_rect().size.x >= 53, "Portrait presence survives the smaller party frame")
		check(hud.sites_panel.get_global_rect().size.y < 180, "One visible objective has no tall empty content well")
		check(zone.scale.x >= .65 and zone.scale.x <= .72, "Return ring changes visual size only")
		check(zone.material_override.albedo_color.a >= .40 and zone.material_override.albedo_color.a <= .50, "Idle return zone remains faint")
		check(not zone.material_override.emission_enabled, "Return ring has no material emission")
	elif id == "03_building_compact":
		var card: PanelContainer = hud.poi_context._focus_card
		check(card.visible and card.size.x >= 208 and card.size.x <= 240, "Idle interaction width is 65-75 percent of the old 320 pixels")
		check(not card.detail.visible and not card.action.visible and not card.progress.visible, "Compact interaction contains only icon and name")
	elif id == "03_building_search":
		check(hud.poi_context._focus_card.size.y > 180 and hud.poi_context._focus_card.action.is_visible_in_tree(), "A real search expands and exposes the cancel action")
	elif id == "04_objective_action_interaction":
		var power: Button = hud.power_buttons.values()[0]
		check(power.scale.x > 1.0 and power.scale.x <= 1.021, "Hover enlargement stays restrained")
	elif id == "04_skill_active":
		check(hud.power_buttons.values()[0].state_line.visible, "Active uses a visible small state diamond")
	elif id == "04_skill_disabled":
		check(not hud.power_buttons.values()[0].state_line.visible, "Spent skill removes its active indicator")
	elif id == "05_return_bus":
		check(zone.material_override.albedo_color.a >= .65 and zone.material_override.albedo_color.a <= .75, "Actual extraction raises return readability without emission")
