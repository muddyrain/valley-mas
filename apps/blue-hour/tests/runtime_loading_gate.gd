extends "res://tests/expedition_minimap.gd"
## Gate failure and cache lifetime regressions, independent of the presentation animation.

const Profile = preload("res://core/runtime_load_profile.gd")
const Provider = preload("res://maps/expedition/expedition_map_provider.gd")

func run() -> void:
	var app: Node = await create_app(4102)
	var mission: Node3D = app.mission
	var map: Control = app.hud.minimap
	app.load_profile = Profile.new()
	check(app.expedition_ready(), "Complete synchronous fixture satisfies all ready conditions")
	var source: String = map.cached_source
	map.cached_source = "previous-seed"
	check(not app.expedition_ready(), "A previous expedition cache cannot pass ready gate")
	map.cached_source = source
	var geometry: Dictionary = mission.runtime_data.minimap_geometry
	mission.runtime_data.minimap_geometry = {"buildings": [], "regions": []}
	map._process(0)
	check(map.static_layer.commands.is_empty(), "Invalid world clears stale draw commands")
	check(not app.expedition_ready(), "Empty world cannot pass ready gate")
	mission.runtime_data.minimap_geometry = geometry
	map._process(0)
	mission.runtime_data.navigation_available = false
	check(not app.expedition_ready(), "Navigation readiness is required")
	mission.runtime_data.navigation_available = true
	mission.search_registry_ready = false
	check(not app.expedition_ready(), "Search readiness is required")
	mission.search_registry_ready = true
	var original_size: Vector2 = map.size
	map.size = Vector2.ZERO
	check(not app.expedition_ready(), "A zero-size map cannot pass ready gate")
	map.size = original_size
	map._process(0)
	check(app.expedition_ready(), "Restoring valid current data restores readiness")
	var sync_signature: Dictionary = mission.runtime_data.source_signatures.duplicate()
	var sync_navigation: String = mission.city.navigation.metrics.signature
	var sync_entries: Dictionary = {}
	for id: String in mission.city.sites:
		sync_entries[id] = {"entry": mission.city.sites[id].spec.entry, "status": mission.city.sites[id].spec.search_status}
	var parent := Node3D.new()
	root.add_child(parent)
	var staged: Dictionary = await Provider.create_runtime_staged(mission.mission_type, 4102, app.base_map, parent, Profile.new())
	check(staged.ok, "Staged provider completes")
	check(staged.runtime.source_signatures == sync_signature, "Staged source data equals frozen synchronous path")
	await process_frame
	check(staged.root.navigation.metrics.signature == sync_navigation, "Staging preserves identical navigation cells")
	# Repeat the same search resolution in batches without changing the mission or target data.
	await mission.search_registry.resolve_navigation_staged()
	for id: String in sync_entries:
		check(mission.city.sites[id].spec.entry == sync_entries[id].entry, "Batched resolution preserves entrance: " + id)
		check(mission.city.sites[id].spec.search_status == sync_entries[id].status, "Batched resolution preserves availability: " + id)
	parent.queue_free()
	app.queue_free()
	await process_frame
	print("RUNTIME LOADING GATE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
