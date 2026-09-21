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
	$M05_SurvivorDetail.hide()
	$M04_SurvivorRoster.survivor_selected.connect(_select_survivor)
	$M08_DepartAction/Entry.pressed.connect(func(): depart_requested.emit())
	$M09_Utility/Entry.pressed.connect(func(): menu_requested.emit())
	$M03_ResourceBar/MenuButton.pressed.connect(func(): camp_menu_requested.emit())
	_layout()

func configure_roster(catalog: RefCounted, campaign: RefCounted) -> void:
	$M04_SurvivorRoster.configure(catalog, campaign)

func set_hud_visible(value: bool) -> void:
	for module: Control in _modules:
		module.visible = value and (module != $M05_SurvivorDetail or selected_survivor_id != null)

func _select_survivor(survivor_id: String) -> void:
	var view_data: Dictionary = $M04_SurvivorRoster.get_survivor_view_data(survivor_id)
	var data: Dictionary = view_data.get("detail", {})
	if data.is_empty():
		return
	selected_survivor_id = survivor_id
	$M05_SurvivorDetail.show_survivor(data)
	$M05_SurvivorDetail.show()

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
		module.size = rect.size
		module.position = size * _anchors[index] + rect.position * factor
