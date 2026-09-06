extends SceneTree

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
var checks = 0
var failures: Array[String] = []

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok: failures.append(message); push_error(message)

func _initialize() -> void:
	var w = World.generate({"width":32,"height":32,"template":"ocean","seed":12,"trees":0})
	check(World.BIOME_NAMES.size() == 18, "Eighteen distinct ecology environments")
	check(w.has_method("maturity"), "Growth and calendar have a shared explicit time model")
	if not w.has_method("maturity"): finish(); return
	verify(w)
	finish()

func finish() -> void:
	print("AEON VALE SEASONS: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)

func verify(w) -> void:
	w.terrain.fill(World.FOREST)
	w.biomes.fill(World.TEMPERATE)
	w.prepare_ecology()
	var i = 16*32+16
	w.sow(i,1)
	w.advance(World.YEAR_SECONDS)
	check(w.plant_stage[i] < World.ADULT, "A tree remains immature after a full calendar year")
	var control = Save.decode(Save.encode(w)).world
	w.begin_stroke(); w.paint(Vector2i(16,16),0,World.TREE_FERTILIZER); w.end_stroke()
	w.advance(40); control.advance(40)
	check(w.plant_stage[i] == World.ADULT and control.plant_stage[i] < World.ADULT, "Fertilizer matures an existing tree in tens of seconds")
	check(w.lifespan(i) >= 35*World.YEAR_SECONDS, "Adult trees live for decades")
	w.terrain[i] = World.HILLS
	w.begin_stroke(); w.paint(Vector2i(16,16),0,World.BIOME_TOOLS+7); w.end_stroke()
	check(w.terrain[i] == World.HILLS and w.biomes[i] == 7, "Birch ecology preserves hills")
	check(w.plant_stage[i] == World.DEAD, "Incompatible old trees wither on ecology conversion")
	for terrain in [World.DEEP,World.BEACH,World.MOUNTAIN]:
		w.terrain[i] = terrain
		check(not w.tool_affects(i,World.BIOME_TOOLS), "Ecology seed refuses unsuitable substrate %d" % terrain)
	w.terrain[i] = World.FOREST
	for b in World.BIOME_NAMES.size():
		w.biomes[i] = b
		var valid = true
		for sample in 200: valid = valid and w.can_live(i,w.species_for(i,sample))
		check(valid,"Ecology %d naturally chooses suitable species" % b)
	verify_masks(w)
	verify_disasters(w)
	verify_migration(w)

func verify_masks(w) -> void:
	for shape in 4:
		var copy = Save.decode(Save.encode(w)).world
		copy.terrain.fill(World.GRASS)
		copy.plants.fill(0); copy.plant_age.fill(0); copy.plant_stage.fill(0); copy.boost.fill(0)
		var points = copy.brush_cells(Vector2i(16,16),5,shape)
		copy.begin_stroke(); copy.paint(Vector2i(16,16),5,World.HILLS,shape); copy.end_stroke()
		var changed = 0
		for t in copy.terrain: changed += int(t == World.HILLS)
		check(changed == points.size(), "Brush preview footprint equals changed cells for shape %d" % shape)
		check(copy.brush_cells(Vector2i(16,16),5,shape) == points, "Brush is stable until the target moves")
	check(w.brush_cells(Vector2i(16,16),5,1).size() > w.brush_cells(Vector2i(16,16),5,0).size(),"Square covers its corners")
	check(w.brush_cells(Vector2i(16,16),5,3).size() < w.brush_cells(Vector2i(16,16),5,0).size(),"Spray leaves gaps")

func verify_disasters(w) -> void:
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE)
	w.plants.fill(0); w.plant_stage.fill(0); w.plant_age.fill(0); w.boost.fill(0)
	for y in range(8,25,2):
		for x in range(8,25,2): w.sow(y*32+x,1)
	w.prepare_ecology()
	w.begin_stroke(); w.paint(Vector2i(16,16),4,World.FIRE); w.end_stroke()
	check(not w.fires.is_empty(),"Fire creates persistent burning vegetation")
	var saved = Save.decode(JSON.parse_string(JSON.stringify(Save.encode(w))))
	check(saved.world != null and saved.world.fires == w.fires,"Burning vegetation survives disk representation")
	w.advance(4); saved.world.advance(4)
	check(w.plants == saved.world.plants and w.fires == saved.world.fires,"Fire resumes deterministically")
	check(w.deaths > 0,"Fire actually kills vegetation")
	w.begin_stroke(); w.paint(Vector2i(16,16),16,World.RAIN); w.end_stroke()
	check(w.fires.is_empty(),"Rain extinguishes the covered fires")
	w.begin_stroke(); w.paint(Vector2i(16,16),4,World.TORNADO); w.end_stroke()
	check(w.tornadoes.size() == 1,"One tornado per cast, not one per brush cell")
	var origin = w.tornadoes[0].x
	w.advance(2)
	check(w.tornadoes[0].x != origin,"Tornado moves through world time")
	var restored = Save.decode(Save.encode(w)).world
	check(restored.tornadoes == w.tornadoes,"Moving tornado survives save/load")
	var ground_before=w.terrain.duplicate()
	w.begin_stroke(); w.paint(Vector2i(16,16),5,World.EARTHQUAKE); w.end_stroke()
	check(w.terrain!=ground_before,"Earthquake changes actual terrain elevation")
	check(Save.decode(Save.encode(w)).world != null,"Disaster terrain and plants remain a valid save")
	w.begin_stroke(); w.paint(Vector2i(10,10),2,World.LIGHTNING); w.end_stroke()
	check(not w.disaster_events.is_empty(),"Lightning produces a visible strike")

func verify_migration(w) -> void:
	var old = Save.encode(w)
	old.version = 3; old.age = 120.0
	var terrain = PackedByteArray(); terrain.resize(1024); terrain.fill(World.FOREST)
	var biome = PackedByteArray(); biome.resize(1024); biome.fill(World.TEMPERATE)
	var plants = PackedByteArray(); plants.resize(1024); plants[0] = 1
	var stages = PackedByteArray(); stages.resize(1024); stages[0] = World.ADULT
	var ages = PackedFloat32Array(); ages.resize(1024); ages[0] = 100
	var boost = PackedFloat32Array(); boost.resize(1024)
	old.terrain = Marshalls.raw_to_base64(terrain); old.biomes = Marshalls.raw_to_base64(biome)
	old.plants = Marshalls.raw_to_base64(plants); old.plant_stage = Marshalls.raw_to_base64(stages)
	old.plant_age = Marshalls.raw_to_base64(ages.to_byte_array()); old.boost = Marshalls.raw_to_base64(boost.to_byte_array())
	var migrated = Save.decode(old)
	check(migrated.world != null,"A real old v3 life record migrates")
	if migrated.world == null: return
	check(migrated.world.age == World.YEAR_SECONDS*10,"Migration preserves displayed world year")
	migrated.world.advance(1)
	check(migrated.world.plant_stage[0] == World.ADULT,"Old adult tree does not regress after loading")
	Save.directory = "user://test-runs/seasons-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var exact = JSON.stringify(old)
	var f = FileAccess.open(Save.path(1),FileAccess.WRITE); f.store_string(exact); f.close()
	check(Save.write_slot(migrated.world,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v3.bak") == exact,"First v4 overwrite preserves exact v3 bytes")
