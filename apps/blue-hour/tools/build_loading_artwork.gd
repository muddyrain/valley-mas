extends SceneTree

const CORE := "res://assets/ui/loading/core/"
const OUTPUT := "res://assets/ui/loading/loading_right_artwork_main.png"
const STICKER_OFFSET := Vector2(50, 0)
# Positions use the 1920x1080 design canvas. Photo02 includes its source safety margin.
const PIECES := [
	["photo_01.png", Vector2(1480, 120) + STICKER_OFFSET, 1.25],
	["photo_02.png", Vector2(1600, 315) + STICKER_OFFSET, 0.25],
	["note_01.png", Vector2(1440, 98) + STICKER_OFFSET, 0.96],
	["note_02.png", Vector2(1590, 535) + STICKER_OFFSET, 0.96],
	["ticket.png", Vector2(1640, 635) + STICKER_OFFSET, 0.95],
	["character_group.png", Vector2(795, 205), 1.5],
	["foreground_crates.png", Vector2(680, 950), 1.5],
	["lantern.png", Vector2(1660, 735), 0.95],
	["signature.png", Vector2(1710, 930), 0.9],
]

func _initialize() -> void:
	var canvas := Image.create(1920, 1080, false, Image.FORMAT_RGBA8)
	canvas.fill(Color(0, 0, 0, 0))
	for piece: Array in PIECES:
		if not _blend(canvas, piece[0], piece[1], piece[2]):
			quit(1)
			return
	# Replace atomically: the editor may still map the previous PNG while it is open.
	var output_path := ProjectSettings.globalize_path(OUTPUT)
	var pending_path := output_path + ".pending"
	var error := canvas.save_png(pending_path)
	if error == OK:
		error = DirAccess.rename_absolute(pending_path, output_path)
	if error != OK:
		push_error("Could not save Loading artwork: %s" % error)
		quit(1)
		return
	print("LOADING ARTWORK: 9 unique source pieces; transparent canvas; ", OUTPUT)
	print("Reimport the PNG before runtime capture or export: Godot --headless --editor --import --quit")
	quit()

func _blend(canvas: Image, file_name: String, position: Vector2, scale_factor: float) -> bool:
	# Raw PNGs avoid stale editor import caches when rebuilding the artwork.
	var source := Image.load_from_file(ProjectSettings.globalize_path(CORE + file_name))
	if source == null or source.is_empty():
		push_error("Missing Loading source: " + file_name)
		return false
	source.convert(Image.FORMAT_RGBA8)
	source.resize(roundi(source.get_width() * scale_factor), roundi(source.get_height() * scale_factor), Image.INTERPOLATE_LANCZOS)
	canvas.blend_rect(source, Rect2i(Vector2i.ZERO, source.get_size()), Vector2i(position))
	return true
