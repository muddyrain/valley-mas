extends Node3D
const Assets = preload("res://vfx/generated_assets.gd")
const Visuals = preload("res://vfx/visuals.gd")
const Atmosphere = preload("res://blue_hour/atmosphere.gd")
var lamps: Array[MeshInstance3D] = []
var accent_lights: Array[OmniLight3D] = []
var bus_light: OmniLight3D
var camera: Camera3D
var atmosphere: Node3D
var asset_nodes: Dictionary = {}
var asset_labels: Dictionary = {}
var mode := 0
var category := "all"
var target := Vector3(0, 0, 34)
var yaw := .30
var pitch := .77
var mode_button: Button
var sections := {
	"all": [Vector3(0,0,34), 105.0],
	"roads": [Vector3(0,0,0), 53.0],
	"buildings": [Vector3(0,1,18), 31.0],
	"modules": [Vector3(0,1,32), 38.0],
	"props": [Vector3(0,1,47), 36.0],
	"vehicles": [Vector3(0,1,65), 38.0],
	"weapons": [Vector3(0,.2,78), 5.2],
	"bus": [Vector3(24,1.6,65), 11.5],
	"infected": [Vector3(8,1,78), 4.5],
}

func _ready() -> void:
	Visuals.box(self, Vector3(91,.16,99), Vector3(0,-.08,36), Color("#656B6D"))
	var grouped: Dictionary = {}
	for id in Assets.catalog():
		var spec: Dictionary = Assets.catalog()[id]
		var group: String = "props" if spec.category == "searchable" else spec.category
		if not grouped.has(group):
			grouped[group] = []
		grouped[group].append(id)
	for group in grouped:
		var ids: Array = grouped[group]
		for index in range(ids.size()):
			var pos := _asset_position(group, index, ids.size())
			var instance := Assets.spawn(ids[index], self, pos, 0, true)
			asset_nodes[ids[index]] = instance
			Assets.collect_lamps(instance, lamps)
			var text: String = ids[index].trim_prefix("BH_")
			var label_offset: float = 5.4 if group in ["roads","vehicles"] else (6.3 if group == "buildings" else (1.8 if group != "weapons" else .6))
			var label := Visuals.label(self, text, pos + Vector3(0,.1,label_offset), Color("#D8D5C9"), 20)
			label.pixel_size = .019 if group != "weapons" else .007
			label.no_depth_test = false
			asset_labels[ids[index]] = label
	bus_light = OmniLight3D.new()
	bus_light.position = Vector3(24,3,65)
	bus_light.omni_range = 9
	bus_light.light_color = Color("#E8B36A")
	add_child(bus_light)
	atmosphere = Atmosphere.new()
	add_child(atmosphere)
	atmosphere.setup(self)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = .05
	camera.far = 300
	add_child(camera)
	camera.current = true
	_build_controls()
	focus_category("all")
	set_mode(0)
	print("BH_SHOWCASE_READY ", asset_nodes.size())

func _asset_position(group: String, index: int, count: int) -> Vector3:
	match group:
		"roads": return Vector3((index-(count-1)*.5)*10,0,0)
		"buildings": return Vector3((index-1)*16,0,18)
		"modules": return Vector3((index-(count-1)*.5)*5.3,0,32)
		"props": return Vector3((index%10-4.5)*5.1,0,42+floori(index/10.0)*9)
		"vehicles": return Vector3((index-2)*12,0,65)
		"weapons": return Vector3((index-1.5)*1.4,.28,78)
		"characters": return Vector3(8,0,78)
	return Vector3.ZERO

func _build_controls() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := PanelContainer.new()
	panel.position = Vector2(18,18)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#243747")
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", style)
	layer.add_child(panel)
	var column := VBoxContainer.new()
	panel.add_child(column)
	var title := Label.new()
	title.text = "BLUE HOUR  /  ART KIT V1  ·  %d ASSETS" % asset_nodes.size()
	title.add_theme_font_size_override("font_size",22)
	column.add_child(title)
	var row := HBoxContainer.new()
	column.add_child(row)
	for entry in [["all","总览"],["roads","道路"],["buildings","建筑"],["modules","模块"],["props","道具"],["vehicles","车辆"],["bus","归航巴士"],["weapons","武器"],["infected","感染者"]]:
		var button := Button.new()
		button.text = entry[1]
		button.pressed.connect(focus_category.bind(entry[0]))
		row.add_child(button)
	mode_button = Button.new()
	mode_button.pressed.connect(func(): set_mode(1-mode))
	column.add_child(mode_button)
	var hint := Label.new()
	hint.text = "滚轮缩放 · 右键拖动旋转 · Tab 切换灯光"
	column.add_child(hint)

func focus_category(value: String) -> void:
	category = value
	for id in asset_nodes:
		var group: String = Assets.catalog()[id].category
		var show: bool = value == "all" or group == value or (value == "props" and group == "searchable") or (value == "bus" and id == "BH_EvacBus_01") or (value == "infected" and group == "characters")
		asset_nodes[id].visible = show
		asset_labels[id].visible = show
	target = sections[value][0]
	camera.size = sections[value][1]
	yaw = .30 if value not in ["weapons","infected"] else 1.05
	pitch = .77 if value not in ["bus","weapons","infected"] else .46
	_update_camera()

func set_mode(value: int) -> void:
	mode = value
	atmosphere.set_phase(mode, true)
	mode_button.text = "DAY  →  BLUE HOUR" if mode == 0 else "BLUE HOUR  →  DAY"

func _update_camera() -> void:
	camera.position = target + Vector3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch))*100
	camera.look_at(target)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_TAB:
		set_mode(1-mode)
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			camera.size = maxf(2,camera.size*.85)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			camera.size = minf(140,camera.size/ .85)
	elif event is InputEventMouseMotion and event.button_mask & MOUSE_BUTTON_MASK_RIGHT:
		yaw -= event.relative.x*.005
		pitch = clampf(pitch+event.relative.y*.004,.20,1.35)
		_update_camera()
