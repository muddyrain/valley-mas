extends SceneTree
## Read-only asset audit and native QA stage. No resources or Town data are saved.

const Generated = preload("res://vfx/generated_assets.gd")
const WorldCatalog = preload("res://data/world_asset_catalog.gd")
const Geometry = preload("res://maps/town/environment/environment_geometry.gd")
const Dressing = preload("res://camp/camp_dressing.gd")
const OUTPUT := "res://test-output/environment-asset-reuse-audit"
const CANDIDATES: Array[Array] = [
	["BH_Bench_01", "P0", "Park bench"],
	["BH_Pallet", "P0", "Pallet"],
	["BH_WoodCrate", "P0", "Wood crate"],
	["BH_MetalCrate", "P0", "Metal crate"],
	["BH_Searchable_Crate", "P0", "Supply crate alternative"],
	["BH_Fence", "P1", "Legacy metal fence"],
	["BH_Fence_Broken", "P1", "Broken metal fence"],
	["BH_RoadSign", "P1", "Direction sign"],
	["BH_Barrier_Concrete", "P1", "Concrete barrier"],
	["BH_Barricade_Metal", "P1", "Metal barricade"],
	["BAR_001_chainlink_fence", "P1", "Current industrial chainlink"],
	["chainlink_damaged", "P1", "Damaged chainlink"],
	["camp_low_fence", "P1", "Existing camp low fence"],
	["camp_open_entry", "P1", "Two existing fence segments / 2m opening"],
	["BH_VendingMachine", "P2", "Vending machine"],
	["BH_Searchable_VendingMachine", "P2", "Vending machine alternative"],
	["CAMP_PROP_003_notice_board", "P2", "Camp notice board"],
	["camp_planter", "P2", "Existing camp planter"]
]

var _stage: Node3D
var _camera: Camera3D
var _label: Label
var _ruler: Node3D
var _ground: MeshInstance3D
var _failures: Array[String] = []
var _records: Array[Dictionary] = []

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUTPUT))
	_setup_stage()
	var rendered := DisplayServer.get_name() != "headless"
	var sheets: Dictionary = {}
	for candidate: Array in CANDIDATES:
		var id: String = candidate[0]
		var instance := _instantiate(id)
		_stage.add_child(instance)
		await process_frame
		var record := _measure(instance, id)
		record.priority = candidate[1]
		record.category = candidate[2]
		record.captures = []
		record.capture_checks = []
		_records.append(record)
		if record.meshes == 0 or record.triangles == 0:
			_failures.append(id + ": no render geometry")
		var box := Geometry.bounds(instance)
		var center := box.get_center()
		# Stage positioning only: the untouched source root transform is recorded above.
		instance.position -= Vector3(center.x, 0, center.z)
		for mode: String in ["front", "quarter", "scale"]:
			_ground.visible = mode != "front"
			_ruler.visible = mode == "scale"
			_ruler.position = Vector3(-box.size.x * 0.5 - 0.65, 0, 0)
			var focus := Vector3(0, maxf(box.size.y, 1.7 if mode == "scale" else 0) * 0.45, 0)
			_camera.size = maxf(2.7, maxf(box.size.y * 1.65, (box.size.x + box.size.z + (2.0 if mode == "scale" else 0.5)) / 1.45))
			_camera.position = focus + (Vector3(0, 0.1, 15) if mode == "front" else Vector3(7, 8, 11))
			_camera.look_at(focus)
			var framed_box: AABB = instance.transform * box
			if mode == "scale":
				framed_box = framed_box.merge(AABB(_ruler.position - Vector3(0.1, 0, 0.1), Vector3(0.2, 1.7, 0.2)))
			var frame_ok := false
			for attempt: int in 20:
				frame_ok = true
				for corner: int in 8:
					if not Rect2(48, 100, 1184, 572).has_point(_camera.unproject_position(framed_box.get_endpoint(corner))):
						frame_ok = false
				if frame_ok:
					break
				_camera.size *= 1.1
			if not frame_ok:
				_failures.append("Framing: " + id + " " + mode)
			_label.text = "%s | %s | %s\n%.3f x %.3f x %.3f m | %d tris | %d materials%s" % [id, candidate[2], mode.to_upper(), box.size.x, box.size.y, box.size.z, record.triangles, record.material_count, " | ruler: 1.70m" if mode == "scale" else ""]
			if rendered:
				instance.hide()
				await process_frame
				await process_frame
				await RenderingServer.frame_post_draw
				var background := root.get_texture().get_image()
				instance.show()
				for frame: int in 4:
					await process_frame
				await RenderingServer.frame_post_draw
				var pixels := root.get_texture().get_image()
				var path := OUTPUT.path_join(id + "_" + mode + ".png")
				if pixels.save_png(path) != OK:
					_failures.append("PNG save: " + path)
				record.captures.append(path)
				var changed_samples := 0
				for x: int in range(48, 1232, 4):
					for y: int in range(100, 672, 4):
						var difference := pixels.get_pixel(x, y) - background.get_pixel(x, y)
						if absf(difference.r) + absf(difference.g) + absf(difference.b) > 0.06:
							changed_samples += 1
				if changed_samples < 40:
					_failures.append("Blank QA image: " + path)
				record.capture_checks.append({"view": mode, "framing": frame_ok, "asset_visible_samples": changed_samples, "image_size": var_to_str(pixels.get_size()), "camera_size": _camera.size})
				var key: String = candidate[1] + "_" + mode
				if not sheets.has(key):
					sheets[key] = []
				pixels.resize(640, 360, Image.INTERPOLATE_LANCZOS)
				sheets[key].append(pixels)
		instance.free()
		print("AUDIT %s meshes=%d vertices=%d tris=%d materials=%d textures=%d size=%s" % [id, record.meshes, record.vertices, record.triangles, record.material_count, record.texture_count, str(box.size)])
	for key: String in sheets:
		var frames: Array = sheets[key]
		var sheet := Image.create(1280, ceili(frames.size() / 2.0) * 360, false, Image.FORMAT_RGBA8)
		sheet.fill(Color("e2e6e8"))
		for index: int in frames.size():
			sheet.blit_rect(frames[index], Rect2i(0, 0, 640, 360), Vector2i((index % 2) * 640, (index / 2) * 360))
		sheet.save_png(OUTPUT.path_join(key + "_sheet.png"))
	FileAccess.open(OUTPUT.path_join("runtime-audit.json"), FileAccess.WRITE).store_string(JSON.stringify({"candidates": _records, "failures": _failures, "native_rendered": rendered, "units": "meters", "triangle_basis": "imported render geometry at full detail; collision proxies excluded", "vertices_basis": "render surface vertex arrays (split normals and UV seams included)", "lighting": "M00 daylight values; existing asset materials retained"}, "\t"))
	print("ASSET REUSE AUDIT: %d candidates, %d failures, native=%s" % [_records.size(), _failures.size(), rendered])
	quit(0 if _failures.is_empty() else 1)

