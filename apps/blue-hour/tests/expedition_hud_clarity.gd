extends "res://tests/expedition_hud_phase2.gd"
## Native render/input evidence, isolated deterministic scavenge campaign.

func run() -> void:
	output_directory = "res://test-output/expedition_hud_clarity/"
	create_timer(150).timeout.connect(func(): printerr("CLARITY TIMEOUT"); quit(2))
	root.unfocusable = true
	root.size = Vector2i(1920, 1080)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(output_directory)
	var catalog := Catalog.new()
	var campaign := Campaign.new(catalog)
	campaign.new_run(20260912, "scavenge", ["xia_zhiyao", "su_wanxing"])
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = []
	mission.setup(catalog, Ledger.new(), loadout, 20260912, campaign)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(15)
	await hover(Vector2(1100, 600))
	if "--baseline" in OS.get_cmdline_user_args():
		await shot("before_full")
		await shot("before_action_normal", hud.command_panel, 24)
		await hover(hud.command_buttons["停止"].get_global_rect().get_center())
		await shot("before_action_hover", hud.command_panel, 24)
		print("BASELINE captured")
	else:
		await verify_clarity()
	FileAccess.open(output_directory + ("baseline.json" if "--baseline" in OS.get_cmdline_user_args() else "runtime.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"screenshots":screenshots,"evidence":evidence}, "\t"))
	layer.free()
	mission.free()
	await frames(3)
	print("CLARITY: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func verify_clarity() -> void:
	await shot("full_hud")
