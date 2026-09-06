extends SceneTree

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
const Flora = preload("res://scripts/pixel_flora.gd")
var checks = 0
var failures: Array[String] = []

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var world = World.generate({"width": 48, "height": 48, "seed": 8241, "template": "ocean", "trees": 0})
	check(world.has_method("tool_affects"), "Preview and execution share a cell eligibility rule")
	if world.has_method("tool_affects"): verify_preview(world)
	verify_catalog(world)
	print("AEON VALE POLISH: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func verify_preview(world) -> void:
	world.terrain.fill(World.FOREST)
	world.biomes.fill(World.TEMPERATE)
	world.prepare_ecology()
	for tool in [World.DEEP, World.BEACH, World.HILLS, World.BIOME_TOOLS + World.TUNDRA, World.PLANT_TOOLS, World.PLANT_FERTILIZER, World.TREE_FERTILIZER, World.CLEAR_PLANTS, World.ROCK_TOOL]:
		var copy = Save.decode(Save.encode(world)).world
		copy.sow(24 * 48 + 24, 1)
		var mismatch = 0
		for y in range(20, 28):
			for x in range(20, 28):
				var i = y * 48 + x
				var before = copy.cell_state(i)
				var expected: bool = copy.tool_affects(i, tool)
				copy.begin_stroke()
				copy.paint(Vector2i(x, y), 0, tool)
				if (before != copy.cell_state(i)) != expected: mismatch += 1
		check(mismatch == 0, "Displayed eligibility matches actual mutation for tool %d" % tool)

func verify_catalog(world) -> void:
	var count = 0
	var seen: Dictionary = {}
	for biome in World.BIOME_NAMES.size():
		world.biomes.fill(biome)
		world.terrain.fill(World.FOREST)
		for sample in range(4096): seen[world.species_for(24 * 48 + 24,sample)] = true
	for species in range(1,World.Catalog.MAX_ID+1):
		if not World.Catalog.valid(species): continue
		count += 1
		var silhouettes: Dictionary = {}
		for variation in 3:
			var im = Flora.new().render(species,World.ADULT,variation,false)
			var data = im.get_data()
			var alpha = PackedByteArray()
			for i in range(3,data.size(),4): alpha.append(data[i])
			silhouettes[alpha.hex_encode()] = true
		check(silhouettes.size() == 3, "Species %d has three distinct occupied-pixel silhouettes" % species)
		check(seen.has(species), "Species %d participates in suitable natural colonisation" % species)
	check(count >= 48 and World.Catalog.TREES.size() >= 24, "Catalog contains 48 actual plant species including 24 trees")
	world.terrain.fill(World.GRASS)
	world.biomes.fill(World.ARID)
	world.plants.fill(0)
	world.plant_stage.fill(0)
	world.plant_age.fill(0)
	world.boost.fill(0)
	world.objects.fill(0)
	world.sow(24*48+24,44)
	var current = Save.encode(world)
	check(current.version == 11 and Save.decode(JSON.parse_string(JSON.stringify(current))).world.plants.has(44), "Current save persists expanded plant IDs through real JSON")
	current.version = 2
	check(Save.decode(current).world == null, "Version 2 retains its original species bounds")
	world.remove_plant(24*48+24,"clear")
	current = Save.encode(world)
	current.version = 2
	var old_bytes = JSON.stringify(current)
	Save.directory = "user://test-runs/polish-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var file = FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(old_bytes)
	file.close()
	var restored = Save.read_slot(1)
	check(restored.world != null and FileAccess.get_file_as_string(Save.path(1)) == old_bytes, "Reading version 2 preserves original disk bytes")
	check(Save.write_slot(restored.world,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v2.bak") == old_bytes, "First version 3 overwrite backs up the exact version 2 file")
