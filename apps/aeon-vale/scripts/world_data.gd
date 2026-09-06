extends RefCounted

const Catalog = preload("res://scripts/plant_catalog.gd")
const Ground = preload("res://scripts/ground_art.gd")
const Brush = preload("res://scripts/brush_mask.gd")
const Forces = preload("res://scripts/natural_forces.gd")
const Landscape = preload("res://scripts/world_landscape.gd")
const Dynamics = preload("res://scripts/biome_dynamics.gd")
const Weather = preload("res://scripts/weather.gd")
const YEAR_SECONDS = 84.0
const FERTILIZER_SECONDS = 45.0
const DEAD_SECONDS = YEAR_SECONDS * .75
const LIGHTNING = 220
const TORNADO = 221
const FIRE = 222
const EARTHQUAKE = 223
const RAIN = 224
const ACID_RAIN = 225
const RIFT = 14

const DEEP = 0
const OCEAN = 1
const SHALLOW = 2
const BEACH = 3
const GRASS = 4
const FOREST = 5
const AUTUMN = 6
const SNOW = 7
const DESERT = 8
const WETLAND = 9
const MOUNTAIN = 10
const BLOSSOM = 11
const RIVER = 12
const HILLS = 13
const TILE = 4
const NAMES = ["深海", "近海", "浅滩", "沙滩", "平原土壤", "森林土壤", "秋林", "雪原", "沙漠", "湿地", "山峰", "花林", "河流", "丘陵", "地裂"]
const COLORS = [Color("3066ae"), Color("4389ce"), Color("79bedf"), Color("e3dca3"), Color("88aa4e"), Color("548441"), Color("bcb04b"), Color("d7e1d7"), Color("cdb25f"), Color("759879"), Color("555e59"), Color("83a651"), Color("65b1d9"), Color("6e8051"), Color("36392f")]
const MEADOW = 0
const TEMPERATE = 1
const GOLDEN = 2
const TUNDRA = 3
const ARID = 4
const MARSH = 5
const SAKURA = 6
const BIRCH = 7
const CONIFER = 8
const SAVANNA = 9
const TROPICAL = 10
const BAMBOO = 11
const FLOWERLAND = 12
const MUSHROOM = 13
const CITRUS = 14
const CRYSTAL = 15
const JADE = 16
const SWEET = 17
const BIOME_NAMES = ["草原", "温带森林", "金色秋林", "雪地", "干旱荒原", "湿地", "樱花林", "桦木林", "针叶林", "热带草原", "热带雨林", "竹林", "花海", "蘑菇林", "晨光果林", "水晶原野", "翡翠林", "糖霜林"]
const BIOME_COLORS = [Color("83aa49"), Color("40733b"), Color("b4a34a"), Color("ccdcd3"), Color("cfb96d"), Color("668a77"), Color("86a750"),Color("8eae51"),Color("4d7956"),Color("bfad59"),Color("4b955f"),Color("719b72"),Color("9aad68"),Color("78858a"),Color("b8bc6c"),Color("6eadae"),Color("488c7c"),Color("c89da6")]
const BIOME_TOOLS = 50
const PLANT_TOOLS = 100
const CLEAR_PLANTS = 200
const GRASS_SEEDS = 201
const BERRY_SEEDS = 202
const PLANT_FERTILIZER = 203
const TREE_FERTILIZER = 204
const ROCK_TOOL = 205
const BOULDER_TOOL = 206
const COMBO_TOOLS = 300
const SEED = 0
const SPROUT = 1
const YOUNG = 2
const ADULT = 3
const OLD = 4
const DEAD = 5
const FLOWER = 15
const BERRY = 16
const HERB = 17
const REED = 18
const SNOW_SHRUB = 19
const DRY_SHRUB = 20
const SITE_DENSITY = [49,77,72,53,43,66,69,69,76,41,84,77,66,67,66,60,71,63]
const BIOME_SPECIES = Catalog.BIOMES
const CANOPY_SHARE = [24,76,70,60,34,48,67,72,76,30,74,72,10,42,64,42,68,62]

var width: int = 0
var height: int = 0
var world_seed: int = 0
var world_name: String = "初生之谷"
var template: String = "continent"
var terrain: PackedByteArray = PackedByteArray()
var plants: PackedByteArray = PackedByteArray()
var biomes: PackedByteArray = PackedByteArray()
var objects: PackedByteArray = PackedByteArray()
var quake_scars: PackedByteArray = PackedByteArray()
# Bare soil has no active ecology; the climate biome remains available for old saves.
var bare_soil: PackedByteArray = PackedByteArray()
var plant_stage: PackedByteArray = PackedByteArray()
var plant_age: PackedFloat32Array = PackedFloat32Array()
var boost: PackedFloat32Array = PackedFloat32Array()
var eco_tick: int = 0
var eco_remainder: float = 0
var births: int = 0
var deaths: int = 0
var visual_events: Array = []
var casting: bool = false
var crown_cache: Dictionary = {}
var maturity_values: PackedFloat32Array = []
var biome_suitability: Array[PackedByteArray] = []
var grove_trees: Array[Array] = []
var grove_understory: Array[Array] = []
var dirty_rows: Dictionary = {}
var ecology_sites: Array[int] = []
var ecology_rows: Dictionary = {}
var colonizable: PackedByteArray = PackedByteArray()
var site_dirty_rows: Dictionary = {}
var legacy_sites: Dictionary = {}
var life_limit: PackedFloat32Array = PackedFloat32Array()
var ground_cache: Dictionary = {}
var mountain_cache: Dictionary = {}
var ground_noise: FastNoiseLite
var ridge_noise: FastNoiseLite
var age: float = 0.0
var image: Image
var surface_revision: int = 0
var undo_stack: Array = []
var redo_stack: Array = []
var stroke: Dictionary = {}
var revision: int = 0
var fires: Dictionary = {}
var tornadoes: Array = []
var rain_clouds: Array = []
var fair_clouds: Array = []
var fair_due: int = 12
var fair_cycle: int = 0
var weather_enabled: bool = true
var weather_due: int = int(YEAR_SECONDS*2)
var weather_cycle: int = 0
var disaster_events: Array = []
var stroke_changed = false
var generation_settings: Dictionary = {}
var spread_enabled: bool = false
var warmth: PackedFloat32Array = PackedFloat32Array()
var moisture: PackedFloat32Array = PackedFloat32Array()
var elevation: PackedFloat32Array = PackedFloat32Array()
var biome_frontier: Dictionary = {}
var biome_cooldown: Dictionary = {}
var frontier_dirty: bool = true
var surface_dirty_cells: Dictionary = {}
var surface_pending_cells: Dictionary = {}
var defer_surface: bool = false
var spread_changes: int = 0

