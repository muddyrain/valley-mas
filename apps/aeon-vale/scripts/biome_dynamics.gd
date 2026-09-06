extends RefCounted

# Warmth and moisture are persistent environmental conditions, not active weather powers.
const CLIMATES = [Vector2(.53,.48),Vector2(.49,.64),Vector2(.46,.48),Vector2(.14,.48),Vector2(.70,.18),Vector2(.53,.85),Vector2(.55,.61),Vector2(.42,.51),Vector2(.30,.53),Vector2(.72,.35),Vector2(.78,.84),Vector2(.62,.73),Vector2(.55,.55),Vector2(.40,.80),Vector2(.65,.55),Vector2(.38,.44),Vector2(.55,.77),Vector2(.52,.56)]

static func prepare(w) -> void:
	var count: int = w.terrain.size()
	if w.warmth.size()!=count:
		w.warmth.resize(count); w.moisture.resize(count); w.elevation.resize(count)
		for i in count:
			var climate: Vector2 = CLIMATES[w.biomes[i]]
			w.warmth[i]=climate.x; w.moisture[i]=climate.y
			w.elevation[i]=.25 if w.terrain[i]==w.HILLS else (.5 if w.terrain[i]==w.MOUNTAIN else .1)
	w.biome_frontier.clear()
	for i in count:
		if boundary(w,i): w.biome_frontier[i]=true
	w.frontier_dirty=false

static func eligible(w, i: int) -> bool:
	var type: int=w.terrain[i]
	return type==w.GRASS or type==w.FOREST or type==w.HILLS

static func boundary(w,i: int) -> bool:
	if not eligible(w,i): return false
	for p in w.neighbors(i):
		if eligible(w,p) and w.bare_soil[p]==0 and (w.bare_soil[i]>0 or w.biomes[p]!=w.biomes[i]): return true
	return false

static func fitness(w,i: int,biome: int) -> float:
	var climate: Vector2 = CLIMATES[biome]
	var result: float = 1.0-absf(w.warmth[i]-climate.x)*1.2-absf(w.moisture[i]-climate.y)*1.25
	if biome in [w.MARSH,w.TROPICAL]: result-=maxf(0,w.elevation[i]-.18)*.9
	return clampf(result,0,1)

static func step(w) -> void:
	if not w.spread_enabled: return
	if w.frontier_dirty or w.warmth.size()!=w.terrain.size(): prepare(w)
	var changes: Dictionary = {}
	for i in w.biome_frontier:
		# Slower, supported edge growth. A changed cell rests for three years instead
		# of flickering back to the other side at its next random trial.
		var interval=int(w.YEAR_SECONDS/2)
		if w.hash_cell(i,0,w.world_seed+419)%interval!=w.eco_tick%interval: continue
		if w.biome_cooldown.get(i,0)>w.eco_tick: continue
		w.biome_cooldown.erase(i)
		if not eligible(w,i) or w.fires.has(i): continue
		var neighbors: Array[int] = w.neighbors(i)
		var sample: int = w.hash_cell(i,w.eco_tick,w.world_seed+3791)
		var source: int = neighbors[sample%neighbors.size()]
		if not eligible(w,source) or w.bare_soil[source]>0: continue
		var candidate: int = w.biomes[source]
		if candidate==w.biomes[i] and w.bare_soil[i]==0: continue
		var suited = fitness(w,i,candidate)
		var incumbent = fitness(w,i,w.biomes[i]) if w.bare_soil[i]==0 else 0.0
		if suited<.42 or suited<incumbent-.08: continue
		var support = 0
		for p in w.neighbors8(i):
			if eligible(w,p) and w.bare_soil[p]==0 and w.biomes[p]==candidate: support+=1
		if support<(1 if w.bare_soil[i]>0 else 3): continue
		var probability = (.55 if w.bare_soil[i]>0 else .10)+maxf(0,suited-incumbent)*.35+maxi(0,support-4)*.035
		if float(w.hash_cell(i,w.eco_tick,w.world_seed+6151)%1000)/1000<probability: changes[i]=candidate
	# Simultaneous changes avoid an iteration-order wave crossing the island in one step.
	var touched: Dictionary = {}
	for i in changes:
		w.biomes[i]=changes[i]
		w.bare_soil[i]=0
		w.biome_cooldown[i]=w.eco_tick+int(w.YEAR_SECONDS*3)
		w.reconcile_habitat(i)
		touched[i]=true
		for p in w.neighbors(i): touched[p]=true
		# Diagonal tiles also contain shoreline/biome corner pixels.
		for p in w.neighbors8(i): w.surface_dirty_cells[p]=true
		w.surface_dirty_cells[i]=true
	for i in touched:
		if boundary(w,i): w.biome_frontier[i]=true
		else: w.biome_frontier.erase(i)
	if not changes.is_empty():
		w.revision+=1
		w.spread_changes+=changes.size()
		w.refresh_ecology_cells(changes.keys())
