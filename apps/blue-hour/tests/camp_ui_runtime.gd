extends "res://tests/camp_preparation_runtime.gd"
## Current Camp behavior: real population, detail actions, ability ownership,
## modal input and TodayAction. Preparation acceptance also covers transactions.

func run() -> void:
	create_timer(450).timeout.connect(func() -> void: printerr("CURRENT CAMP UI TIMEOUT"); quit(2))
	root.unfocusable = true
	root.content_scale_size = Vector2i.ZERO
	root.size = Vector2i(1600, 900)
	root.add_child(InputGate.new())
	run_save = "user://test-runs/current-camp-ui-%d.json" % OS.get_process_id()
	for count: int in [1, 2, 4]:
		await launch(false)
		app.campaign.new_run(772, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue", "lu_qinghe"].slice(0, count))
		app.show_shelter()
		await frames(15)
		var camp: Node3D = app.camp_view.camp
		var camera: Transform3D = app.camp_view.camera.global_transform
		var characters: Array[Node] = camp.get_node("Characters").get_children()
		check(characters.size() == count, "Camp renders only its actual living population")
		check(characters.all(func(actor: Node) -> bool: return actor.member_id in app.campaign.data.members), "Visible actors have real Campaign member IDs")
		for member: String in app.campaign.data.members:
			app.select_member(member)
			await create_timer(.4).timeout
			var detail: Control = app.camp_ui.get_node("M05_SurvivorDetail")
			var rail: Control = app.camp_ui.get_node("M04_SurvivorRoster")
			check(detail.is_visible_in_tree() and not detail.get_global_rect().intersects(rail.get_global_rect()), "Current detail preserves the visible roster")
			check(not detail.get_node("ActionBar/EquipmentButton").disabled, "Actual Run member has equipment access")
			await click(detail.get_node("ActionBar/EquipmentButton"))
			check(app.preparation.member_id == member, "Detail resolves the stable member identity")
			check(root.get_visible_rect().encloses(app.preparation.close_button.get_global_rect()), "Fixed return control fits the viewport")
			await key(KEY_ESCAPE)
		var powers: Control = app.camp_ui.get_node("M06_CampActionRail")
		check(not powers.get_node("TemporaryBuff").disabled and powers.get_node("MedicalSupport").disabled, "Left edge shows supported owned ability types")
		var locked: Control = powers.get_node("LockedAction")
		check(not locked is BaseButton and locked.mouse_filter == Control.MOUSE_FILTER_IGNORE, "Future ability slot has no actionable control")
		var before: Dictionary = app.campaign.data.duplicate(true)
		await click(powers.get_node("TemporaryBuff"))
		check(app.preparation.page == "powers" and app.campaign.data == before, "Ability information does not cast or spend resources")
		await key(KEY_ESCAPE)
		await click(app.camp_ui.get_node("M08_DepartAction/Entry"))
		await create_timer(.7).timeout
		check(app.state == "today_action" and not app.camp_ui.get_node("M08_DepartAction").visible, "TodayAction owns input and hides the underlying action")
		await click(app.screen.cards.commercial)
		check(app.campaign.data == before, "Choosing a draft action never writes Campaign")
		await click(app.screen.cancel_button)
		await create_timer(.7).timeout
		check(app.camp_view.camp == camp and app.camp_view.camera.global_transform == camera, "Cancel preserves Camp and camera")
		check(app.campaign.data == before and app.state == "shelter", "Cancel retains day, roster, resources and loadout")
	# Real equipment/training/shop/ability replacement, failed saves, keyboard,
	# both window sizes and live search-to-next-sortie acceptance are shared.
	await super.run()
