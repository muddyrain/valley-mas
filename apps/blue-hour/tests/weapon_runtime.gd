extends "res://tests/runtime.gd"
const Registry = preload("res://data/weapon_registry.gd")
const WeaponInstanceData = preload("res://weapons/weapon_instance.gd")

func run() -> void:
	create_timer(100).timeout.connect(func(): printerr("WEAPON UI TIMEOUT"); quit(2))
	root.unfocusable = true
	app = load("res://core/main.gd").new()
	app.save_path = "user://test-runs/weapons-ui.json"
	app.fresh_test_run = true
	root.add_child(app)
	root.add_child(InputGate.new())
	await frames(8)
	app.campaign.new_run(52)
	for definition: Resource in app.catalog.weapons:
		app.campaign.weapon_inventory.add_weapon(WeaponInstanceData.from_dict({"uid": "ui:" + definition.id, "kind": definition.id}))
	app._save()
	app.show_shelter()
	await frames(8)
	# Exercise the real save/UI/Camp path for both current rigged characters.
	var persistent_camp: Node3D = app.camp_view
	for member: String in app.campaign.data.members:
		app.select_member(member)
		await frames(6)
		for kind: String in [Registry.P9, Registry.KNIFE, Registry.A21]:
			await click_button("武器")
			await click_button("武器库存")
			var inventory: Control = app.screen.get_child(app.screen.get_child_count() - 1)
			var item_button: Button = inventory.entries["ui:" + kind]
			item_button.get_parent().get_parent().ensure_control_visible(item_button)
			await frames(3)
			await click(item_button.get_global_rect().get_center())
			await frames(3)
			var equip_text: String = "装备给 " + app.member_name(member)
			if button(equip_text) == null:
				equip_text = "转交给 " + app.member_name(member)
			await click_button(equip_text)
			var actor: Node3D = app.camp_view.members[member].visual
			check(app.camp_view == persistent_camp, "Equipment refresh preserves Camp")
			check(actor.weapon.id == kind and actor.weapon_visual.definition.id == kind and actor.weapon_visual.model != null, "UI and live Camp agree: " + member + " " + kind)
			await capture("weapon-camp-" + app.campaign.member_template(member).id + "-" + kind)
		app.unequip_member(member)
		await frames(3)
		check(app.camp_view.members[member].visual.weapon_visual.model == null, "Live Camp unequip removes model")
	await capture("weapon-shelter")
	await click_button("武器")
	var browser: Control = app.screen.get_child(app.screen.get_child_count() - 1)
	check(browser.entries.size() == 8, "Catalogue has all eight icons")
	for definition: Resource in app.catalog.weapons:
		var entry: Button = browser.entries[definition.id]
		var scroll: ScrollContainer = entry.get_parent().get_parent()
		scroll.ensure_control_visible(entry)
		await frames(3)
		await click(entry.get_global_rect().get_center())
		await frames(2)
		check(browser.selected_definition == definition, "Click selects " + definition.id)
		var icon: TextureRect = browser.details.get_node("WeaponIcon")
		check(icon.texture == definition.icon() and icon.size == Vector2(200, 200), "Correct 200px detail icon")
		var stats: Label = browser.details.get_node("WeaponStats")
		check(stats.text.contains("%.2f 次/秒" % definition.attack_rate), "UI reads actual attack rate")
		if definition.id == Registry.S12:
			check(stats.text.contains("/ 弹丸") and stats.text.contains("散射"), "Shotgun detail states pellet mechanics")
			await capture("weapon-s12")
	await click_button("武器库存")
	var selected: String = app.selected_member
	var uid: String = "ui:" + Registry.H7
	var entry: Button = browser.entries[uid]
	entry.get_parent().get_parent().ensure_control_visible(entry)
	await frames(3)
	await click(entry.get_global_rect().get_center())
	await frames(3)
	await click_button("装备给 " + app.member_name(selected))
	check(app.campaign.data.equipment[selected] == uid, "Mouse equips instance")
	await click_button("卸下武器")
	check(app.campaign.get_equipped_weapon(selected) == null, "Mouse unequips instance")
	await capture("weapon-unequipped")
	app.show_shelter()
	await frames(6)
	check(app.campaign.data.equipment[selected] == "", "Empty slot survives screen rebuild")
	var stored: Dictionary = app.store.read(app.campaign.valid_state)
	check(stored.ok and stored.data.equipment[selected] == "", "UI saves empty slot")
	await click_button("武器")
	browser = app.screen.get_child(app.screen.get_child_count() - 1)
	root.size = Vector2i(960, 720)
	await frames(10)
	entry = browser.entries[Registry.H7]
	entry.get_parent().get_parent().ensure_control_visible(entry)
	await frames(3)
	await click(entry.get_global_rect().get_center())
	await frames(3)
	var image: TextureRect = browser.details.get_node("WeaponIcon")
	check(root.get_visible_rect().encloses(image.get_global_rect()), "Detail image fits scaled viewport")
	await capture("weapon-960")
	await click_button("关闭")
	var armed_member: String = app.campaign.data.members.filter(func(id: String) -> bool: return id != selected)[0]
	app.equip_member(armed_member, "ui:" + Registry.A21)
	app.start_mission("commercial")
	await wait_for_departure()
	await frames(12)
	check(app.mission.survivors.any(func(member: Node3D) -> bool: return member.weapon == null), "Unarmed survivor enters real mission")
	var mission_member: Node3D = app.mission.survivors.filter(func(member: Node3D) -> bool: return member.data.id == armed_member)[0]
	check(mission_member.weapon.id == Registry.A21 and mission_member.weapon_visual.model != null, "Camp A21 survives real departure into Mission")
	check(mission_member.weapon_visual.definition == mission_member.combat.weapon, "Mission model and combat share equipped resource")
	# The existing HUD presents the same definition as the hand model.
	var cards: Array[Node] = app.hud.find_children("*", "PanelContainer", true, false)
	var found_card := false
	for card in cards:
		if card.get_script() == load("res://ui/expedition/squad_card.gd") and card.equipped_id == Registry.A21:
			found_card = card.weapon_icon.texture == mission_member.weapon.icon()
	check(found_card, "A21 hand model and HUD icon agree")
	await capture("weapon-mission")
	app.mission.director_enabled = false
	for enemy in app.mission.enemies:
		if is_instance_valid(enemy):
			enemy.queue_free()
	app.mission.enemies.clear()
	app.mission.command_extract()
	await wait_until(func(): return app.state == "result", 25)
	check(app.state == "result", "Equipped characters return through actual extraction")
	if app.state == "result":
		app.return_to_shelter()
		await frames(8)
		check(app.state == "shelter" and app.mission == null, "Mission disposal returns to Camp")
		check(app.camp_view.members[armed_member].visual.weapon_visual.definition.id == Registry.A21, "A21 persists after Mission return")
	app.free()
	await frames(5)
	print("WEAPON UI: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
