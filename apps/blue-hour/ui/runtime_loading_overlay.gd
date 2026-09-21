extends CanvasLayer
## Reusable opaque hold between two scenes; world initialization starts after close().

const UI = preload("res://ui/ui_style.gd")
const CLOSE_SECONDS: float = 0.25
const OPEN_SECONDS: float = 0.55
const IRIS_SHADER := "shader_type canvas_item; render_mode unshaded; uniform float radius = 1.5; uniform float aspect = 1.7778; void fragment(){ float d = length((UV - vec2(0.5)) * vec2(aspect, 1.0)); float a = radius <= 0.0 ? 1.0 : smoothstep(radius - 0.002, radius + 0.002, d); COLOR = vec4(0.024, 0.043, 0.071, a); }"

var phase: String = "idle"
var surface: ColorRect
var label: Label
var indicator: LoadingIndicator
var radius: float = 1.5:
	set(value):
		radius = value
		if is_instance_valid(surface):
			(surface.material as ShaderMaterial).set_shader_parameter("radius", value)
var first_draw_usec: int = 0
var hold_draw_usec: int = 0

func _ready() -> void:
	layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	surface = ColorRect.new()
	surface.name = "IrisMask"
	surface.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	surface.mouse_filter = Control.MOUSE_FILTER_STOP
	var shader := Shader.new()
	shader.code = IRIS_SHADER
	var material := ShaderMaterial.new()
	material.shader = shader
	surface.material = material
	add_child(surface)
	label = Label.new()
	label.name = "LoadingLabel"
	label.theme = UI.theme()
	label.text = "加载中…"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 24)
	label.add_theme_color_override("font_color", Color("#dce5ed"))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	surface.add_child(label)
	indicator = LoadingIndicator.new()
	indicator.mouse_filter = Control.MOUSE_FILTER_IGNORE
	surface.add_child(indicator)
	get_viewport().size_changed.connect(_layout)
	_layout()
	hide()

func _layout() -> void:
	var dimensions := get_viewport().get_visible_rect().size
	(surface.material as ShaderMaterial).set_shader_parameter("aspect", dimensions.x / maxf(1, dimensions.y))
	indicator.position = dimensions - Vector2(58, 54)

func _input(_event: InputEvent) -> void:
	if visible and phase != "failed":
		get_viewport().set_input_as_handled()

func rendered_frame() -> void:
	await get_tree().process_frame
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw

func close(profile: RefCounted = null) -> void:
	var close_started: int = Time.get_ticks_usec()
	phase = "closing"
	first_draw_usec = 0
	hold_draw_usec = 0
	label.hide()
	indicator.hide()
	radius = _outer_radius()
	show()
	await rendered_frame()
	first_draw_usec = Time.get_ticks_usec()
	if profile != null:
		profile.mark("overlay_ready")
		profile.stages["click_to_overlay_visible"] = (first_draw_usec - profile.started_usec) / 1000.0
		profile.mark("iris_close_started")
	# Starting after the first draw avoids consuming the departure input frame's old delta.
	var tween := create_tween()
	tween.tween_property(self, "radius", 0.0, CLOSE_SECONDS).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	await tween.finished
	phase = "hold"
	label.show()
	indicator.show()
	await rendered_frame()
	hold_draw_usec = Time.get_ticks_usec()
	if profile != null:
		profile.mark("loading_hold_drawn")
		profile.measure("overlay_close", close_started)

func open(profile: RefCounted = null) -> void:
	var started: int = Time.get_ticks_usec()
	phase = "opening"
	label.hide()
	indicator.hide()
	var tween := create_tween()
	tween.tween_property(self, "radius", _outer_radius(), OPEN_SECONDS).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	await tween.finished
	hide()
	phase = "idle"
	if profile != null:
		profile.measure("iris_open", started)
		profile.stages["wait_transition"] = profile.stages.iris_open
		profile.mark("iris_open_complete")

func set_text(value: String) -> void:
	label.text = value

func fail() -> void:
	phase = "failed"
	set_text("加载未完成，请返回主菜单重试。")
	indicator.hide()

func _outer_radius() -> float:
	var dimensions := get_viewport().get_visible_rect().size
	return Vector2(dimensions.x / maxf(1, dimensions.y), 1).length() * .5 + .01

class LoadingIndicator extends Control:
	var angle: float = 0.0
	func _process(delta: float) -> void:
		if is_visible_in_tree():
			angle += delta * 3.2
			queue_redraw()
	func _draw() -> void:
		draw_arc(Vector2.ZERO, 11, 0, TAU, 48, Color("#23374b"), 2, true)
		draw_arc(Vector2.ZERO, 11, angle, angle + PI * 1.2, 32, Color("#a6bdcf"), 2, true)
