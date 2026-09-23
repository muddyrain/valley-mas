extends Control
## Independent modules; the root routes presentation selection without campaign writes.

signal depart_requested
signal menu_requested
signal camp_menu_requested

const REFERENCE := Vector2(1600, 900)
var selected_survivor_id: Variant = null
var _modules: Array[Control] = []
var _rects: Array[Rect2] = []
var _anchors: Array[Vector2] = []

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
	_layout()

func configure_roster(catalog: RefCounted, campaign: RefCounted) -> void:
	$M04_SurvivorRoster.configure(catalog, campaign)
	_layout()
	_refresh_selected_detail()

func refresh_roster() -> void:
	$M04_SurvivorRoster.refresh()
	_layout()
	_refresh_selected_detail()

func set_hud_visible(value: bool) -> void:
	for module: Control in _modules:
		if module != $M05_SurvivorDetail:
			module.visible = value
	if value:
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
	$M05_SurvivorDetail.present(data)

func show_survivor(id: String) -> void:
	# World selection and the portrait rail share the existing presentation route.
	$M04_SurvivorRoster.select_survivor(id)

func lock_departure() -> void:
	set_hud_visible(true)
	$M08_DepartAction/Entry.disabled = true
	$M09_Utility/Entry.disabled = true
	$M03_ResourceBar/MenuButton.disabled = true

func _layout() -> void:
	var factor := minf(size.x / REFERENCE.x, size.y / REFERENCE.y)
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
