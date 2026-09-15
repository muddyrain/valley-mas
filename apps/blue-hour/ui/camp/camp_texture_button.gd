extends Button
## One centered content tree for every textured CAMP control. Button.text is
## retained for accessibility and existing automation, but never painted twice.
const CampArt = preload("res://ui/camp/camp_skin.gd")
const Surface = preload("res://ui/camp/camp_surface.gd")
var family: String = "secondary"
var main_label: Label
var secondary_label: Label
var icon_view: TextureRect
var badge: Label
var content: MarginContainer
var center: CenterContainer
var content_group: HBoxContainer
var text_stack: VBoxContainer
var skin: PanelContainer
var arrow: TextureRect
var debug_centers: bool = false
var selected_visual: bool = false
var _last_state: String = ""
var _hovered: bool = false
var _arrow_tween: Tween
var _guide: Control

func _init() -> void:
	preload("res://ui/new_run_art.gd").empty_button(self)
	mouse_filter = MOUSE_FILTER_STOP
	pressed.connect(_refresh_visual)
	button_down.connect(_refresh_visual)
	button_up.connect(_refresh_visual)
	mouse_entered.connect(func(): _hovered = true; _refresh_visual())
	mouse_exited.connect(func(): _hovered = false; _refresh_visual())
	focus_entered.connect(_refresh_visual)
	focus_exited.connect(_refresh_visual)
	toggled.connect(func(_value: bool): _refresh_visual())
	resized.connect(queue_redraw)

func setup(value: String, callback: Callable, kind: String = "secondary", symbol: Texture2D = null, subtitle: String = "", font_size: int = 18) -> void:
	family = kind
	text = value
	pressed.connect(callback)
	skin = Surface.new()
	add_child(skin)
	CampArt.full_rect(skin)
	content = MarginContainer.new()
	content.name = "CampCenteredButtonContent"
	add_child(content)
	CampArt.full_rect(content)
	for side: String in ["left", "right"]:
		content.add_theme_constant_override("margin_" + side, 8)
	# A single optical adjustment moves the whole group, never individual buttons.
	content.offset_top = CampArt.TEXT_VISUAL_OFFSET_Y
	content.offset_bottom = CampArt.TEXT_VISUAL_OFFSET_Y
	center = CenterContainer.new()
	center.mouse_filter = MOUSE_FILTER_IGNORE
	content.add_child(center)
	content_group = HBoxContainer.new()
	content_group.mouse_filter = MOUSE_FILTER_IGNORE
	content_group.add_theme_constant_override("separation", 8)
	center.add_child(content_group)
	icon_view = CampArt.icon(symbol, Vector2(24, 24))
	icon_view.visible = symbol != null
	icon_view.size_flags_vertical = SIZE_SHRINK_CENTER
	content_group.add_child(icon_view)
	text_stack = VBoxContainer.new()
	text_stack.add_theme_constant_override("separation", -2)
	text_stack.mouse_filter = MOUSE_FILTER_IGNORE
	content_group.add_child(text_stack)
	main_label = CampArt.label(value, font_size, CampArt.WHITE)
	main_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	text_stack.add_child(main_label)
	main_label.visible = not value.is_empty()
	secondary_label = CampArt.label(subtitle, 12, CampArt.WHITE)
	secondary_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	secondary_label.visible = not subtitle.is_empty()
	text_stack.add_child(secondary_label)
	badge = CampArt.label("", 12, CampArt.WHITE)
	badge.visible = false
	badge.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(badge)
	if kind == "depart":
		arrow = CampArt.icon(CampArt.texture(94), Vector2(36, 30))
		arrow.size_flags_vertical = SIZE_SHRINK_CENTER
		content_group.add_child(arrow)
		content_group.add_theme_constant_override("separation", 18)
	_refresh_visual()

func set_selected(value: bool) -> void:
	selected_visual = value
	_refresh_visual()

func set_debug_centers(value: bool) -> void:
	debug_centers = value
	if _guide == null:
		_guide = CenterGuide.new()
		_guide.button = self
		add_child(_guide)
		CampArt.full_rect(_guide)
		_guide.z_index = 100
	_guide.visible = value
	_guide.queue_redraw()

func _process(_delta: float) -> void:
	if main_label != null and main_label.text != text:
		main_label.text = text
	_refresh_visual()

func _refresh_visual() -> void:
	if skin == null:
		return
	var state: String = "disabled" if disabled else "pressed" if is_pressed() else "selected_hover" if selected_visual and (_hovered or has_focus()) else "selected" if selected_visual else "hover" if _hovered or has_focus() else "normal"
	if state == _last_state:
		return
	_last_state = state
	# Keep one geometry per control family. The old hover assets have slightly
	# different baked bounds, which made every button visibly warp on hover.
	# State feedback is now carried by tint and a restrained press scale.
	var ids: Dictionary = {
		"secondary": [70, 70, 70, 70, 70], "primary": [71, 71, 71, 71, 71],
		"quick": [30, 30, 30, 30, 30], "slot": [222, 222, 222, 222, 222],
		"roster": [227, 228, 229, 227, 229], "skill_label": [224, 224, 224, 224, 224], "depart": [90, 90, 90, 90, 90],
		"plain": [70, 70, 70, 70, 70]}
	var index: int = ["normal", "hover", "pressed", "disabled", "selected", "selected_hover"].find(state)
	if index < 0:
		index = 4
	if state == "selected_hover":
		index = 4
	var id: int = ids[family][index]
	var corners: float = 95.0 if family in ["slot", "roster"] else 75.0
	skin.configure(id, corners, 0.10 if family == "roster" else 0.12, family in ["quick", "depart"])
	skin.texture_tint = Color(0.62, 0.68, 0.74) if disabled and family in ["secondary", "primary"] else (Color(1.08, 1.08, 1.08) if state in ["hover", "selected_hover"] else Color.WHITE)
	# Plain controls (timeline status and close affordances) must not acquire a
	# dark baked button plate on hover.
	skin.visible = family != "plain"
	content.modulate = Color(0.65, 0.72, 0.79) if disabled else Color.WHITE
	content.scale = Vector2(0.97, 0.97) if state == "pressed" else Vector2.ONE
	content.pivot_offset = size * 0.5
	if arrow != null:
		if _arrow_tween != null:
			_arrow_tween.kill()
		_arrow_tween = create_tween()
		_arrow_tween.tween_property(arrow, "self_modulate", Color(1.14, 1.14, 1.14) if state == "hover" else Color.WHITE, 0.12)
	queue_redraw()

func _has_point(point: Vector2) -> bool:
	if family == "quick":
		return point.distance_to(size * 0.5) <= minf(size.x, size.y) * 0.48
	return Rect2(Vector2.ZERO, size).has_point(point)

class CenterGuide extends Control:
	var button: Button

	func _draw() -> void:
		var group_center: Vector2 = get_global_transform().affine_inverse() * button.content_group.get_global_rect().get_center()
		draw_rect(Rect2(Vector2.ZERO, size), Color.MAGENTA, false, 1)
		draw_line(Vector2(0, size.y * 0.5), Vector2(size.x, size.y * 0.5), Color.MAGENTA, 1.0)
		draw_line(Vector2(group_center.x - 28, group_center.y), Vector2(group_center.x + 28, group_center.y), Color.GREEN, 1.0)
