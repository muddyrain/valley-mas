extends SceneTree

const LOADING_SCENE := preload("res://scenes/loading/LoadingScreenV2.tscn")
const CAPTURE_DIR := "res://test-output/loading_v2"

var elapsed := 0.0
var welcome_captured := false
var first_captured := false
var half_captured := false
var overlay_half_captured := false
var full_captured := false
var fade_captured := false
var captures: Array[Dictionary] = [
	{"at": 0.0, "name": "A-entry.png"},
	{"at": 0.10, "name": "B-100ms.png"},
	{"at": 0.30, "name": "C-300ms.png"},
	{"at": 0.60, "name": "D-600ms.png"},
]

func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(CAPTURE_DIR))
	var reference := load("res://assets/ui/loading_v2/reference/loading_final_reference.png") as Texture2D
	if reference != null:
		reference.get_image().save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/reference.png"))
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(LOADING_SCENE.instantiate())
	root.get_child(0).set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_root().add_child(root)
	await process_frame
	await RenderingServer.frame_post_draw
	var loading_root := root.get_child(0)
	var left_ui := loading_root.find_child("LeftUI", true, false) as Control
	var fade := loading_root.find_child("FadeRect", true, false) as Control
	var reference_overlay := loading_root.find_child("ReferenceOverlay", true, false) as Control
	if left_ui != null:
		left_ui.visible = false
	if fade != null:
		fade.visible = false
	if reference_overlay != null:
		reference_overlay.visible = false
	await process_frame
	await RenderingServer.frame_post_draw
	get_root().get_texture().get_image().save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/artwork-only.png"))
	if left_ui != null:
		left_ui.visible = true
	if fade != null:
		fade.visible = true
	_process_capture(0.0)

func _process(delta: float) -> bool:
	elapsed += delta
	if not first_captured:
		var first_image := get_root().get_texture().get_image()
		if first_image.get_pixel(960, 540).get_luminance() > 0.01:
			first_image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/A-entry.png"))
			first_captured = true
	_process_capture(elapsed)
	if not welcome_captured:
		var welcome_label := get_root().find_child("LoadingTitle", true, false) as Label
		if welcome_label != null and welcome_label.text == "欢迎回来。":
			var image := get_root().get_texture().get_image()
			image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/E-welcome-back.png"))
			welcome_captured = true
	var percent_label := get_root().find_child("Percent", true, false) as Label
	if percent_label != null and percent_label.text == "50%" and not half_captured:
		var half_image := get_root().get_texture().get_image()
		half_image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/current-50.png"))
		half_image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/current-50-fixed.png"))
		half_captured = true
		if OS.is_debug_build() and "--loading-layout-debug" in OS.get_cmdline_user_args():
			_save_reference_overlay(half_image)
			overlay_half_captured = true
	if percent_label != null and percent_label.text == "100%" and not full_captured:
		var full_image := get_root().get_texture().get_image()
		full_image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/current-100.png"))
		full_image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/current-100-fixed.png"))
		full_captured = true
	var loading_root := get_root().find_child("LoadingScreenV2", true, false) as Control
	if loading_root != null and loading_root.modulate.a <= 0.5 and not fade_captured:
		get_root().get_texture().get_image().save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/fade-covering.png"))
		get_root().get_texture().get_image().save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/transition-covered.png"))
		fade_captured = true
	if elapsed >= 2.4:
		quit()
	return false

func _process_capture(current: float) -> void:
	if captures.is_empty() or current < float(captures[0].at):
		return
	var capture: Dictionary = captures.pop_front()
	var image := get_root().get_texture().get_image()
	image.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/" + str(capture.name)))

func _save_reference_overlay(base: Image) -> void:
	var reference := Image.load_from_file(ProjectSettings.globalize_path("res://assets/ui/loading_v2/reference/loading_final_reference.png"))
	if reference == null:
		base.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/overlay-50.png"))
		return
	reference.convert(Image.FORMAT_RGBA8)
	base.convert(Image.FORMAT_RGBA8)
	reference.resize(base.get_width(), base.get_height(), Image.INTERPOLATE_LANCZOS)
	for y in range(base.get_height()):
		for x in range(base.get_width()):
			var current := base.get_pixel(x, y)
			var guide := reference.get_pixel(x, y)
			base.set_pixel(x, y, current.lerp(guide, 0.42))
	base.save_png(ProjectSettings.globalize_path(CAPTURE_DIR + "/overlay-50.png"))
