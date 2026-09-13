extends SceneTree

const REFERENCE := "res://assets/ui/loading_v2/reference/loading_final_reference.png"
const CURRENT := "res://test-output/loading_v2/current-50.png"
const OUTPUT_DIR := "res://test-output/loading_v3_reference"
const TARGET_SIZE := Vector2i(1672, 941)

func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT_DIR))
	var reference := Image.load_from_file(ProjectSettings.globalize_path(REFERENCE))
	var current := Image.load_from_file(ProjectSettings.globalize_path(CURRENT))
	if reference == null or current == null:
		quit(1)
		return
	reference.convert(Image.FORMAT_RGBA8)
	current.convert(Image.FORMAT_RGBA8)
	current.resize(TARGET_SIZE.x, TARGET_SIZE.y, Image.INTERPOLATE_LANCZOS)
	var overlay := reference.duplicate()
	overlay.blend_rect(current, Rect2i(Vector2i.ZERO, TARGET_SIZE), Vector2i.ZERO)
	overlay.save_png(ProjectSettings.globalize_path(OUTPUT_DIR + "/overlay.png"))
	var diff := Image.create(TARGET_SIZE.x, TARGET_SIZE.y, false, Image.FORMAT_RGBA8)
	diff.fill(Color.BLACK)
	var total := 0.0
	var count := 0
	for y in range(TARGET_SIZE.y):
		for x in range(TARGET_SIZE.x):
			var a := reference.get_pixel(x, y)
			var b := current.get_pixel(x, y)
			var distance := absf(a.r - b.r) + absf(a.g - b.g) + absf(a.b - b.b)
			total += distance
			count += 1
			diff.set_pixel(x, y, Color(distance / 3.0, distance / 3.0, distance / 3.0, 1.0))
	diff.save_png(ProjectSettings.globalize_path(OUTPUT_DIR + "/diff.png"))
	print("[LoadingV3] mean_abs_diff=%.6f" % (total / (float(count) * 3.0)))
	quit()
