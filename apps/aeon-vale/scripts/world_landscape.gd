extends RefCounted

# One full-resolution recipe feeds both the preview and the created world.
static func settings(config: Dictionary) -> Dictionary:
	return {"land_size":clampi(int(config.get("land_size",6)),1,10),"islands":clampi(int(config.get("islands",4)),0,12),"coast":clampi(int(config.get("coast",4)),0,10),"trees":clampf(float(config.get("trees",.8)),0,1),"rivers":bool(config.get("rivers",true))}

static func build(w, config: Dictionary, report: Callable) -> void:
	w.generation_settings = settings(config)
	w.spread_enabled = bool(config.get("spread",true))
	var count: int = w.width*w.height
	w.elevation.resize(count); w.moisture.resize(count); w.warmth.resize(count)
	var scale: float = lerpf(6.0,2.0,(w.generation_settings.land_size-1)/9.0)
	var land = w.noise_for(w.world_seed,scale,2)
	var detail = w.noise_for(w.world_seed+173,13.0,2)
	var warp = w.noise_for(w.world_seed+819,2.4,1)
	var wet = w.noise_for(w.world_seed+507,3.3,2)
	var heat = w.noise_for(w.world_seed+917,2.6,2)
	var ridge = w.noise_for(w.world_seed+1237,4.2,2)
	var islands: Array = []
	for k in w.generation_settings.islands:
		var angle: float = k*TAU/maxi(1,w.generation_settings.islands)+w.hash_cell(k,0,w.world_seed)*.00007
		var radius: float = .30+float(w.hash_cell(k,1,w.world_seed)%100)/1000.0
		islands.append(Vector3(.5+cos(angle)*radius,.5+sin(angle)*radius,.025+float(w.hash_cell(k,2,w.world_seed)%100)/2800.0))
	for y in w.height:
		for x in w.width:
			var u: float = float(x)/maxi(1,w.width-1)
			var v: float = float(y)/maxi(1,w.height-1)
			var bend = Vector2(warp.get_noise_2d(u,v),warp.get_noise_2d(u+9,v+5))*.17
			var pos = Vector2(u,v)+bend
			var radial = Vector2((pos.x-.5)*2.30,(pos.y-.5)*2.30).length()
			var n = land.get_noise_2d(pos.x,pos.y)
			var d: float = detail.get_noise_2d(u,v)*w.generation_settings.coast*.006
			var h = .50-radial*.65+n*.34+d
			match w.template:
				"archipelago": h = .06-radial*.29+n*.86+d
				"lagoon": h = .13-absf(radial-.47)*.85+n*.16+d
				"twin":
					var a = Vector2((pos.x-.29)*3.7,(pos.y-.47)*2.6).length()
					var b = Vector2((pos.x-.72)*3.8,(pos.y-.53)*2.6).length()
					h = .39-minf(a,b)*.62+n*.25+d
				"highlands": h = .5-radial*.65+n*.36+d
				"caldera": h = .28-absf(radial-.40)*1.32+n*.12+d*.4
				"wetlands": h = .20-radial*.36+n*.4+d
			for island in islands:
				var distance: float = Vector2(u-island.x,v-island.y).length()
				h = maxf(h,(island.z-distance)*1.9+d*.4)
			var rim = minf(minf(u,1-u),minf(v,1-v))
			h = minf(h,(rim-.055)*2.0)
			if w.template == "ocean": h = -.4
			var i: int = y*w.width+x
			w.elevation[i] = h
			w.moisture[i] = clampf(.54+wet.get_noise_2d(u,v)*.72,0,1)
			w.warmth[i] = clampf(.49+(v-.5)*.29+heat.get_noise_2d(u,v)*.62-maxf(h-.2,0)*.3,0,1)
			w.terrain[i] = w.GRASS if h>0 else w.DEEP
		if y%24==0 and report.is_valid(): report.call(.08+.25*y/w.height,"抬升大陆 · 铺展海岸")
	# Drop single-cell specks; coast width comes from distance, not scattered altitude bands.
	var initial: PackedByteArray = w.terrain.duplicate()
	for i in count:
		var same = 0
		for p in w.neighbors(i):
			if initial[p]==initial[i]: same+=1
		if same==0 and i/w.width>0 and i/w.width<w.height-1: w.terrain[i] = w.DEEP if initial[i]==w.GRASS else w.GRASS
	var sea_distance = distance_from(w,true)
	var land_distance = distance_from(w,false)
	var shore_scale: float = clampf(mini(w.width,w.height)/160.0,.55,1.8)
	for i in count:
		var u: float = float(i%w.width)/w.width
		var v: float = float(i/w.width)/w.height
		var broad = wet.get_noise_2d(u+3,v+5)
		if w.terrain[i] == w.DEEP:
			var distance: float = land_distance[i]/shore_scale
			w.terrain[i] = w.SHALLOW if distance<3.3+broad*1.6 else (w.OCEAN if distance<10+broad*3 else w.DEEP)
		else:
			var h: float = w.elevation[i]
			var peak = ridge.get_noise_2d(u,v)
			if sea_distance[i] < 1.55*shore_scale: w.terrain[i] = w.BEACH
			elif (peak>.25 and h>.16) or h>(.26 if w.template=="highlands" else .43) or (w.template=="caldera" and h>.22): w.terrain[i] = w.MOUNTAIN
			elif peak>.10 and h>.08: w.terrain[i] = w.HILLS
			if w.template == "wetlands": w.moisture[i] = maxf(w.moisture[i],.74)
	if w.generation_settings.rivers and w.template != "ocean": w.carve_rivers(w.elevation)
	if report.is_valid(): report.call(.48,"疏通河道 · 唤醒土地")
	assign_biomes(w)
	populate(w,w.generation_settings.trees,report)

