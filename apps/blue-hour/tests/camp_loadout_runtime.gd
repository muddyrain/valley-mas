extends "res://tests/camp_hud_skeleton_runtime.gd"

const CAPTURES: String = "res://test-output/m07/"
const ARMOR: Texture2D = preload("res://assets/items/icons/item_armor_plate_icon.png")
const WATCH: Texture2D = preload("res://assets/items/icons/item_old_watch_icon.png")

var requests: Array[int] = []

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i.ZERO
	DirAccess.make_dir_recursive_absolute(CAPTURES)
	var app: Node = MAIN.instantiate()
	app.save_path = "user://test-runs/camp-loadout.json"
	app.fresh_test_run = true
	root.add_child(app)
	app.campaign.new_run(772, "", ["xia_zhiyao", "su_wanxing"])
	app.show_shelter()
	await frames(30)
	var panel: Control = app.camp_ui.get_node("M07_LoadoutPanel")
	var left: StateButton = panel.get_node("SlotContainer/SlotLeft")
	var right: StateButton = panel.get_node("SlotContainer/SlotRight")
	var left_id: int = left.get_instance_id()
	var right_id: int = right.get_instance_id()
	var panel_rect: Rect2 = panel.get_global_rect()
	var campaign: Dictionary = app.campaign.data.duplicate(true)
	panel.slot_requested.connect(func(index: int, _item: Dictionary) -> void: requests.append(index))
	check(app.state == "shelter" and app.camp_view.camera.current, "Real Camp active")
	check(panel_rect == Rect2(624, 776, 316, 82), "M07 preserves root geometry")
	check_state(panel, "0/1", [0, 1])
	check(not panel.get_node("Pagination").visible, "Default page controls hidden")
	await capture_m07("default-0-of-1")
	await click(right)
	check(requests.is_empty(), "Locked slot cannot request equipment")
	await click(left)
	check(requests == [0], "Empty slot requests its absolute index")
	await move_pointer(Vector2(800, 600), 0.16)
	var hit: Rect2 = left.get_global_rect()
	var art: Rect2 = left.normal_layer.get_global_rect()
	await move_pointer(hit.get_center(), 0.045)
	check(left.hover_layer.modulate.a > 0.0 and left.hover_layer.modulate.a < 0.32, "Hover has intermediate alpha, no hard cut")
	await create_timer(0.16).timeout
	check(is_equal_approx(left.hover_layer.modulate.a, 0.32), "Overlay reaches restrained opacity")
	check(left.normal_layer.modulate.a == 1.0, "Normal art remains beneath hover overlay")
	check(left.normal_layer.get_global_rect() == left.hover_layer.get_global_rect(), "Hover shares slot center and bounds")
	await capture_m07("empty-hover")
	for index: int in range(20):
		var previous: Tween = left._transition
		await move_pointer(Vector2(800, 600) if index % 2 == 0 else hit.get_center(), 0.01)
		check(left.get_global_rect() == hit and left.normal_layer.get_global_rect() == art, "Rapid input never moves or scales slot")
		check(not previous.is_valid(), "New hover state replaces tween")
	await move_pointer(right.get_global_rect().get_center(), 0.16)
	check(is_zero_approx(left.hover_layer.modulate.a) and is_zero_approx(right.hover_layer.modulate.a), "No hover residue; locked ignores hover")
	for visual: Control in left.visual_root.find_children("*", "Control", true, false):
		check(visual.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Visual ignores input: " + str(visual.name))
	var items: Array[Dictionary] = [{"id": "armor_plate", "name": "装甲板", "icon": ARMOR}]
	panel.show_loadout(items, 1)
	check_state(panel, "1/1", [2, 1])
	check(left.item_icon.texture == ARMOR, "Equipped icon is a separate existing item texture")
	panel.show_loadout(items, 2)
	check_state(panel, "1/2", [2, 0])
	await move_pointer(Vector2(800, 600), 0.16)
	await capture_m07("one-of-two")
	items.append({"id": "old_watch", "name": "旧怀表", "icon": WATCH})
	panel.show_loadout(items, 4)
	check_state(panel, "2/4", [2, 2])
	check(panel.get_node("Pagination").visible and panel.get_page_count() == 2, "Four unlocked slots enable two pages")
	var footer: Control = panel.get_node("Pagination")
	var next: StateButton = footer.get_node("NextButton")
	check(footer.size == Vector2(116, 26) and is_equal_approx(footer.position.x + footer.size.x / 2.0, panel.size.x / 2.0), "Footer stays centered under the panel")
	check(footer.position.y - panel.size.y == 4.0 and next.size == Vector2(22, 22), "Footer uses 4px gap and a fixed 22px click target")
	var footer_hit: Rect2 = next.get_global_rect()
	await create_timer(0.16).timeout
	await move_pointer(footer_hit.get_center(), 0.045)
	print("Footer mid-transition alpha: ", next.hover_layer.modulate.a)
	check(next.hover_layer.modulate.a > 0.0 and next.hover_layer.modulate.a < 1.0, "Footer cross-fade has intermediate alpha")
	await create_timer(0.16).timeout
	check(is_equal_approx(next.hover_layer.modulate.a, 1.0), "Footer hover completes")
	await move_pointer(Vector2(800, 600), 0.16)
	check(is_zero_approx(next.hover_layer.modulate.a) and next.get_global_rect() == footer_hit and next.visual_root.scale == Vector2.ONE, "Footer hover clears without movement or scale")
	await capture_m07("two-of-four-page-1")
	await click(panel.get_node("Pagination/NextButton"))
	check_state(panel, "2/4", [0, 0])
	check(panel.page_index == 1 and left.slot_index == 2 and right.slot_index == 3, "Next page maps to slots two and three")
	await move_pointer(Vector2(800, 600), 0.16)
	await capture_m07("two-of-four-page-2")
	await click(right)
	check(requests.back() == 3, "Second page click uses global slot index")
	await click(panel.get_node("Pagination/PrevButton"))
	check_state(panel, "2/4", [2, 2])
	check(left.item_icon.texture == ARMOR and right.item_icon.texture == WATCH, "Page return restores item icons")
	for index: int in range(8):
		panel.set_page(index % 2)
	check(left.get_instance_id() == left_id and right.get_instance_id() == right_id and panel.get_global_rect() == panel_rect, "Paging reuses both controls and preserves panel size")
	# More than two pages and a sparse item ensure capacity is not coupled to the view.
	var sparse: Array[Dictionary] = [{}, {}, {}, {}, {}, {}, items[0]]
	panel.show_loadout(sparse, 7)
	panel.set_page(3)
	check_state(panel, "1/7", [2, 1])
	check(panel.get_page_count() == 4 and left.slot_index == 6, "Odd capacity beyond six displays final unlocked and locked slots")
	panel.show_loadout(items, 3, 6)
	check(panel.get_page_count() == 3, "Explicit total capacity includes future locked pages")
	panel.set_page(2)
	check_state(panel, "2/3", [1, 1])
	var full: Array[Dictionary] = [items[0], items[1], items[0], items[1]]
	panel.show_loadout(full, 4)
	check_state(panel, "4/4", [2, 2])
	var empty_items: Array[Dictionary] = []
	panel.show_loadout(empty_items, 1)
	check(panel.page_index == 0 and not panel.get_node("Pagination").visible, "Reducing capacity clamps current page")
	check_state(panel, "0/1", [0, 1])
	var before_clicks: int = requests.size()
	for index: int in range(6):
		await click(left)
	check(requests.size() == before_clicks + 6, "Repeated clicks each emit exactly one request")
	check(left.scale == Vector2.ONE and left.visual_root.scale == Vector2.ONE, "Repeated clicks keep hit and visual scale fixed")
	for dimensions: Vector2i in [Vector2i(1280, 720), Vector2i(1024, 640), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		check(root.get_visible_rect().encloses(panel.get_global_rect()), "Panel stays onscreen at " + str(dimensions))
		check(left.size == right.size, "Slot dimensions remain uniform")
	check(app.campaign.data == campaign, "Display fixtures never change Campaign")
	var report: FileAccess = FileAccess.open(CAPTURES + "runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP M07: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)

func check_state(panel: Control, count_text: String, states: Array[int]) -> void:
	check(panel.get_node("Header/CountLabel").text == count_text, "Count " + count_text)
	for index: int in range(states.size()):
		check(panel.slots[index].slot_state == states[index], "State " + count_text + " slot " + str(index))

func move_pointer(point: Vector2, duration: float) -> void:
	var event: InputEventMouseMotion = InputEventMouseMotion.new()
	event.position = point
	root.push_input(event, true)
	await create_timer(duration).timeout

func capture_m07(label: String) -> void:
	await RenderingServer.frame_post_draw
	var screenshot: Image = root.get_texture().get_image()
	check(screenshot.get_size() == Vector2i(1600, 900), "Native 1600x900 capture")
	check(screenshot.save_png(CAPTURES + label + ".png") == OK, "Saved " + label)
