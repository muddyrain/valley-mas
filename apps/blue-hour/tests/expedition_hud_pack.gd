extends SceneTree
## Mount with --main-pack to prove runtime textures and HUD come from the shipped EXE.
const Mission = preload("res://missions/mission.gd")
const HUD = preload("res://ui/mission_hud.gd")
const Catalog = preload("res://data/catalog.gd")
const Ledger = preload("res://core/run_ledger.gd")
const Campaign = preload("res://core/campaign.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var failures: Array[String] = []
var checks: int = 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		push_error(message)

func run() -> void:
	root.size = Vector2i(1920,1080)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	var specialization: String = "scavenge" if "--scavenge" in OS.get_cmdline_user_args() else "combat"
	campaign.new_run(20260912,specialization,["xia_zhiyao","su_wanxing"])
	var mission := Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog,Ledger.new(),loadout,20260912,campaign)
	var layer := CanvasLayer.new()
	root.add_child(layer)
	var hud := HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	for frame: int in range(12):
		await process_frame
	for asset: String in ["icon_bag","icon_loot","icon_ammo","icon_menu","weapon_ranged","weapon_melee","ui_status_dot_red","ui_status_dot_blue","party_index_badge","hp_friendly_bg","hp_friendly_fill","hp_enemy_bg","hp_enemy_fill","icon_stop","icon_focus_fire","icon_locate","icon_rage","hotkey_normal","hotkey_active","icon_vehicle","icon_vehicle_bus","icon_house_large","icon_house_small","icon_search","icon_arrow_right","icon_chevron_down","icon_location_pin","panel_pointer","map_player_marker","map_poi_marker","map_target_marker","hud_return_default","hud_return_hover","hud_return_pressed","icon_return","icon_return_highlight"]:
		check(HudArt.texture(asset) != null,"Embedded PNG " + asset)
	if specialization == "combat":
		check(hud.power_buttons.rage.icon == HudArt.texture("icon_rage"),"Embedded Rage uses clean Phase 2 icon")
	else:
		check(hud.power_buttons.sprint.caption.text == "疾行号令" and hud.power_buttons.sprint.icon == mission.powers.states.sprint.definition.icon,"Scavenge keeps its actual Sprint label and icon")
	if "--final-match" in OS.get_cmdline_user_args():
	check(HudArt.texture("logo_main") != null, "Expedition logo loads from embedded pack")
	check(hud.minimap.frame.texture == HudArt.texture("minimap_frame"), "New frame overlays the dynamic map")
		check(hud.top_panel.get_parent() == hud.day_panel.get_parent(), "Embedded time cards share the horizontal root")
		check(hud.command_panel.get_theme_stylebox("panel") is StyleBoxEmpty, "Embedded actions have no blue tray")
		check(hud.extract_button.key_backplate.position.y >= hud.extract_button.caption.get_rect().end.y - 2, "Embedded E badge sits below the return face")
	check(hud.extract_button.caption.text == "返回巴士" and hud.extract_button.badge.text == "E","Embedded return label and hotkey")
	check(hud.extract_button.get_theme_stylebox("pressed").texture == HudArt.texture("hud_return_pressed"),"Embedded pressed state")
	for actor: Node3D in mission.enemies:
		if actor.active:
			actor.take_damage(actor.max_hp * .5)
			check(is_equal_approx(actor.hp_bar.ratio,.5),"Embedded enemy fill updates")
			break
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		for argument: String in OS.get_cmdline_user_args():
			if argument.begins_with("--capture-path="):
				check(root.get_texture().get_image().save_png(argument.trim_prefix("--capture-path=")) == OK,"Captured embedded HUD")
	layer.free()
	mission.free()
	await process_frame
	print("PHASE2 PACK: %d checks, %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
