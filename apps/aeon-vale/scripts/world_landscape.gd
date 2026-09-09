extends RefCounted

const Sprites = preload("res://scripts/flora_sprites.gd")
const Flora = preload("res://scripts/pixel_flora.gd")
const OVERVIEW_PIXELS = 1
const CROWN_SIZE = Vector2i(4,5)

const Templates=preload("res://scripts/world_templates.gd")
const Topology=preload("res://scripts/world_topology.gd")

static func settings(config: Dictionary) -> Dictionary:
	return Templates.settings(config)

static func build(w, config: Dictionary, report: Callable) -> void:
	w.generation_settings=Templates.recipe(w.template,config)
	w.spread_enabled=bool(config.get("spread",true))
	Topology.build(w,report)
	var sea_distance=distance_from(w,true)
	var land_distance=distance_from(w,false)
	Topology.mountains(w,sea_distance)
	var shore_scale: float=clampf(mini(w.width,w.height)/192.0,.45,1.8)
	var wet=w.noise_for(w.world_seed+507,6.0,2)
	var detail=w.noise_for(w.world_seed+517,21.0,2)
	for i in w.terrain.size():
		var p=Topology.point(w,i)
		var broad=wet.get_noise_2d(p.x,p.y)
		var bay=detail.get_noise_2d(p.x,p.y)
		if w.terrain[i]==w.DEEP:
			var distance: float=land_distance[i]/shore_scale
			var shallows=clampf(2.8+broad*4+bay*2,1.2,4.8)
			var offshore=shallows+clampf(4+broad*5+bay*3,2,8)
			w.terrain[i]=w.SHALLOW if distance<shallows else (w.OCEAN if distance<offshore else w.DEEP)
		elif w.terrain[i]!=w.MOUNTAIN:
			var strand=clampf(1.2+broad*1.8+bay*.5,.7,2.2)*shore_scale
			if sea_distance[i]<strand: w.terrain[i]=w.BEACH
	if w.generation_settings.rivers: w.carve_rivers(w.elevation)
	if report.is_valid(): report.call(.48,"疏通河道 · 唤醒土地")
	assign_biomes(w)
	populate(w,w.generation_settings.trees,report)

static func distance_from(w, water: bool) -> PackedFloat32Array:
	var result = PackedFloat32Array()
	result.resize(w.terrain.size()); result.fill(10000)
	for i in result.size():
		if w.is_water(w.terrain[i])==water: result[i]=0
	for y in w.height:
		for x in w.width:
			var i: int = y*w.width+x
			if x>0: result[i]=minf(result[i],result[i-1]+1)
			if y>0: result[i]=minf(result[i],result[i-w.width]+1)
			if x>0 and y>0: result[i]=minf(result[i],result[i-w.width-1]+1.414)
			if x<w.width-1 and y>0: result[i]=minf(result[i],result[i-w.width+1]+1.414)
	for y in range(w.height-1,-1,-1):
		for x in range(w.width-1,-1,-1):
			var i: int = y*w.width+x
			if x<w.width-1: result[i]=minf(result[i],result[i+1]+1)
			if y<w.height-1: result[i]=minf(result[i],result[i+w.width]+1)
			if x<w.width-1 and y<w.height-1: result[i]=minf(result[i],result[i+w.width+1]+1.414)
			if x>0 and y<w.height-1: result[i]=minf(result[i],result[i+w.width-1]+1.414)
	return result