func _init() -> void:
	maturity_values.resize(Catalog.MAX_ID+1)
	for species in maturity_values.size():
		var sample=hash_cell(species,0,871)
		maturity_values[species]=(180.0+sample%121 if is_tree(species) else (60.0+sample%61 if Catalog.is_shrub(species) else 30.0+sample%31))*YEAR_SECONDS/60.0
	for biome in BIOME_SPECIES:
		var mask=PackedByteArray(); mask.resize(Catalog.MAX_ID+1)
		for species in biome: mask[species]=1
		biome_suitability.append(mask)
	for biome in BIOME_SPECIES.size():
		var trees: Array=[]; var understory: Array=[]
		for species in Catalog.DOMINANT[biome]:
			if Catalog.is_canopy(species): trees.append(species)
		for species in BIOME_SPECIES[biome]:
			if not Catalog.is_canopy(species): understory.append(species)
		if trees.is_empty():
			for species in BIOME_SPECIES[biome]:
				if Catalog.is_canopy(species): trees.append(species)
		grove_trees.append(trees); grove_understory.append(understory)

static func noise_for(seed_value: int, frequency: float, octaves: int = 3) -> FastNoiseLite:
	var noise = FastNoiseLite.new()
	noise.seed = seed_value
	noise.frequency = frequency
	noise.fractal_octaves = octaves
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	return noise

static func hash_cell(x: int, y: int, seed_value: int) -> int:
	# Avalanche each coordinate before sampling; simple linear hashes produce visible stripes.
	var value = (x * 73856093 ^ y * 19349663 ^ seed_value * 83492791) & 0xffffffff
	value = ((value ^ (value >> 16)) * 0x45d9f3b) & 0xffffffff
	value = ((value ^ (value >> 16)) * 0x45d9f3b) & 0xffffffff
	return (value ^ (value >> 16)) & 0xffff

static func supports_plant(type: int, sprite: int) -> bool:
	if type <= SHALLOW or type == RIVER:
		return false
	if sprite >= 12:
		return true
	if type == DESERT:
		return sprite == 9 or sprite == 8
	if type == BEACH:
		return sprite == 8
	if type == SNOW:
		return sprite == 3 or sprite == 2
	if type == MOUNTAIN:
		return sprite == 2 or sprite == 10
	return sprite != 9 and sprite != 3

static func generate(config: Dictionary, report: Callable = Callable()):
	var world = new()
	world.width = clampi(int(config.get("width", 288)), 32, 512)
	world.height = clampi(int(config.get("height", 192)), 32, 384)
	world.world_seed = int(config.get("seed", 48217))
	world.world_name = str(config.get("name", "初生之谷")).strip_edges().left(32)
	if world.world_name.is_empty(): world.world_name = "初生之谷"
	world.template = str(config.get("template", "continent"))
	var count = world.width * world.height
	world.terrain.resize(count)
	world.plants.resize(count)
	world.plants.fill(0)
	world.initialize_life_arrays()
	world.prepare_noise()
	Landscape.build(world,config,report)
	world.prepare_ecology()
	world.image = world.bake_image(report)
	if report.is_valid(): report.call(1.0, "万物就绪")
	return world

func carve_rivers(heights: PackedFloat32Array) -> void:
	var distance = PackedInt32Array()
	distance.resize(terrain.size())
	distance.fill(-1)
	var queue: Array[int] = []
	for i in terrain.size():
		if terrain[i] <= SHALLOW:
			distance[i] = 0
			queue.append(i)
	var cursor = 0
	while cursor < queue.size():
		var i = queue[cursor]
		cursor += 1
		for p in neighbors(i):
			if distance[p] == -1:
				distance[p] = distance[i] + 1
				queue.append(p)
	var sources: Array[int] = []
	for attempt in 3:
		var best = -1
		var score = 0.0
		for i in terrain.size():
			if distance[i] < 6: continue
			var near_source = false
			for source in sources:
				if Vector2(i % width - source % width, i / width - source / width).length() < width * 0.17:
					near_source = true
			if near_source: continue
			var candidate = heights[i] + distance[i] * 0.009
			if candidate > score:
				best = i
				score = candidate
		if best == -1: break
		sources.append(best)
		var current = best
		var visited: Dictionary = {}
		var sideways = 0
		var bends = noise_for(world_seed + attempt * 91, 0.10, 2)
		while distance[current] > 0:
			visited[current] = true
			terrain[current] = RIVER
			var radius = 1.0 + 0.5 * (1.0 - float(distance[current]) / maxi(1, distance[best]))
			for dy in range(-3, 4):
				for dx in range(-3, 4):
					if Vector2(dx, dy).length() > radius: continue
					var point = Vector2i(current % width + dx, current / width + dy)
					if Rect2i(0, 0, width, height).has_point(point):
						var p = point.y * width + point.x
						if terrain[p] > SHALLOW: terrain[p] = RIVER
			var next = -1
			var lowest = INF
			for p in neighbors8(current):
				if visited.has(p) or distance[p] > distance[current]: continue
				if sideways >= 3 and distance[p] == distance[current]: continue
				var value = distance[p] * 0.008 + heights[p] * 0.4 + bends.get_noise_2d(p % width, p / width) * 0.14
				if value < lowest:
					lowest = value
					next = p
			if next == -1: break
			sideways = sideways + 1 if distance[next] == distance[current] else 0
			current = next
	# Sand belongs to the bank; it never replaces the channel or changes player-painted rivers.
	var banks: Dictionary = {}
	for i in terrain.size():
		if terrain[i] != RIVER: continue
		for p in neighbors(i):
			if not is_water(terrain[p]): banks[p] = true
	for i in banks: terrain[i] = BEACH

