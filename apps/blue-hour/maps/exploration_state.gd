extends RefCounted
## Persistent explored cells and transient sight cells for one generated map.

const CELL_SIZE: float = 1.5
const SAVE_DIRECTORY: String = "user://exploration"

var map_id: String = ""
var explored_cells: Dictionary = {}
var visible_cells: Dictionary = {}

func load_map(identity: String) -> void:
	map_id = identity.sha256_text().substr(0, 24)
	explored_cells.clear()
	visible_cells.clear()
	var path: String = _save_path()
	if not FileAccess.file_exists(path):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not parsed is Dictionary or str(parsed.get("map_id", "")) != map_id:
		return
	for cell: Variant in parsed.get("explored_cells", []):
		if cell is Array and cell.size() == 2:
			explored_cells[_key(Vector2i(int(cell[0]), int(cell[1])))] = true
	for cell: Variant in parsed.get("visible_cells", []):
		if cell is Array and cell.size() == 2:
			explored_cells[_key(Vector2i(int(cell[0]), int(cell[1])))] = true

func update_visibility(sources: PackedVector2Array, radius: float) -> bool:
	visible_cells.clear()
	var changed: bool = false
	var cell_radius: int = ceili(radius / CELL_SIZE)
	var radius_squared: float = radius * radius
	for source: Vector2 in sources:
		var center: Vector2i = Vector2i((source / CELL_SIZE).floor())
		for x: int in range(center.x - cell_radius, center.x + cell_radius + 1):
			for y: int in range(center.y - cell_radius, center.y + cell_radius + 1):
				var cell := Vector2i(x, y)
				var world_center: Vector2 = (Vector2(cell) + Vector2.ONE * 0.5) * CELL_SIZE
				if world_center.distance_squared_to(source) > radius_squared:
					continue
				var key: String = _key(cell)
				visible_cells[key] = true
				if not explored_cells.has(key):
					explored_cells[key] = true
					changed = true
	return changed

func state_at(position: Vector2) -> int:
	var key: String = _key(Vector2i((position / CELL_SIZE).floor()))
	if visible_cells.has(key):
		return 2
	if explored_cells.has(key):
		return 1
	return 0

func save() -> bool:
	if map_id.is_empty():
		return false
	var directory: String = ProjectSettings.globalize_path(SAVE_DIRECTORY)
	if DirAccess.make_dir_recursive_absolute(directory) != OK:
		return false
	var cells: Array = []
	for key: String in explored_cells:
		var parts: PackedStringArray = key.split(":")
		cells.append([int(parts[0]), int(parts[1])])
	var visible: Array = []
	for key: String in visible_cells:
		var parts: PackedStringArray = key.split(":")
		visible.append([int(parts[0]), int(parts[1])])
	var file: FileAccess = FileAccess.open(_save_path(), FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify({"map_id": map_id, "cell_size": CELL_SIZE, "explored_cells": cells, "visible_cells": visible}))
	return file.get_error() == OK

func _save_path() -> String:
	return SAVE_DIRECTORY.path_join(map_id + ".json")

func _key(cell: Vector2i) -> String:
	return "%d:%d" % [cell.x, cell.y]
