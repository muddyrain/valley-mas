extends SceneTree

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
var failures: Array[String] = []
var checks: int = 0

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var config = {"seed": 48217, "width": 96, "height": 64, "template": "continent", "trees": 0.65, "rivers": true}
	var first = World.generate(config)
	var second = World.generate(config)
	check(first.terrain == second.terrain and first.plants == second.plants, "Same seed and settings reproduce terrain and vegetation")
	config.seed = 48218
	check(first.terrain != World.generate(config).terrain, "Changing seed changes the world")
	config.seed = 48217
	config.template = "archipelago"
	check(first.terrain != World.generate(config).terrain, "Template changes landforms")
	check(first.terrain.size() == 96 * 64, "Map dimensions match the requested world")
	check(first.terrain.has(World.BEACH) and first.terrain.has(World.SHALLOW) and first.terrain.has(World.DEEP), "World has beaches and graduated water depths")
	check(first.terrain.has(World.RIVER), "River option produces a river")
	var invalid_plants = 0
	for i in first.plants.size():
		if first.plants[i] > 0 and not first.can_live(i, first.plants[i]):
			invalid_plants += 1
	check(invalid_plants == 0, "Vegetation is compatible with its terrain")
	var before = first.terrain.duplicate()
	var plants_before = first.plants.duplicate()
	first.begin_stroke()
	first.paint(Vector2i(0, 0), 5, World.DESERT)
	first.paint(Vector2i(3, 1), 5, World.DESERT)
	first.end_stroke()
	check(first.terrain[0] == World.GRASS and first.biomes[0] == World.ARID, "Combination brush works at map edges without overflowing")
	check(first.undo(), "A complete drag is undoable")
	check(first.terrain == before and first.plants == plants_before, "Undo restores the complete stroke and vegetation")
	check(first.redo() and first.terrain[0] == World.GRASS and first.biomes[0] == World.ARID, "Redo restores the brush stroke")
	first.begin_stroke()
	first.paint(Vector2i(0, 0), 3, World.DEEP)
	first.end_stroke()
	check(first.plants[0] == 0, "Painting water removes incompatible plants")
	check(first.image.get_data() == first.bake_image().get_data(), "Editing updates neighboring shoreline shading consistently with a freshly rendered save")
	var roundtrip = Save.decode(Save.encode(first))
	check(roundtrip.error == "" and roundtrip.world.terrain == first.terrain and roundtrip.world.plants == first.plants, "Save roundtrip preserves edited terrain and vegetation")
	var corrupted = Save.encode(first)
	corrupted.terrain = "bad"
	check(Save.decode(corrupted).world == null, "Truncated terrain is rejected")
	corrupted = Save.encode(first)
	corrupted.width = 999999
	check(Save.decode(corrupted).world == null, "Oversized untrusted saves are rejected before allocation")
	corrupted = Save.encode(first)
	corrupted.version = 99
	check(Save.decode(corrupted).world == null, "Unknown save versions are rejected")
	var mix: Dictionary = {}
	for y in range(0, 64, 2):
		for x in range(0, 96, 2): mix[World.hash_cell(x, y, 48217) % 2] = true
	check(mix.size() == 2, "Even vegetation anchors still receive both shape variants")
	config.template = "lagoon"
	var lagoon = World.generate(config)
	check(lagoon.terrain[32 * 96 + 48] <= World.SHALLOW, "Lagoon template has a central water body")
	config.rivers = false
	check(not World.generate(config).terrain.has(World.RIVER), "Disabling rivers is respected")
	print("AEON VALE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