static func distance_from(w, water: bool) -> PackedFloat32Array:
	var result = PackedFloat32Array()
	result.resize(w.terrain.size()); result.fill(10000)
	for i in result.size():
		if (w.terrain[i]==w.DEEP)==water: result[i]=0
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
	var regions: Array = []
	var bend = w.noise_for(w.world_seed+1991,4.2,1)
	# Seeded provinces rather than latitude bands or an x-indexed fantasy palette.
	var types = [w.MEADOW,w.TEMPERATE,w.BIRCH,w.TEMPERATE,w.MEADOW,w.BIRCH,w.CONIFER,w.GOLDEN,w.FLOWERLAND,w.SAKURA,w.MARSH,w.SAVANNA]
	for k in types.size():
		var p = Vector2(.14+float(w.hash_cell(k,1,w.world_seed+312)%1000)/1390.0,.14+float(w.hash_cell(k,2,w.world_seed+312)%1000)/1390.0)
		regions.append([p,types[k]])
	var accents: Array = []
	for k in 5:
		var p = Vector2(.12+float(w.hash_cell(k,3,w.world_seed+517)%1000)/1315.0,.12+float(w.hash_cell(k,4,w.world_seed+517)%1000)/1315.0)
		accents.append([p,[w.MUSHROOM,w.CITRUS,w.CRYSTAL,w.JADE,w.SWEET][k]])
	for i in w.terrain.size():
		var u: float = float(i%w.width)/w.width
		var v: float = float(i/w.width)/w.height
		var p = Vector2(u,v)+Vector2(bend.get_noise_2d(u,v),bend.get_noise_2d(u+8,v+8))*.09
		var biome: int = w.MEADOW
		var best = INF
		for region in regions:
			var distance: float = p.distance_squared_to(region[0])
			# Reserve the majority of the land for grass, temperate and birch forest.
			if region[1] not in [w.MEADOW,w.TEMPERATE,w.BIRCH] and distance>.012: continue
			if distance<best: best=distance; biome=region[1]
		if w.warmth[i]<.28: biome=w.TUNDRA if w.warmth[i]<.22 else w.CONIFER
		elif w.moisture[i]<.30: biome=w.ARID if w.moisture[i]<.23 else w.SAVANNA
		elif w.moisture[i]>.74: biome=w.TROPICAL if w.warmth[i]>.59 else w.MARSH
		elif biome==w.MARSH: biome=w.BAMBOO if w.moisture[i]>.62 else w.TEMPERATE
		elif biome==w.SAVANNA and (w.warmth[i]<.61 or w.moisture[i]>.48): biome=w.MEADOW
		for accent in accents:
			if p.distance_squared_to(accent[0])<.0026: biome=accent[1]
		w.biomes[i]=biome
		if w.terrain[i] in [w.GRASS,w.FOREST]: w.terrain[i]=w.ecology_soil(biome)

