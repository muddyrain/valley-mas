extends SceneTree

const CORE := "res://assets/ui/loading/core/"
const OUTPUT := "res://assets/ui/loading/loading_right_artwork_main.png"
const PHOTO_GROUP_SCALE := 1.18
const ARTWORK_OFFSET := Vector2.ZERO
const PHOTO_01_POS := Vector2(1430, 115)
const PHOTO_02_POS := Vector2(1535, 350)
const NOTE_01_POS := Vector2(1405, 102)
const NOTE_02_POS := Vector2(1515, 500)
const TICKET_POS := Vector2(1615, 610)

func _initialize() -> void:
	var canvas := Image.create(1920, 1080, false, Image.FORMAT_RGBA8)
	canvas.fill(Color(0, 0, 0, 0))
	# Back-to-front compositing establishes one coherent right-side illustration.
	_blend(canvas, "08_photo_01.png", PHOTO_01_POS + ARTWORK_OFFSET, PHOTO_GROUP_SCALE)
	_blend(canvas, "10_photo_02.png", PHOTO_02_POS + ARTWORK_OFFSET, PHOTO_GROUP_SCALE)
	_blend(canvas, "09_note_01.png", NOTE_01_POS + ARTWORK_OFFSET, PHOTO_GROUP_SCALE)
	_blend(canvas, "11_note_02.png", NOTE_02_POS + ARTWORK_OFFSET, PHOTO_GROUP_SCALE)
	_blend(canvas, "12_ticket.png", TICKET_POS + ARTWORK_OFFSET, PHOTO_GROUP_SCALE)
	_blend(canvas, "07_character_group.png", Vector2(795, 205) + ARTWORK_OFFSET, 1.5)
	_blend(canvas, "16_foreground_crates.png", Vector2(680, 820) + ARTWORK_OFFSET, 1.5)
	_blend(canvas, "17_lantern.png", Vector2(1660, 735) + ARTWORK_OFFSET, 0.95)
	_blend(canvas, "19_signature.png", Vector2(1710, 930) + ARTWORK_OFFSET, 0.9)
	# Contact shade is deliberately subtle; it visually seats the character in the crates.
	var shade := Image.create(860, 120, false, Image.FORMAT_RGBA8)
	shade.fill(Color(0.01, 0.025, 0.05, 0.0))
	for y in range(shade.get_height()):
		var alpha := 0.20 * (1.0 - float(y) / float(shade.get_height()))
		for x in range(shade.get_width()):
			var edge := minf(minf(float(x) / 80.0, float(shade.get_width() - x) / 80.0), 1.0)
			shade.set_pixel(x, y, Color(0.01, 0.02, 0.04, alpha * edge))
	canvas.blend_rect(shade, Rect2i(0, 0, shade.get_width(), shade.get_height()), Vector2i(690, 760))
	var dir_shadow := Image.create(1100, 900, false, Image.FORMAT_RGBA8)
	dir_shadow.fill(Color(0.02, 0.05, 0.11, 0.045))
	canvas.blend_rect(dir_shadow, Rect2i(0, 0, dir_shadow.get_width(), dir_shadow.get_height()), Vector2i(720, 100))
	canvas.save_png(ProjectSettings.globalize_path(OUTPUT))
	quit()

func _blend(canvas: Image, file_name: String, position: Vector2, scale_factor: float) -> void:
	var source := load(CORE + file_name) as Texture2D
	if source == null:
		return
	var image := source.get_image()
	image.resize(roundi(image.get_width() * scale_factor), roundi(image.get_height() * scale_factor), Image.INTERPOLATE_LANCZOS)
	canvas.blend_rect(image, Rect2i(0, 0, image.get_width(), image.get_height()), Vector2i(position))
