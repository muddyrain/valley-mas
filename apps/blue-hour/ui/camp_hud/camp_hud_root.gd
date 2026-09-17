extends Control
## Layout-only shell. Each direct child is an independently replaceable module.

signal depart_requested
signal menu_requested

const REFERENCE := Vector2(1600, 900)

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
	$M08_DepartAction/Entry.pressed.connect(func(): depart_requested.emit())
	$M09_Utility/Entry.pressed.connect(func(): menu_requested.emit())
	_layout()

func set_hud_visible(value: bool) -> void:
	for module: Control in _modules:
		module.visible = value

func lock_departure() -> void:
	set_hud_visible(true)
	$M08_DepartAction/Entry.disabled = true
	$M09_Utility/Entry.disabled = true

func _layout() -> void:
	var factor := minf(size.x / REFERENCE.x, size.y / REFERENCE.y)
	for index: int in range(_modules.size()):
		var module := _modules[index]
		var rect := _rects[index]
		module.scale = Vector2.ONE * factor
		module.size = rect.size
		module.position = size * _anchors[index] + rect.position * factor
