extends "res://tests/camp_departure.gd"

func run() -> void:
	create_timer(120).timeout.connect(func(): quit(2))
	root.size = Vector2i(1920, 1080)
	root.content_scale_size = Vector2i(1600, 900)
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute("res://test-output/camp-ui-review")
	await verify_camp_population()
	if "--population-only" in OS.get_cmdline_user_args():
		print("CAMP POPULATION: %d checks, %d failures" % [checks, failures.size()])
		quit(0 if failures.is_empty() else 1)
		return
	await launch(true)
	app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue", "lu_qinghe"])
	app.campaign.data.food = 30
	app.campaign.grant_effect("power", "aid")
	app.show_shelter()
	await frames(12)
	var camp_id: int = app.camp_view.camp.get_instance_id()
	var camera: Transform3D = app.camp_view.camera.global_transform
	check(app.camp_ui.find_child("PowerSlots", true, false) != null, "Camp exposes active abilities on its left edge")
	if app.camp_ui.find_child("PowerSlots", true, false) == null:
		quit(1)
		return
	await review_shot("01-camp-hud")
	for id: String in ["xia_zhiyao", "su_wanxing"]:
		await click(app.camp_ui.member_buttons[id])
		check(app.selected_member == id and app.camp_ui.party_panel.is_visible_in_tree(), "Selecting a survivor keeps the party rail available: " + id)
		check(not app.camp_ui.drawer.get_global_rect().intersects(app.camp_ui.party_panel.get_global_rect()), "Survivor card does not occlude the party rail")
	await review_shot("02-survivor-detail")
	var level_before: int = app.campaign.member_level(app.selected_member)
	await click(app.camp_ui.training_button)
	check(app.campaign.member_level(app.selected_member) == level_before + 1, "Survivor upgrade uses the existing food transaction")
	await key(KEY_ESCAPE)
	var power: Button = app.camp_ui.find_child("Effect_power_rage", true, false)
	await hover_at(power.get_global_rect().get_center())
	check(is_instance_valid(app.camp_ui.detail_card) and not app.camp_ui.detail_card.interactive, "Hover shows a compact ability description")
	await click(power)
	check(app.camp_ui.detail_card.interactive, "Click pins an interactive ability card")
	await review_shot("03-ability-detail")
	check(root.get_visible_rect().encloses(app.camp_ui.detail_card.get_global_rect()) and app.camp_ui.detail_card.size.y < 440, "Ability card hugs its content and fits the viewport")
	await click(button("更换"))
	await click(button("全地图治疗"))
	check(app.campaign.data.power_slots == ["aid"], "Replacing an ability preserves capacity and changes the equipped effect")
	check(app.store.read(app.campaign.valid_state).data.power_slots == ["aid"], "Replacement persists through the existing save transaction")
	var before: Dictionary = app.campaign.data.duplicate(true)
	var good_store: RefCounted = app.store
	app.store = load("res://core/save_store.gd").new(app.save_path + "/blocked.json")
	app.replace_camp_effect("power", "aid", "rage")
	check(app.campaign.data == before, "Failed replacement save restores the complete previous loadout")
	app.save_error_dialog.hide()
	app.store = good_store
	app.replace_camp_effect("power", "aid", "missing-effect")
	check(app.campaign.data == before, "Invalid replacement cannot discard the equipped ability")
	await key(KEY_ESCAPE)
	var locked_slot: Button = app.camp_ui.find_child("Unlock_passive", true, false)
	check(locked_slot.disabled, "Unavailable expansion stays visibly disabled")
	app.camp_ui.show_slot_detail("passive", true)
	check(app.camp_ui.detail_card.interactive, "The existing slot explanation remains available")
	await key(KEY_ESCAPE)
	await click(app.camp_ui.find_child("PhaseStatus", true, false))
	check(is_instance_valid(app.camp_ui.detail_card), "Top phase status opens its explanation")
	await review_shot("05-phase-detail")
	check(app.camp_ui.detail_card.size.y < 380, "Phase description remains a compact card")
	await key(KEY_ESCAPE)
	for dimensions: Vector2i in [Vector2i(1280, 720), Vector2i(1600, 900), Vector2i(1920, 1080)]:
		root.size = dimensions
		await frames(8)
		await click(app.camp_ui.member_buttons.su_wanxing)
		check(root.get_visible_rect().encloses(app.camp_ui.drawer.get_global_rect()), "Survivor detail fits " + str(dimensions))
		await key(KEY_ESCAPE)
	await click(app.camp_ui.departure)
	await frames(12)
	check(not app.camp_ui.hud_root.is_visible_in_tree(), "TodayAction has one clear resource and party display")
	check(app.screen.composition.scale.x >= 0.9, "Paper composition retains its original readable scale")
	await click(app.screen.cards.commercial)
	await review_shot("06-today-action")
	await click(app.screen.cancel_button)
	check(app.camp_view.camp.get_instance_id() == camp_id and app.camp_view.camera.global_transform == camera, "Cancelling preserves the Camp and camera")
	await review_shot("07-before-confirm")
	await click(app.camp_ui.departure)
	await click(app.screen.cards.commercial)
	var displayed_sites := int(app.screen.cards.commercial.find_child("StatSlot_地点", true, false).get_node("StatStack/Amount").text)
	await click_at(app.screen.confirm_button.get_global_rect().get_center())
	await create_timer(0.3).timeout
	check(app.state == "departure" and app.camp_view.camp.get_instance_id() == camp_id, "Confirm starts departure in the same Camp")
	check(app.camp_ui.hud_root.is_visible_in_tree() and app.camp_ui.departure.disabled, "Departure restores the HUD and locks its actions")
	await review_shot("08-after-confirm")
	var deadline := Time.get_ticks_msec() + 20000
	while app.state == "departure" and Time.get_ticks_msec() < deadline:
		await process_frame
	check(app.state == "mission" and app.mission.survivors.size() == 4, "Departure reaches the chosen mission with the selected party")
	check(app.mission.city.sites.size() == displayed_sites, "Task card site count matches the playable mission registry")
	var report := FileAccess.open("res://test-output/camp-ui-review/runtime.json", FileAccess.WRITE)
	report.store_string(JSON.stringify({"checks": checks, "failures": failures}, "\t"))
	print("CAMP UI REVIEW: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await frames(5)
	quit(0 if failures.is_empty() else 1)

func verify_camp_population() -> void:
	for count: int in [1, 2, 4]:
		await launch(true)
		app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue", "lu_qinghe"].slice(0, count))
		app.show_shelter()
		await frames(8)
		var characters: Array[Node] = app.camp_view.camp.get_node("Characters").get_children()
		check(characters.size() == count, "Camp visible population matches its %d actual members" % count)
		check(characters.all(func(actor: Node): return actor.is_in_group("camp_party_actor") and actor.member_id in app.campaign.data.members), "Every visible Camp character has a Campaign identity")
		if count == 2:
			await review_shot("09-two-member-camp")
			await click(app.camp_ui.member_buttons.su_wanxing)
			await review_shot("10-two-member-detail")
			await verify_survivor_detail()

func verify_survivor_detail() -> void:
	var drawer: Control = app.camp_ui.drawer
	var close_rect: Rect2 = drawer.close_button.get_global_rect()
	var training_rect: Rect2 = drawer.training_button.get_global_rect()
	check(root.get_visible_rect().encloses(close_rect) and root.get_visible_rect().encloses(training_rect), "Fixed close and upgrade fit the compact detail panel")
	await click(drawer.equipment_button)
	check(app.camp_ui.browser.inventory_mode, "Details lead to the existing inventory and weapon stats")
	await key(KEY_ESCAPE)
	await click(app.camp_ui.member_buttons.su_wanxing)
	check(app.camp_ui.drawer.close_button.get_global_rect() == close_rect, "Returning to details preserves close button placement")
	check(app.camp_ui.drawer.training_button.get_global_rect() == training_rect, "Returning to details preserves upgrade placement")
	await review_shot("11-survivor-detail-actions")
	await click(app.camp_ui.drawer.close_button)
	check(not is_instance_valid(app.camp_ui.drawer), "Fixed close action dismisses the card")

func hover_at(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.device = 42
	event.position = point
	root.push_input(event, true)
	await create_timer(0.4).timeout

func review_shot(label: String) -> void:
	await create_timer(0.2).timeout
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png("res://test-output/camp-ui-review/" + label + ".png") == OK, "Native capture: " + label)
