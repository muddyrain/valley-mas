extends SceneTree

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
var checks=0
var failures: Array[String]=[]

func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func _initialize() -> void:
	var config={"width":96,"height":64,"seed":48217,"trees":.8,"land_size":6,"islands":4,"coast":4}
	var w=World.generate(config)
	var copy=World.generate(config)
	check(w.terrain==copy.terrain and w.biomes==copy.biomes and w.plants==copy.plants,"Same complete recipe reproduces terrain, biomes and initial vegetation")
	check(w.spread_enabled,"New worlds enable ecological spread")
	for change in [{"seed":715991},{"land_size":2},{"islands":0},{"coast":10}]:
		var recipe=config.duplicate(); recipe.merge(change,true)
		var alternative=World.generate(recipe)
		check(w.terrain!=alternative.terrain,"Generator responds to "+str(change))
	var forest_ground=0; var soil=0; var fantasy=0; var valid=true
	for i in w.terrain.size():
		if w.terrain[i] in [World.GRASS,World.FOREST,World.HILLS]:
			soil+=1
			if w.biomes[i] in [World.MEADOW,World.TEMPERATE,World.BIRCH]: forest_ground+=1
			if w.biomes[i]>=World.CITRUS or w.biomes[i]==World.MUSHROOM: fantasy+=1
		if w.plants[i]>0: valid=valid and w.can_live(i,w.plants[i])
	check(forest_ground>soil*.55 and fantasy<soil*.20,"Natural provinces dominate; fantasy remains local accents")
	check(valid and w.life_counts().adult>0 and w.life_counts().young>0,"Initial world mixes suitable adults and seedlings")
	for template in ["continent","archipelago","lagoon","twin","highlands","caldera","wetlands","ocean"]:
		var map=World.generate({"width":48,"height":32,"template":template,"seed":7719})
		var rim=true
		for x in map.width: rim=rim and map.is_water(map.terrain[x]) and map.is_water(map.terrain[(map.height-1)*map.width+x])
		for y in map.height: rim=rim and map.is_water(map.terrain[y*map.width]) and map.is_water(map.terrain[y*map.width+map.width-1])
		check(rim and Save.decode(Save.encode(map)).world!=null,"Template has a water rim and a valid save: "+template)

	var front=World.generate({"width":64,"height":48,"template":"ocean","trees":0,"seed":9831})
	front.terrain.fill(World.FOREST)
	front.warmth.fill(.49); front.moisture.fill(.60); front.elevation.fill(.12)
	for i in front.terrain.size(): front.biomes[i]=World.BIRCH if i%front.width<32 else World.TEMPERATE
	front.prepare_ecology()
	var original=front.biomes.duplicate()
	front.advance(World.YEAR_SECONDS*3)
	check(front.biomes!=original and front.spread_changes>0,"An ecological edge changes within three world years")
	check(front.biomes.count(World.BIRCH)>600 and front.biomes.count(World.TEMPERATE)>600,"Local spread preserves both large regions over three years")
	var saved=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(front)))).world
	front.advance(137); saved.advance(137)
	check(front.biomes==saved.biomes and front.plants==saved.plants and front.plant_age==saved.plant_age,"Save and resume preserve exact spread and life continuation")
	var inactive=front.biomes.duplicate(); var before_age=front.age
	front.spread_enabled=false; front.advance(240)
	check(front.biomes==inactive and front.age>before_age,"Disabling spread freezes only biome boundaries")
	var old=Save.encode(front); old.version=5; old.spread_enabled=true
	var legacy=Save.decode(old).world
	check(legacy!=null and not legacy.spread_enabled and legacy.biomes==front.biomes and legacy.plant_stage==front.plant_stage and is_equal_approx(legacy.age/World.YEAR_SECONDS,front.age/60.0),"Old saves preserve their world and start with spreading off")
	for barrier in [World.RIVER,World.BEACH,World.MOUNTAIN,World.RIFT]:
		var divided=World.generate({"width":32,"height":32,"template":"ocean","trees":0})
		divided.terrain.fill(World.FOREST); divided.biomes.fill(World.BIRCH)
		for i in divided.terrain.size():
			if i%32==16: divided.terrain[i]=barrier
			elif i%32>16: divided.biomes[i]=World.TEMPERATE
		divided.prepare_ecology(); var borders=divided.biomes.duplicate()
		divided.advance(1200)
		check(divided.biomes==borders,"Spread cannot cross terrain barrier "+str(barrier))
	var hills=World.generate({"width":32,"height":32,"template":"ocean","trees":0})
	hills.terrain.fill(World.HILLS); hills.warmth.fill(.49); hills.moisture.fill(.60)
	for i in hills.terrain.size(): hills.biomes[i]=World.BIRCH if i%32<16 else World.TEMPERATE
	hills.prepare_ecology(); hills.advance(300)
	check(hills.spread_changes>0 and hills.terrain.count(World.HILLS)==hills.terrain.size(),"Ecology can move over hills without flattening them")
	for biome in 18:
		var climate: Vector2=World.Dynamics.CLIMATES[biome]
		hills.warmth[0]=climate.x; hills.moisture[0]=climate.y; hills.elevation[0]=.1
		check(World.Dynamics.fitness(hills,0,biome)>.9,"Every ecology has a suitable local environment: "+str(biome))
	var malformed=Save.encode(w); malformed.spread_enabled="yes"
	check(Save.decode(malformed).world==null,"Invalid spread flags are rejected")
	malformed=Save.encode(w); malformed.generation_settings.land_size=99
	check(Save.decode(malformed).world==null,"Invalid generation settings are rejected")
	malformed=Save.encode(w); malformed.warmth="broken"
	check(Save.decode(malformed).world==null,"Invalid environment arrays are rejected")
	Save.directory="user://test-runs/landscape-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var bytes=JSON.stringify(old); var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(bytes); file.close()
	check(Save.write_slot(front,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v5.bak")==bytes,"First v6 write preserves exact v5 backup")
	check(Save.read_slot(1).world!=null,"New version loads from the real save directory")
	print("AEON VALE LANDSCAPE: %d checks, %d failures" % [checks,failures.size()])
	quit(0 if failures.is_empty() else 1)
