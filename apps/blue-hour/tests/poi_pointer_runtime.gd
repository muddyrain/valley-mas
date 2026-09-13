extends "res://tests/poi_context_runtime.gd"
## Native pointer regression for a world search card and its Cancel target.
var samples: Array[Dictionary] = []
var trace: Array[Dictionary] = []

func record(label: String) -> void:
	var hovered: Control = root.gui_get_hovered_control()
	var card: PanelContainer = current_card("arrival_mid")
	trace.append({"event": label, "displayed": hud.poi_context.displayed_id, "card": card.get_instance_id() if is_instance_valid(card) else 0, "hover": str(hovered.get_path()) if is_instance_valid(hovered) else "", "alpha": card.modulate.a if is_instance_valid(card) else -1})

func current_card(id: String) -> PanelContainer:
	if hud.poi_context.displayed_id == id and hud.poi_context._focus_card.is_visible_in_tree():
		return hud.poi_context._focus_card
	return hud.poi_context.cards.get(id)

func observe_pointer(id: String, point: Vector2, seconds: float) -> Dictionary:
	await hover(point)
	var identities: Dictionary = {}
	var lowest_alpha: float = 1.0
	var absent: int = 0
	var end: int = Time.get_ticks_msec() + roundi(seconds * 1000)
	while Time.get_ticks_msec() < end:
		await process_frame
		var card: PanelContainer = current_card(id)
		if is_instance_valid(card) and card.is_visible_in_tree():
			identities[card.get_instance_id()] = true
			lowest_alpha = minf(lowest_alpha, card.modulate.a)
		else:
			absent += 1
	return {"identities": identities.size(), "minimum_alpha": lowest_alpha, "absent_frames": absent, "point": var_to_str(point)}

func run() -> void:
	create_timer(45).timeout.connect(func(): printerr("POI POINTER TIMEOUT"); quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/poi-flicker-fix")
	mission = Mission.new()
	root.add_child(mission)
	mission.set_physics_process(false)
	var loadout: Array[String] = ["pistol", "smg"]
	mission.setup(Catalog.new(), Ledger.new(), loadout, 20260912)
	mission.director_enabled = false
	mission.debug_clear_enemies()
	var entry: Vector3 = mission.city.sites.arrival_mid.spec.entry
	mission.survivors[0].position = entry
	mission.exploration.refresh()
	mission.camera_controller.following = false
	mission.camera_center = entry + Vector3(0, 0, -3)
	mission.camera_controller.apply()
	var layer := CanvasLayer.new()
	root.add_child(layer)
	hud = HUD.new()
	layer.add_child(hud)
	hud.setup(mission)
	await frames(8)
	mission.command_search("arrival_mid")
	check(mission.search_tasks.has("arrival_mid"), "Real search exists before testing its cancel button")
	# Ground inspection can be dismissed independently while a search continues.
	mission.poi_selected_id = ""
	await hover(hud.brand_panel.get_global_rect().get_center())
	await create_timer(.25).timeout
	for target: String in ["body", "cancel", "body", "cancel"]:
		var card: PanelContainer = current_card("arrival_mid")
		check(is_instance_valid(card), "Search has a visible card")
		if not is_instance_valid(card):
			break
		var point: Vector2 = card.action.get_global_rect().get_center() if target == "cancel" else card.detail.get_global_rect().get_center()
		var sample: Dictionary = await observe_pointer("arrival_mid", point, .7)
		sample["target"] = target
		samples.append(sample)
		print("POI POINTER: ", sample)
		check(sample.identities == 1 and sample.absent_frames == 0 and sample.minimum_alpha > .95, "Stationary %s hover keeps one opaque search card" % target)
	var card: PanelContainer = current_card("arrival_mid")
	if is_instance_valid(card):
		await capture("poi-flicker-fix/before-cancel")
		var point: Vector2 = card.action.get_global_rect().get_center()
		for pressed: bool in [true, false]:
			record("before down" if pressed else "before up")
			var event := InputEventMouseButton.new()
			event.device = 42
			event.position = point
			event.button_index = MOUSE_BUTTON_LEFT
			event.pressed = pressed
			root.push_input(event, true)
			record("after down" if pressed else "after up")
			for i: int in range(12):
				await create_timer(.014).timeout
				record("held" if pressed else "released")
		check(not mission.search_tasks.has("arrival_mid"), "One normal-duration Cancel click releases the search")
	await create_timer(.3).timeout
	FileAccess.open("res://test-output/poi-flicker-fix/pointer-runtime.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "samples": samples, "trace": trace}, "\t"))
	layer.free()
	mission.free()
	await frames(2)
	print("POI POINTER RUNTIME: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
