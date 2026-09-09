extends SceneTree
var app: Node
var checks := 0
var failures: Array[String] = []
const SAVE_PATH = "user://test-runs/day-loop-runtime.json"

class InputGate extends Node:
	func _input(event: InputEvent) -> void:
		if event.device != 42:
			get_viewport().set_input_as_handled()

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func frames(count: int = 5) -> void:
	for i in range(count):
		await process_frame

func click(node: Control) -> void:
	check(node != null and node.is_visible_in_tree(), "Visible input target")
	if node == null:
		return
	var point := node.get_global_rect().get_center()
	await click_at(point)

func click_at(point: Vector2) -> void:
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.device = 42
		event.position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		root.push_input(event, true)
		await process_frame
	await frames()

func key(code: Key, receiver: Viewport = null) -> void:
	for pressed in [true, false]:
		var event := InputEventKey.new()
		event.device = 42
		event.physical_keycode = code
		event.keycode = code
		event.pressed = pressed
		(receiver if receiver != null else root).push_input(event, true)
		await process_frame
	await frames()

func button(text: String) -> Button:
	for node in app.find_children("*", "Button", true, false):
		if node.text == text and node.is_visible_in_tree():
			return node
	return null

func capture(id: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://test-output/" + id + ".png") == OK, "Captured " + id)

func launch(fresh: bool) -> void:
	if app != null:
		app.queue_free()
		await frames()
	app = load("res://core/main.gd").new()
	app.save_path = SAVE_PATH
	app.fresh_test_run = fresh
	root.add_child(app)
	await frames(12)
	if not fresh:
		await click(button("继续"))

func stage_return(food: int) -> void:
	await click(button("整装出发"))
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission.ledger.add_loot(food, 0)
	app.mission._finish(false)
	await frames(10)

func run() -> void:
	create_timer(70).timeout.connect(func(): printerr("DAY LOOP UI TIMEOUT"); quit(2))
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output")
	await launch(true)
	# Funding is a fixture; purchase, popup equipment selection and ration allocation use input.
	app.campaign.data.scrap = 30
	app._save()
	app.show_shelter()
	await frames()
	var offer: Dictionary = app.campaign.data.shop[0].duplicate()
	await click(button("备用装备"))
	var buy = app.find_child("Buy_" + offer.uid.replace(":", "_"), true, false)
	await click(buy)
	check(app.campaign.data.inventory.size() == 4 and app.campaign.data.scrap == 30 - offer.price, "Actual purchase spends Scrap and grants one instance")
	check(app.store.read().data.inventory.size() == 4, "Purchase is immediately saved")
	var select: OptionButton = app.screen.weapon_selects[0]
	await click(select)
	var popup := select.get_popup()
	# This menu has equal-height rows with no separators; choose the final visible row.
	await click_at(Vector2(popup.position) + Vector2(40, popup.size.y - 24))
	check(app.campaign.data.equipment[app.campaign.data.members[0]] == offer.uid, "Native equipment popup equips purchased weapon")
	await capture("13-equipment")
	var gear: Dictionary = app.campaign.data.equipment.duplicate()
	await launch(false)
	check(app.campaign.data.equipment == gear and app.campaign.data.shop[0].sold, "Reload retains loadout and sold offer")
	app.campaign.data.food = 0
	app._save()
	app.show_shelter()
	await frames()
	await stage_return(0)
	check(app.state == "result" and not app.campaign.preview().fatal, "First shortage is previewed without casualties")
	await capture("14-first-shortage")
	await click(button("确认结算"))
	check(app.campaign.data.hunger == 1 and app.campaign.data.members.size() == 3, "Actual confirmation grants next day grace")
	await launch(false)
	check(app.campaign.data.day == 2 and app.campaign.data.hunger == 1, "Hunger and day survive process reload")
	await click(button("整装出发"))
	check(app.mission.survivors[0].hp == 80 and app.catalog.survivors[0].max_hp == 100, "Hungry sortie has reduced HP without mutating template")
	app.mission.director_enabled = false
	app.mission.debug_clear_enemies()
	app.mission.ledger.add_loot(1, 0)
	app.mission._finish(false)
	await frames(10)
	check(app.campaign.preview().fatal and app.screen.confirm_button.disabled, "Consecutive shortage blocks confirmation until allocation")
	await launch(false)
	check(app.state == "result" and app.campaign.preview().slots == 1, "Pending result resumes instead of repeating the outing")
	root.size = Vector2i(1024, 640)
	await frames(12)
	var chosen: String = app.campaign.data.members[1]
	await click(app.screen.food_choices[chosen])
	check(not app.screen.confirm_button.disabled and app.screen.consequence.text.contains(app.member_name(app.campaign.data.members[0])), "Mouse allocation previews named casualties")
	check(root.get_visible_rect().encloses(app.screen.confirm_button.get_global_rect()), "Confirmation remains visible at minimum window size")
	await capture("15-rations-small")
	await click(app.screen.confirm_button)
	check(app.campaign.data.members == [chosen] and app.campaign.data.day == 3, "Chosen member alone continues on day three")
	await capture("16-solo-shelter")
	await click(button("整装出发"))
	check(app.mission.survivors.size() == 1 and app.hud.squad_labels.size() == 1, "Solo outing and HUD agree")
	await capture("17-solo-city")
	app.mission.survivors[0].take_damage(1000)
	app.mission._physics_process(0.1)
	await frames(10)
	await click(button("确认结算"))
	check(app.state == "ended" and button("整装出发") == null, "Final death removes departure and ends run")
	await capture("18-run-ended")
	await click(button("重新开局"))
	await click(button("确认创建"))
	check(app.campaign.data.members.size() == 2 and app.campaign.data.food == 6 and app.campaign.data.inventory.size() == 2, "New-run button restores fresh roster and resets stock")
	app.debug_change("day", 4)
	await frames()
	await stage_return(0)
	await click(button("确认结算"))
	check(app.state == "ended" and app.campaign.data.status == "won", "Day-five settlement reaches ending screen")
	await capture("19-five-day-ending")
	var report := FileAccess.open("res://test-output/day-loop-runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures, "evidence": "native synthetic input; controlled resource/return fixtures; independent test save"}, "\t"))
	print("DAY LOOP NATIVE: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(8)
	quit(0 if failures.is_empty() else 1)
