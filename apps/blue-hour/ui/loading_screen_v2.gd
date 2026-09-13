extends Control

## Quiet, layered return-to-camp loading screen. The controller owns presentation;
## the existing main node remains responsible for save state and camp ownership.

signal completed

const MenuArt = preload("res://ui/menu_art.gd")
const DESIGN_SIZE := Vector2(1920.0, 1080.0)
const MIN_LOADING_DURATION := 1.4
const STAGE_THRESHOLDS: Array[float] = [0.15, 0.30, 0.50, 0.72, 0.90]
const STAGE_TEXT: Array[String] = [
	"正在读取归航记录…",
	"正在恢复幸存者档案…",
	"正在同步营地状态…",
	"正在整理物资记录…",
	"正在准备今日行动…",
]
const TIPS: Array[String] = [
	"升级营地设施可以解锁更多功能。",
	"不同幸存者拥有不同职业与特性。",
	"搜刮时注意蓝时即将到来的时间。",
	"装备与角色特性会影响外出效率。",
]
const CORE := "res://assets/ui/loading/core/"
const RIGHT_ARTWORK: Texture2D = preload("res://assets/ui/loading/loading_right_artwork_main.png")

var host_app: Node
var design: Control
var visual_layers: Control
var fade_rect: ColorRect
var progress_fill_clip: Control
var percent_label: Label
var title_label: Label
var stage_labels: Array[Label] = []
var stage_icons: Array[TextureRect] = []
var character: TextureRect
var lantern_glow: TextureRect
var reference_overlay: TextureRect
var artwork_root: Control
var elapsed := 0.0
var target_progress := 0.0
var display_progress := 0.0
var ready_for_camp := false
var finishing := false
var final_pause := 0.0
var heavy_loading_started := false

func setup(app: Node) -> void:
	host_app = app

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 100
	theme = MenuArt.theme()
	_build_scene()
	_log_timing("T_logo_visible")
	_play_intro()
	_mark_first_loading_frame()
	resized.connect(_layout)
	_layout()

func _process(delta: float) -> void:
	elapsed += delta
	_update_target_progress()
	display_progress = move_toward(display_progress, target_progress, delta * 92.0)
	if progress_fill_clip != null:
		progress_fill_clip.size.x = 500.0 * display_progress
	if percent_label != null:
		var shown_percent := 100 if display_progress >= 0.999 else floori(display_progress * 100.0)
		percent_label.text = "%d%%" % shown_percent
	_update_stage_states()
	if display_progress >= 0.999 and ready_for_camp and not finishing:
		_begin_finish()
	if finishing:
		final_pause -= delta
		if final_pause <= 0.0:
			completed.emit()
			set_process(false)

func _input(event: InputEvent) -> void:
	if not OS.is_debug_build() or reference_overlay == null:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F8:
		reference_overlay.visible = not reference_overlay.visible
		get_viewport().set_input_as_handled()

func _build_scene() -> void:
	var background := TextureRect.new()
	background.name = "BackgroundGradient"
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color("#070f1d"), Color("#14263b"), Color("#080d18")])
	gradient.offsets = PackedFloat32Array([0.0, 0.52, 1.0])
	var gradient_texture := GradientTexture2D.new()
	gradient_texture.gradient = gradient
	gradient_texture.width = 1920
	gradient_texture.height = 1080
	gradient_texture.fill_from = Vector2(0.0, 0.0)
	gradient_texture.fill_to = Vector2(1.0, 0.2)
	background.texture = gradient_texture
	var vignette := ColorRect.new()
	vignette.name = "Vignette"
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vignette_shader := Shader.new()
	vignette_shader.code = "shader_type canvas_item; void fragment(){ vec2 p=UV-vec2(0.5); float edge=smoothstep(0.28,0.78,length(p)); COLOR=vec4(0.0,0.015,0.04,edge*0.34); }"
	var vignette_material := ShaderMaterial.new()
	vignette_material.shader = vignette_shader
	vignette.material = vignette_material
	add_child(vignette)
	add_child(background)

	design = Control.new()
	design.name = "LoadingScreenV2"
	design.custom_minimum_size = DESIGN_SIZE
	design.size = DESIGN_SIZE
	design.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(design)
	visual_layers = Control.new()
	visual_layers.name = "LayeredVisuals"
	visual_layers.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visual_layers.mouse_filter = Control.MOUSE_FILTER_IGNORE
	design.add_child(visual_layers)
	artwork_root = Control.new()
	artwork_root.name = "RightArtworkRoot"
	artwork_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	artwork_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	visual_layers.add_child(artwork_root)
	_build_artwork_base()
	_build_artwork_atmosphere()
	_build_back_decor()
	_build_particles()
	_build_ui()

	fade_rect = ColorRect.new()
	fade_rect.name = "FadeRect"
	fade_rect.color = Color(0.02, 0.04, 0.08, 0.0)
	fade_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	design.add_child(fade_rect)
	_build_reference_overlay()

