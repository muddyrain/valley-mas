extends SceneTree
## Entrance normals come from four-sided model inspection, independently of FrontMarker.

const Assets = preload("res://data/world_asset_catalog.gd")
const Generator = preload("res://maps/town/town_generator.gd")
const View = preload("res://maps/town/town_urban_view.gd")
const OUTPUT := "res://test-output/town-entrance-frontage/"
# All 22 source meshes have their designated entrance facade along ModelRoot-local +Z.
# BLD_007 and BLD_013 also have side/rear entrances; these do not replace that facade.
const AUDITED_PRIMARY_NORMAL := Vector3.BACK

var checks: int = 0
var failures: Array[String] = []
var rows: Array[Dictionary] = []
var snapshot: Dictionary = {}

func _initialize() -> void:
	var label := "current"
	var compare := ""
	for argument: String in OS.get_cmdline_user_args():
		if argument.begins_with("--snapshot="):
			label = argument.trim_prefix("--snapshot=")
		if argument.begins_with("--compare="):
			compare = argument.trim_prefix("--compare=")
	var definitions: Array[Resource] = Assets.get_buildings_by_category("")
	_check(definitions.size() == 22, "Audit covers exactly 22 catalog buildings")
	for definition: Resource in definitions:
		for quarter: int in 4:
			var yaw := quarter * PI / 2.0
			var basis := Basis(Vector3.UP, yaw)
			var site := {"id": definition.building_id, "asset": definition.id, "yaw": yaw,
				"position": Vector3.ZERO, "road_anchor": basis * definition.road_offset,
				"entry": basis * definition.entrance_offset}
			_audit(site, basis * Vector3.FORWARD, "catalog-%d" % quarter, "synthetic", "cardinal")
	var seeds: Array[int] = [4101, 4102, 4103, 4104]
	for seed_value: int in 24:
		seeds.append(seed_value)
	var covered: Dictionary = {}
	for seed_value: int in seeds:
		var town: Dictionary = Generator.generate("food_supply", seed_value, "PROFILE_A_MAIN_STREET")
		_check(town.ok, "Town generated: %d" % seed_value)
		if not town.ok:
			continue
		# Whole generated data includes roads, parcels, positions, entrances and POI data.
		snapshot["town-%d" % seed_value] = var_to_str(town).sha256_text()
		for site: Dictionary in town.buildings:
			var parcels: Array = town.parcels.filter(func(item: Dictionary) -> bool: return item.parcel_id == site.id)
			_check(parcels.size() == 1, "Unique assigned parcel: " + site.id)
			if parcels.size() != 1:
				continue
			var parcel: Dictionary = parcels[0]
			var blocks: Array = town.blocks.filter(func(item: Dictionary) -> bool: return item.id == parcel.block_id)
			_check(blocks.size() == 1, "Unique assigned block: " + site.id)
			if blocks.size() != 1:
				continue
			var edges: Array = blocks[0].street_edges.filter(func(item: Dictionary) -> bool: return item.side == parcel.frontage_edge)
			_check(edges.size() == 1, "Unique assigned frontage: " + site.id)
			if edges.size() != 1:
				continue
			var edge: Dictionary = edges[0]
			var outward: Vector2 = edge.outward
			_audit(site, Vector3(outward.x, 0, outward.y), str(seed_value), parcel.frontage_edge, edge.road_id)
			covered[site.asset] = true
	_check(covered.has("BLD_010_residence_d"), "Regression asset occurs in generated towns")
	DirAccess.make_dir_recursive_absolute(OUTPUT)
	if not compare.is_empty():
		var previous: Variant = JSON.parse_string(FileAccess.get_file_as_string(OUTPUT + compare + "-snapshot.json"))
		_check(previous is Dictionary, "Previous snapshot is readable")
		if previous is Dictionary:
			_check(previous.size() == snapshot.size(), "Same protected snapshot keys")
			for key: String in snapshot:
				_check(previous.get(key, "") == snapshot[key], "Frozen geometry/anchors/collisions: " + key)
	FileAccess.open(OUTPUT + label + "-snapshot.json", FileAccess.WRITE).store_string(JSON.stringify(snapshot, "\t"))
	FileAccess.open(OUTPUT + label + "-audit.json", FileAccess.WRITE).store_string(JSON.stringify({
		"checks": checks, "failures": failures, "rows": rows, "generated_asset_count": covered.size()}, "\t"))
	print("ENTRANCE FRONTAGE: %d checks, %d failures, %d instances, %d generated assets" % [checks, failures.size(), rows.size(), covered.size()])
	for failure: String in failures:
		printerr(failure)
	quit(0 if failures.is_empty() else 1)

func _audit(site: Dictionary, assigned: Vector3, seed_label: String, frontage: String, road_id: String) -> void:
	var definition: Resource = Assets.asset(site.asset)
	var wrapper: Node3D = View.instantiate_building(site)
	var model: Node3D = wrapper.get_node("ModelRoot")
	var facing: Vector3 = (wrapper.basis * model.basis * AUDITED_PRIMARY_NORMAL).normalized()
	var dot := clampf(facing.dot(assigned.normalized()), -1.0, 1.0)
	var angle := rad_to_deg(acos(dot))
	var identity := "%s/%s/%s" % [seed_label, site.id, definition.building_id]
	_check(dot > 0.999, "Primary entrance faces assigned frontage: %s (%.1f degrees)" % [identity, angle])
	_check(wrapper.position.distance_to(site.position) < 0.001, "Building position preserved: " + identity)
	var front: Node3D = wrapper.get_node("Anchors/FrontMarker")
	_check((wrapper.basis * front.position).normalized().dot(assigned) > 0.999, "FrontMarker faces assigned frontage: " + identity)
	var entrance: Node3D = wrapper.get_node("Anchors/EntranceMarker")
	_check((wrapper.transform * entrance.position).distance_to(site.entry) < 0.001, "Entrance data matches wrapper: " + identity)
	var protected: Dictionary = {"wrapper": wrapper.transform}
	for path: String in ["Anchors", "Collision", "SpawnPoints"]:
		var parent: Node3D = wrapper.get_node(path)
		protected[path] = parent.transform
		for child: Node in parent.find_children("*", "Node3D", true, false):
			protected[str(wrapper.get_path_to(child))] = (child as Node3D).transform
	# Every other building's visible model placement must also remain identical.
	if definition.building_id != "BLD_010":
		protected["model"] = model.transform
	snapshot[identity] = var_to_str(protected).sha256_text()
	rows.append({"seed": seed_label, "instance": site.id, "asset": definition.building_id,
		"frontage": frontage, "road": road_id, "angle_degrees": angle, "aligned": dot > 0.999})
	wrapper.free()

func _check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