func neighbors8(index: int) -> Array[int]:
	var result = neighbors(index)
	var x = index%width
	var y = index/width
	for dy in [-1,1]:
		for dx in [-1,1]:
			if x+dx>=0 and x+dx<width and y+dy>=0 and y+dy<height: result.append((y+dy)*width+x+dx)
	return result

func flush_surface_changes() -> void:
	if surface_dirty_cells.is_empty(): return
	if defer_surface:
		surface_pending_cells.merge(surface_dirty_cells)
	elif image != null:
		for i in surface_dirty_cells:
			draw_tile(image,i%width,i/width)
	surface_dirty_cells.clear()
	surface_revision+=1

func flush_pending_surface() -> void:
	surface_dirty_cells.merge(surface_pending_cells)
	surface_pending_cells.clear()
	flush_surface_changes()

func neighbors(index: int) -> Array[int]:
	var result: Array[int] = []
	var x = index % width
	var y = index / width
	if x > 0: result.append(index - 1)
	if x < width - 1: result.append(index + 1)
	if y > 0: result.append(index - width)
	if y < height - 1: result.append(index + width)
	return result

func bake_image(report: Callable = Callable()) -> Image:
	var result = Image.create(width * Ground.PIXELS, height * Ground.PIXELS, false, Image.FORMAT_RGBA8)
	for y in height:
		for x in width: draw_tile(result, x, y)
		if y % 24 == 0 and report.is_valid(): report.call(0.75 + 0.24 * y / height, "描绘山川 · 整理世界")
	return result

func draw_tile(target: Image, x: int, y: int) -> void:
	if ground_noise == null: prepare_noise()
	Ground.paint(target, self, x, y)

func begin_stroke() -> void:
	stroke = {}
	stroke_changed = false

func brush_cells(center: Vector2i, radius: int, shape: int = 0) -> Array[Vector2i]:
	return Brush.cells(center,clampi(radius,0,16),shape,Vector2i(width,height))

func paint(center: Vector2i, radius: int, tool: int, shape: int = 0) -> Rect2i:
	radius = clampi(radius,0,16)
	if tool in [LIGHTNING,TORNADO,FIRE,EARTHQUAKE,RAIN,ACID_RAIN]: return Forces.cast(self,center,radius,shape,tool)
	if tool == GRASS_SEEDS: tool = BIOME_TOOLS + MEADOW
	var surface_changed = false
	var area = Rect2i(center-Vector2i.ONE*radius,Vector2i.ONE*(radius*2+1)).intersection(Rect2i(0,0,width,height))
	if not area.has_area(): return Rect2i()
	if tool in [PLANT_FERTILIZER,TREE_FERTILIZER]: return fertilize_brush(center,radius,shape,tool,area)
	casting=true
	var low = area.position
	var high = area.end-Vector2i.ONE
	for y in range(low.y, high.y + 1):
		for x in range(low.x, high.x + 1):
			if not Brush.contains(Vector2i(x-center.x,y-center.y),radius,shape,Vector2i(x,y)): continue
			var i = y * width + x
			if not tool_affects(i, tool): continue
			var previous = cell_state(i)
			if tool<=HILLS or (tool>=BIOME_TOOLS and tool<BIOME_TOOLS+BIOME_NAMES.size()) or (tool>=COMBO_TOOLS and tool<COMBO_TOOLS+BIOME_NAMES.size()):
				quake_scars[i]=0
			if tool == CLEAR_PLANTS:
				remove_plant(i, "clear")
			elif tool in [GRASS_SEEDS, BERRY_SEEDS]:
				sow(i, HERB if tool == GRASS_SEEDS else BERRY)
				if tool==BERRY_SEEDS:
					plant_age[i]=maturity(i); plant_stage[i]=ADULT
					emit_visual(i,"appear")
			elif tool in [ROCK_TOOL, BOULDER_TOOL]:
				if not is_water(terrain[i]) and x % 2 == 0 and y % 2 == 0:
					remove_plant(i, "clear")
					objects[i] = 1 if tool == ROCK_TOOL else 2
			elif tool >= COMBO_TOOLS and tool < COMBO_TOOLS + BIOME_NAMES.size():
				terrain[i] = FOREST if tool - COMBO_TOOLS in [TEMPERATE, GOLDEN, SAKURA, MARSH] else GRASS
				biomes[i] = tool - COMBO_TOOLS
				bare_soil[i] = 0
				reconcile_habitat(i)
			elif tool >= PLANT_TOOLS and tool < PLANT_TOOLS + Catalog.MAX_ID:
				var species = tool - PLANT_TOOLS + 1
				if species in [13, 14]:
					if not is_water(terrain[i]) and x % 2 == 0 and y % 2 == 0:
						remove_plant(i, "clear")
						objects[i] = species - 12
				else: sow(i, species)
			elif tool >= BIOME_TOOLS and tool < BIOME_TOOLS + BIOME_NAMES.size():
				if not is_water(terrain[i]):
					biomes[i] = tool - BIOME_TOOLS
					bare_soil[i] = 0
					reconcile_habitat(i)
			else:
				terrain[i] = soil_from_legacy(clampi(tool, DEEP, HILLS))
				if elevation.size()>i:
					elevation[i]={DEEP:-.8,OCEAN:-.4,SHALLOW:-.1,BEACH:0.0,GRASS:.10,FOREST:.17,HILLS:.32,MOUNTAIN:.65,RIVER:-.1}.get(terrain[i],.1)
				bare_soil[i] = int(tool in [GRASS,FOREST] or (tool==HILLS and (is_water(previous[0]) or previous[8]>0)))
				if tool in [AUTUMN, SNOW, DESERT, WETLAND, BLOSSOM]: biomes[i] = biome_from_legacy(tool)
				reconcile_habitat(i)
			var after = cell_state(i)
			if previous != after:
				if previous[0] != after[0] or previous[1] != after[1] or previous[7]!=after[7] or previous[8]!=after[8]: surface_changed = true
				if not stroke.has(i): stroke[i] = {"before": previous, "after": after}
				else: stroke[i].after = after
				dirty_rows[y / 8] = true
				if previous[0] != after[0] or previous[1] != after[1] or previous[6] != after[6] or previous[8]!=after[8]: site_dirty_rows[y / 8] = true
	var affected = Rect2i(low, high - low + Vector2i.ONE).grow(1).intersection(Rect2i(0, 0, width, height))
	if surface_changed: refresh_tiles(affected)
	casting=false
	return Rect2i(affected.position * TILE, affected.size * TILE)