static func assign_biomes(w) -> void:
	var rng=RandomNumberGenerator.new(); rng.seed=w.world_seed+1991
	var types: Array[int]=[]
	var number=rng.randi_range(3,5)
	# Every biome can form a province. The first is familiar woodland or meadow;
	# the rest are sampled without replacement, never forced into tiny accents.
	types.append([w.MEADOW,w.TEMPERATE,w.BIRCH,w.CONIFER,w.SAVANNA][rng.randi_range(0,4)])
	while types.size()<number:
		var type=rng.randi_range(0,17)
		if type not in types: types.append(type)
	var candidates: Array[Vector2]=[]
	var inland=distance_from(w,true)
	var margin: float=mini(w.width,w.height)*(.046 if w.template=="continent" else .022)
	for i in w.terrain.size():
		if w.terrain[i] in [w.GRASS,w.FOREST,w.HILLS] and i%3==0 and inland[i]>=margin: candidates.append(Topology.point(w,i))
	if candidates.size()<number*4:
		for i in w.terrain.size():
			if w.terrain[i] in [w.GRASS,w.FOREST,w.HILLS]: candidates.append(Topology.point(w,i))
	var regions: Array[Vector2]=[]
	for k in number:
		var best=Vector2.ZERO; var score=-1.0
		for attempt in 160:
			if candidates.is_empty(): break
			var p: Vector2=candidates[rng.randi_range(0,candidates.size()-1)]
			var nearest=1.0
			for other in regions: nearest=minf(nearest,p.distance_squared_to(other))
			var value=nearest*rng.randf_range(.8,1.2)
			if value>score: best=p; score=value
		regions.append(best)
	var bend=w.noise_for(w.world_seed+2991,5.5,2)
	for i in w.terrain.size():
		var p=Topology.point(w,i)
		p+=Vector2(bend.get_noise_2d(p.x,p.y),bend.get_noise_2d(p.x+8,p.y+8))*.035
		var biome=types[0]; var best=INF
		for k in regions.size():
			var distance=p.distance_squared_to(regions[k])
			if distance<best: best=distance; biome=types[k]
		w.biomes[i]=biome
		var climate: Vector2=w.Dynamics.CLIMATES[biome]
		w.warmth[i]=clampf(climate.x+bend.get_noise_2d(p.x+5,p.y)*.035,0,1)
		w.moisture[i]=clampf(climate.y+bend.get_noise_2d(p.x,p.y+5)*.035,0,1)
		if w.terrain[i] in [w.GRASS,w.FOREST]: w.terrain[i]=w.ecology_soil(biome)

static func populate(w, density: float, report: Callable) -> void:
	for y in w.height:
		for x in w.width:
			var i: int = y*w.width+x
			if w.is_water(w.terrain[i]) or x%2!=0 or y%2!=0: continue
			var sample: int = w.hash_cell(x,y,w.world_seed)
			if sample%139==0 or (w.terrain[i]==w.MOUNTAIN and sample%29==0): w.objects[i]=1+sample%2
			elif w.site_available(i):
				var species: int=w.species_for(i,sample)
				var grove: float=w.ground_noise.get_noise_2d(x*.65+413,y*.65+227)
				var woodland=smoothstep(-.18,.18,grove)
				var coverage=lerpf(.16,1.25,woodland) if w.Catalog.is_canopy(species) else lerpf(.95,.55,woodland)
				if float(w.hash_cell(x,y,w.world_seed+81)%1000)/1000>=minf(1,density*coverage): continue
				if w.Catalog.is_canopy(species) and not w.fertilizer_space(i,true,2.5): continue
				w.plants[i]=species
				w.plant_age[i]=minf(w.maturity(i)*(.15+float(sample%1000)/220.0),w.lifespan(i)*.76)
				w.plant_stage[i]=w.stage_for(i)
		if y%32==0 and report.is_valid(): report.call(.55+.18*y/w.height,"播撒林木 · 点亮原野")

static func preview(w) -> Image:
	var result: Image = w.image.duplicate()
	result.resize(w.width*OVERVIEW_PIXELS,w.height*OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	for i in w.plants.size():
		paint_crown(result,w,i)
	return result

static func plant_anchor(w, i: int) -> Vector2:
	var x: int=i%w.width
	var y: int=i/w.width
	var sample: int=w.hash_cell(x,y,w.world_seed)
	return Vector2(x*w.TILE+float(sample%7)*.6-1.8,y*w.TILE+2+float((sample/7)%5)*.6)

static func paint_crown(target: Image, w, i: int, offset: Vector2i=Vector2i.ZERO) -> void:
	var species: int=w.plants[i]
	var stage: int=w.plant_stage[i]
	if not w.Catalog.valid(species) or stage==w.SEED: return
	var variation: int=w.hash_cell(i%w.width,i/w.width,w.world_seed)%3
	var key=Vector4i(species,stage,variation,-1)
	if not w.crown_cache.has(key):
		var crown=Sprites.frame(species,stage,variation,2)
		w.crown_cache[key]=crown
	var at=Vector2i((plant_anchor(w,i)*OVERVIEW_PIXELS/w.TILE).round())-offset-Vector2i(2,4)
	target.blend_rect(w.crown_cache[key],Rect2i(Vector2i.ZERO,CROWN_SIZE),at)
