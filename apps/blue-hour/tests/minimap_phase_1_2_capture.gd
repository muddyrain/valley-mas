extends "res://tests/expedition_minimap.gd"
## Static visual evidence for the Phase 1.2 MiniMap renderer.

const QA_OUT: String = "res://test-output/map-phase-1-2-minimap"

var captures: Array[Dictionary] = []

func run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(QA_OUT))
	for seed_value: int in [4101, 4102, 4103, 4104, 4105]:
		var app: Node = await create_app(seed_value)
		var map: Control = app.hud.minimap
		map._process(0.0)
		await process_frame
		await RenderingServer.frame_post_draw
		var world_image: Image = root.get_texture().get_image()
		var map_rect: Rect2 = map.get_global_transform_with_canvas() * Rect2(Vector2.ZERO, map.size)
		var minimap_image: Image = world_image.get_region(Rect2i(map_rect))
		var comparison: Image = Image.create(world_image.get_width() + minimap_image.get_width(),
			maxi(world_image.get_height(), minimap_image.get_height()), false, world_image.get_format())
		comparison.fill(Color("#132b43"))
		comparison.blit_rect(world_image, Rect2i(Vector2i.ZERO, world_image.get_size()), Vector2i.ZERO)
		comparison.blit_rect(minimap_image, Rect2i(Vector2i.ZERO, minimap_image.get_size()),
			Vector2i(world_image.get_width(), 0))
		var output_path: String = QA_OUT.path_join("seed_%d_comparison.png" % seed_value)
		comparison.save_png(ProjectSettings.globalize_path(output_path))
		captures.append({"seed": seed_value, "world_size": world_image.get_size(),
			"minimap_size": minimap_image.get_size(), "markers": map.town_markers.size(),
			"static_build_count": map.static_build_count, "static_build_ms": map.static_build_ms,
			"output": output_path})
		app.queue_free()
		await process_frame
	FileAccess.open(ProjectSettings.globalize_path(QA_OUT.path_join("capture-manifest.json")), FileAccess.WRITE).store_string(JSON.stringify(captures, "\t"))
	print("M01.2 MINIMAP CAPTURE: %d seeds captured" % captures.size())
	quit(0)