func fertilize_brush(center: Vector2i, radius: int, shape: int, tool: int, area: Rect2i) -> Rect2i:
	fertilize_cells(brush_cells(center,radius,shape),tool)
	return Rect2i(area.position*TILE,area.size*TILE)

func fertilize_path(path: Array[Vector2i], radius: int, shape: int, tool: int) -> Rect2i:
	var covered: Dictionary={}
	var previous=path[0]
	for next in path:
		# Overlapping stamps follow path distance, not frame rate. Small brushes retain every cell.
		var spacing=maxf(1,radius*.25)
		var steps=maxi(1,ceili(maxi(absi(next.x-previous.x),absi(next.y-previous.y))/spacing))
		for n in range(steps+1):
			var center=Vector2i(Vector2(previous).lerp(Vector2(next),float(n)/steps).round())
			for cell in brush_cells(center,radius,shape): covered[cell]=true
		previous=next
	var cells: Array[Vector2i]=[]; cells.assign(covered.keys())
	fertilize_cells(cells,tool)
	if cells.is_empty(): return Rect2i()
	var bounds=cell_bounds(cells)
	return Rect2i(bounds.position*TILE,bounds.size*TILE)

func cell_bounds(cells: Array[Vector2i]) -> Rect2i:
	var low=cells[0]; var high=low
	for cell in cells: low=low.min(cell); high=high.max(cell)
	return Rect2i(low,high-low+Vector2i.ONE)

func fertilizer_obstacles(cells: Array[Vector2i], trees: bool) -> PackedByteArray:
	var blocked=PackedByteArray(); blocked.resize(terrain.size())
	if cells.is_empty(): return blocked
	var bounds=cell_bounds(cells).grow(3 if trees else 1).intersection(Rect2i(0,0,width,height))
	for y in range(bounds.position.y,bounds.end.y):
		for x in range(bounds.position.x,bounds.end.x):
			var i=y*width+x
			if plants[i]>0 and not retired_plant(i) and (not trees or Catalog.is_canopy(plants[i])): block_fertilizer_site(blocked,i,trees)
	return blocked

func block_fertilizer_site(blocked: PackedByteArray, i: int, trees: bool) -> void:
	var distance=4 if trees else 2; var x=i%width; var y=i/width
	for dy in range(-distance+1,distance):
		for dx in range(-distance+1,distance):
			if (dx==0 and dy==0) or dx*dx+dy*dy>=distance*distance: continue
			if x+dx>=0 and x+dx<width and y+dy>=0 and y+dy<height: blocked[(y+dy)*width+x+dx]=1

func fertilizer_target(i: int, trees: bool, blocked: PackedByteArray) -> int:
	if objects[i]>0 or fires.has(i): return 0
	if plants[i]>0 and not retired_plant(i) and not (trees and Catalog.is_ground_cover(plants[i])):
		return plants[i] if plant_stage[i]<ADULT and Catalog.is_canopy(plants[i])==trees and can_live(i,plants[i]) else 0
	return fertilizer_species(i,trees,blocked)

func preview_for(cells: Array[Vector2i], selected: int) -> Array:
	var result=[]
	var fertilizer=selected in [PLANT_FERTILIZER,TREE_FERTILIZER]
	var trees=selected==TREE_FERTILIZER
	var blocked=fertilizer_obstacles(cells,trees) if fertilizer else PackedByteArray()
	for cell in cells:
		var i=cell.y*width+cell.x
		result.append([cell,fertilizer_target(i,trees,blocked)>0 if fertilizer else tool_affects(i,selected)])
	return result

func fertilize_cells(cells: Array[Vector2i], tool: int) -> void:
	if cells.is_empty(): return
	var trees=tool==TREE_FERTILIZER
	casting=true
	# Clear the whole covered area before constructing the spacing mask. Otherwise
	# a dead tree would continue to block the new trees beside its former location.
	for p in cells:
		var i=p.y*width+p.x
		if terrain[i] not in [GRASS,FOREST,HILLS] or objects[i]>0 or fires.has(i) or not retired_plant(i): continue
		var previous=cell_state(i)
		remove_plant(i,"decay")
		if not stroke.has(i): stroke[i]={"before":previous,"after":cell_state(i)}
		else: stroke[i].after=cell_state(i)
	var blocked=fertilizer_obstacles(cells,trees)
	# Sort precomputed integer priorities, without a script callback for each comparison.
	var ordered=PackedInt64Array()
	for p in cells: ordered.append((hash_cell(p.x,p.y,world_seed+385)<<18)+(p.y*width+p.x))
	ordered.sort()
	casting=true
	for ranked in ordered:
		var i=ranked&262143
		var species=fertilizer_target(i,trees,blocked)
		if species==0: continue
		var previous=cell_state(i)
		if plants[i]==0 or (trees and Catalog.is_ground_cover(plants[i])):
			if plants[i]>0: remove_plant(i,"fade")
			sow(i,species,true)
			block_fertilizer_site(blocked,i,trees)
		plant_age[i]=maturity(i); plant_stage[i]=ADULT; boost[i]=0
		emit_visual(i,"fertilize")
		if not stroke.has(i): stroke[i]={"before":previous,"after":cell_state(i)}
		else: stroke[i].after=cell_state(i)
	casting=false