func _build_back_decor() -> void:
	var back := Control.new()
	back.name = "BackDecor"
	back.position = Vector2.ZERO
	visual_layers.add_child(back)
	_add_image(back, "Smoke01", "smoke_01.png", Vector2(745, 640), 0.20)
	_add_image(back, "Smoke02", "smoke_02.png", Vector2(1170, 730), 0.16)
	_add_image(back, "TaglineMark", "tagline_mark.png", Vector2(1790, 35), 0.9)
	var line := _add_image(back, "DecorationLine", "decoration_line.png", Vector2(84, 360), 0.8)
	line.modulate = Color(0.52, 0.73, 0.92, 0.78)
	_create_drift(back.get_node("Smoke01") as TextureRect, Vector2(18, -8), 12.0)
	_create_drift(back.get_node("Smoke02") as TextureRect, Vector2(-16, -10), 14.0)

func _build_character_layer() -> void:
	var layer := Control.new()
	layer.name = "CharacterLayer"
	visual_layers.add_child(layer)
	character = _add_image(layer, "CharacterMain", "character_group.png", Vector2(795, 205), 1.5)
	character.pivot_offset = character.size * 0.5
	character.modulate = Color(1.08, 1.08, 1.08, 0.0)
	_create_drift(character, Vector2(0, -3), 4.2, true)

func _build_foreground() -> void:
	var layer := Control.new()
	layer.name = "ForegroundLayer"
	visual_layers.add_child(layer)
	var crates := _add_image(layer, "ForegroundCrates", "foreground_crates.png", Vector2(600, 820), 1.5)
	crates.pivot_offset = crates.size * 0.5
	_create_drift(crates, Vector2(-4, 3), 11.2)
	lantern_glow = _add_image(layer, "LanternGlow", "lantern_glow.png", Vector2(1570, 750), 0.95)
	var glow_material := CanvasItemMaterial.new()
	glow_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	lantern_glow.material = glow_material
	lantern_glow.modulate = Color(1.0, 0.78, 0.42, 0.78)
	var lantern := _add_image(layer, "Lantern", "lantern.png", Vector2(1590, 735), 0.95)
	var lantern_tween := create_tween().set_loops()
	lantern_tween.tween_property(lantern_glow, "modulate:a", 0.94, 1.4).set_trans(Tween.TRANS_SINE)
	lantern_tween.tween_property(lantern_glow, "modulate:a", 0.66, 1.7).set_trans(Tween.TRANS_SINE)
	lantern_tween.tween_property(lantern, "rotation", deg_to_rad(0.15), 1.6).set_trans(Tween.TRANS_SINE)
	lantern_tween.tween_property(lantern, "rotation", deg_to_rad(-0.15), 1.8).set_trans(Tween.TRANS_SINE)

