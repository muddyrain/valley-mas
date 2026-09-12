extends "res://tests/day_loop_runtime.gd"

## Native-resolution Camp, persistent scene ownership, and overlay input regression.
const OUT := "res://test-output/camp-clarity/"
var measurements: Dictionary = {}

func run() -> void:
	create_timer(90).timeout.connect(func(): printerr("CAMP CLARITY TIMEOUT"); quit(2))
	root.size = Vector2i(1920, 1080)
	root.unfocusable = true
	root.add_child(InputGate.new())
	DirAccess.make_dir_recursive_absolute(OUT)
	await launch(true)
	app.campaign.new_run(772)
	app.show_shelter()
	await frames(30)
	var camp: Node3D = app.camp_view.camp
	check(camp.get_viewport() == root, "Formal Camp renders directly into the main viewport")
	if camp.get_viewport() != root:
		await finish()
		return
	check(app.find_children("*", "SubViewport", true, false).is_empty(), "Camp has no intermediate preview render target")
	check(app.screen.get_canvas_layer_node() == app.ui_layer, "Camp controls remain in the existing CanvasLayer")
	check(root.scaling_3d_scale == 1.0 and not root.use_taa, "Camp uses native 3D resolution without temporal upscaling")
	check(root.msaa_3d == Viewport.MSAA_8X, "Camp inherits the project's existing 8x MSAA")
	var station := camp.get_node("NavigationSource/MainBuilding") as Node3D
	var mesh := station.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D
	var material := mesh.get_active_material(0) as StandardMaterial3D
	for texture: Texture2D in [material.albedo_texture, material.normal_texture]:
		check(texture.get_size() == Vector2(4096, 4096), "Hero building preserves its source 4K maps")
		check(texture.get_image().has_mipmaps(), "4K texture keeps mipmaps")
	check(material.roughness_texture.get_size() == Vector2(2048, 2048), "Metallic/roughness retains its original 2K resolution")
	check(material.texture_filter == BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC, "Oblique roof surfaces use mipmapped anisotropic filtering")
	check(material.normal_enabled and material.normal_scale == 1.0, "Imported normal remains active at its source strength")
	check(station.position == Vector3(0, 0, -6.75) and station.scale == Vector3.ONE, "MainBuilding keeps its frozen world transform")
	var camera: Camera3D = app.camp_view.camera
	var camera_transform := camera.global_transform
	check(camera.size == 20.5, "Fixed Camp camera is unchanged")
	measurements["camera"] = {"transform": str(camera_transform), "size": camera.size}
	measurements["station_pixels_1080p"] = str(projected_bounds(station, camera))
	measurements["main_viewport"] = {"image_size": str(root.get_texture().get_image().get_size()), "window_size": str(root.size), "logical_rect": str(root.get_visible_rect()), "content_size": str(root.content_scale_size), "content_mode": root.content_scale_mode, "content_factor": root.content_scale_factor, "scale_3d": root.scaling_3d_scale, "msaa": root.msaa_3d}
	await shot("05-after-ui-1920x1080")
	check(root.get_texture().get_image().get_size() == Vector2i(1920, 1080), "Actual render capture is 1920x1080")
	measurements["frame_timing"] = await frame_timing()
	var ids: Array = app.campaign.data.members.duplicate()
	var actor: Node3D = camp.members[ids[1]]
	await click_at(app.camp_view.member_point(ids[1]))
	check(app.selected_member == ids[1], "World-space survivor selection works through the transparent overlay")
	check(app.camp_view.camp == camp and camp.members[ids[1]] == actor, "Selecting a member preserves Camp and actor identity")
	await click(app.screen.training_button)
	check(app.campaign.member_level(ids[1]) == 2 and app.camp_view.camp == camp, "Training refreshes the overlay without reconstructing Camp")
	await click(button("卸下武器"))
	check(actor.visual.weapon == null and app.camp_view.camp == camp, "Equipment updates the existing Camp actor")
	app.screen.show_effects()
	await frames()
	await click_at(app.camp_view.member_point(ids[0]))
	check(app.selected_member == ids[1], "A modal blocks clicks from reaching Camp survivors")
	app.screen.effects_backdrop.hide()
	app.screen.effects_panel.hide()
	await click(button("整装出发"))
	check(app.state == "today_action" and app.camp_view.camp == camp, "Mission selection retains the existing Camp")
	await click(app.screen.cancel_button)
	check(app.state == "shelter" and app.camp_view.camp == camp, "Cancel restores the overlay on the same Camp")
	check(camera.global_transform.is_equal_approx(camera_transform), "Overlay changes never move the camera")
	root.size = Vector2i(1600, 900)
	await frames(15)
	check(root.get_texture().get_image().get_size() == root.size, "Resizing to 1600x900 renders natively")
	await click_at(app.camp_view.member_point(ids[0]))
	check(app.selected_member == ids[0], "World selection remains aligned after window resizing")
	check(app.screen.departure.get_global_rect().end.y <= root.get_visible_rect().size.y, "Departure remains inside the window")
	await shot("06-after-ui-1600x900")
	await click(button("主菜单"))
	check(app.camp_view == null and not is_instance_valid(camp), "Leaving Camp releases its world and camera")
	await finish()

func projected_bounds(node: Node3D, camera: Camera3D) -> Rect2:
	var result := Rect2()
	var first := true
	for mesh: MeshInstance3D in node.find_children("*", "MeshInstance3D", true, false):
		for surface: int in range(mesh.mesh.get_surface_count()):
			var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]
			for vertex: Vector3 in vertices:
				var point := root.get_stretch_transform() * camera.unproject_position(mesh.global_transform * vertex)
				result = Rect2(point, Vector2.ZERO) if first else result.expand(point)
				first = false
	return result

func frame_timing() -> Dictionary:
	var samples: Array[float] = []
	var start := Time.get_ticks_usec()
	var previous := start
	while Time.get_ticks_usec() - start < 4000000:
		await process_frame
		var now := Time.get_ticks_usec()
		samples.append((now - previous) / 1000.0)
		previous = now
	var seconds := (Time.get_ticks_usec() - start) / 1000000.0
	samples.sort()
	return {"frames": samples.size(), "seconds": seconds, "average_fps": samples.size() / seconds, "median_ms": samples[samples.size() / 2], "p95_ms": samples[int(samples.size() * 0.95)], "max_ms": samples.back(), "vsync": DisplayServer.window_get_vsync_mode(), "rendering_device": RenderingServer.get_video_adapter_name()}

func shot(label: String) -> void:
	await RenderingServer.frame_post_draw
	check(root.get_texture().get_image().save_png(OUT + label + ".png") == OK, "Native capture: " + label)

func finish() -> void:
	measurements["checks"] = checks
	measurements["failures"] = failures
	FileAccess.open(OUT + "validation.json", FileAccess.WRITE).store_string(JSON.stringify(measurements, "\t"))
	print("CAMP CLARITY: %d checks, %d failures" % [checks, failures.size()])
	if is_instance_valid(app):
		app.queue_free()
	await frames(3)
	quit(0 if failures.is_empty() else 1)
