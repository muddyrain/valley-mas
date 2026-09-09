extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
var checks = 0
var failures: Array[String] = []

func check(ok: bool, message: String) -> void:
	checks += 1
	if not ok: failures.append(message); push_error(message)

func _initialize() -> void:
	var w = Fixtures.empty({"width":32,"height":32,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE); w.prepare_ecology()
	var i = 16*32+16
	w.sow(i,1)
	var untreated = Save.decode(Save.encode(w)).world
	w.begin_stroke(); w.paint(Vector2i(16,16),0,World.TREE_FERTILIZER); w.end_stroke()
	check(w.plant_stage[i]==World.ADULT and w.boost[i]==0,"Active fertilizer completes maturation without requiring world time")
	var resumed = Save.decode(Save.encode(w)).world
	w.advance(4); resumed.advance(4); untreated.advance(4)
	check(w.plant_stage[i] == World.ADULT,"Existing tree matures within four seconds at 1x")
	check(untreated.plant_stage[i] < World.ADULT,"Untreated tree retains natural multi-year growth")
	check(w.plant_age == resumed.plant_age and w.plants == resumed.plants,"Fertilized growth survives saving and continues deterministically")
	var before = w.plant_age[i]
	w.advance(10)
	check(is_equal_approx(w.plant_age[i]-before,10),"Remaining fertilizer never accelerates adult ageing")
	check(not w.tool_affects(i,World.TREE_FERTILIZER),"Adult tree is correctly shown as an ineffective target")
	w.plants.fill(0); w.plant_stage.fill(0); w.plant_age.fill(0); w.boost.fill(0)
	w.begin_stroke(); w.paint(Vector2i(16,16),6,World.TREE_FERTILIZER); w.end_stroke()
	check(w.plant_count()>0,"Fertilizer creates suitable trees on empty soil")
	w.remove_plant(i,"clear")
	w.sow(i,16)
	w.begin_stroke(); w.paint(Vector2i(16,16),0,World.TREE_FERTILIZER); w.end_stroke()
	check(w.boost[i] == 0,"Tree fertilizer leaves shrubs unchanged")
	w.begin_stroke(); w.paint(Vector2i(16,16),0,World.PLANT_FERTILIZER); w.end_stroke(); w.advance(4)
	check(w.plant_stage[i] == World.ADULT,"Plant fertilizer visibly matures existing shrubs")
	check(World.BIOME_NAMES.size() >= 18 and World.Catalog.MAX_ID >= 70,"Expanded habitat and silhouette catalog is available")
	for biome in World.BIOME_NAMES.size():
		w.biomes.fill(biome)
		var valid = true
		for species in World.Catalog.BIOMES[biome]: valid = valid and w.can_live(i,species)
		check(valid,"Every catalog plant is suitable for its habitat %d" % biome)
	var map = World.generate({"width":192,"height":128,"seed":48217,"trees":.85})
	var habitats: Dictionary = {}
	for cell in map.terrain.size():
		if not World.is_water(map.terrain[cell]): habitats[map.biomes[cell]] = true
	check(habitats.size() >= 3 and habitats.size() <= 5,"A new world selects three to five large habitat provinces")
	check(Save.decode(Save.encode(map)).world != null,"Expanded generated world is valid on disk")
	var record = Save.encode(untreated)
	record.version = 4
	var bytes = JSON.stringify(record)
	var legacy = Save.decode(JSON.parse_string(bytes))
	check(legacy.world != null and is_equal_approx(legacy.world.age/World.YEAR_SECONDS,untreated.age/60.0) and legacy.world.plant_stage == untreated.plant_stage,"Version 4 JSON retains calendar and exact plant stages")
	Save.directory="user://test-runs/canopy-save-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var file=FileAccess.open(Save.path(1),FileAccess.WRITE); file.store_string(bytes); file.close()
	check(Save.write_slot(untreated,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v4.bak")==bytes,"First v5 save preserves exact v4 source bytes")
	check(Save.read_slot(1).world != null,"Version 5 disk save reads through real JSON")
	var latest = Save.encode(map); latest.version=4
	check(Save.decode(latest).world==null,"Old schema cannot silently accept newly appended habitats")
	check(w.paint(Vector2i(-200,10),4,World.GRASS)==Rect2i(),"Dragging beyond the map produces an empty valid update region")
	var clipped = Fixtures.empty({"width":32,"height":32,"trees":0})
	var mask=clipped.brush_cells(Vector2i(4,4),30,0)
	clipped.paint(Vector2i(4,4),30,World.GRASS,0)
	check(clipped.terrain.count(World.GRASS)==mask.size(),"Oversized brush requests share the preview size limit at map edges")
	# Catalog tails used to be unreachable because the birth sample was divided first.
	var forest = Fixtures.empty({"width":80,"height":80,"seed":421,"trees":0})
	forest.terrain.fill(World.FOREST); forest.biomes.fill(World.TEMPERATE); forest.prepare_ecology()
	forest.advance(World.YEAR_SECONDS*6)
	check(forest.plants.has(50) and forest.plants.has(49),"Natural regeneration reaches fungi and shrubs at the end of the habitat catalog")
	# Observe reproduction from one adult, independently of spontaneous ground births.
	var parent=16*32+16
	var grove=Fixtures.empty({"width":32,"height":32,"seed":9831,"trees":0})
	grove.terrain.fill(World.FOREST); grove.biomes.fill(World.TEMPERATE); grove.prepare_ecology()
	grove.sow(parent,1); grove.plant_stage[parent]=World.ADULT; grove.plant_age[parent]=grove.maturity(parent)
	grove.colonizable.fill(1); grove.ecology_sites.assign([parent])
	for second in 128:
		grove.eco_tick=second; grove.ecology_step()
	check(grove.plant_count()>1,"Adult trees can reproduce beyond their own canopy spacing")
	var spaced=true
	for cell in grove.plants.size():
		if cell!=parent and grove.plants[cell]>0: spaced=spaced and Vector2(cell%32-16,cell/32-16).length()>=2.5
	check(spaced,"Naturally reproduced saplings preserve the parent tree's space")
	var invalid=Save.encode(forest); invalid.version=4.5
	check(Save.decode(invalid).world==null,"Fractional save versions are rejected")
	print("AEON VALE CANOPY: %d checks, %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