func _build_artwork_base() -> void:
	var base := TextureRect.new()
	base.name = "ArtworkBase"
	base.texture = RIGHT_ARTWORK
	base.size = DESIGN_SIZE
	base.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	base.stretch_mode = TextureRect.STRETCH_SCALE
	base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	artwork_root.add_child(base)
	var artwork_tween := create_tween().set_loops()
	artwork_tween.tween_property(artwork_root, "position:y", -1.5, 2.25).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	artwork_tween.tween_property(artwork_root, "position:y", 0.0, 2.25).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _build_artwork_atmosphere() -> void:
	var atmosphere := Control.new()
	atmosphere.name = "ArtworkAtmosphere"
	atmosphere.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	atmosphere.mouse_filter = Control.MOUSE_FILTER_IGNORE
	artwork_root.add_child(atmosphere)
	lantern_glow = _add_image(atmosphere, "LanternGlow", "lantern_glow.png", Vector2(1570, 750), 0.95)
	var glow_material := CanvasItemMaterial.new()
	glow_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	lantern_glow.material = glow_material
	lantern_glow.modulate = Color(1.0, 0.78, 0.42, 0.72)
	var glow_tween := create_tween().set_loops()
	glow_tween.tween_property(lantern_glow, "modulate:a", 0.92, 1.45).set_trans(Tween.TRANS_SINE)
	glow_tween.tween_property(lantern_glow, "modulate:a", 0.70, 1.75).set_trans(Tween.TRANS_SINE)

func _build_particles() -> void:
	var layer := Control.new()
	layer.name = "ParticleLayer"
	visual_layers.add_child(layer)
	var textures: Array[Texture2D] = [
		load(CORE + "particle_01.png") as Texture2D,
		load(CORE + "particle_02.png") as Texture2D,
		load(CORE + "particle_03.png") as Texture2D,
	]
	var positions: Array[Vector2] = [Vector2(790, 270), Vector2(720, 520), Vector2(1050, 180), Vector2(1170, 450), Vector2(1320, 250), Vector2(740, 780)]
	for index in positions.size():
		var particle := TextureRect.new()
		particle.name = "BlueParticle%02d" % index
		particle.texture = textures[index % textures.size()]
		particle.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		particle.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		particle.position = positions[index]
		particle.scale = Vector2.ONE * (0.28 + float(index % 3) * 0.08)
		particle.modulate = Color(0.5, 0.78, 1.0, 0.0)
		layer.add_child(particle)
		var end_position := particle.position + Vector2(24.0 + index * 2.0, -88.0 - index * 5.0)
		var tween := create_tween().set_loops()
		tween.tween_property(particle, "modulate:a", 0.42, 0.9 + index * 0.1).set_trans(Tween.TRANS_SINE)
		tween.tween_property(particle, "position", end_position, 4.0 + index * 0.35).set_trans(Tween.TRANS_SINE)
		tween.parallel().tween_property(particle, "rotation", deg_to_rad(12.0 + index * 3.0), 4.0 + index * 0.35)
		tween.tween_property(particle, "modulate:a", 0.0, 1.2).set_trans(Tween.TRANS_SINE)
		tween.tween_property(particle, "position", positions[index], 0.1)

