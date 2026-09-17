extends RefCounted

const Catalog = preload("res://data/world_asset_catalog.gd")

static func build(parent: Node3D, result: Dictionary) -> Node3D:
	var layer := Node3D.new()
	layer.name = "TownEnvironment"
	parent.add_child(layer)
	for item: Dictionary in result.instances:
		var wrapper: Node3D = Catalog.asset(item.asset).scene.instantiate()
		wrapper.name = item.id
		wrapper.position = item.position
		wrapper.rotation.y = item.yaw
		wrapper.scale = Vector3.ONE * item.scale
		wrapper.set_meta("environment_slot", item.slot_id)
		layer.add_child(wrapper)
	preload("res://maps/world/surface_palette.gd").style_world(layer)
	return layer
