extends "res://tests/expedition_minimap.gd"
## E02 uses the formal App and real Survivors with isolated saves.
const Registry = preload("res://maps/expedition/town_search_registry.gd")
const Assets = preload("res://data/world_asset_catalog.gd")
var completion_events: int = 0
var collection_events: int = 0
var update_usec: int = 0
var update_count: int = 0
var safe_motion: bool = true
var continuous_motion: bool = true
var first_registry_signature: String = ""

func registry_signature(mission: Node3D) -> String:
	var entries: Array[Dictionary] = []
	for id: String in mission.search_registry.building_searchables + mission.search_registry.vehicle_searchables:
		var site: Dictionary = mission.city.sites[id]
		entries.append({"id": id, "asset": site.spec.asset, "entry": site.spec.entry,
			"duration": site.spec.search_seconds, "profile": site.spec.loot_profile})
	return var_to_str(entries).sha256_text()

func instance_signature(mission: Node3D) -> String:
	var entries: Array[Dictionary] = []
	for layer: Node in [mission.city.get_node("Buildings"), mission.runtime_data.environment_root]:
		for body: Node3D in layer.get_children().filter(func(node: Node) -> bool: return node is Node3D):
			entries.append({"name": str(body.name), "pose": body.transform, "children": body.get_child_count(), "metadata": body.get_meta_list()})
	return var_to_str(entries).sha256_text()

func tick(mission: Node3D, count: int = 1) -> void:
	for frame: int in count:
		var before: Array[Vector3] = []
		for member: Node3D in mission.survivors:
			before.append(member.position)
		var started: int = Time.get_ticks_usec()
		mission._physics_process(1.0 / 30.0)
		update_usec += Time.get_ticks_usec() - started
		update_count += 1
		for index: int in mission.survivors.size():
			var member: Node3D = mission.survivors[index]
			safe_motion = safe_motion and mission.city.navigation.segment_clear(before[index], member.position)
			continuous_motion = continuous_motion and before[index].distance_to(member.position) < .5

func nearest_site(mission: Node3D, except: String = "") -> String:
	var best: float = INF
	var result: String = ""
	for id: String in mission.search_registry.building_searchables:
		var site: Dictionary = mission.city.sites[id]
		if id == except or site.searched or site.spec.search_status != "AVAILABLE":
			continue
		var distance: float = mission.survivors[0].position.distance_squared_to(site.spec.entry)
		if distance < best:
			best = distance
			result = id
	return result

func until_search(mission: Node3D, id: String) -> void:
	for frame: int in 12000:
		if mission.search_target_state(id).progressing:
			return
		tick(mission)
	check(false, "Search starts after walking to the entrance: " + id)

func discover(mission: Node3D, id: String) -> void:
	if mission.city.sites[id].discovered:
		return
	check(mission.command_move(mission.city.sites[id].spec.entry), "Move squad to discover target")
	for frame: int in 12000:
		tick(mission)
		if mission.city.sites[id].discovered:
			mission.command_stop()
			return
	check(false, "Target discovered through normal exploration")

