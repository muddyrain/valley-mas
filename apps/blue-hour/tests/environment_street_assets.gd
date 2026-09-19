extends "res://tests/environment_asset_reuse.gd"
## Uses the established measurement and native studio, without rerunning the old audit.

const DESTINATION := "res://test-output/environment-assets-batch01"
const Batch = preload("res://tools/integrate_street_assets.gd")
var _checks: int = 0

func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
		push_error(message)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DESTINATION))
	_setup_stage()
	var native := DisplayServer.get_name() != "headless"
	var sources: Array = JSON.parse_string(FileAccess.get_file_as_string("res://art/environment_street_sources.json"))
	var cards: Array[Image] = []
	for spec: Dictionary in Batch.ITEMS:
		var definition := WorldCatalog.asset(spec.id)
		var wrapper: Node3D = definition.scene.instantiate()
		_stage.add_child(wrapper)
		await physics_frame
		await physics_frame
		var record := _measure(wrapper, spec.id)
		var box := Geometry.bounds(wrapper)
		var source: Dictionary = sources.filter(func(value: Dictionary) -> bool: return value.id == spec.id)[0]
		var vertices := _world_vertices(wrapper)
		_check(wrapper.transform.is_equal_approx(Transform3D.IDENTITY), spec.id + " root identity")
		_check(wrapper.get_node("ModelRoot").scale.is_equal_approx(Vector3.ONE), spec.id + " ModelRoot unit scale")
		_check(absf(box.position.y) < 0.001, spec.id + " grounded bottom")
		_check(box.size.is_equal_approx(definition.bounding_size), spec.id + " definition bounds")
		_check(record.triangles == source.triangles, spec.id + " source triangles unchanged")
		_check(FileAccess.get_sha256(source.runtime_source) == source.sha256, spec.id + " source bytes unchanged")
		_check(record.material_count == 1 and record.texture_count == 3, spec.id + " material and three PBR textures")
		for texture: Dictionary in record.textures:
			_check(texture.width == 2048 and texture.height == 2048, spec.id + " texture resolution")
		_check(not definition.searchable and definition.loot_profile.is_empty() and definition.loot_tags.is_empty(), spec.id + " decorative only")
		_check(definition.spawn_weight == 0.0 and definition.allowed_district.is_empty(), spec.id + " no automatic placement")
		_check(definition.environment_tags == PackedStringArray(spec.tags), spec.id + " future usage tags")
		_check(wrapper.get_node("ModelRoot").find_children("*", "CollisionShape3D", true, false).is_empty(), spec.id + " no duplicate imported collision")
		var markers: Dictionary = {}
		for marker: Marker3D in wrapper.get_node("Anchors").get_children():
			markers[marker.name] = var_to_str(marker.position)
			_check(marker.scale.is_equal_approx(Vector3.ONE), spec.id + " marker scale")
		_check(wrapper.get_node("Anchors/GroundAnchor").position == Vector3.ZERO, spec.id + " GroundAnchor")
		_check(wrapper.get_node("Anchors/FrontMarker").position.z < box.position.z, spec.id + " FrontMarker points -Z")
		if spec.id == "PRP_Utility_Pole_A":
			_check(absf(box.size.y - 8.5) < 0.01, "Pole 850cm")
			for index: int in 3:
				var wire: Marker3D = wrapper.get_node("Anchors/WireMarker_%02d" % (index + 1))
				_check(wire.position.y > 7.0 and wire.position.y <= 8.5, "Wire attachment height")
				var nearest := INF
				for point: Vector3 in vertices:
					nearest = minf(nearest, point.distance_to(wire.position))
				_check(nearest < 0.08, "WireMarker within 8cm of actual insulator geometry")
		elif spec.id == "PRP_Parking_Sign_A":
			_check(absf(box.size.y - 2.5) < 0.01 and wrapper.has_node("Anchors/RoadAnchor"), "Parking sign size and RoadAnchor")
		elif spec.id == "PRP_Storefront_AFrame_Sign_A":
			_check(absf(box.size.y - 1.05) < 0.01, "A-frame height 105cm")
			var feet: Array[float] = [INF, INF, INF, INF]
			for point: Vector3 in vertices:
				var quadrant := (1 if point.x > 0 else 0) + (2 if point.z > 0 else 0)
				feet[quadrant] = minf(feet[quadrant], point.y)
			for foot: float in feet:
				_check(foot < 0.025, "A-frame four feet within 2.5cm of ground")
			record.foot_min_y = feet
		else:
			_check(absf(box.size.z - 1.75) < 0.0875 and absf(box.size.y - 1.05) < 0.01, "Bicycle length within 5 percent of reference; height 105cm")
			_check(wrapper.has_node("Anchors/SideMarker"), "Bicycle SideMarker")
		for collision: CollisionShape3D in wrapper.get_node("Collision").get_children():
			_check(not collision.disabled and (collision.shape is BoxShape3D or collision.shape is CylinderShape3D), spec.id + " active simple collision")
			var center := collision.global_position
			var ray := PhysicsRayQueryParameters3D.create(center + Vector3(0, 0, -5), center + Vector3(0, 0, 5), 1)
			_check(not _stage.get_world_3d().direct_space_state.intersect_ray(ray).is_empty(), spec.id + " physics ray hits proxy")
		record.source = source.runtime_source
		record.original_source = source.source
		record.source_sha256 = source.sha256
		record.size_cm = [box.size.x * 100, box.size.y * 100, box.size.z * 100]
		record.marker_positions = markers
		record.searchable = definition.searchable
		record.environment_tags = definition.environment_tags
		record.definition = definition.resource_path
		record.captures = []
		record.capture_checks = []
		if native:
			for mode: String in ["front", "quarter", "scale", "side", "rear"]:
				_ruler.visible = mode == "scale"
				_ruler.position = Vector3(-box.size.x * 0.5 - 0.65, 0, 0)
				_ground.show()
				var focus := Vector3(0, maxf(box.size.y, 1.7 if mode == "scale" else 0) * 0.5, 0)
				var offsets := {"front": Vector3(0, 0, -15), "quarter": Vector3(7, 7, -11), "scale": Vector3(5, 4, -13), "side": Vector3(15, 0.1, 0), "rear": Vector3(0, 0, 15)}
				_camera.size = maxf(2.5, box.size.y * 1.3)
				_camera.position = focus + offsets[mode]
				_camera.look_at(focus)
				var framed := box
				if mode == "scale":
					framed = framed.merge(AABB(_ruler.position - Vector3(0.1, 0, 0.1), Vector3(0.2, 1.7, 0.2)))
				var fits := false
				for attempt: int in 30:
					fits = true
					for corner: int in 8:
						fits = fits and Rect2(50, 100, 1180, 570).has_point(_camera.unproject_position(framed.get_endpoint(corner)))
					if fits:
						break
					_camera.size *= 1.1
				_check(fits, spec.id + " framing " + mode)
				_label.text = "%s | %s\n%.1f x %.1f x %.1f cm | %d tris%s" % [spec.id, mode.to_upper(), box.size.x * 100, box.size.y * 100, box.size.z * 100, record.triangles, " | ruler 1.70m" if mode == "scale" else ""]
				wrapper.hide()
				await process_frame
				await RenderingServer.frame_post_draw
				var background := root.get_texture().get_image()
				wrapper.show()
				for frame: int in 4:
					await process_frame
				await RenderingServer.frame_post_draw
				var pixels := root.get_texture().get_image()
				var changed := 0
				for x: int in range(50, 1230, 4):
					for y: int in range(100, 670, 4):
						var delta := pixels.get_pixel(x, y) - background.get_pixel(x, y)
						if absf(delta.r) + absf(delta.g) + absf(delta.b) > 0.06:
							changed += 1
				_check(changed > 40, spec.id + " visible " + mode)
				var path: String = DESTINATION.path_join(spec.id + "_" + mode + ".png")
				_check(pixels.save_png(path) == OK, "Save " + path)
				record.captures.append(path)
				record.capture_checks.append({"view": mode, "framing": fits, "visible_samples": changed})
				if mode == "quarter":
					pixels.convert(Image.FORMAT_RGBA8)
					cards.append(pixels)
		_records.append(record)
		wrapper.free()
		print("STREET ASSET ", spec.id, " tris=", record.triangles, " size=", box.size)
	if native:
		var sheet := Image.create(2560, 1440, false, Image.FORMAT_RGBA8)
		for index: int in cards.size():
			sheet.blit_rect(cards[index], Rect2i(0, 0, 1280, 720), Vector2i(index % 2 * 1280, index / 2 * 720))
		_check(sheet.save_png(DESTINATION.path_join("contact_sheet.png")) == OK, "Save contact sheet")
	var town := preload("res://maps/town/town_generator.gd").generate("food_supply", 4101, "PROFILE_A_MAIN_STREET")
	_check(var_to_str(town) == FileAccess.get_file_as_string("res://test-output/medium-town-blueprint/generated-town.txt"), "Frozen Town snapshot unchanged")
	for stage: Array in [[preload("res://maps/town/environment/town_environment_pass.gd"), "m00"], [preload("res://maps/town/environment/town_street_life_pass.gd"), "m01"], [preload("res://maps/town/environment/town_environment_polish.gd"), "m01-1"]]:
		var result: Dictionary = stage[0].new().generate(town)
		_check(var_to_str(result) == FileAccess.get_file_as_string("res://test-output/medium-town-environment-" + stage[1] + "/environment.txt"), "Frozen environment snapshot " + stage[1])
	var suffix := "native" if native else "headless"
	FileAccess.open(DESTINATION.path_join("qa_" + suffix + ".json"), FileAccess.WRITE).store_string(JSON.stringify({"assets": _records, "checks": _checks, "failures": _failures, "native_rendered": native, "asset_qa": "PENDING HUMAN REVIEW", "town_placement": "NOT STARTED"}, "\t"))
	print("STREET ASSETS QA: %d checks, %d failures" % [_checks, _failures.size()])
	quit(0 if _failures.is_empty() else 1)

func _world_vertices(wrapper: Node3D) -> Array[Vector3]:
	var result: Array[Vector3] = []
	for mesh: MeshInstance3D in wrapper.find_children("*", "MeshInstance3D", true, false):
		for surface: int in mesh.mesh.get_surface_count():
			var arrays := mesh.mesh.surface_get_arrays(surface)
			for point: Vector3 in arrays[Mesh.ARRAY_VERTEX]:
				result.append(wrapper.global_transform.affine_inverse() * mesh.global_transform * point)
	return result