func refresh_tiles(rect: Rect2i) -> void:
	frontier_dirty = true
	if image == null: return
	surface_revision += 1
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			if defer_surface: surface_pending_cells[y*width+x]=true
			else:
				draw_tile(image, x, y)

func end_stroke() -> bool:
	if stroke.is_empty() and not stroke_changed: return false
	refresh_ecology_sites()
	undo_stack.append(stroke)
	if undo_stack.size() > 24: undo_stack.pop_front()
	redo_stack.clear()
	stroke = {}
	revision += 1
	return true

func restore_edit(edit: Dictionary, side: String) -> void:
	var low = Vector2i(width, height)
	var high = Vector2i.ZERO
	for i in edit:
		var state: Array = edit[i][side]
		terrain[i] = state[0]
		biomes[i] = state[1]
		plants[i] = state[2]
		plant_stage[i] = state[3]
		plant_age[i] = state[4]
		boost[i] = state[5]
		objects[i] = state[6]
		quake_scars[i] = state[7]
		bare_soil[i] = state[8]
		if elevation.size()>i: elevation[i] = state[9]
		life_limit[i] = 0
		site_dirty_rows[(i / width) / 8] = true
		low = low.min(Vector2i(i % width, i / width))
		high = high.max(Vector2i(i % width, i / width))
	refresh_tiles(Rect2i(low, high - low + Vector2i.ONE).grow(1).intersection(Rect2i(0, 0, width, height)))
	visual_events.clear()
	refresh_ecology_sites()
	revision += 1

func undo() -> bool:
	if undo_stack.is_empty(): return false
	var edit = undo_stack.pop_back()
	restore_edit(edit, "before")
	redo_stack.append(edit)
	return true

func redo() -> bool:
	if redo_stack.is_empty(): return false
	var edit = redo_stack.pop_back()
	restore_edit(edit, "after")
	undo_stack.append(edit)
	return true

func plant_count() -> int:
	var count = 0
	for i in plants.size():
		if plants[i] > 0 and plant_stage[i] != DEAD: count += 1
	return count

static func is_water(type: int) -> bool:
	return type <= SHALLOW or type == RIVER

static func is_tree(species: int) -> bool:
	return Catalog.is_tree(species)

static func soil_from_legacy(type: int) -> int:
	if type in [AUTUMN, WETLAND, BLOSSOM]: return FOREST
	if type in [SNOW, DESERT]: return GRASS
	return type

static func biome_from_legacy(type: int) -> int:
	return {FOREST: TEMPERATE, AUTUMN: GOLDEN, SNOW: TUNDRA, DESERT: ARID, WETLAND: MARSH, BLOSSOM: SAKURA}.get(type, MEADOW)

func initialize_life_arrays() -> void:
	var count = width * height
	biomes.resize(count)
	objects.resize(count)
	quake_scars.resize(count)
	bare_soil.resize(count)
	plant_stage.resize(count)
	plant_age.resize(count)
	boost.resize(count)
	colonizable.resize(count)
	life_limit.resize(count)

func prepare_noise() -> void:
	ground_noise = noise_for(world_seed + 715, 0.045, 2)
	ridge_noise = noise_for(world_seed + 291, 0.145, 2)

func prepare_ecology() -> void:
	prepare_noise()
	Dynamics.prepare(self)
	legacy_sites.clear()
	for i in plants.size():
		if plants[i]>0 and (i%width%2!=0 or (i/width)%2!=0):
			var group=int(i/width)/8
			if not legacy_sites.has(group): legacy_sites[group]=[]
			legacy_sites[group].append(i)
	for group in ceili(height / 8.0): site_dirty_rows[group] = true
	refresh_ecology_sites()

func refresh_ecology_sites() -> void:
	if site_dirty_rows.is_empty(): return
	for group in site_dirty_rows:
		var sites: Array[int] = []
		for y in range(group * 8, mini(height, group * 8 + 8),2):
			for x in range(0,width,2):
				var i = y * width + x
				colonizable[i] = int(site_available(i))
				if colonizable[i] > 0 or plants[i] > 0: sites.append(i)
		for i in legacy_sites.get(group,[]):
			if plants[i]>0: sites.append(i)
		if legacy_sites.has(group): sites.sort()
		ecology_rows[group] = sites
	ecology_sites.clear()
	for group in ceili(height / 8.0): ecology_sites.append_array(ecology_rows.get(group, []))
	site_dirty_rows.clear()

func can_live(i: int, species: int) -> bool:
	if bare_soil[i]>0 or is_water(terrain[i]) or terrain[i] == RIFT or not Catalog.valid(species): return false
	if terrain[i] == BEACH:
		return species in [SNOW_SHRUB,41,42] if biomes[i] == TUNDRA else species in [9,DRY_SHRUB,43,44,45,48]
	if terrain[i] == MOUNTAIN:
		if biomes[i] == ARID: return species in [DRY_SHRUB,30,43,45]
		return species in [3,4,SNOW_SHRUB,28,29,30,41,42] if biomes[i] == TUNDRA else species in [3,11,24,29,30,35,40]
	return biome_suitability[biomes[i]][species]>0