func verify_flow(app: Node, seed_value: int) -> void:
	var mission: Node3D = app.mission
	mission.search_completed.connect(func(_id: String, _worker: String, _loot: Dictionary): completion_events += 1)
	mission.search_loot_collected.connect(func(_id: String, _worker: String, _loot: Dictionary): collection_events += 1)
	var id: String = nearest_site(mission)
	check(not id.is_empty(), "Seed %d has reachable building" % seed_value)
	if id.is_empty():
		return
	discover(mission, id)
	var index: int = (seed_value - 4101) % 3
	var worker: Node3D = mission.survivors[index]
	app.hud.inspect_member(worker, false)
	mission.command_search(id)
	check(mission.search_tasks.has(id), "Selected survivor receives search")
	if not mission.search_tasks.has(id):
		return
	check(mission.search_tasks[id].worker == worker, "Selection is authoritative for every survivor")
	var owner: RefCounted = mission.search_tasks[id]
	app.hud.inspect_member(mission.survivors[(index + 1) % 3], false)
	mission.command_search(id)
	check(mission.search_tasks[id] == owner and owner.worker == worker, "A target has only one owner")
	until_search(mission, id)
	var site: Dictionary = mission.city.sites[id]
	check(worker.position.distance_to(site.spec.entry) <= .1, "Search starts at legal interaction point")
	app.hud.poi_context.refresh()
	check(app.hud.poi_context.cards.has(id), "Active card follows SearchTask")
	var progress: float = site.progress
	var task_started: int = Time.get_ticks_usec()
	for sample: int in 200:
		owner.prepare(0.0, mission)
		owner.advance(0.0, mission)
	records.append({"seed": seed_value, "search_task_update_mean_usec": (Time.get_ticks_usec() - task_started) / 200.0})
	check(mission.command_move(mission.city.spawn_positions(1)[0]), "Ground command accepted for idle survivors")
	tick(mission, 15)
	check(mission.search_tasks.get(id) == owner and site.progress > progress, "Ground move preserves started search and progress")
	var completed_before: int = completion_events
	var collected_before: int = collection_events
	var resources_before: int = mission.ledger.food + mission.ledger.scrap
	app.hud.poi_context.cards[id].action.pressed.emit()
	check(not mission.search_tasks.has(id) and mission.search_target_state(id).worker == null, "Explicit card cancel releases owner immediately")
	check(not app.hud.poi_context.cards[id].visible, "Cancelled card closes without stale cancel action")
	tick(mission, 15)
	check(not worker.inside_building and mission.task_for(worker) == null and (not worker.regrouping or not worker.path.is_empty()), "Cancelled worker finishes exit and receives the existing regroup movement")
	check(completion_events == completed_before and collection_events == collected_before and resources_before == mission.ledger.food + mission.ledger.scrap, "Cancel grants no loot")
	app.hud.inspect_member(mission.survivors[(index + 1) % 3], false)
	mission.command_search(id)
	check(mission.search_tasks[id].worker == app.hud.selected_member, "Different selected survivor resumes retained progress")
	until_search(mission, id)
	owner = mission.search_tasks[id]
	var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, owner.worker.talent.search_multiplier)
	# Drive the existing task to the exact remaining duration, including tolerance.
	owner.advance((1.0 - site.progress) * seconds, mission)
	check(site.searched and site.progress == 1.0 and completion_events == completed_before + 1, "Exact threshold completes and emits once in the same tick")
	app.hud.poi_context.refresh()
	check(not app.hud.poi_context.cards[id].visible, "Completed card closes in same update")
	tick(mission, 30)
	check(collection_events == collected_before + 1 and mission.ledger.food + mission.ledger.scrap > resources_before, "Existing pickup pipeline deposits reward exactly once")
	mission.command_search(id)
	tick(mission, 30)
	check(completion_events == completed_before + 1 and collection_events == collected_before + 1 and not mission.search_tasks.has(id), "Completed target cannot be assigned or looted twice")
	for frame: int in 6000:
		if not app.hud.selected_member.regrouping:
			break
		tick(mission)
	check(not app.hud.selected_member.regrouping, "Completed search returns the worker to the moving squad and clears regroup status")
	var next: String = nearest_site(mission, id)
	discover(mission, next)
	app.hud.inspect_member(mission.survivors[index], false)
	mission.command_search(next)
	if mission.search_tasks.has(next):
		var accepted: bool = false
		for target: Vector3 in mission.city.navigation_targets.values():
			if mission.command_move(target):
				accepted = true
				break
		check(accepted and not mission.search_tasks.has(next), "Accepted ordinary movement replaces approach: " + mission.last_command_rejection)
		mission.command_recall(next)
	var original_entry: Vector3 = mission.city.sites[next].spec.entry
	var position_before: Vector3 = app.hud.selected_member.position
	# Negative fixture points at the physical building center, without changing
	# navigation or the frozen instance. Dispatch must actually query and reject it.
	mission.city.sites[next].spec.entry = mission.city.sites[next].body.position
	mission.command_search(next)
	check(not mission.search_tasks.has(next) and mission.last_command_rejection == "SEARCH_REJECTED_UNREACHABLE", "Unreachable target rejects without task or teleport")
	check(app.hud.selected_member.position == position_before, "Unreachable command cannot reposition the selected actor")
	mission.city.sites[next].spec.entry = original_entry

