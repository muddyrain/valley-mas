extends RefCounted
const Road = preload("res://maps/generation/road_generator.gd")

static func build(city: Node3D, sites: Array[Dictionary]) -> void:
	var root := Node3D.new()
	root.name = "Plots"
	city.add_child(root)
	for site: Dictionary in sites:
		var plot := Node3D.new()
		plot.name = site.id.capitalize()
		root.add_child(plot)
		plot.position = site.position
		plot.rotation.y = site.yaw
		var depth: float = site.size.z
		Road.slab(plot, Vector3(site.size.x + 1.2, .04, depth + 1.2), Vector3(0, -.02, 0), Color("#92938a"))
		var forward: Vector3 = -plot.basis.z
		var distance: float = (site.entry - site.road_anchor).length()
		var path_center: Vector3 = (site.entry + site.road_anchor) * .5
		if distance > .1:
			var pavement := Road.slab(root, Vector3(2.8, .04, distance + 2.0), path_center + Vector3.UP * .015, Color("#b4b0a2"))
			pavement.rotation.y = atan2(-forward.x, -forward.z)