func refresh_ecology_cells(indices: Array) -> void:
	var groups: Dictionary={}
	for i in indices:
		var group: int=int(i/width)/8
		var sites: Array[int]=ecology_rows.get(group,[])
		colonizable[i]=int(site_available(i))
		if colonizable[i]>0 or plants[i]>0:
			if not sites.has(i): sites.append(i)
		else: sites.erase(i)
		ecology_rows[group]=sites; groups[group]=true
	# Stable ordering also makes save/load continuation independent of cache history.
	for group in groups: ecology_rows[group].sort()
	ecology_sites.clear()
	for group in ceili(height/8.0): ecology_sites.append_array(ecology_rows.get(group,[]))

func species_for(i: int, sample: int) -> int:
	if terrain[i] == BEACH:
		var shore = [SNOW_SHRUB,41,42] if biomes[i] == TUNDRA else [9,DRY_SHRUB,43,44,45,48]
		return shore[sample % shore.size()]
	if terrain[i] == MOUNTAIN:
		var peaks = [DRY_SHRUB,30,43,45] if biomes[i] == ARID else ([4,3,19,28,29,30,41,42] if biomes[i] == TUNDRA else [3,11,24,29,30,35,40])
		return peaks[sample % peaks.size()]
	var choices: Array = BIOME_SPECIES[biomes[i]]
	if sample%100<4: return choices[(sample/100)%choices.size()]
	return grove_species(i,sample%100<CANOPY_SHARE[biomes[i]])

func grove_species(i: int, canopy: bool) -> int:
	var choices: Array=grove_trees[biomes[i]] if canopy else grove_understory[biomes[i]]
	if choices.is_empty(): choices=BIOME_SPECIES[biomes[i]]
	var x=i%width; var y=i/width
	# Nearby plants share a dominant species. Small accents remain possible without
	# giving every neighbouring tree an unrelated palette and silhouette.
	var grove=ground_noise.get_noise_2d(x*.55+711,y*.55+199) if ground_noise!=null else 0.0
	var index=clampi(int((grove+.5)*choices.size()),0,choices.size()-1)
	return choices[index]

func tool_affects(i: int, selected: int) -> bool:
	if i < 0 or i >= terrain.size() or selected < 0: return false
	if selected == GRASS_SEEDS: selected = BIOME_TOOLS + MEADOW
	if selected == FIRE: return not is_water(terrain[i]) and plants[i] > 0
	if selected == LIGHTNING: return true
	if selected == TORNADO: return true
	if selected == EARTHQUAKE: return true
	if selected in [RAIN,ACID_RAIN]: return true
	if quake_scars[i]>0 and (selected<=HILLS or (terrain[i] in [GRASS,FOREST,HILLS] and selected>=BIOME_TOOLS and selected<BIOME_TOOLS+BIOME_NAMES.size())): return true
	if selected == CLEAR_PLANTS: return plants[i] > 0
	if selected in [PLANT_FERTILIZER, TREE_FERTILIZER]:
		return fertilizer_target(i,selected==TREE_FERTILIZER,PackedByteArray())>0
	var species = 0
	if selected == GRASS_SEEDS: species = HERB
	elif selected == BERRY_SEEDS: species = BERRY
	elif selected >= PLANT_TOOLS and selected < PLANT_TOOLS + Catalog.MAX_ID: species = selected - PLANT_TOOLS + 1
	if species > 0 and species not in [13,14]:
		return plants[i] == 0 and objects[i] == 0 and can_live(i, species) and i % width % 2 == 0 and (i / width) % 2 == 0
	if selected in [ROCK_TOOL, BOULDER_TOOL] or species in [13,14]:
		var object = (species - 12) if species > 0 else (1 if selected == ROCK_TOOL else 2)
		return not is_water(terrain[i]) and i % width % 2 == 0 and (i / width) % 2 == 0 and objects[i] != object
	if selected >= COMBO_TOOLS and selected < COMBO_TOOLS + BIOME_NAMES.size():
		var biome = selected - COMBO_TOOLS
		var soil = FOREST if biome in [TEMPERATE,GOLDEN,SAKURA,MARSH] else GRASS
		return terrain[i] != soil or biomes[i] != biome or bare_soil[i]>0
	if selected >= BIOME_TOOLS and selected < BIOME_TOOLS + BIOME_NAMES.size():
		return terrain[i] in [GRASS,FOREST,HILLS] and (bare_soil[i]>0 or biomes[i] != selected-BIOME_TOOLS)
	if selected <= HILLS:
		return (selected in [GRASS,FOREST] and bare_soil[i]==0) or terrain[i] != soil_from_legacy(selected) or (selected in [AUTUMN,SNOW,DESERT,WETLAND,BLOSSOM] and biomes[i] != biome_from_legacy(selected))
	return false

func fertilizer_species(i: int, trees: bool, blocked: PackedByteArray=PackedByteArray()) -> int:
	if bare_soil[i]>0 or objects[i]>0 or terrain[i] not in [GRASS,FOREST,HILLS] or fires.has(i): return 0
	if plants[i]>0 and not retired_plant(i) and not (trees and Catalog.is_ground_cover(plants[i])): return 0
	if not blocked.is_empty():
		if blocked[i]>0: return 0
	elif not fertilizer_space(i,trees): return 0
	var choices: Array=BIOME_SPECIES[biomes[i]]
	var sample=hash_cell(i,biomes[i],world_seed+385)
	# Start from the ecological choice, then find a member of the requested plant family.
	var dominant=grove_species(i,trees)
	if Catalog.is_canopy(dominant)==trees and can_live(i,dominant): return dominant
	for offset in choices.size():
		var species: int=choices[(sample+offset)%choices.size()]
		if Catalog.is_canopy(species)==trees and can_live(i,species): return species
	return 0

