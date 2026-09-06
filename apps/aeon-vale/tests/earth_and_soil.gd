extends SceneTree

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
var checks=0
var failures: Array=[]

func check(ok: bool, message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func cast(w, tool: int, radius: int=10) -> void:
	w.begin_stroke(); w.paint(Vector2i(32,32),radius,tool); w.end_stroke()

func _initialize() -> void:
	var w=World.generate({"width":64,"height":64,"seed":917,"template":"ocean","trees":0})
	w.weather_enabled=false; w.spread_enabled=false; w.biomes.fill(World.MARSH)
	cast(w,World.GRASS)
	var color=w.image.get_pixel(32*12+6,32*12+6)
	check(color.r>color.g,"Fresh plain soil is warm bare earth, not a hidden wetland")
	check(is_equal_approx(w.elevation[32*64+32],.1),"New plain soil replaces the former seabed height")
	cast(w,World.TREE_FERTILIZER)
	check(w.plant_count()==0,"Fertilizer cannot invent an ecology on unseeded soil")
	w.advance(World.YEAR_SECONDS)
	check(w.plant_count()==0,"Unseeded isolated soil does not recruit the former underwater biome")
	cast(w,World.GRASS_SEEDS)
	color=w.image.get_pixel(32*12+6,32*12+6)
	check(color.g>color.r,"Grass seeds establish visible green cover")
	cast(w,World.PLANT_FERTILIZER)
	check(w.plant_count()>0,"Fertilizer grows the seeded ecology")
	var ocean=World.generate({"width":64,"height":64,"seed":917,"template":"ocean","trees":0})
	var changed=false
	for n in 4:
		var before=ocean.terrain.duplicate(); cast(ocean,World.EARTHQUAKE,12)
		changed=changed or before!=ocean.terrain
	check(changed,"Player earthquakes can reshape ocean terrain")
	verify_persistence_and_ecology()
	verify_faults()
	print("AEON VALE EARTH AND SOIL: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)

func verify_persistence_and_ecology() -> void:
	var w=World.generate({"width":64,"height":64,"seed":917,"template":"ocean","trees":0})
	w.weather_enabled=false; w.spread_enabled=false
	cast(w,World.FOREST)
	var original=w.bare_soil.duplicate()
	for biome in World.BIOME_NAMES.size():
		cast(w,World.FOREST)
		check(w.bare_soil[32*64+32]==1,"Soil paint removes former cover for biome %d"%biome)
		cast(w,World.BIOME_TOOLS+biome)
		check(w.bare_soil[32*64+32]==0 and w.terrain[32*64+32]==World.FOREST,"Seed establishes ecology without replacing underlying soil %d"%biome)
		cast(w,World.TREE_FERTILIZER)
		check(w.plant_count()>0,"Seeded bare soil supports canopy fertilizer in biome %d"%biome)
	cast(w,World.GRASS)
	var saved=Save.encode(w)
	var decoded=Save.decode(JSON.parse_string(JSON.stringify(saved,"",true,true))).world
	check(decoded!=null and decoded.bare_soil==w.bare_soil,"Bare soil survives JSON saving and loading")
	check(decoded!=null and not decoded.describe_cell(32*64+32).contains(World.BIOME_NAMES[w.biomes[32*64+32]]),"Bare soil inspection hides inactive ecology")
	var before=w.bare_soil.duplicate(); cast(w,World.GRASS_SEEDS)
	check(w.undo() and w.bare_soil==before,"Undo restores unseeded soil")
	check(w.redo() and w.bare_soil[32*64+32]==0,"Redo restores seeded ground")
	var seeded=Save.encode(w); seeded.version=10; seeded.erase("bare_soil")
	var old=Save.decode(seeded).world
	check(old!=null and old.bare_soil.count(1)==0,"v10 worlds preserve their established ecology")
	for invalid in ["missing","size","value","water"]:
		var bad=saved.duplicate(true)
		var bare=w.bare_soil.duplicate()
		match invalid:
			"missing": bad.erase("bare_soil")
			"size": bad.bare_soil="AA=="
			"value": bare[32*64+32]=2; bad.bare_soil=Marshalls.raw_to_base64(bare)
			"water": bare[0]=1; bad.bare_soil=Marshalls.raw_to_base64(bare)
		check(Save.decode(bad).world==null,"Malformed bare soil is rejected: "+invalid)
	Save.directory="user://test-runs/earth14-%d"%Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var bytes=JSON.stringify(seeded,"\t"); var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(bytes); file.close()
	check(Save.write_slot(old,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v10.bak")==bytes,"First v11 save preserves exact v10 bytes")
	# Edge colonisation follows the existing spread switch and world clock.
	w=World.generate({"width":64,"height":64,"seed":914,"template":"ocean","trees":0})
	w.terrain.fill(World.GRASS); w.biomes.fill(World.MEADOW); w.bare_soil.fill(1)
	w.warmth.fill(.53); w.moisture.fill(.48); w.elevation.fill(.1)
	for y in 64:
		for x in range(0,24): w.bare_soil[y*64+x]=0
	w.prepare_ecology(); w.weather_enabled=false; w.spread_enabled=false
	var bare_before=w.bare_soil.duplicate(); w.advance(World.YEAR_SECONDS)
	check(w.bare_soil==bare_before,"Disabled spread leaves unseeded land untouched")
	w.spread_enabled=true; w.advance(World.YEAR_SECONDS*2)
	check(w.bare_soil.count(1)<bare_before.count(1),"Neighbouring ecology can progressively colonise bare soil")
	check(w.bare_soil[32*64+60]==1,"Ecology does not teleport across unseeded land")
	var resumed=Save.decode(Save.encode(w)).world
	w.advance(42); resumed.advance(10); resumed.advance(32)
	check(w.bare_soil==resumed.bare_soil and w.plants==resumed.plants,"Colonisation resumes deterministically after loading")

func verify_faults() -> void:
	var signatures: Dictionary={}
	var up=false; var down=false
	for shape in 4:
		for seed in range(1,5):
			var w=World.generate({"width":64,"height":64,"seed":seed,"template":"ocean","trees":0})
			w.terrain.fill(World.GRASS); w.biomes.fill(World.MEADOW); w.elevation.fill(.1)
			var terrain=w.terrain.duplicate(); var elevations=w.elevation.duplicate()
			w.begin_stroke(); w.paint(Vector2i(32,32),12,World.EARTHQUAKE,shape); w.end_stroke()
			var leaks=0
			for i in w.terrain.size():
				if terrain[i]==w.terrain[i]: continue
				if not World.Brush.contains(Vector2i(i%64-32,i/64-32),12,shape,Vector2i(i%64,i/64)): leaks+=1
				up=up or w.terrain[i] in [World.HILLS,World.MOUNTAIN]
				down=down or World.is_water(w.terrain[i])
			check(leaks==0 and w.terrain!=terrain,"Fault displacement stays inside brush family %d / seed %d"%[shape,seed])
			signatures[hash(w.terrain)]=true
			var result=w.terrain.duplicate(); var bare=w.bare_soil.duplicate()
			check(w.undo() and w.terrain==terrain and w.elevation==elevations,"Fault undo restores original heights")
			check(w.redo() and w.terrain==result and w.bare_soil==bare,"Fault redo reproduces the same shape")
	check(up and down,"Earthquakes produce both uplift and subsidence")
	check(signatures.size()>8,"Earthquakes offer varied fault orientations and branches")
