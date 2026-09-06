extends SceneTree

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
var checks = 0
var failures: Array[String] = []

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	var world = World.generate({"width": 48, "height": 48, "seed": 8241, "template": "ocean", "trees": 0})
	check(world.has_method("advance"), "World time must drive plant life, not only a displayed year")
	if not world.has_method("advance"):
		quit(1)
		return
	run_ecology(world)
	print("AEON VALE ECOLOGY: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func run_ecology(world) -> void:
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 20, world.HILLS)
	world.paint(Vector2i(24, 24), 20, world.BIOME_TOOLS + world.TEMPERATE)
	world.end_stroke()
	var shape = world.terrain.duplicate()
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 10, world.BIOME_TOOLS + world.TUNDRA)
	world.end_stroke()
	check(world.terrain == shape, "Painting ecology preserves hills and water depth")
	check(world.plant_count() == 0, "Painting soil or ecology does not stamp mature trees")
	world.undo()
	world.advance(360.0)
	var stats: Dictionary = world.life_counts()
	check(stats.living > 25 and stats.adult > 5 and stats.young > 0, "Untouched suitable soil develops a mixed-age grove within six world years")
	check(stats.living < 250, "Natural colonisation leaves open space instead of filling every site")
	var living_before = stats.living
	var born_before = world.births
	world.advance(5200.0)
	stats = world.life_counts()
	check(world.deaths > 0 and world.births > born_before and stats.living > 10, "Ageing, death and replacement sustain a living grove")
	check(stats.living < 300 and living_before > 0, "Long-running ecology remains bounded")
	var unsuitable = 0
	for i in world.plants.size():
		if world.plants[i] > 0 and world.plant_stage[i] != world.DEAD and not world.can_live(i, world.plants[i]): unsuitable += 1
	check(unsuitable == 0, "Every living natural plant matches both soil and ecology")
	var i = 24 * world.width + 24
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 2, world.FOREST)
	world.paint(Vector2i(24, 24), 2, world.BIOME_TOOLS + world.TEMPERATE)
	world.paint(Vector2i(24, 24), 0, world.PLANT_TOOLS)
	world.end_stroke()
	world.plant_age[i] = 65.0
	world.plant_stage[i] = world.ADULT
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 0, world.BEACH)
	world.end_stroke()
	check(world.plants[i] == 1 and world.plant_stage[i] == world.DEAD, "An unsuitable tree immediately becomes a dead tree")
	check(not world.visual_events.is_empty(), "Habitat change emits a visible transition")
	world.undo()
	check(world.terrain[i] == world.FOREST and world.plant_stage[i] == world.ADULT and world.plant_age[i] == 65.0, "Undo restores habitat and the actual plant life state")
	world.redo()
	check(world.plant_stage[i] == world.DEAD, "Redo restores the dead-tree consequence")
	world.advance(World.DEAD_SECONDS+1)
	check(world.plants[i] != 1, "Dead trees eventually decay and release their site")
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 1, world.DEEP)
	world.end_stroke()
	check(world.plants[i] == 0 and world.objects[i] == 0, "Water clears plants and ground objects")
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 2, world.GRASS)
	world.paint(Vector2i(24, 24), 2, world.BIOME_TOOLS + world.TEMPERATE)
	world.paint(Vector2i(24, 24), 2, world.CLEAR_PLANTS)
	world.paint(Vector2i(24, 24), 2, world.TREE_FERTILIZER)
	world.end_stroke()
	check(world.plant_count()>0, "Tree fertilizer can populate suitable empty soil")
	world.remove_plant(i,"clear")
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 0, world.PLANT_TOOLS)
	world.paint(Vector2i(24, 24), 0, world.PLANT_FERTILIZER)
	world.end_stroke()
	check(world.plant_stage[i] == world.SEED and world.boost[i] == 0, "Tree sowing starts a seed and herb fertilizer does not affect it")
	var control = Save.decode(Save.encode(world)).world
	world.begin_stroke()
	world.paint(Vector2i(24, 24), 0, world.TREE_FERTILIZER)
	world.end_stroke()
	world.advance(10)
	control.advance(10)
	check(world.plant_age[i] > control.plant_age[i] * 2, "Tree fertilizer visibly accelerates existing tree growth")
	world.begin_stroke()
	world.remove_plant(24*world.width+26,"clear")
	world.paint(Vector2i(26, 24), 0, world.BERRY_SEEDS)
	world.paint(Vector2i(26, 24), 0, world.PLANT_FERTILIZER)
	world.end_stroke()
	var bush = 24 * world.width + 26
	check(world.plants[bush] == world.BERRY and world.plant_stage[bush]==world.ADULT, "Berry placement creates a visible mature bush")
	world.begin_stroke()
	world.paint(Vector2i(26, 24), 0, world.BEACH)
	world.end_stroke()
	check(world.plants[bush] == 0, "Unsuitable shrubs disappear instead of becoming dead trees")
	world.advance(0.375)
	var loaded = Save.decode(Save.encode(world))
	check(loaded.error.is_empty() and loaded.world.biomes == world.biomes and loaded.world.plant_age == world.plant_age and loaded.world.plant_stage == world.plant_stage, "Versioned save preserves ecology and every life stage")
	world.advance(31.125)
	loaded.world.advance(31.125)
	check(loaded.world.plants == world.plants and loaded.world.plant_age == world.plant_age and loaded.world.eco_tick == world.eco_tick, "Save/resume preserves the exact ecology clock and deterministic continuation")
	var legacy = {"version": 1, "name": "Legacy", "seed": 1, "width": 32, "height": 32, "template": "continent", "age": 3.0}
	var terrain = PackedByteArray()
	terrain.resize(1024)
	terrain.fill(world.FOREST)
	var plants = PackedByteArray()
	plants.resize(1024)
	plants[0] = 13
	plants[2] = 1
	legacy.terrain = Marshalls.raw_to_base64(terrain)
	legacy.plants = Marshalls.raw_to_base64(plants)
	var original = JSON.stringify(legacy)
	var migrated = Save.decode(legacy)
	check(migrated.error.is_empty() and migrated.world.objects[0] == 1 and migrated.world.plants[0] == 0 and migrated.world.plant_count() == 1, "Legacy rock sprites migrate to objects and never count as living plants")
	check(JSON.stringify(legacy) == original, "Legacy migration leaves the source data untouched")
	var malformed = Save.encode(world)
	malformed.plant_age = "bad"
	check(Save.decode(malformed).world == null, "Malformed plant ages are rejected before simulation")
	malformed = Save.encode(world)
	var stages = world.plant_stage.duplicate()
	stages[0] = 255
	malformed.plant_stage = Marshalls.raw_to_base64(stages)
	check(Save.decode(malformed).world == null, "Invalid life stages are rejected")
	var large = World.generate({"width": 384, "height": 256, "seed": 48217, "trees": 0.65})
	var encoded = Save.encode(large)
	var restored = Save.decode(encoded)
	check(restored.world != null, "Full-size worlds validate and reload their complete life arrays")
	var parsed = JSON.parse_string(JSON.stringify(encoded))
	check(Save.decode(parsed).world != null, "JSON disk representation reloads, including numeric version values")
	Save.directory = "user://test-runs/ecology-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var file = FileAccess.open(Save.path(1), FileAccess.WRITE)
	file.store_string(original)
	file.close()
	var from_disk = Save.read_slot(1)
	check(from_disk.world != null and FileAccess.get_file_as_string(Save.path(1)) == original, "Loading a legacy disk save migrates in memory without touching its original file")
	check(Save.write_slot(from_disk.world, 1).is_empty() and FileAccess.get_file_as_string(Save.path(1) + ".v1.bak") == original, "First v2 overwrite preserves the exact v1 save as a backup")
	check(Save.read_slot(1).world != null, "The migrated v2 disk save remains playable")
