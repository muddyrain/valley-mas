extends PanelContainer
## One anchored surface for both transient hints and pinned Camp details.
signal closed
const Style = preload("res://ui/camp_style.gd")
var interactive := false
var column: VBoxContainer
var source: Control
var side := "right"
var _scroll: ScrollContainer
var _tween: Tween
var _closing := false

func setup(title: String, subtitle: String, trigger: Control, placement: String, pinned: bool) -> void:
	name = "CampDetailCard"
	theme = Style.paper_theme()
	interactive = pinned
	source = trigger
	side = placement
	custom_minimum_size.x = 340
	size = Vector2(340, 0)
	mouse_filter = Control.MOUSE_FILTER_STOP if pinned else Control.MOUSE_FILTER_IGNORE
	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.mouse_filter = mouse_filter
	add_child(_scroll)
	column = VBoxContainer.new()
	column.custom_minimum_size.x = 300
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.mouse_filter = mouse_filter
	column.add_theme_constant_override("separation", 12)
	_scroll.add_child(column)
	var heading := HBoxContainer.new()
	heading.mouse_filter = mouse_filter
	column.add_child(heading)
	var title_label := Style.label(title, 23)
	title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(title_label)
	if pinned:
		heading.add_child(Style.button("×", request_close, Vector2(32, 30)))
	if not subtitle.is_empty():
		column.add_child(Style.wrapped(subtitle, 13, Style.ACCENT))
	column.minimum_size_changed.connect(_fit)
	get_viewport().size_changed.connect(_fit)
	_fit.call_deferred()
	call_deferred("play_open_animation")

func play_open_animation() -> void:
	if _closing:
		return
	pivot_offset = size * 0.5
	if pivot_offset == Vector2.ZERO:
		pivot_offset = Vector2(170.0, 120.0)
	scale = Vector2(0.94, 0.94)
	modulate = Color(1.0, 1.0, 1.0, 0.0)
	if _tween != null:
		_tween.kill()
	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.set_trans(Tween.TRANS_BACK)
	_tween.set_ease(Tween.EASE_OUT)
	_tween.tween_property(self, "scale", Vector2.ONE, 0.26)
	_tween.tween_property(self, "modulate", Color.WHITE, 0.16)

func request_close() -> void:
	if _closing:
		return
	_closing = true
	mouse_filter = MOUSE_FILTER_IGNORE
	if _tween != null:
		_tween.kill()
	_tween = create_tween()
	_tween.set_parallel(true)
	_tween.set_trans(Tween.TRANS_QUAD)
	_tween.set_ease(Tween.EASE_IN)
	_tween.tween_property(self, "scale", Vector2(0.96, 0.96), 0.14)
	_tween.tween_property(self, "modulate", Color(1.0, 1.0, 1.0, 0.0), 0.12)
	get_tree().create_timer(0.17).timeout.connect(func():
		if _closing:
			closed.emit()
	)

func _fit() -> void:
	# A deferred layout can outlive a tooltip closed during the same input frame.
	if not is_inside_tree():
		return
	_scroll.custom_minimum_size.y = minf(column.get_combined_minimum_size().y, maxf(180, get_viewport_rect().size.y - 260))
	reset_size()
	place.call_deferred()

func describe(text: String, color: Color = Style.MUTED) -> void:
	column.add_child(Style.wrapped(text, 15, color))

func action(text: String, callback: Callable, enabled: bool = true) -> Button:
	var result := Style.button(text, callback)
	result.disabled = not enabled
	column.add_child(result)
	return result

func place() -> void:
	if not is_inside_tree() or not is_instance_valid(source) or not source.is_inside_tree():
		return
	var bounds := get_viewport_rect()
	var rect := source.get_global_rect()
	var at := Vector2(rect.end.x + 14, rect.position.y)
	if side == "above":
		at = Vector2(rect.get_center().x - size.x * 0.5, rect.position.y - size.y - 14)
	elif side == "below":
		at = Vector2(rect.get_center().x - size.x * 0.5, rect.end.y + 14)
	elif side == "left":
		at = Vector2(rect.position.x - size.x - 14, rect.position.y)
	position = Vector2(clampf(at.x, 16, maxf(16, bounds.size.x - size.x - 226)), clampf(at.y, 104, maxf(104, bounds.size.y - size.y - 110)))