func _instantiate(id: String) -> Node3D:
	if id == "camp_low_fence" or id == "camp_planter":
		return _camp_recipe(id)
	if id == "camp_open_entry":
		var assembly := Node3D.new()
		var first := _camp_recipe("camp_low_fence")
		var second := _camp_recipe("camp_low_fence")
		var width := Geometry.bounds(first).size.x
		first.position.x = -(width + 2.0) * 0.5
		second.position.x = (width + 2.0) * 0.5
		assembly.add_child(first)
		assembly.add_child(second)
		return assembly
	if id == "BAR_001_chainlink_fence":
		return WorldCatalog.asset(id).scene.instantiate()
	if id == "chainlink_damaged":
		return load("res://scenes/world/barriers/barrier_chainlink_damaged.tscn").instantiate()
	return load("res://" + str(Generated.catalog()[id].path)).instantiate()

func _camp_recipe(id: String) -> Node3D:
	var dressing := Dressing.new()
	if id == "camp_planter":
		dressing._planter(Vector3.ZERO, 0.65)
	else:
		# Replay one actual 4.5m boundary segment, without loading Camp gameplay.
		var source: Node3D = load("res://scenes/camp/camp_main.tscn").instantiate()
		var camp := Node3D.new()
		var navigation := Node3D.new()
		navigation.name = "NavigationSource"
		camp.add_child(navigation)
		var boundaries := Node3D.new()
		boundaries.name = "BoundaryBlockouts"
		navigation.add_child(boundaries)
		var body: Node3D = source.get_node("NavigationSource/BoundaryBlockouts/RearLeft").duplicate()
		body.position = Vector3(0, 0.225, 0)
		boundaries.add_child(body)
		dressing._camp = camp
		dressing._boundary_fences()
		camp.free()
		source.free()
	var visual := Node3D.new()
	for material_id: String in dressing._surfaces:
		# The two amber markers belong to the Camp entrance, not this fence segment.
		if id == "camp_low_fence" and material_id == "warm":
			continue
		var mesh := MeshInstance3D.new()
		mesh.name = material_id
		mesh.mesh = dressing._surfaces[material_id].commit()
		visual.add_child(mesh)
	dressing.free()
	return visual