func _build_ui() -> void:
	var ui := Control.new()
	ui.name = "LeftUI"
	ui.position = Vector2(108, 58)
	ui.size = Vector2(620, 900)
	design.add_child(ui)
	var logo := _add_image(ui, "Logo", "logo.png", Vector2.ZERO, 0.94)
	logo.modulate = Color(1, 1, 1, 0.78)
	var tagline := _label(ui, "Tagline", "无论多远，\n总有可以回家的路。", 26, Color("#aebed1"))
	tagline.position = Vector2(24, 235)
	tagline.size = Vector2(430, 80)
	var title := _label(ui, "LoadingTitle", STAGE_TEXT[0], 42, Color("#edf5ff"))
	title.position = Vector2(0, 315)
	title.size = Vector2(620, 58)
	title_label = title
	var underline := _add_image(ui, "LoadingUnderline", "decoration_line.png", Vector2(6, 382), 0.92)
	underline.modulate = Color(0.45, 0.72, 1.0, 0.72)
	var progress_track := TextureRect.new()
	progress_track.name = "ProgressTrack"
	progress_track.position = Vector2(0, 430)
	progress_track.size = Vector2(500, 39)
	progress_track.texture = load(CORE + "progress_bar_bg.png") as Texture2D
	progress_track.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	progress_track.stretch_mode = TextureRect.STRETCH_SCALE
	progress_track.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(progress_track)
	progress_fill_clip = Control.new()
	progress_fill_clip.name = "ProgressFillClip"
	progress_fill_clip.position = progress_track.position + Vector2(0, 14)
	progress_fill_clip.size = Vector2(0.0, 10.0)
	progress_fill_clip.clip_contents = true
	progress_fill_clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(progress_fill_clip)
	var progress_fill := Panel.new()
	progress_fill.name = "ProgressFill"
	progress_fill.size = Vector2(500, 10)
	var fill_style := StyleBoxFlat.new()
	fill_style.bg_color = Color("#9bcfff")
	fill_style.corner_radius_top_left = 5
	fill_style.corner_radius_top_right = 5
	fill_style.corner_radius_bottom_left = 5
	fill_style.corner_radius_bottom_right = 5
	fill_style.shadow_color = Color(0.42, 0.72, 1.0, 0.34)
	fill_style.shadow_size = 5
	progress_fill.add_theme_stylebox_override("panel", fill_style)
	progress_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	progress_fill_clip.add_child(progress_fill)
	percent_label = _label(ui, "Percent", "00%", 31, Color("#9bcfff"))
	percent_label.position = Vector2(525, 423)
	percent_label.size = Vector2(90, 48)
	var steps := Control.new()
	steps.name = "LoadingSteps"
	steps.position = Vector2(0, 477)
	steps.size = Vector2(585, 260)
	ui.add_child(steps)
	for index in STAGE_TEXT.size():
		var row_y := float(index * 48)
		var icon := _add_image(steps, "StepIcon%02d" % index, "check_off.png", Vector2(0, row_y), 0.34)
		icon.position += Vector2(0, 2)
		stage_icons.append(icon)
		var stage_label := _label(steps, "StepLabel%02d" % index, STAGE_TEXT[index].trim_suffix("…"), 20, Color("#65758b"))
		stage_label.position = Vector2(42, row_y + 7)
		stage_label.size = Vector2(300, 34)
		stage_labels.append(stage_label)
		var state_label := _label(steps, "StepState%02d" % index, "…  等待中", 17, Color("#65758b"))
		state_label.position = Vector2(360, row_y + 9)
		state_label.size = Vector2(180, 30)
	var tip := _label(ui, "Tips", "ⓘ  TIPS: " + TIPS[randi() % TIPS.size()], 16, Color("#aebdca"))
	tip.position = Vector2(0, 865)
	tip.size = Vector2(610, 32)

func _build_reference_overlay() -> void:
	reference_overlay = TextureRect.new()
	reference_overlay.name = "ReferenceOverlay"
	reference_overlay.texture = load("res://assets/ui/loading/reference/loading_final_reference.png") as Texture2D
	reference_overlay.position = Vector2.ZERO
	reference_overlay.size = DESIGN_SIZE
	reference_overlay.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	reference_overlay.stretch_mode = TextureRect.STRETCH_SCALE
	reference_overlay.modulate = Color(1, 1, 1, 0.42)
	reference_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	reference_overlay.visible = OS.is_debug_build() and "--loading-layout-debug" in OS.get_cmdline_user_args()
	add_child(reference_overlay)

func _add_image(parent: Node, node_name: String, file_name: String, at: Vector2, scale_factor: float) -> TextureRect:
	var image := TextureRect.new()
	image.name = node_name
	image.texture = load(CORE + file_name) as Texture2D
	if image.texture != null:
		image.size = image.texture.get_size()
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.position = at
	image.scale = Vector2.ONE * scale_factor
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(image)
	return image

