extends Control
## Independent modules; the root routes presentation selection without campaign writes.

signal depart_requested
signal menu_requested
signal camp_menu_requested
signal preparation_requested(member_id: String, page: String)

const REFERENCE := Vector2(1600, 900)
var selected_survivor_id: Variant = null
var _modules: Array[Control] = []
var _rects: Array[Rect2] = []
var _anchors: Array[Vector2] = []
var _campaign: RefCounted
var preparation_button: Button

func _ready() -> void:
	for child: Node in get_children():
		var module := child as Control
		_modules.append(module)
		_rects.append(Rect2(Vector2(module.offset_left, module.offset_top), module.size))
		_anchors.append(Vector2(module.anchor_left, module.anchor_top))
	resized.connect(_layout)
	$M05_SurvivorDetail.force_hidden()
	$M04_SurvivorRoster.survivor_selected.connect(_select_survivor)
	$M04_SurvivorRoster.survivor_reselected.connect(_reselect_survivor)
	$M08_DepartAction/Entry.pressed.connect(func(): depart_requested.emit())
	$M09_Utility/Entry.pressed.connect(func(): menu_requested.emit())
	$M03_ResourceBar/MenuButton.pressed.connect(func(): camp_menu_requested.emit())
	preparation_button = preload("res://ui/menu_art.gd").button("营地整备 [I]", func() -> void: preparation_requested.emit("", "inventory"))
	preparation_button.name = "PreparationEntry"
	preparation_button.custom_minimum_size = Vector2(220, 50)
	preparation_button.add_theme_font_size_override("font_size", 20)
	add_child(preparation_button)
	$M05_SurvivorDetail/ActionBar/EquipmentButton.pressed.connect(_request_selected.bind("inventory"))
	$M05_SurvivorDetail/ActionBar/UpgradeButton.pressed.connect(_request_selected.bind("training"))
	$M05_SurvivorDetail/ActionBar/UpgradeButton.text = "训练"
	$M06_CampActionRail.action_requested.connect(func(_action: String) -> void: preparation_requested.emit("", "powers"))
	$M07_LoadoutPanel.slot_requested.connect(func(_index: int, _item: Dictionary) -> void: preparation_requested.emit("", "powers"))
	_layout()

func configure_roster(catalog: RefCounted, campaign: RefCounted) -> void:
	_campaign = campaign
	$M04_SurvivorRoster.configure(catalog, campaign)
	$M06_CampActionRail.configure(campaign)
	_refresh_loadout()
	refresh_campaign_state()
	_layout()
	_refresh_selected_detail()

func refresh_roster() -> void:
	$M04_SurvivorRoster.refresh()
	$M06_CampActionRail.configure(_campaign)
	_refresh_loadout()
	refresh_campaign_state()
	_layout()
	_refresh_selected_detail()

func _refresh_loadout() -> void:
	var items: Array[Dictionary] = []
	for id: String in _campaign.data.passive_slots:
		var definition: Resource = _campaign.effect_definition("passive", id)
		items.append({"id": id, "name": definition.display_name, "icon": definition.icon})
	$M07_LoadoutPanel.show_loadout(items, int(_campaign.data.passive_capacity))

func refresh_campaign_state() -> void:
	if _campaign == null or _campaign.data.is_empty():
		return
	# Read the current dictionary each time: rollback and restore can replace it.
	var state: Dictionary = _campaign.data
	$M03_ResourceBar/ResourceFood/Value.text = str(state.food)
	$M03_ResourceBar/ResourceScrap/Value.text = str(state.scrap)
	# Campaign has no intelligence currency; keep the existing slot without a fake balance.
	$M03_ResourceBar/ResourceIntel/Value.text = "—"
	var info: Control = $M01_CampIdentity/CampInfoPanel
	info.get_node("DayEn").text = "DAY %02d" % int(state.day)
	info.get_node("DayCn").text = "第 %d 天" % int(state.day)
	var ration_need: int = state.members.size() * _campaign.catalog.loop.food_per_member
	if int(state.hunger) > 0:
		info.get_node("DescriptionLine1").text = "缺粮影响未解除"
		info.get_node("DescriptionLine2").text = "生命上限 %d%%" % roundi(_campaign.health_multiplier() * 100.0)
	else:
		info.get_node("DescriptionLine1").text = "口粮储备充足" if int(state.food) >= ration_need else "口粮储备不足"
		info.get_node("DescriptionLine2").text = "今晚需 %d 食物" % ration_need

func set_hud_visible(value: bool) -> void:
	preparation_button.visible = value
	for module: Control in _modules:
		if module != $M05_SurvivorDetail:
			module.visible = value
	if value:
		refresh_campaign_state()
		_refresh_selected_detail()
	else:
		$M05_SurvivorDetail.force_hidden()

func _select_survivor(survivor_id: String) -> void:
	selected_survivor_id = survivor_id
	_refresh_selected_detail()

func _reselect_survivor(survivor_id: String) -> void:
	if selected_survivor_id != survivor_id:
		return
	selected_survivor_id = null
	$M04_SurvivorRoster.clear_selection()
	$M05_SurvivorDetail.close_panel()

func _refresh_selected_detail() -> void:
	if selected_survivor_id == null:
		return
	var view_data: Dictionary = $M04_SurvivorRoster.get_survivor_view_data(str(selected_survivor_id))
	var data: Dictionary = view_data.get("detail", {})
	if data.is_empty():
		selected_survivor_id = null
		$M04_SurvivorRoster.clear_selection()
		$M05_SurvivorDetail.close_panel()
		return
	data = data.duplicate(true)
	var member_id: String = _member_id(str(selected_survivor_id))
	if not member_id.is_empty():
		data.action_states.equipment = "available"
		data.action_states.upgrade = "available"
	$M05_SurvivorDetail.present(data)

func _member_id(identity: String) -> String:
	if _campaign == null:
		return ""
	for id: String in _campaign.data.members:
		var definition: Resource = _campaign.member_template(id)
		if id == identity or definition.survivor_id == identity or definition.id == identity:
			return id
	return ""

func _request_selected(page: String) -> void:
	var member_id := _member_id(str(selected_survivor_id))
	if not member_id.is_empty():
		preparation_requested.emit(member_id, page)

func show_survivor(id: String) -> void:
	# World selection and the portrait rail share the existing presentation route.
	var member_id := _member_id(id)
	var identity: String = _campaign.member_template(member_id).survivor_id if not member_id.is_empty() else id
	$M04_SurvivorRoster.select_survivor(identity)

func lock_departure() -> void:
	set_hud_visible(true)
	$M08_DepartAction/Entry.disabled = true
	$M09_Utility/Entry.disabled = true
	$M03_ResourceBar/MenuButton.disabled = true
	preparation_button.disabled = true

func _layout() -> void:
	var factor := minf(size.x / REFERENCE.x, size.y / REFERENCE.y)
	if is_instance_valid(preparation_button):
		preparation_button.scale = Vector2.ONE * factor
		preparation_button.position = Vector2(size.x - 470.0 * factor, 88.0 * factor)
	for index: int in range(_modules.size()):
		var module := _modules[index]
		var rect := _rects[index]
		module.scale = Vector2.ONE * factor
		module.size = Vector2(rect.size.x, $M04_SurvivorRoster.preferred_height()) if module == $M04_SurvivorRoster else rect.size
		var layout_position := size * _anchors[index] + rect.position * factor
		if module == $M05_SurvivorDetail:
			$M05_SurvivorDetail.set_layout_position(layout_position, factor)
		else:
			module.position = layout_position