func fertilizer_space(i: int, trees: bool, spacing: float=0) -> bool:
	var distance=spacing if spacing>0 else (4 if trees else 2)
	var x=i%width; var y=i/width
	for dy in range(-ceili(distance)+1,ceili(distance)):
		for dx in range(-ceili(distance)+1,ceili(distance)):
			if (dx==0 and dy==0) or dx*dx+dy*dy>=distance*distance: continue
			if x+dx<0 or x+dx>=width or y+dy<0 or y+dy>=height: continue
			var at=(y+dy)*width+x+dx; var other=plants[at]
			if other>0 and not retired_plant(at) and (not trees or Catalog.is_canopy(other)): return false
	return true

func retired_plant(i: int) -> bool:
	return plants[i]>0 and (plant_stage[i]==DEAD or not can_live(i,plants[i]))

func invalid_cast_site(i: int, selected: int) -> bool:
	if selected in [PLANT_FERTILIZER,TREE_FERTILIZER]:
		return bare_soil[i]>0 or terrain[i] not in [GRASS,FOREST,HILLS] or objects[i]>0 or fires.has(i)
	return not tool_affects(i,selected)

func decay_duration(i: int) -> float:
	# Stagger the release of former tree sites; this is world time, never camera time.
	return DEAD_SECONDS*(.65+float(hash_cell(i,plants[i],world_seed+197)%351)/1000.0)

func site_available(i: int) -> bool:
	if bare_soil[i]>0 or is_water(terrain[i]) or terrain[i] == RIFT or objects[i] > 0: return false
	var x = i % width
	var y = i / width
	if x % 2 != 0 or y % 2 != 0: return false
	var threshold = SITE_DENSITY[biomes[i]]
	if terrain[i] == BEACH: threshold = 14
	if terrain[i] == MOUNTAIN: threshold = 7
	var grove = int((ground_noise.get_noise_2d(x*.55,y*.55)+.5)*24) if ground_noise != null else 12
	return hash_cell(x, y, world_seed + 177) % 100 < threshold - grove

static func ecology_soil(biome: int) -> int:
	return GRASS if biome in [MEADOW,TUNDRA,ARID,SAVANNA,FLOWERLAND] else FOREST

func maturity(i: int) -> float:
	return maturity_values[plants[i]]

func lifespan(i: int) -> float:
	if life_limit[i] == 0:
		var sample = hash_cell(i%width,i/width,world_seed)
		life_limit[i] = (35.0+sample%46)*YEAR_SECONDS if is_tree(plants[i]) else (4.0+sample%7)*YEAR_SECONDS
	return life_limit[i]

func stage_for(i: int) -> int:
	var seconds = plant_age[i]
	if seconds < YEAR_SECONDS*.1: return SEED
	if seconds < maxf(YEAR_SECONDS*.15,maturity(i)*.18): return SPROUT
	if seconds < maturity(i): return YOUNG
	if seconds < lifespan(i)*.78: return ADULT
	return OLD

func migrate_legacy_time() -> void:
	# Piecewise mapping preserves stage and progress, including a dead tree's decay.
	age *= YEAR_SECONDS/12.0
	for i in plants.size():
		if plants[i] == 0: continue
		var old_age = plant_age[i]
		if plant_stage[i] == DEAD:
			plant_age[i] = minf(old_age/24.0,.999)*DEAD_SECONDS
			continue
		var old_life = (230.0 if is_tree(plants[i]) else 125.0)+hash_cell(i%width,i/width,world_seed)%130
		var old_bounds = [0.0,2.0,10.0 if is_tree(plants[i]) else 5.0,44.0 if is_tree(plants[i]) else 18.0,old_life*.78,old_life]
		var new_bounds = [0.0,YEAR_SECONDS*.1,maxf(YEAR_SECONDS*.15,maturity(i)*.18),maturity(i),lifespan(i)*.78,lifespan(i)]
		var stage = clampi(plant_stage[i],0,4)
		var progress = clampf((old_age-old_bounds[stage])/(old_bounds[stage+1]-old_bounds[stage]),0,.999)
		plant_age[i] = lerpf(new_bounds[stage],new_bounds[stage+1],progress)
		boost[i] = boost[i]/18.0*FERTILIZER_SECONDS

func migrate_sixty_second_calendar() -> void:
	# Calendar/life units change; simulation ticks, fire and active cloud seconds do not.
	var factor=YEAR_SECONDS/60.0
	age*=factor
	for i in plants.size():
		if plants[i]>0: plant_age[i]*=factor

func cell_state(i: int) -> Array:
	return [terrain[i], biomes[i], plants[i], plant_stage[i], plant_age[i], boost[i], objects[i], quake_scars[i], bare_soil[i], elevation[i] if elevation.size()>i else 0.0]

func emit_visual(i: int, kind: String) -> void:
	dirty_rows[(i / width) / 8] = true
	if visual_events.size() < 256: visual_events.append({"cell": i, "kind": kind, "species": plants[i], "stage": plant_stage[i], "active":casting})

func sow(i: int, species: int, active_site: bool=false) -> void:
	if plants[i] > 0 or objects[i] > 0 or not can_live(i, species): return
	var odd_site=i%width%2!=0 or (i/width)%2!=0
	if odd_site and not active_site: return
	plants[i] = species
	if odd_site:
		var group=int(i/width)/8
		if not legacy_sites.has(group): legacy_sites[group]=[]
		if not legacy_sites[group].has(i): legacy_sites[group].append(i)
	life_limit[i] = 0
	if colonizable[i] == 0: site_dirty_rows[(i / width) / 8] = true
	plant_stage[i] = SEED
	plant_age[i] = 0
	boost[i] = 0
	births += 1
	emit_visual(i, "birth")

func remove_plant(i: int, kind: String) -> void:
	if plants[i] > 0: emit_visual(i, kind)
	plants[i] = 0
	plant_stage[i] = SEED
	plant_age[i] = 0
	boost[i] = 0