func _label(parent: Node, node_name: String, text_value: String, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.name = node_name
	label.text = text_value
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label

func _create_drift(node: Control, offset: Vector2, duration: float, with_rotation: bool = false) -> void:
	var start := node.position
	var tween := create_tween().set_loops()
	tween.tween_property(node, "position", start + offset, duration * 0.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if with_rotation:
		tween.parallel().tween_property(node, "rotation", deg_to_rad(0.12), duration * 0.5).set_trans(Tween.TRANS_SINE)
	tween.tween_property(node, "position", start, duration * 0.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if with_rotation:
		tween.parallel().tween_property(node, "rotation", deg_to_rad(-0.12), duration * 0.5).set_trans(Tween.TRANS_SINE)

func _play_intro() -> void:
	var intro := create_tween()
	var logo := design.get_node("LeftUI/Logo") as TextureRect
	intro.tween_property(logo, "modulate:a", 1.0, 0.18).set_trans(Tween.TRANS_SINE)
	intro.parallel().tween_property(logo, "position:y", 0.0, 0.18).set_trans(Tween.TRANS_SINE)
	intro.tween_property(artwork_root, "modulate:a", 1.0, 0.45).set_trans(Tween.TRANS_SINE)
	intro.parallel().tween_property(artwork_root, "position:x", 0.0, 0.45).set_trans(Tween.TRANS_SINE)

func _update_target_progress() -> void:
	if elapsed < 0.24:
		target_progress = 0.0
	elif elapsed < 0.52:
		target_progress = 0.15
	elif elapsed < 0.80:
		target_progress = 0.30
	elif elapsed < 1.02:
		target_progress = 0.50
	elif elapsed < 1.18:
		target_progress = 0.72
	else:
		target_progress = 1.0 if ready_for_camp else 0.90
	if not ready_for_camp and elapsed >= 0.88:
		if not heavy_loading_started:
			heavy_loading_started = true
			_log_timing("T_heavy_loading_started")
		if is_instance_valid(host_app):
			var prepared: Variant = host_app.call("get_camp_view")
			host_app.call("prepare_camp_for_loading")
			ready_for_camp = prepared != null
		else:
			# Standalone debug scene: exercise the full animation without a game host.
			ready_for_camp = elapsed >= 1.12

func _update_stage_states() -> void:
	if title_label == null:
		return
	var current := 0
	for index in STAGE_THRESHOLDS.size():
		if display_progress >= STAGE_THRESHOLDS[index]:
			current = index + 1
	for index in stage_labels.size():
		var state_label := stage_labels[index].get_parent().get_node("StepState%02d" % index) as Label
		if index < current:
			stage_icons[index].texture = load(CORE + "check_on.png") as Texture2D
			stage_labels[index].add_theme_color_override("font_color", Color("#a8d9ff"))
			state_label.text = "…  完成"
			state_label.add_theme_color_override("font_color", Color("#a8d9ff"))
		elif index == current and display_progress < 1.0:
			stage_icons[index].texture = load(CORE + "check_loading.png") as Texture2D
			stage_labels[index].add_theme_color_override("font_color", Color("#edf5ff"))
			state_label.text = "…  进行中"
			state_label.add_theme_color_override("font_color", Color("#edf5ff"))
		else:
			stage_icons[index].texture = load(CORE + "check_off.png") as Texture2D
			stage_labels[index].add_theme_color_override("font_color", Color("#65758b"))
			state_label.text = "…  等待中"
			state_label.add_theme_color_override("font_color", Color("#65758b"))
	if current < STAGE_TEXT.size():
		title_label.text = STAGE_TEXT[current]

func _begin_finish() -> void:
	finishing = true
	final_pause = 0.80
	target_progress = 1.0
	display_progress = 1.0
	title_label.text = "欢迎回来。"
	_log_timing("T_loading_100_reached")
	_log_timing("T_welcome_hold_start")
	var tween := create_tween()
	# Camp is already prewarmed beneath Loading; only the complete Loading root fades.
	tween.tween_interval(0.62)
	tween.tween_callback(func() -> void: _log_timing("T_fade_out_start"))
	tween.tween_property(self, "modulate:a", 0.0, 0.16).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(func() -> void: _log_timing("T_fade_fully_covered"))
	_log_timing("T_loading_100_ready")

func _mark_first_loading_frame() -> void:
	await get_tree().process_frame
	_log_timing("T_first_loading_frame_drawn")

func _log_timing(label: String) -> void:
	if is_instance_valid(host_app) and host_app.has_method("loading_timing"):
		host_app.call("loading_timing", label)

func _layout() -> void:
	if design == null:
		return
	var factor := minf(size.x / DESIGN_SIZE.x, size.y / DESIGN_SIZE.y)
	design.scale = Vector2.ONE * factor
	design.position = (size - DESIGN_SIZE * factor) * 0.5