func verify_registry(mission: Node3D, seed_value: int) -> void:
	var registry: RefCounted = mission.search_registry
	check(registry != null and not registry.building_searchables.is_empty(), "Town has building registry")
	var ids: Dictionary = {}
	var available: int = 0
	for id: String in registry.building_searchables + registry.vehicle_searchables:
		check(not ids.has(id), "Unique runtime id: " + id)
		ids[id] = true
		var value: Dictionary = registry.snapshot(id)
		var definition: Resource = Assets.asset(value.source_definition_id)
		check(definition.searchable and Registry.Loot.PROFILES.has(value.loot_profile), "Definition-backed profile")
		if value.status == "AVAILABLE":
			available += 1
			check(mission.city.navigation.point_clear(value.interaction_point), "Interaction clears all inflated blockers")
			check(not mission.city.path(mission.city.spawn_positions(1)[0], value.interaction_point).is_empty(), "Interaction reachable from arrival exit")
			check(value.interaction_point.distance_to(value.entrance_point) < 2.1, "Interaction remains near authored entrance")
	check(registry.vehicle_searchables.is_empty() and registry.metrics.decorative_vehicle_count > 0, "Decoration-only environment vehicles stay non-lootable")
	var before: String = var_to_str(registry.building_searchables)
	var entries_before: Array = []
	for id: String in registry.building_searchables:
		entries_before.append(mission.city.sites[id].spec.entry)
	registry.resolve_navigation()
	var entries_after: Array = []
	for id: String in registry.building_searchables:
		entries_after.append(mission.city.sites[id].spec.entry)
	check(before == var_to_str(registry.building_searchables) and entries_before == entries_after, "Registry resolution is deterministic and idempotent")
	records.append({"seed": seed_value, "metrics": registry.metrics.duplicate(), "reachable": available,
		"rejected": registry.rejected.duplicate(), "source_signatures": mission.runtime_data.source_signatures.duplicate()})

func run() -> void:
	output_directory = "res://test-output/expedition-integration-e02"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_directory))
	var definition: Resource = Assets.ALL[0].duplicate()
	definition.loot_profile = "missing_profile_fixture"
	check(Registry.definition_status(definition) == "MISSING_PROFILE", "Unknown profiles cannot silently fall back to invented loot")
	definition.searchable = false
	check(Registry.definition_status(definition) == "NOT_SEARCHABLE", "Non-searchable definition is rejected")
	for seed_value: int in [4101, 4102, 4103, 4104]:
		var app: Node = await create_app(seed_value)
		var frozen_instances: String = instance_signature(app.mission)
		verify_registry(app.mission, seed_value)
		if seed_value == 4101:
			first_registry_signature = registry_signature(app.mission)
		verify_flow(app, seed_value)
		check(instance_signature(app.mission) == frozen_instances, "Search never changes frozen building or environment instances")
		app.queue_free()
		await process_frame
	var replay: Node = await create_app(4101)
	check(registry_signature(replay.mission) == first_registry_signature, "Fresh mission with same seed reproduces IDs, entrances, durations and profiles")
	replay.queue_free()
	await process_frame
	check(safe_motion, "Every movement segment stays clear of blockers")
	check(continuous_motion, "Real Survivor motion never teleports on search entry or exit")
	records.append({"world_update_mean_usec": update_usec / float(maxi(1, update_count)), "ticks": update_count})
	finish()

func finish() -> void:
	FileAccess.open(output_directory.path_join("report.json"), FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "seeds": records, "human_runtime_qa": "PENDING"}, "\t"))
	print("E02 SEARCH: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
