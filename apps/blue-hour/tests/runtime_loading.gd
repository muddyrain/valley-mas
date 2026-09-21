extends "res://tests/day_loop_runtime.gd"
## Real Camp > selection > departure input, with isolated saves and renderer evidence.

const DEFAULT_OUT := "res://test-output/expedition-runtime-loading/"
const P01_OUT := "res://test-output/expedition-load-performance-p01/"
var samples: Array[Dictionary] = []
var records: Array[Dictionary] = []
var recording: bool = false
var capture_index: int = 0
var capture_started: int = 0
var shots: Dictionary = {}
var milestone_images: Dictionary = {}
var video_images: Array[Image] = []
var artifact_prefix: String = ""
var output_directory: String = DEFAULT_OUT
var p01_mode: bool = false

func run() -> void:
	root.unfocusable = true
	root.size = Vector2i(1600, 900)
	root.content_scale_size = Vector2i(1600, 900)
	p01_mode = "--p01" in OS.get_cmdline_user_args()
	output_directory = P01_OUT if p01_mode else DEFAULT_OUT
	DirAccess.make_dir_recursive_absolute(output_directory + "frames")
	var baseline := "--baseline" in OS.get_cmdline_user_args()
	var record_video := "--record" in OS.get_cmdline_user_args()
	artifact_prefix = "video_" if record_video else ""
	app = load("res://core/main.gd").new()
	app.fresh_test_run = true
	app.save_path = "user://test-runs/runtime-loading-%d.json" % OS.get_process_id()
	root.add_child(app)
	await frames(10)
	if not baseline:
		# Use a newly randomized campaign and production characters, without a map-seed override.
		app.campaign.new_run(0, "combat", ["xia_zhiyao", "su_wanxing", "lin_jianyue"])
		app.show_shelter()
		await frames(10)
	var seeds: Dictionary = {}
	var signatures: Dictionary = {}
	for visit: int in (1 if baseline or record_video else 5):
		if visit > 0:
			app.return_to_main_menu()
			app.continue_from_menu()
			var camp_deadline := Time.get_ticks_msec() + 30000
			while (app.state != "shelter" or is_instance_valid(app.continue_loading)) and Time.get_ticks_msec() < camp_deadline:
				await process_frame
			await frames(5)
		check(app.state == "shelter", "Visit %d starts in Camp" % visit)
		await click_at(app.camp_ui.get_node("M08_DepartAction/Entry").get_global_rect().get_center())
		await create_timer(0.65).timeout
		check(app.state == "today_action", "Camp input opens production selection")
		var page: Control = app.screen
		await click_at(page.cards[["commercial", "residential", "airdrop"][visit % 3]].get_global_rect().get_center())
		await create_timer(0.25).timeout
		if visit == 0:
			await shot("baseline-before" if baseline else "01_before_depart")
		if record_video:
			recording = true
			capture_started = Time.get_ticks_usec()
			RenderingServer.frame_post_draw.connect(record_frame)
		var clicked := Time.get_ticks_usec()
		if visit == 0 and not baseline:
			RenderingServer.frame_post_draw.connect(capture_milestone)
		await click_at(page.confirm_button.get_global_rect().get_center())
		var overlay: Node = app.get_node_or_null("RuntimeLoadingOverlay")
		check(overlay != null, "Click immediately installs reusable loading overlay")
		var deadline := Time.get_ticks_msec() + 60000
		while app.state == "departure" and Time.get_ticks_msec() < deadline:
			await process_frame
		if RenderingServer.frame_post_draw.is_connected(capture_milestone):
			RenderingServer.frame_post_draw.disconnect(capture_milestone)
		check(app.state == "mission", "Ready gate completes within timeout")
		if app.state != "mission":
			break
		var before: Vector3 = app.mission.squad_center()
		var target: Vector3 = app.mission.city.navigation.nearest(before + Vector3(5, 0, 0))
		var command_accepted: bool = app.mission.command_move(target)
		var click_to_command_accepted_ms: float = (Time.get_ticks_usec() - clicked) / 1000.0
		check(command_accepted, "First ground movement command is accepted immediately after Iris open")
		if baseline:
			await create_timer(.4).timeout
		await frames(5)
		await RenderingServer.frame_post_draw
		var minimap: Control = app.hud.minimap
		var image: Image = root.get_texture().get_image()
		var pixels := world_pixels(image, minimap)
		check(pixels.roads > 30 and pixels.buildings > 30, "Visible current-world roads AND buildings: %s" % str(pixels))
		var runtime: Dictionary = app.mission.runtime_data
		check(not seeds.has(runtime.seed), "Fresh production seed on every departure")
		check(not signatures.has(runtime.source_signatures.town), "Fresh geometry on every departure")
		seeds[runtime.seed] = true
		signatures[runtime.source_signatures.town] = true
		check(minimap.cached_source.begins_with(str(runtime.seed) + ":"), "Cache belongs to this seed")
		check(minimap.static_build_count == 1, "One cache build for this expedition")
		if not baseline:
			check(app.expedition_ready(), "All eight readiness conditions hold")
			check(app.load_profile.events.overlay_ready < app.load_profile.events.initialization_started, "Overlay drawn before heavy initialization")
			check(app.load_profile.event_order.find("final_ready_gate") < app.load_profile.event_order.find("iris_open_started"), "First reveal follows ready gate")
			check(minimap.world_layer_ready(), "World commands were drawn, not only allocated")
			check(app.load_profile.gates.values().all(func(value: bool) -> bool: return value), "Ready gate records all requirements")
			check(app.mission.search_registry.metrics.background_total > 0, "Formal loading schedules background search resolution")
			check(app.mission.search_registry.unresolved_count() > 0, "Search navigation does not block the first reveal")
		var entry := {"seed": runtime.seed, "signature": runtime.source_signatures.town,
			"elapsed_ms": click_to_command_accepted_ms, "pixels": pixels}
		if not baseline:
			entry["profile"] = app.load_profile.report()
			entry["search_unresolved_at_playable"] = app.mission.search_registry.unresolved_count()
		records.append(entry)
		await shot("baseline-minimap" if baseline else "seed_%02d_playable" % [visit + 1] if p01_mode else "%02d_seed_%s_minimap" % [visit + 5, ["a", "b", "c", "d", "e"][visit]])
		await create_timer(1.2).timeout
		check(app.mission.squad_center().distance_to(before) > .2, "Real survivors move after gate opens")
		check(minimap.follow_center.distance_to(app.mission.squad_center()) < .2, "Local map follows current squad")
		if not baseline:
			var resolve_deadline: int = Time.get_ticks_msec() + 15000
			while not app.mission.search_registry.background_complete() and Time.get_ticks_msec() < resolve_deadline:
				await process_frame
			check(app.mission.search_registry.background_complete(), "Background search navigation finishes after reveal")
			entry["profile"] = app.load_profile.report()
			entry["search_resolve_compute_ms"] = app.mission.search_registry.metrics.background_compute_ms
		if record_video:
			recording = false
			RenderingServer.frame_post_draw.disconnect(record_frame)
	# Encode after timing the live transition so PNG/JPEG compression cannot stall the Iris.
	for name: String in milestone_images:
		(milestone_images[name] as Image).save_png(output_directory + artifact_prefix + name + ".png")
	if p01_mode and milestone_images.has("03_loading_hold"):
		(milestone_images["03_loading_hold"] as Image).save_png(output_directory + "seed_01_loading.png")
	for index: int in video_images.size():
		video_images[index].save_jpg(output_directory + "frames/frame_%05d.jpg" % index, .9)
	if record_video:
		write_video_manifest()
	video_images.clear()
	milestone_images.clear()
	FileAccess.open(output_directory + ("baseline.json" if baseline else "recording.json" if record_video else "validation.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "records": records, "frames": samples}, "\t"))
	if p01_mode and not baseline and not record_video:
		FileAccess.open(output_directory + "load_profile_5_seeds.txt", FileAccess.WRITE).store_string(profile_text())
	app.queue_free()
	await frames(3)
	print("RUNTIME LOADING: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func shot(name: String) -> void:
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output_directory + artifact_prefix + name + ".png")
	shots[name] = true

func record_frame() -> void:
	if not recording:
		return
	var elapsed := (Time.get_ticks_usec() - capture_started) / 1000000.0
	video_images.append(root.get_texture().get_image())
	samples.append({"frame": capture_index, "seconds": elapsed})
	capture_index += 1

func capture_milestone() -> void:
	var overlay: Node = app.get_node_or_null("RuntimeLoadingOverlay")
	if overlay == null:
		return
	var shot_name: String = {"closing": "02_iris_closing", "hold": "03_loading_hold", "opening": "04_expedition_opening"}.get(overlay.phase, "")
	if shot_name.is_empty() or shots.has(shot_name):
		return
	if overlay.phase != "hold" and (overlay.radius < .25 or overlay.radius > .85):
		return
	milestone_images[shot_name] = root.get_texture().get_image()
	shots[shot_name] = true

func world_pixels(image: Image, minimap: Control) -> Dictionary:
	var transform: Transform2D = minimap.get_global_transform_with_canvas()
	var region: Rect2 = transform * minimap.minimap_content_rect
	var result := {"roads": 0, "buildings": 0}
	for x: int in range(int(region.position.x) + 2, int(region.end.x) - 2):
		for y: int in range(int(region.position.y) + 2, int(region.end.y) - 2):
			var color := image.get_pixel(x, y)
			if Vector3(color.r, color.g, color.b).distance_to(Vector3(154, 174, 198) / 255.0) < .02:
				result.roads += 1
			if Vector3(color.r, color.g, color.b).distance_to(Vector3(172, 181, 192) / 255.0) < .02:
				result.buildings += 1
	return result

func profile_text() -> String:
	var lines: PackedStringArray = ["Expedition Load Performance P01", "Measurement: Mission Selection confirm click -> Iris fully open -> immediate ground command accepted", ""]
	var total_ms: float = 0.0
	var maximum_ms: float = 0.0
	for index: int in records.size():
		var record: Dictionary = records[index]
		var stages: Dictionary = record.profile.stages_ms
		var elapsed_ms: float = record.elapsed_ms
		total_ms += elapsed_ms
		maximum_ms = maxf(maximum_ms, elapsed_ms)
		lines.append("seed_%02d seed=%d" % [index + 1, int(record.seed)])
		for key: String in ["click_to_overlay_visible", "overlay_close", "town_generate", "building_instance", "environment_generate", "environment_data_generate", "environment_roadside_generate", "environment_instance", "roadside_instance", "navigation_ready", "search_registry_create", "wait_search_resolve", "search_navigation_resolve", "search_navigation_resolve_background_elapsed", "minimap_build", "survivor_spawn", "hud_bind", "wait_navigation_sync", "wait_search_registry_ready", "wait_minimap_ready", "wait_survivor_ready", "wait_hud_ready", "wait_frame_present", "wait_transition", "iris_open", "TOTAL_CLICK_TO_PLAYABLE"]:
			lines.append("  %s=%.3f ms" % [key, float(stages.get(key, 0.0))])
		lines.append("  TEST_CLOCK_CLICK_TO_COMMAND_ACCEPTED=%.3f ms" % elapsed_ms)
		lines.append("  unresolved_search_targets_at_playable=%d" % int(record.search_unresolved_at_playable))
		lines.append("")
	var average_ms: float = total_ms / maxf(1.0, records.size())
	lines.append("AVERAGE_TEST_CLOCK_CLICK_TO_COMMAND_ACCEPTED=%.3f ms" % average_ms)
	lines.append("MAX_TEST_CLOCK_CLICK_TO_COMMAND_ACCEPTED=%.3f ms" % maximum_ms)
	lines.append("TARGET_AVERAGE_LE_3000_MS=%s" % str(average_ms <= 3000.0))
	lines.append("TARGET_EACH_LE_3500_MS=%s" % str(maximum_ms <= 3500.0))
	return "\n".join(lines) + "\n"

func write_video_manifest() -> void:
	var lines: PackedStringArray = []
	for index: int in samples.size():
		lines.append("file frames/frame_%05d.jpg" % index)
		var duration: float = 1.0 / 30.0
		if index + 1 < samples.size():
			duration = maxf(0.001, float(samples[index + 1].seconds) - float(samples[index].seconds))
		lines.append("duration %.6f" % duration)
	if not samples.is_empty():
		lines.append("file frames/frame_%05d.jpg" % (samples.size() - 1))
	FileAccess.open(output_directory + "video-frames.txt", FileAccess.WRITE).store_string("\n".join(lines) + "\n")
