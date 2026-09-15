extends SceneTree
const G = preload("res://maps/random/random_map_generator.gd")
func _initialize() -> void:
	for i in range(1, 4):
		var seed_value := 772 + i * 104729
		var r: Dictionary = G.generate("supply_search", seed_value, "LAYOUT_MEDIUM_3X4")
		var ids: Array[String] = []
		var slots: Array[String] = []
		for b: Dictionary in r.buildings:
			ids.append(str(b.asset)); slots.append(str(b.slot_id))
		print("FORMAL_RUN=%d Seed=%d Layout=%s Buildings=%s Slots=%s Instance=%s" % [i, seed_value, r.layout, ",".join(ids), ",".join(slots), str(r.get("instance_id", "generated-%d" % seed_value))])
	quit()
