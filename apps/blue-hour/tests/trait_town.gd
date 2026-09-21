extends "res://tests/expedition_minimap.gd"
const Neutral = preload("res://data/trait_data.gd")
var measurements: Array[Dictionary] = []

func run() -> void:
	var app: Node = await create_app(4101)
	var mission: Node3D = app.mission
	mission.director_enabled = false
	mission.debug_clear_enemies()
	mission.effects.sources.clear()
	mission.effects._rebuild()
	for tick: int in 600:
		mission._physics_process(1.0 / 60)
		if mission.survivor_commands_enabled:
			break
	var worker: Node3D = mission.survivors[0]
	var id: String = ""
	for candidate: String in mission.search_registry.building_searchables:
		if mission.city.sites[candidate].spec.search_status == "RESOLVED_REACHABLE":
			id = candidate
			break
	check(not id.is_empty(), "Formal Town has available target")
	if not id.is_empty():
		var site: Dictionary = mission.city.sites[id]
		var base: float = site.spec.search_seconds
		for level: int in [0, 1, 5]:
			mission.search_tasks.clear()
			for task: RefCounted in mission.exiting_tasks:
				task.advance_exit(1)
			mission.exiting_tasks.clear()
			site.searched = false
			site.progress = 0.0
			site.discovered = true
			worker.position = site.spec.entry
			worker.inside_building = false
			worker.talent = Neutral.new() if level == 0 else app.catalog.by_id(app.catalog.traits, "search_instinct").at_level(level)
			app.hud.inspect_member(worker, false)
			mission.command_search(id)
			check(mission.search_tasks.has(id), "Town real command dispatch")
			if not mission.search_tasks.has(id):
				continue
			var task: RefCounted = mission.search_tasks[id]
			task.prepare(0, mission)
			task.prepare(.3, mission)
			var duration: float = base / (1.0 if level == 0 else 1.12 if level == 1 else 1.25)
			task.advance(duration / 2, mission)
			app.hud.poi_context.refresh()
			check(absf(site.progress - .5) < .00001, "Town half-time progress")
			check(app.hud.poi_context.cards.has(id) and absf(app.hud.poi_context.cards[id].progress.value - 50) < .001, "Formal HUD shows real duration")
			task.advance(duration / 2, mission)
			check(site.searched, "Town exact duration completes")
			measurements.append({"target": id, "level": level, "base_seconds": base, "duration_seconds": duration})
	FileAccess.open("res://test-output/trait-foundation/town.json", FileAccess.WRITE).store_string(JSON.stringify({"checks": checks, "failures": failures, "search": measurements}, "\t"))
	print("TRAIT TOWN: ", checks, " checks; ", failures)
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
