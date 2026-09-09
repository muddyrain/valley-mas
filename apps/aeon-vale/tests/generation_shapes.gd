extends SceneTree

const World=preload("res://scripts/world_data.gd")
const Game=preload("res://scripts/game.gd")
const TYPES=["continent","box_world","islands","boring_plains","donut","toast","pancake","fjords"]
var checks=0
var failures: Array[String]=[]

func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func components(w,water: bool) -> Array[int]:
	var seen=PackedByteArray(); seen.resize(w.terrain.size())
	var sizes: Array[int]=[]
	for start in seen.size():
		if seen[start] or w.is_water(w.terrain[start])!=water: continue
		var queue: Array[int]=[start]; seen[start]=1; var cursor=0
		while cursor<queue.size():
			for neighbor in w.neighbors(queue[cursor]):
				if not seen[neighbor] and w.is_water(w.terrain[neighbor])==water:
					seen[neighbor]=1; queue.append(neighbor)
			cursor+=1
		sizes.append(queue.size())
	sizes.sort(); sizes.reverse()
	return sizes

func inspect(config: Dictionary) -> void:
	var w=World.create(config)
	var type: String=config.template
	var label_text=type+" "+str(config.seed)+" "+str(w.width)+" "+str(config.get("extreme","default"))
	var dry=components(w,false); var wet=components(w,true)
	var major: Array[int]=[]
	for area in dry:
		if area>16: major.append(area)
	var biomes: Dictionary={}; var count=0
	var lo=Vector2i(w.width,w.height); var hi=Vector2i.ZERO
	for i in w.terrain.size():
		if not w.is_water(w.terrain[i]):
			biomes[w.biomes[i]]=biomes.get(w.biomes[i],0)+1; count+=1
			lo=lo.min(Vector2i(i%w.width,i/w.width)); hi=hi.max(Vector2i(i%w.width,i/w.width))
	check(biomes.size()>=3 and biomes.size()<=5,"3–5 provinces: "+label_text)
	for biome in biomes: all_biomes[biome]=true
	var minimum=1000000
	for area in biomes.values(): minimum=mini(minimum,area)
	check(minimum>count*.018,"Meaningful province areas: "+label_text)
	if type=="continent": check(not major.is_empty() and major[0]>count*.78,"Dominant broad mainland: "+label_text)
	elif type=="boring_plains": check(wet.is_empty() and w.terrain.count(World.MOUNTAIN)==0,"Full flat land: "+label_text)
	elif type=="box_world":
		var frame=true
		for x in w.width: frame=frame and w.terrain[x]==World.MOUNTAIN and w.terrain[(w.height-1)*w.width+x]==World.MOUNTAIN
		for y in w.height: frame=frame and w.terrain[y*w.width]==World.MOUNTAIN and w.terrain[y*w.width+w.width-1]==World.MOUNTAIN
		check(frame and not wet.is_empty(),"Closed mountain frame, internal water: "+label_text)
	elif type=="donut":
		check(wet.size()==2 and dry.size()==1 and w.is_water(w.terrain[(w.height/2)*w.width+w.width/2]),"Unbroken ring and enclosed lake: "+label_text)
	elif type=="islands": check(major.size()==w.generation_settings.islands and major[-1]>w.width*w.height*.009,"Selected number of separate substantial islands: "+label_text)
	elif type=="fjords": check(major.size()>=2 and major[1]>major[0]*.45 and major[0]+major[1]>count*.9,"Two broad lands divided by through strait: "+label_text)
	elif type in ["toast","pancake"]: check(dry.size()==1 and w.terrain.count(World.MOUNTAIN)==0,"One flat island: "+label_text)
	if type in ["donut","toast","pancake"]:
		check(absf(float(hi.x-lo.x)/maxi(1,hi.y-lo.y)-1)<.09,"True circle / square proportions: "+label_text)
	if type not in ["box_world","boring_plains"]:
		check(lo.x>0 and lo.y>0 and hi.x<w.width-1 and hi.y<w.height-1,"Sea margins: "+label_text)
	if config.seed==319762786:
		var again=World.create(config)
		check(w.terrain==again.terrain and w.biomes==again.biomes and w.elevation==again.elevation,"Deterministic model: "+label_text)

var all_biomes: Dictionary={}
func _initialize() -> void:
	check(Game.TEMPLATES==TYPES,"Creation offers precisely the eight approved templates")
	var seeds=[319762786,168760530,17821,48217,7719,715991,9831,781936,60391,2175,982173,14177]
	for type in TYPES:
		for n in seeds.size():
			var size: Vector2i=World.MAP_SIZES[n%3]
			inspect({"width":size.x,"height":size.y,"seed":seeds[n],"template":type,"trees":0})
		var controls=World.Landscape.Templates.CONTROLS[type]
		for combination in (1<<controls.size()):
			var size: Vector2i=World.MAP_SIZES[combination%3]
			var config={"width":size.x,"height":size.y,"seed":781936+combination,"template":type,"trees":0,"extreme":combination}
			for n in controls.size(): config[controls[n][0]]=controls[n][3 if combination & (1<<n) else 2]
			inspect(config)
		print("GENERATION CHECKED "+type)
	check(all_biomes.size()==18,"All eighteen biomes appear across the seed matrix")
	var report={"checks":checks,"failures":failures,"biomes":all_biomes.keys()}
	FileAccess.open("res://test-output/"+(OS.get_cmdline_user_args()[0] if not OS.get_cmdline_user_args().is_empty() else "generation-shapes")+".json",FileAccess.WRITE).store_string(JSON.stringify(report,"\t"))
	print("AEON VALE GENERATION SHAPES: "+JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