func kill_plant(i: int) -> void:
	if plants[i] == 0 or plant_stage[i] == DEAD: return
	deaths += 1
	if is_tree(plants[i]):
		emit_visual(i, "wither")
		plant_stage[i] = DEAD
		plant_age[i] = 0
		boost[i] = 0
	else: remove_plant(i, "fade")

func reconcile_habitat(i: int) -> void:
	if is_water(terrain[i]):
		remove_plant(i, "water")
		objects[i] = 0
		fires.erase(i)
	elif plants[i] > 0 and not can_live(i, plants[i]): kill_plant(i)

func advance(seconds: float) -> bool:
	if seconds <= 0 or not is_finite(seconds): return false
	refresh_ecology_sites()
	age += seconds
	var stepped = false
	# Eight deterministic cohorts spread the work through a world second. The saved
	# remainder identifies the next cohort, so a mid-second load never repeats it.
	while seconds > .00000001:
		var phase = mini(7, floori((eco_remainder+.00000001)*8))
		var until = (phase+1)/8.0-eco_remainder
		if seconds+.00000001 < until:
			eco_remainder+=seconds
			break
		seconds=maxf(0,seconds-until)
		eco_remainder=(phase+1)/8.0
		ecology_step(phase,eco_tick+1)
		if phase==7:
			eco_remainder=0
			eco_tick+=1
			Weather.step(self)
			Forces.step(self)
			Dynamics.step(self)
		stepped = true
	flush_surface_changes()
	return stepped

func ecology_step(phase: int=-1, tick: int=-1) -> void:
	# Each site still advances one second per cycle, regardless of camera or FPS.
	var sites: Array[int]=[]
	if phase<0: sites=ecology_sites
	else:
		for group in range(phase,ceili(height/8.0),8): sites.append_array(ecology_rows.get(group,[]))
	var sample_tick=eco_tick if tick<0 else tick
	for i in sites:
		if plants[i] == 0:
			if colonizable[i] > 0 and not fires.has(i):
				var sample = hash_cell(i, sample_tick, world_seed + 983)
				if sample % 1000 < 16:
					# Birth probability and species choice need independent full-range samples.
					sow_natural(i,species_for(i,hash_cell(i,sample_tick,world_seed+1451)))
			continue
		if plant_stage[i] == DEAD:
			plant_age[i] += 1
			if plant_age[i] >= decay_duration(i):
				remove_plant(i,"decay")
				if not fires.has(i): sow_natural(i,species_for(i,hash_cell(i,sample_tick,world_seed+1451)),true)
			continue
		if not can_live(i, plants[i]):
			kill_plant(i)
			continue
		# A grassy clearing can recruit its own canopy. Healthy shrubs and trees keep
		# their lives; only low cover yields, and each cohort has a bounded chance.
		if colonizable[i]>0 and Catalog.is_ground_cover(plants[i]) and not fires.has(i):
			var sample=hash_cell(i,sample_tick,world_seed+6217)
			if sample%1000<7:
				var candidate=species_for(i,hash_cell(i,sample_tick,world_seed+7229))
				if Catalog.is_canopy(candidate):
					var old_species=plants[i]
					sow_natural(i,candidate)
					if plants[i]!=old_species: continue
		var growing = plant_stage[i] < ADULT
		if boost[i] > 0 and growing:
			# One application reaches maturity in four world seconds, without ageing the adult.
			plant_age[i] = minf(maturity(i),plant_age[i] + maturity(i)/4.0)
		else: plant_age[i] += 1.0
		boost[i] = maxf(0, boost[i] - 1)
		if plant_age[i] >= lifespan(i):
			kill_plant(i)
			continue
		var stage = stage_for(i)
		if stage != plant_stage[i]:
			plant_stage[i] = stage
			emit_visual(i, "grow")
		if stage == ADULT and hash_cell(i, sample_tick, world_seed + 205) % 1000 < 12:
			var direction = hash_cell(i, sample_tick, world_seed + 719) % 4
			var offset: Vector2i = [Vector2i(2, 0), Vector2i(-2, 0), Vector2i(0, 2), Vector2i(0, -2)][direction]
			# Canopy offspring land outside the parent's spacing, on the same even grid.
			if Catalog.is_canopy(plants[i]): offset*=2
			var target = Vector2i(i % width, i / width) + offset
			if Rect2i(0, 0, width, height).has_point(target):
				var child = target.y * width + target.x
				if colonizable[child] > 0: sow_natural(child, plants[i])

func sow_natural(i: int, species: int, former_site: bool=false) -> void:
	if fires.has(i) or objects[i]>0 or not can_live(i,species): return
	if plants[i]>0 and not (Catalog.is_canopy(species) and Catalog.is_ground_cover(plants[i])): return
	if Catalog.is_canopy(species) and not fertilizer_space(i,true,2.5): return
	if plants[i]>0: remove_plant(i,"fade")
	sow(i,species,former_site)

func life_counts() -> Dictionary:
	var result = {"living": 0, "young": 0, "adult": 0, "dead": 0, "trees": 0}
	refresh_ecology_sites()
	for i in ecology_sites:
		if plants[i] == 0: continue
		if plant_stage[i] == DEAD:
			result.dead += 1
			continue
		result.living += 1
		if is_tree(plants[i]): result.trees += 1
		if plant_stage[i] < ADULT: result.young += 1
		else: result.adult += 1
	return result

func describe_cell(i: int) -> String:
	var text: String = NAMES[terrain[i]]
	if bare_soil[i]>0: text += " · 裸土"
	elif not is_water(terrain[i]): text += " · " + BIOME_NAMES[biomes[i]]
	if plants[i] > 0: text += " · " + ["萌发", "幼苗", "生长中", "成熟", "衰老", "枯树"][plant_stage[i]]
	return text
