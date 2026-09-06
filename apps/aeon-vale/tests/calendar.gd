extends "res://tests/landscape.gd"

func _initialize() -> void:
	var w=World.generate({"width":64,"height":48,"seed":9831,"template":"ocean","trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE); w.prepare_ecology()
	w.weather_enabled=false
	check(World.YEAR_SECONDS==84,"Twelve seven-second months form one 1x year")
	for stage in 6:
		var i=(8+stage*4)*w.width+16
		w.sow(i,1,true)
		var bounds=[0.0,World.YEAR_SECONDS*.1,World.YEAR_SECONDS*.15,w.maturity(i),w.lifespan(i)*.78,w.lifespan(i)]
		w.plant_stage[i]=stage
		w.plant_age[i]=(bounds[stage]+bounds[stage+1])*.5 if stage<5 else w.decay_duration(i)*.37
	w.prepare_ecology(); w.age=84*12+42; w.eco_tick=751; w.eco_remainder=.375
	World.Weather.add_cloud(w,Vector2i(20,20),8,0)
	w.fires[2]=7.0; w.weather_due=126
	var old=Save.encode(w); old.version=7; old.erase("biome_cooldown")
	old.age=w.age*60.0/84.0; old.weather_due=90
	var ages=w.plant_age.duplicate()
	for i in ages.size():
		ages[i]=120.0*.37 if w.plants[i]>0 and w.plant_stage[i]==World.DEAD else ages[i]*60.0/84.0
	old.plant_age=Marshalls.raw_to_base64(ages.to_byte_array())
	var migrated=Save.decode(JSON.parse_string(JSON.stringify(old,"",true,true))).world
	check(migrated!=null,"A real v7 calendar fixture loads")
	if migrated==null: finish_calendar(); return
	check(is_equal_approx(migrated.age,w.age) and migrated.eco_tick==w.eco_tick and migrated.eco_remainder==w.eco_remainder,"Displayed year/progress migrates without moving the simulation clock")
	check(migrated.rain_clouds==w.rain_clouds and migrated.fires==w.fires and migrated.weather_due==126,"Active hazard seconds stay intact; next natural weather keeps its calendar interval")
	for stage in 6:
		var i=(8+stage*4)*w.width+16
		check(migrated.plant_stage[i]==stage and absf(migrated.plant_age[i]-w.plant_age[i])<.001,"Migration preserves stage and progress including dead decay: "+str(stage))
	w.fires.clear(); w.rain_clouds.clear(); w.age=0; w.eco_tick=0; w.eco_remainder=0
	var whole=Save.decode(Save.encode(w)).world
	var fractional=Save.decode(Save.encode(w)).world
	whole.advance(84)
	for n in 840: fractional.advance(.1)
	check(whole.eco_tick==84 and fractional.eco_tick==84 and is_equal_approx(fractional.age,84),"Real 1x and fractional frames reach the same year boundary")
	check(whole.plants==fractional.plants and whole.plant_age==fractional.plant_age and whole.plant_stage==fractional.plant_stage,"Cohort scheduling is independent of frame grouping")
	for phase in 8:
		var original=Save.decode(Save.encode(w)).world
		original.advance(phase*.125+.03125)
		var resumed=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(original),"",true,true))).world
		original.advance(8.0); resumed.advance(3.75); resumed.advance(4.25)
		check(original.plants==resumed.plants and original.plant_age==resumed.plant_age,"Saving during a cohort never skips or repeats plant work: "+str(phase))
	var edge=World.generate({"width":64,"height":48,"seed":9831,"template":"ocean","trees":0})
	edge.terrain.fill(World.FOREST); edge.warmth.fill(.49); edge.moisture.fill(.60)
	for i in edge.terrain.size(): edge.biomes[i]=World.BIRCH if i%edge.width<32 else World.TEMPERATE
	edge.prepare_ecology(); edge.advance(84*3)
	check(edge.spread_changes>0 and edge.spread_changes<100,"A boundary visibly evolves over three years without churning hundreds of cells")
	var locks=edge.biome_cooldown.duplicate(); var biomes=edge.biomes.duplicate()
	var loaded=Save.decode(Save.encode(edge)).world
	check(loaded!=null and loaded.biome_cooldown==locks,"Boundary rest periods survive saving")
	edge.advance(42); loaded.advance(42)
	var stable=true
	for i in locks:
		if locks[i]>edge.eco_tick: stable=stable and edge.biomes[i]==biomes[i]
	check(stable and edge.biomes==loaded.biomes,"New boundaries do not immediately reverse, including after load")
	for bad in [[-1,edge.eco_tick+10],[0,edge.eco_tick+1000],[.5,edge.eco_tick+10],[0,"bad"]]:
		var record=Save.encode(edge); record.biome_cooldown=[bad]
		check(Save.decode(record).world==null,"Malformed boundary rest data is rejected")
	Save.directory="user://test-runs/calendar-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var text=JSON.stringify(old,"",true,true); var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(text); file.close()
	check(Save.write_slot(migrated,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v7.bak")==text,"First overwrite retains exact original v7 bytes")
	check(Save.read_slot(1).world!=null,"Migrated calendar can be saved and reloaded")
	var ancient=old.duplicate(true); ancient.age=999999900.0
	var very_old=Save.decode(ancient).world
	check(Save.decode(Save.encode(very_old)).world.age==very_old.age,"The previous maximum calendar range is not truncated on a second load")
	finish_calendar()

func finish_calendar() -> void:
	print("AEON VALE CALENDAR: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
