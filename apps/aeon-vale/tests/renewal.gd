extends "res://tests/weather.gd"

func _initialize() -> void:
	for biome in World.BIOME_NAMES.size():
		for tool in [World.TREE_FERTILIZER,World.PLANT_FERTILIZER]:
			var w=plot(biome)
			var old_tree=1
			for species in World.Catalog.TREES:
				if not w.can_live(16*w.width+16,species): old_tree=species; break
			for y in range(4,29,6):
				for x in range(4,29,6):
					var i=y*w.width+x
					w.plants[i]=old_tree; w.plant_stage[i]=World.DEAD
			var center=16*w.width+16
			check(not w.invalid_cast_site(center,tool),"Old plant sites are not error feedback: %d/%d" % [biome,tool])
			var healthy=w.grove_species(2*w.width+2,true)
			w.sow(2*w.width+2,healthy,true); w.plant_stage[2*w.width+2]=World.ADULT
			w.objects[2*w.width+29]=1
			w.prepare_ecology()
			w.begin_stroke(); w.paint(Vector2i(16,16),18,tool,1); w.end_stroke()
			var produced=0; var wrong=0; var dead=0
			for i in w.plants.size():
				if w.plant_stage[i]==World.DEAD: dead+=1
				if w.plants[i]>0 and i!=2*w.width+2:
					produced+=1
					if World.Catalog.is_canopy(w.plants[i])!=(tool==World.TREE_FERTILIZER) or not w.can_live(i,w.plants[i]): wrong+=1
			check(produced>0 and wrong==0 and dead==0,"Changed habitat clears dead wood and produces its family: %d/%d" % [biome,tool])
			check(w.plants[2*w.width+2]==healthy and w.objects[2*w.width+29]==1,"Fertilizer retains a healthy canopy and rock: %d/%d" % [biome,tool])
			check(w.age==0,"Active renewal works while paused")
			w.undo(); check(w.plant_stage[center]==World.DEAD,"Undo restores removed dead wood")
			w.redo(); check(w.plant_stage[center]!=World.DEAD,"Redo reapplies the complete renewal")
	var w=plot(World.BIRCH)
	var i=16*w.width+16
	w.sow(i,2); w.plant_stage[i]=World.DEAD; w.plant_age[i]=0; w.prepare_ecology()
	w.advance(World.YEAR_SECONDS*.9)
	var life: Dictionary=w.life_counts()
	check(w.plant_stage[i]!=World.DEAD and life.living>0 and life.young>0,"Retired wood releases its site and the area recruits seedlings within a year: "+str(life))
	w=plot(World.BIRCH)
	w.sow(i,World.HERB); w.sow_natural(i,2)
	check(w.plants[i]==2 and w.plant_stage[i]==World.SEED,"Natural canopy recruitment can replace low grass")
	w.remove_plant(i,"clear"); w.sow(i,World.BERRY); w.sow_natural(i,2)
	check(w.plants[i]==World.BERRY,"Natural canopy recruitment preserves a healthy berry shrub")
	check(not w.invalid_cast_site(i,World.TREE_FERTILIZER),"A full healthy site is not an error")
	w.terrain[i]=World.DEEP
	check(w.invalid_cast_site(i,World.TREE_FERTILIZER),"Water retains genuine invalid feedback")
	w=plot(World.BIRCH); w.weather_enabled=true; w.fair_due=0; w.weather_due=200
	w.advance(1); check(w.fair_clouds.size()==1 and w.rain_clouds.is_empty(),"Fair clouds do not require rain")
	var dry=Save.decode(Save.encode(w)).world; dry.fair_clouds.clear(); dry.weather_enabled=false
	w.weather_enabled=false; var cloud=w.fair_clouds[0].duplicate()
	w.advance(0); check(w.fair_clouds[0]==cloud,"Paused world leaves fair clouds still")
	w.advance(4.25); dry.advance(4.25)
	check(w.plants==dry.plants and w.plant_age==dry.plant_age,"Fair clouds do not accelerate plants")
	var restored=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(w),"",true,true))).world
	check(restored!=null and restored.fair_clouds==w.fair_clouds,"Fair clouds round-trip through real JSON")
	w.advance(2.75); restored.advance(.75); restored.advance(2)
	check(restored.fair_clouds==w.fair_clouds,"Cloud continuation survives save and frame grouping")
	var old=Save.encode(w); old.version=8
	for key in ["fair_clouds","fair_due","fair_cycle"]: old.erase(key)
	var legacy=Save.decode(old).world
	check(legacy!=null and legacy.fair_clouds.is_empty(),"v8 starts without historical fair clouds")
	Save.directory="user://test-runs/renewal-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var original=JSON.stringify(old,"",true,true)
	var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(original); file.close()
	check(Save.read_slot(1).world!=null and FileAccess.get_file_as_string(Save.path(1))==original,"Reading v8 does not rewrite the player record")
	check(Save.write_slot(legacy,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v8.bak")==original,"First v9 overwrite preserves the exact v8 record")
	check(Save.read_slot(1).world!=null,"The migrated v9 world reloads")
	for key in ["life","x","seed"]:
		var bad=Save.encode(w); bad.fair_clouds[0][key]="invalid"
		check(Save.decode(bad).world==null,"Invalid fair cloud field is rejected: "+key)
	w.advance(300); check(w.fair_clouds.is_empty(),"Disabled weather allows existing clouds to expire")
	w.weather_enabled=true; w.advance(World.YEAR_SECONDS*20)
	check(w.fair_clouds.size()<=World.Weather.MAX_FAIR_CLOUDS,"Long-running weather has bounded cloud count")
	var result={"checks":checks,"failures":failures}
	FileAccess.open("res://test-output/renewal12-rules.json",FileAccess.WRITE).store_string(JSON.stringify(result,"\t"))
	print("AEON VALE RENEWAL: "+JSON.stringify(result)); quit(0 if failures.is_empty() else 1)

func plot(biome: int):
	var w=Fixtures.empty({"width":32,"height":32,"seed":89721,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(biome); w.prepare_ecology()
	w.spread_enabled=false; w.weather_enabled=false
	return w
