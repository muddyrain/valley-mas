extends RefCounted

const Catalog = preload("res://data/world_asset_catalog.gd")
const View = preload("res://maps/town/environment/town_environment_view.gd")
const UrbanView = preload("res://maps/town/town_urban_view.gd")
const COLORS := {
	"PRP_003_park_bench": {"BH_Plastic_Light": "89999b"},
	"PRP_004_pallet": {"BH_Plastic_Light": "968a72", "BH_Concrete_Dark": "665f54"},
	"PRP_005_wood_crate": {"BH_Plastic_Light": "9c9380", "BH_Warm_Orange": "81715b"}
}
static var _materials: Dictionary = {}

static func build(parent: Node3D, result: Dictionary) -> Node3D:
	var layer := View.build(parent, result)
	for wrapper: Node3D in layer.get_children():
		style(wrapper)
	var ground := Node3D.new()
	ground.name = "ResidentialParkingSurfaces"
	layer.add_child(ground)
	for driveway: Dictionary in result.driveways:
		UrbanView._slab(ground, "Pad_" + driveway.vehicle_id, driveway.pad, 0.0, Color("89908b"), "pavement")
		if driveway.connector.has_area():
			UrbanView._slab(ground, "Driveway_" + driveway.vehicle_id, driveway.connector, -0.002, Color("89908b"), "pavement")
	return layer

static func style(wrapper: Node3D) -> void:
	var id: String = wrapper.get("asset_id")
	if not COLORS.has(id):
		return
	for mesh: MeshInstance3D in wrapper.find_children("*", "MeshInstance3D", true, false):
		for surface: int in mesh.mesh.get_surface_count():
			var source := mesh.get_active_material(surface) as StandardMaterial3D
			if source == null or not COLORS[id].has(source.resource_name):
				continue
			var key := id + ":" + str(source.get_instance_id())
			if not _materials.has(key):
				var material: StandardMaterial3D = source.duplicate()
				material.albedo_color = Color(COLORS[id][source.resource_name])
				material.roughness = 0.9
				material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
				_materials[key] = material
			mesh.set_surface_override_material(surface, _materials[key])