static func populate(w, density: float, report: Callable) -> void:
	for y in w.height:
		for x in w.width:
			var i: int = y*w.width+x
			if w.is_water(w.terrain[i]) or x%2!=0 or y%2!=0: continue
			var sample: int = w.hash_cell(x,y,w.world_seed)
			if sample%139==0 or (w.terrain[i]==w.MOUNTAIN and sample%29==0): w.objects[i]=1+sample%2
			elif w.site_available(i) and float(w.hash_cell(x,y,w.world_seed+81)%1000)/1000<density:
				var species: int=w.species_for(i,sample)
				if w.Catalog.is_canopy(species) and not w.fertilizer_space(i,true,2.5): continue
				w.plants[i]=species
				w.plant_age[i]=minf(w.maturity(i)*(.15+float(sample%1000)/220.0),w.lifespan(i)*.76)
				w.plant_stage[i]=w.stage_for(i)
		if y%32==0 and report.is_valid(): report.call(.55+.18*y/w.height,"播撒林木 · 点亮原野")

static func preview(w) -> Image:
	var result: Image = w.image.duplicate()
	result.resize(w.width*2,w.height*2,Image.INTERPOLATE_LANCZOS)
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
	if not w.Catalog.valid(species) or stage<w.YOUNG or stage==w.DEAD: return
	var ground: Color=w.BIOME_COLORS[w.biomes[i]]
	var color: Color=w.Catalog.leaf_color(species).lerp(ground,.12)
	var at=Vector2i((plant_anchor(w,i)*.5).round())-offset
	var bounds=Rect2i(Vector2i.ZERO,target.get_size())
	if not bounds.intersects(Rect2i(at-Vector2i(3,5),Vector2i(7,7))): return
	if w.is_tree(species):
		var sample: int=w.hash_cell(i,species,w.world_seed)
		var key=Vector4i(species,w.biomes[i],int(stage==w.YOUNG),sample%3)
		if w.crown_cache.has(key):
			target.blend_rect(w.crown_cache[key],Rect2i(0,0,7,7),at-Vector2i(3,5))
			return
		var crown=Image.create(7,7,false,Image.FORMAT_RGBA8)
		var radius_value=3.0+float(sample%3)*.15
		if stage==w.YOUNG: radius_value*=.7
		var conifer=species in [3,4,11,24,28,29,30,64,69]
		for py in range(-5,2):
			for px in range(-3,4):
				var inside=Vector2(px,(py+1)*1.08).length()<=radius_value
				if conifer: inside=py>=-4 and py<=0 and absf(px)<=float(py+4)*radius_value/4
				if not inside: continue
				var lit=color.lightened(.10) if px+py<-2 else color.darkened(.19 if px>0 or py==0 else .02)
				crown.set_pixel(px+3,py+5,lit)
		w.crown_cache[key]=crown
		target.blend_rect(crown,Rect2i(0,0,7,7),at-Vector2i(3,5))
	elif bounds.has_point(at) and i%3==0: target.set_pixelv(at,color.lerp(ground,.65))
