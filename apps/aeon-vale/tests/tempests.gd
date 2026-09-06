extends SceneTree

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
var checks=0
var failures: Array=[]

func check(ok: bool, message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func forest():
	var w=World.generate({"width":64,"height":64,"seed":39117,"template":"ocean","trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE)
	w.weather_enabled=false; w.spread_enabled=false
	for y in range(0,64,2):
		for x in range(0,64,2):
			var i=y*64+x
			w.plants[i]=1; w.plant_stage[i]=World.ADULT; w.plant_age[i]=400
	w.prepare_ecology(); w.image=w.bake_image()
	return w

func cast(w, tool: int, radius: int=8, shape: int=0) -> void:
	w.begin_stroke(); w.paint(Vector2i(32,32),radius,tool,shape); w.end_stroke()

func _initialize() -> void:
	var acid=forest(); cast(acid,225,6,2)
	check(acid.plant_stage[32*64+32]==World.DEAD,"Acid rain immediately withers trees while the world is paused")
	check(acid.plant_stage[38*64+38]==World.ADULT,"Acid respects the selected diamond footprint")
	check(acid.rain_clouds.size()==1,"Acid leaves a persistent moving precipitation cloud")
	check(acid.age==0,"An active acid cast does not advance the world")
	check(acid.plant_stage[32*64+40]==World.ADULT,"Forest ahead of the acid cloud is initially untouched")
	if not acid.rain_clouds.is_empty():
		var before=acid.rain_clouds.duplicate(true)
		var saved=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(acid),"",true,true))).world
		check(saved!=null,"An acid-damaged world survives a genuine JSON round trip")
		if saved!=null:
			acid.advance(4); saved.advance(1.5); saved.advance(2.5)
			check(acid.rain_clouds==saved.rain_clouds and acid.plant_stage==saved.plant_stage,"Moving acid and plant damage continue deterministically after loading")
		check(acid.rain_clouds[0].x>before[0].x,"Acid drifts across the world")
		check(acid.plant_stage[32*64+40]==World.DEAD,"Plants ahead of the original footprint wither when the moving acid reaches them")
	var quake=forest(); var original=quake.terrain.duplicate(); var heights=quake.elevation.duplicate()
	cast(quake,World.EARTHQUAKE,12)
	check(quake.terrain!=original and quake.elevation!=heights,"Earthquake changes ground types and height together")
	check(quake.life_counts().dead>10,"Earthquake leaves standing dead trees around the fault")
	check(quake.plant_stage[12*64+12]==World.ADULT,"Earthquake does not damage distant forest")
	check(Save.decode(Save.encode(quake)).world!=null,"Earthquake aftermath remains saveable")
	var terrain=quake.terrain.duplicate(); var bare=quake.bare_soil.duplicate()
	check(Save.decode(Save.encode(quake)).world.terrain==terrain,"Displaced ground is preserved exactly")
	check(quake.undo() and quake.life_counts().dead==0 and quake.terrain==original,"Undo restores earthquake-damaged ground and vegetation together")
	check(quake.bare_soil.count(1)==0 and quake.elevation==heights,"Undo restores soil cover and elevation")
	check(quake.redo() and quake.terrain==terrain and quake.bare_soil==bare,"Redo restores the same terrain displacement")
	cast(quake,World.FOREST,16)
	check(quake.quake_scars.count(0)==quake.terrain.size(),"Repainting restores soil without obsolete fracture overlays")
	var tornado=forest(); cast(tornado,World.TORNADO,12)
	check(tornado.tornadoes.size()==1,"A tornado cast creates one persistent funnel")
	check(tornado.plant_stage[32*64+42]==World.ADULT,"A newly forming small funnel does not destroy its full future footprint")
	var initial=tornado.tornadoes[0].duplicate()
	check(World.Forces.tornado_scale(initial)<.2,"The funnel starts small")
	tornado.advance(7)
	check(Vector2(tornado.tornadoes[0].vx,tornado.tornadoes[0].vy).distance_to(Vector2(initial.vx,initial.vy))>.1,"A tornado turns as it wanders rather than travelling in a straight line")
	var resumed=Save.decode(JSON.parse_string(JSON.stringify(Save.encode(tornado),"",true,true))).world
	check(resumed!=null,"A developing tornado can be saved")
	if resumed!=null:
		tornado.advance(4.5); resumed.advance(2); resumed.advance(2.5)
		check(tornado.tornadoes==resumed.tornadoes,"The saved funnel follows the same later path")
	tornado.advance(30)
	check(tornado.tornadoes.is_empty(),"The funnel dissipates and stops damaging plants")
	verify_shapes_and_migration()
	print("AEON VALE TEMPESTS: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)

func verify_shapes_and_migration() -> void:
	for shape in 4:
		var w=forest(); cast(w,World.ACID_RAIN,8,shape)
		var leaks=0; var missed=0
		for y in range(0,64,2):
			for x in range(0,64,2):
				var expected=World.Brush.contains(Vector2i(x-32,y-32),8,shape,Vector2i(x,y))
				var dead=w.plant_stage[y*64+x]==World.DEAD
				if dead and not expected: leaks+=1
				if expected and not dead: missed+=1
		check(leaks==0 and missed==0,"Acid damage matches brush family %d" % shape)
		var before=w.terrain.duplicate(); var biome=w.biomes.duplicate()
		w.advance(24)
		check(w.rain_clouds.is_empty() and before==w.terrain and biome==w.biomes,"Acid expires without replacing soil or ecology for brush %d" % shape)
	var w=forest(); cast(w,World.RAIN); cast(w,World.TORNADO)
	var old=Save.encode(w); old.version=9; old.erase("quake_scars")
	for cloud in old.rain_clouds: cloud.erase("acid")
	for storm in old.tornadoes: storm.erase("phase")
	var legacy=Save.decode(JSON.parse_string(JSON.stringify(old,"",true,true))).world
	check(legacy!=null and legacy.quake_scars.count(0)==w.terrain.size() and not legacy.rain_clouds[0].acid,"v9 worlds retain rain and begin without invented earthquake scars")
	check(legacy!=null and legacy.tornadoes[0].life==24,"Old tornadoes retain their remaining lifetime")
	Save.directory="user://test-runs/tempests-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var original=JSON.stringify(old,"\t"); var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(original); file.close()
	check(Save.write_slot(legacy,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v9.bak")==original,"First v10 save keeps the exact original v9 file")
	var data=Save.encode(w)
	for field in ["acid","phase"]:
		var bad=data.duplicate(true)
		if field=="acid": bad.rain_clouds[0].acid="invalid"
		else: bad.tornadoes[0].phase="invalid"
		check(Save.decode(bad).world==null,"Malformed persistent effect field is rejected: "+field)
	var bad=data.duplicate(true); var marks=w.quake_scars.duplicate(); marks[0]=3
	bad.quake_scars=Marshalls.raw_to_base64(marks)
	check(Save.decode(bad).world==null,"Unknown earthquake surface values are rejected")
	w.rain_clouds.clear(); w.tornadoes.clear(); w.weather_enabled=true; w.weather_due=0
	w.advance(1)
	check(w.rain_clouds.size()==1 and not w.rain_clouds[0].acid,"Natural weather never generates destructive acid rain")
	for n in 50:
		w.begin_stroke(); w.paint(Vector2i(n%64,n*7%64),n%8,World.ACID_RAIN,n%4); w.end_stroke()
	check(w.rain_clouds.size()<=World.Weather.MAX_CLOUDS,"Rain and acid share one bounded cloud budget")
	w.rain_clouds.clear(); w.terrain.fill(World.OCEAN); w.plants.fill(0); w.plant_stage.fill(0); w.plant_age.fill(0)
	cast(w,World.LIGHTNING)
	check(not w.disaster_events.is_empty() and w.fires.is_empty(),"Lightning remains visible over empty water without igniting it")
