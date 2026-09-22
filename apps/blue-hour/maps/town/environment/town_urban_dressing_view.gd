extends RefCounted
## Instantiates decorative props without adding search objects or navigation blockers.

const Catalog = preload("res://data/world_asset_catalog.gd")

static func build(parent: Node3D, town: Dictionary, data: Dictionary) -> Node3D:
	var layer := Node3D.new()
	layer.name = "UrbanDressingLayer"
	parent.add_child(layer)
	for item: Dictionary in data.get("instances", []):
		var definition: Resource = Catalog.asset(item.asset)
		if definition == null or definition.scene == null:
			continue
		var wrapper: Node3D = definition.scene.instantiate()
		wrapper.name = item.id
		wrapper.position = item.position
		wrapper.rotation.y = float(item.yaw)
		wrapper.scale = Vector3.ONE * float(item.get("scale", 1.0))
		wrapper.set_meta("environment_slot", item.zone)
		wrapper.set_meta("urban_dressing", true)
		layer.add_child(wrapper)
	layer.set_meta("seed", data.get("seed", town.get("seed", 0)))
	layer.set_meta("statistics", data.get("by_zone", {}))
	return layer
