extends RefCounted
## Three finite frontage templates. Slots have no model IDs.
const IDS: Array[String] = ["LAYOUT_SMALL_3X3", "LAYOUT_MEDIUM_3X4", "LAYOUT_MEDIUM_4X4"]

static func get_layout(id: String) -> Dictionary:
	var index := IDS.find(id)
	if index < 0:
		return {}
	var rows: Array = [[2, 3, 2], [3, 4, 3], [3, 6, 3]][index]
	var half_width: int = [40, 48, 64][index]
	var slots: Array[Dictionary] = []
	for row: int in range(3):
		for column: int in int(rows[row]):
			slots.append({"slot_id": "block_%d_slot_%d" % [row, column], "block_id": "block_%d" % row,
				"row": row, "category": "commercial" if row == 0 else "residential" if row == 1 else "mixed",
				"position": Vector3.ZERO, "rotation": PI if row == 0 else 0.0,
				"road_z": -22.4 if row == 0 else -9.6 if row == 1 else 22.4,
				"max_footprint": Vector2(24, 16), "allow_poi": row == 0 and column == 0, "weight": 1.0})
	var edge := half_width - 8
	var roads: Array[Dictionary] = [
		{"start": Vector2i(-edge, -16), "end": Vector2i(edge, -16)},
		{"start": Vector2i(-edge, 16), "end": Vector2i(edge, 16)},
		{"start": Vector2i(-edge, -16), "end": Vector2i(-edge, 16)}]
	var zombie_slots: Array[Vector3] = []
	for x: int in range(-edge + 12, edge - 10, 4):
		zombie_slots.append(Vector3(x, 0, -16))
		zombie_slots.append(Vector3(x, 0, 16))
	return {"slots": slots, "half_width": half_width, "roads": roads,
		"spawn": Vector3(-edge, 0, 16), "extraction": Vector3(edge, 0, -16), "zombie_slots": zombie_slots}