func _measure(instance: Node3D, id: String) -> Dictionary:
	var materials: Dictionary = {}
	var textures: Dictionary = {}
	var geometry: Array[Dictionary] = []
	var vertices := 0
	var triangles := 0
	for mesh: MeshInstance3D in instance.find_children("*", "MeshInstance3D", true, false):
		var mesh_vertices := 0
		var mesh_triangles := 0
		for surface: int in mesh.mesh.get_surface_count():
			var arrays := mesh.mesh.surface_get_arrays(surface)
			var positions: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			mesh_vertices += positions.size()
			mesh_triangles += (indices.size() if not indices.is_empty() else positions.size()) / 3
			var material := mesh.get_active_material(surface)
			if material != null:
				var key := str(material.get_instance_id())
				materials[key] = {"name": material.resource_name, "type": material.get_class()}
				if material is BaseMaterial3D:
					materials[key].color = material.albedo_color.to_html()
					materials[key].roughness = material.roughness
					materials[key].metallic = material.metallic
					for property: Dictionary in material.get_property_list():
						if property.type != TYPE_OBJECT:
							continue
						var value: Variant = material.get(property.name)
						if value is Texture2D:
							textures[str(value.get_instance_id())] = {"name": value.resource_path, "width": value.get_width(), "height": value.get_height()}
		vertices += mesh_vertices
		triangles += mesh_triangles
		geometry.append({"name": str(mesh.name), "vertices": mesh_vertices, "triangles": mesh_triangles, "local_transform": var_to_str(mesh.transform)})
	var shapes: Array[Dictionary] = []
	for shape: CollisionShape3D in instance.find_children("*", "CollisionShape3D", true, false):
		shapes.append({"name": str(shape.name), "type": shape.shape.get_class() if shape.shape else "missing", "disabled": shape.disabled, "body": shape.get_parent().get_class()})
	var markers: Array[String] = []
	for marker: Marker3D in instance.find_children("*", "Marker3D", true, false):
		markers.append(str(instance.get_path_to(marker)))
	var registrations: Array[String] = []
	for definition: Resource in WorldCatalog.ALL:
		if definition.id == id:
			registrations.append(definition.id)
	var box := Geometry.bounds(instance)
	var source: String = "res://" + str(Generated.catalog()[id].path) if Generated.catalog().has(id) else instance.scene_file_path
	if id.begins_with("camp_"):
		source = "res://camp/camp_dressing.gd::_planter" if id == "camp_planter" else "res://camp/camp_dressing.gd::_boundary_fences"
	return {"id": id, "source": source, "root_transform": var_to_str(instance.transform), "root_scale": var_to_str(instance.scale), "meshes": geometry.size(), "vertices": vertices, "triangles": triangles, "material_count": materials.size(), "materials": materials.values(), "texture_count": textures.size(), "textures": textures.values(), "bounds": var_to_str(box), "size_m": [box.size.x, box.size.y, box.size.z], "pivot_center_xz": [box.get_center().x, box.get_center().z], "bottom_y": box.position.y, "up_axis": "+Y (Godot import)", "ground_contact": absf(box.position.y) < 0.02, "collision": shapes, "collision_bounds": var_to_str(Geometry.bounds(instance, true)), "markers": markers, "world_catalog": registrations, "legacy_manifest": Generated.catalog().has(id), "geometry": geometry, "loaded_and_instantiated": true}

func _setup_stage() -> void:
	root.size = Vector2i(1280, 720)
	_stage = Node3D.new()
	root.add_child(_stage)
	var world := WorldEnvironment.new()
	world.environment = Environment.new()
	world.environment.background_mode = Environment.BG_COLOR
	world.environment.background_color = Color("b8c2c6")
	world.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	world.environment.ambient_light_color = Color("b6c4d6")
	world.environment.ambient_light_energy = 0.48
	world.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	_stage.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_energy = 0.56
	sun.light_color = Color("fff1d9")
	sun.shadow_enabled = true
	_stage.add_child(sun)
	var ground := MeshInstance3D.new()
	_ground = ground
	var plane := PlaneMesh.new()
	plane.size = Vector2(150, 150)
	ground.mesh = plane
	ground.position.y = -0.015
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("919c94")
	material.roughness = 1
	material.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	ground.material_override = material
	_stage.add_child(ground)
	_camera = Camera3D.new()
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	_camera.far = 200
	_stage.add_child(_camera)
	_camera.current = true
	_ruler = Node3D.new()
	_stage.add_child(_ruler)
	for index: int in 17:
		var segment := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.15, 0.1, 0.15)
		segment.mesh = box
		segment.position.y = 0.05 + index * 0.1
		var paint := StandardMaterial3D.new()
		paint.albedo_color = Color("f1efdf") if index % 2 == 0 else Color("3e5662")
		segment.material_override = paint
		_ruler.add_child(segment)
	var canvas := CanvasLayer.new()
	root.add_child(canvas)
	_label = Label.new()
	_label.position = Vector2(24, 16)
	_label.add_theme_color_override("font_color", Color("192d38"))
	_label.add_theme_font_size_override("font_size", 18)
	canvas.add_child(_label)
