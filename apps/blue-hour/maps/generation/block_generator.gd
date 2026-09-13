extends RefCounted
const Road = preload("res://maps/generation/road_generator.gd")
const Assets = preload("res://data/world_asset_catalog.gd")

static func build(city: Node3D, sites: Array[Dictionary]) -> void:
	var root := Node3D.new()
	root.name = "Plots"
	city.add_child(root)
	# Warehouse parking, loading bays and an access aisle have distinct pavement and markings.
	Road.slab(root, Vector3(29, .045, 15), Vector3(57, -.007, -49), Color("#697c87"))
	for bay: int in range(4):
		var x: float = 44.0 + bay * 7
		Road.slab(root, Vector3(.12, .012, 6.0), Vector3(x, .024, -51), Color("#d7c392"))
		Road.slab(root, Vector3(6.0, .012, .12), Vector3(x + 3, .024, -54), Color("#d7c392"))
	for dash: int in range(6):
		Road.slab(root, Vector3(2.0, .012, .12), Vector3(44 + dash * 5, .024, -43), Color("#c3c7b7"))
	# Continuous shared rear lanes turn the leftover space into connected courtyards.
	for block: Dictionary in city.data.frontage_blocks:
		var center: float = (float(block.start) + float(block.end)) * .5
		var rear_z: float = float(block.road_z) + (14.0 if is_zero_approx(block.yaw) else -16.0)
		Road.slab(root, Vector3(float(block.end) - float(block.start), .04, 3.2), Vector3(center, -.01, rear_z), Color("#979e95"))
	for site: Dictionary in sites:
		var plot := Node3D.new()
		plot.name = site.id.capitalize()
		root.add_child(plot)
		plot.position = site.position
		plot.rotation.y = site.yaw
		plot.set_meta("block_id", site.get("block_id", "service_yard"))
		var depth: float = site.size.z
		var home: bool = "house" in site.asset
		var service: bool = "repair" in site.asset or "warehouse" in site.asset or "gas_station" in site.asset
		var paving := Color("#b9b3a0") if home else Color("#82929a") if service else Color("#b3bbb7")
		# Each frontage has an intentional yard/apron instead of a model sitting on the base grass.
		var surround := Road.slab(plot, Vector3(site.size.x + 3.8, .012, depth + 3.6), Vector3(0, -.031 if home else -.018, .35), Color("#77866b") if home else paving.darkened(.13))
		surround.material_override = Road.Surfaces.get_material(Color("#77866b") if home else paving.darkened(.13), "ground" if home else "pavement")
		Road.slab(plot, Vector3(site.size.x + 1.2, .04, depth + 1.2), Vector3(0, -.02, 0), paving)
		var forward: Vector3 = -plot.basis.z
		var distance: float = (site.entry - site.road_anchor).length()
		var path_center: Vector3 = (site.entry + site.road_anchor) * .5
		if distance > .1:
			var pavement := Road.slab(root, Vector3(2.8, .04, distance + 2.0), path_center + Vector3.UP * .015, paving.lightened(.06))
			pavement.rotation.y = atan2(-forward.x, -forward.z)
		# Beds hug the facade corners, outside the authored entrance corridor.
		if home or not service:
			for side: int in [-1, 1]:
				var at := Vector3(side * (site.size.x * .5 - .45), 0, -depth * .5 - .55)
				var world_at: Vector3 = plot.transform * at
				if world_at.distance_to(site.entry) < 2.0:
					continue
				_bed(plot, at, 2.5 if home else 1.7)
		else:
			# Painted loading apron uses the current footprint, so no navigation obstacles are added.
			for side: int in [-1, 1]:
				Road.slab(plot, Vector3(.14, .012, 1.4), Vector3(side * site.size.x * .35, .027, -depth * .5 - .5), Color("#c8b782"))

static func _bed(parent: Node3D, at: Vector3, width: float) -> void:
	var bed := Node3D.new()
	bed.name = "FacadeGarden"
	parent.add_child(bed)
	bed.position = at
	Road.slab(bed, Vector3(width, .08, 1.0), Vector3(0, .02, 0), Color("#99a28d"))
	Road.slab(bed, Vector3(width - .14, .018, .82), Vector3(0, .071, 0), Color("#657967"))
	for index: int in range(3):
		var bush: Node3D = Assets.asset("VEG_002_bush_a").scene.instantiate()
		# Decoration never introduces an invisible change to the established walking/search grid.
		for collision: Node in bush.find_children("*", "CollisionObject3D", true, false):
			collision.free()
		bed.add_child(bush)
		bush.position = Vector3((index - 1) * width * .28, .08, 0)
		bush.scale = Vector3.ONE * .78
		bush.rotation.y = index * 1.7

