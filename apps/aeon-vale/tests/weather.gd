extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
var checks=0
var failures: Array=[]

func check(ok: bool, message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func _initialize() -> void:
	var w=Fixtures.empty({"width":32,"height":32,"seed":92317,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.TEMPERATE); w.prepare_ecology()
	w.weather_enabled=false
	w.fires[16*w.width+16]=12.0; w.fires[20*w.width+20]=12.0
	w.begin_stroke(); w.paint(Vector2i(16,16),6,World.RAIN,2); w.end_stroke()
	check(w.rain_clouds.size()==1 and not w.disaster_events.is_empty(),"Rain creates a visible persistent cloud without requiring fire")
	check(not w.fires.has(16*w.width+16) and w.fires.has(20*w.width+20),"Immediate rain extinguishes only the selected diamond footprint")
	check(w.age==0 and w.rain_clouds[0].life==w.rain_clouds[0].duration,"Paused casting has an immediate result without advancing weather")
	var wet=Save.decode(Save.encode(w)).world
	var dry=Save.decode(Save.encode(w)).world; dry.rain_clouds.clear()
	wet.fires.clear(); dry.fires.clear()
	wet.advance(4); dry.advance(4)
	check(wet.plants==dry.plants and wet.plant_age==dry.plant_age and wet.plant_stage==dry.plant_stage,"Rain leaves plant germination, age and maturation unchanged")
	wet.fires[16*wet.width+18]=12.0
	wet.advance(1)
	check(not wet.fires.has(16*wet.width+18),"A moving cloud extinguishes new fire after the initial cast")
	var saved=Save.encode(w)
	check(saved.version==11,"Weather state uses the new save version")
	var loaded=Save.decode(JSON.parse_string(JSON.stringify(saved,"",true,true))).world
	check(loaded!=null and loaded.rain_clouds==w.rain_clouds and not loaded.weather_enabled,"Weather and its switch survive JSON save/load")
	var x=w.rain_clouds[0].x
	w.advance(3.2); loaded.advance(1.2); loaded.advance(2.0)
	check(w.rain_clouds==loaded.rain_clouds,"Rain continuation is deterministic across frame grouping and saving")
	check(w.rain_clouds[0].x!=x and w.rain_clouds[0].life<w.rain_clouds[0].duration,"Cloud movement and expiry follow world time")
	w.advance(25)
	check(w.rain_clouds.is_empty(),"A short rain cloud expires naturally")
	w.weather_enabled=true; w.weather_due=0
	w.advance(1)
	check(w.rain_clouds.size()==1 and w.rain_clouds[0].natural,"Natural weather creates a local cloud")
	check(w.rain_clouds[0].duration>=10 and w.rain_clouds[0].duration<=20 and w.weather_due>=World.YEAR_SECONDS and w.weather_due<=World.YEAR_SECONDS*3,"Natural intervals and duration match the selected rhythm")
	w.weather_enabled=false; w.weather_due=0; w.advance(60)
	check(w.rain_clouds.is_empty(),"Disabling natural weather stops new automatic clouds")
	w.begin_stroke(); w.paint(Vector2i(4,4),2,World.RAIN); w.end_stroke()
	check(w.rain_clouds.size()==1,"The rain power remains available with natural weather disabled")
	for n in 40:
		w.begin_stroke(); w.paint(Vector2i(n%32,n*7%32),n%8,World.RAIN,n%4); w.end_stroke()
	check(w.rain_clouds.size()<=12,"Held and repeated rain have a bounded active cloud count")
	var old=saved.duplicate(true); old.version=6
	for key in ["rain_clouds","weather_enabled","weather_due","weather_cycle"]: old.erase(key)
	var legacy=Save.decode(old).world
	check(legacy!=null and legacy.rain_clouds.is_empty() and legacy.weather_enabled and is_equal_approx(legacy.age/World.YEAR_SECONDS,saved.age/60.0),"Old worlds start without historic clouds and preserve their clock")
	for property in ["x","life","radius","seed"]:
		var bad=saved.duplicate(true); bad.rain_clouds[0][property]="invalid"
		check(Save.decode(bad).world==null,"Malformed weather field is rejected: "+property)
	var invalid=saved.duplicate(true); invalid.rain_clouds[0].life=100
	check(Save.decode(invalid).world==null,"Impossible remaining rain lifetime is rejected")
	Save.directory="user://test-runs/weather-%d" % Time.get_ticks_usec()
	DirAccess.make_dir_recursive_absolute(Save.directory)
	var text=JSON.stringify(old,"\t"); var file=FileAccess.open(Save.path(1),FileAccess.WRITE)
	file.store_string(text); file.close()
	check(Save.write_slot(legacy,1).is_empty() and FileAccess.get_file_as_string(Save.path(1)+".v6.bak")==text,"First overwrite preserves the exact original v6 bytes")
	print("AEON VALE WEATHER: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
