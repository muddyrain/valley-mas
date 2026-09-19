extends SceneTree
## Offline assembly of approved street assets; never saves imported source scenes.

const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Definition = preload("res://data/world_asset_data.gd")
const Wrapper = preload("res://maps/world/world_asset.gd")
const ITEMS: Array[Dictionary] = [
	{"id": "PRP_Utility_Pole_A", "yaw": 0.0, "tags": ["RESIDENTIAL_A", "RESIDENTIAL_B", "COMMERCIAL_CORE", "MIXED_TRANSITION", "TOWN_EDGE"]},
	{"id": "PRP_Parking_Sign_A", "yaw": PI, "tags": ["PARKING", "COMMERCIAL_CORE", "SERVICE_AREA"]},
	{"id": "PRP_Storefront_AFrame_Sign_A", "yaw": -PI / 2.0, "tags": ["COMMERCIAL_FRONTAGE", "CAFE", "SMALL_SHOP"]},
	{"id": "PRP_Bicycle_A", "yaw": -PI / 2.0, "tags": ["RESIDENTIAL", "COMMERCIAL", "PARK_EDGE"]}
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	for item: Dictionary in ITEMS:
		var wrapper := Node3D.new()
		wrapper.name = item.id
		wrapper.set_script(Wrapper)
		wrapper.set("asset_id", item.id)
		wrapper.add_to_group("world_assets", true)
		var source: PackedScene = load("res://assets/world/props/street/" + item.id + ".glb")
		var model: Node3D = source.instantiate()
		model.name = "ModelRoot"
		wrapper.add_child(model)
		model.rotation.y = item.yaw
		var box := Geometry.bounds(wrapper)
		model.position = -Vector3(box.get_center().x, box.position.y, box.get_center().z)
		box = Geometry.bounds(wrapper)
		var body := StaticBody3D.new()
		body.name = "Collision"
		wrapper.add_child(body)
		match item.id:
			"PRP_Utility_Pole_A":
				var cylinder := CylinderShape3D.new()
				cylinder.height = 7.6
				cylinder.radius = 0.15
				_shape(body, "Pole", cylinder, Vector3(0, 3.8, 0))
			"PRP_Parking_Sign_A":
				_box(body, "Base", Vector3(0.30, 0.3, 0.30), Vector3(0, 0.15, 0))
				_box(body, "Post", Vector3(0.1, 2.45, 0.1), Vector3(0, 1.225, 0))
				_box(body, "Sign", Vector3(0.48, 0.85, 0.16), Vector3(0, 2.06, 0))
			"PRP_Storefront_AFrame_Sign_A":
				_box(body, "Frame", Vector3(0.60, 1.05, 0.52), Vector3(0, 0.525, 0))
			"PRP_Bicycle_A":
				_box(body, "BicycleBody", Vector3(0.32, 0.83, 1.70), Vector3(0, 0.415, 0))
				_box(body, "HandlebarBasket", Vector3(0.76, 0.3, 0.42), Vector3(0, 0.9, -0.55))
		var anchors := Node3D.new()
		anchors.name = "Anchors"
		wrapper.add_child(anchors)
		_marker(anchors, "GroundAnchor", Vector3.ZERO)
		_marker(anchors, "FrontMarker", Vector3(0, 0, -box.size.z * 0.5 - 0.3))
		match item.id:
			"PRP_Utility_Pole_A":
				var points: Array[Vector3] = [Vector3(-0.88, 8.49, 0), Vector3(0, 8.49, -0.88), Vector3(0.88, 8.49, 0)]
				for index: int in 3:
					_marker(anchors, "WireMarker_%02d" % (index + 1), points[index])
			"PRP_Parking_Sign_A":
				_marker(anchors, "RoadAnchor", Vector3(0, 0, -0.75))
			"PRP_Bicycle_A":
				_marker(anchors, "SideMarker", Vector3(box.size.x * 0.5 + 0.3, 0, 0))
		_own(wrapper, wrapper)
		var packed := PackedScene.new()
		assert(packed.pack(wrapper) == OK)
		var path: String = "res://scenes/world/props/street/" + item.id + ".tscn"
		assert(ResourceSaver.save(packed, path) == OK)
		var definition := Definition.new()
		definition.id = item.id
		definition.scene = load(path)
		definition.category = "street"
		definition.footprint = Vector2(box.size.x, box.size.z)
		definition.bounding_size = box.size
		definition.spawn_weight = 0.0
		definition.allowed_district = PackedStringArray()
		definition.environment_tags = PackedStringArray(item.tags)
		definition.searchable = false
		definition.loot_profile = ""
		definition.enemy_profile = ""
		assert(ResourceSaver.save(definition, "res://data/world_assets/" + item.id + ".tres") == OK)
		print("INTEGRATED ", item.id, " bounds=", box)
		wrapper.free()
	quit()

func _box(body: StaticBody3D, label: String, size: Vector3, position: Vector3) -> void:
	var box := BoxShape3D.new()
	box.size = size
	_shape(body, label, box, position)

func _shape(body: StaticBody3D, label: String, shape: Shape3D, position: Vector3) -> void:
	var collision := CollisionShape3D.new()
	collision.name = label
	collision.shape = shape
	collision.position = position
	body.add_child(collision)

func _marker(anchors: Node3D, label: String, position: Vector3) -> void:
	var marker := Marker3D.new()
	marker.name = label
	marker.position = position
	anchors.add_child(marker)

func _own(node: Node, owner: Node) -> void:
	for child: Node in node.get_children():
		child.owner = owner
		if child.scene_file_path.is_empty():
			_own(child, owner)
