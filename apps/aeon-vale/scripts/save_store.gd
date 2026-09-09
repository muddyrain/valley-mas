extends RefCounted

const World = preload("res://scripts/world_data.gd")
const MAX_BYTES = 24000000
static var directory: String = "user://worlds"

static func encode(world) -> Dictionary:
	if world.warmth.size()!=world.terrain.size(): world.Dynamics.prepare(world)
	var burning: Array = []
	for i in world.fires: burning.append([i,world.fires[i]])
	var cooldowns: Array=[]
	var locations=world.biome_cooldown.keys(); locations.sort()
	for i in locations:
		if world.biome_cooldown[i]>world.eco_tick: cooldowns.append([i,world.biome_cooldown[i]])
	return {"version": 11, "name": world.world_name, "seed": world.world_seed, "width": world.width, "height": world.height, "template": world.template, "age": world.age, "saved_at": Time.get_datetime_string_from_system(),
		"quake_scars":Marshalls.raw_to_base64(world.quake_scars),
		"bare_soil":Marshalls.raw_to_base64(world.bare_soil),
		"biome_cooldown":cooldowns,
		"fair_clouds":world.fair_clouds.duplicate(true),"fair_due":world.fair_due,"fair_cycle":world.fair_cycle,
		"weather_enabled":world.weather_enabled,"weather_due":world.weather_due,"weather_cycle":world.weather_cycle,"rain_clouds":world.rain_clouds.duplicate(true),
		"spread_enabled":world.spread_enabled,"generation_settings":world.Landscape.settings(world.generation_settings),
		"warmth":Marshalls.raw_to_base64(world.warmth.to_byte_array()),"moisture":Marshalls.raw_to_base64(world.moisture.to_byte_array()),"elevation":Marshalls.raw_to_base64(world.elevation.to_byte_array()),
		"terrain": Marshalls.raw_to_base64(world.terrain), "plants": Marshalls.raw_to_base64(world.plants), "biomes": Marshalls.raw_to_base64(world.biomes), "objects": Marshalls.raw_to_base64(world.objects),
		"plant_stage": Marshalls.raw_to_base64(world.plant_stage), "plant_age": Marshalls.raw_to_base64(world.plant_age.to_byte_array()), "boost": Marshalls.raw_to_base64(world.boost.to_byte_array()),
		"eco_tick": world.eco_tick, "eco_remainder": world.eco_remainder, "births": world.births, "deaths": world.deaths, "fires": burning, "tornadoes": world.tornadoes.duplicate(true)}

static func unpack(data: Dictionary, key: String, byte_count: int) -> PackedByteArray:
	var value = data.get(key)
	if not value is String or value.length() != ceili(byte_count / 3.0) * 4: return PackedByteArray()
	var base64 = RegEx.new()
	base64.compile("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$")
	if base64.search(value) == null: return PackedByteArray()
	var bytes = Marshalls.base64_to_raw(value)
	return bytes if bytes.size() == byte_count else PackedByteArray()

static func decode(data: Variant) -> Dictionary:
	var invalid = {"world": null, "error": "存档损坏或版本不兼容"}
	# JSON numbers are floats; Array.has compares Variant types strictly.
	if not data is Dictionary: return invalid
	if not numeric(data.get("version")) or data.version != int(data.version) or int(data.version) not in [1,2,3,4,5,6,7,8,9,10,11]: return invalid
	for key in ["width", "height", "seed", "age"]:
		if not data.get(key) is float and not data.get(key) is int: return invalid
	for key in ["name", "terrain", "plants", "template"]:
		if not data.get(key) is String: return invalid
	var width = int(data.width)
	var height = int(data.height)
	if data.width != width or data.height != height or not is_finite(float(data.age)): return invalid
	if not is_finite(float(data.seed)) or absf(float(data.seed)) > 999999999: return invalid
	if width < 32 or width > 512 or height < 32 or height > 512: return invalid
	var count = width * height
	var terrain = unpack(data, "terrain", count)
	var plants = unpack(data, "plants", count)
	if terrain.is_empty() or plants.is_empty(): return invalid
	var world = World.new()
	world.width = width
	world.height = height
	world.world_seed = int(data.seed)
	world.world_name = str(data.name).left(32)
	world.template = str(data.template)
	world.age = clampf(float(data.age), 0, 100000000 if data.version < 4 else (1000000000 if data.version<8 else 1400000000))
	world.terrain = terrain
	world.plants = plants
	world.initialize_life_arrays()
	if data.version>=11:
		var bare=unpack(data,"bare_soil",count)
		if bare.is_empty(): return invalid
		for i in count:
			if bare[i]>1 or (bare[i]>0 and terrain[i] not in [World.GRASS,World.FOREST,World.HILLS]): return invalid
		world.bare_soil=bare
	if data.version>=10:
		var scars=unpack(data,"quake_scars",count)
		if scars.is_empty(): return invalid
		for i in count:
			if scars[i]>2 or (scars[i]>0 and World.is_water(terrain[i])): return invalid
		world.quake_scars=scars
	if data.version == 1:
		for i in count:
			if terrain[i] > World.RIVER or plants[i] > 16: return invalid
			if plants[i] > 0 and not World.supports_plant(terrain[i], plants[i] - 1): return invalid
			world.biomes[i] = World.biome_from_legacy(terrain[i])
			world.terrain[i] = World.soil_from_legacy(terrain[i])
			if plants[i] in [13, 14]:
				world.objects[i] = plants[i] - 12
				world.plants[i] = 0
			elif plants[i] > 0:
				world.plant_age[i] = 55.0 + World.hash_cell(i % width, i / width, world.world_seed) % 95
				world.plant_stage[i] = World.ADULT
				world.reconcile_habitat(i)
	else:
		for key in ["eco_tick", "eco_remainder", "births", "deaths"]:
			var value = data.get(key)
			if (not value is float and not value is int) or not is_finite(float(value)) or value < 0 or value > 1000000000: return invalid
		if data.eco_remainder >= 1 or data.eco_tick != int(data.eco_tick): return invalid
		var biomes = unpack(data, "biomes", count)
		var objects = unpack(data, "objects", count)
		var stages = unpack(data, "plant_stage", count)
		var ages = unpack(data, "plant_age", count * 4)
		var boosts = unpack(data, "boost", count * 4)
		if biomes.is_empty() or objects.is_empty() or stages.is_empty() or ages.is_empty() or boosts.is_empty(): return invalid
		world.biomes = biomes
		world.objects = objects
		world.plant_stage = stages
		world.plant_age = ages.to_float32_array()
		world.boost = boosts.to_float32_array()
		for i in count:
			if terrain[i] not in [0, 1, 2, 3, 4, 5, 10, 12, 13, 14] or (data.version < 4 and terrain[i] == World.RIFT) or biomes[i] > (6 if data.version < 4 else (13 if data.version == 4 else World.BIOME_NAMES.size()-1)) or objects[i] > 2: return invalid
			if plants[i] > (20 if data.version == 2 else (50 if data.version == 3 else (54 if data.version == 4 else World.Catalog.MAX_ID))) or plants[i] in [13, 14] or stages[i] > World.DEAD: return invalid
			if not is_finite(world.plant_age[i]) or world.plant_age[i] < 0 or world.plant_age[i] > (1000 if data.version < 4 else (10000 if data.version<8 else 14000)): return invalid
			if not is_finite(world.boost[i]) or world.boost[i] < 0 or world.boost[i] > (18 if data.version < 4 else World.FERTILIZER_SECONDS): return invalid
			if World.is_water(terrain[i]) and (plants[i] > 0 or objects[i] > 0): return invalid
			if plants[i] > 0:
				if objects[i] > 0: return invalid
				if stages[i] == World.DEAD:
					if not World.is_tree(plants[i]): return invalid
				elif not world.can_live(i, plants[i]): return invalid
			elif stages[i] != 0 or world.plant_age[i] != 0 or world.boost[i] != 0: return invalid
		world.eco_tick = int(data.eco_tick)
		world.eco_remainder = float(data.eco_remainder)
		world.births = int(data.births)
		world.deaths = int(data.deaths)
	if data.version < 4: world.migrate_legacy_time()
	else:
		if not data.get("fires") is Array or not data.get("tornadoes") is Array: return invalid
		if data.fires.size() > 2048 or data.tornadoes.size() > 20: return invalid
		for fire in data.fires:
			if not fire is Array or fire.size() != 2: return invalid
			if not numeric(fire[0]) or not numeric(fire[1]): return invalid
			var i = int(fire[0])
			if fire[0] != i or i < 0 or i >= count or World.is_water(terrain[i]) or fire[1] <= 0 or fire[1] > 12 or world.fires.has(i): return invalid
			world.fires[i] = float(fire[1])
		for storm in data.tornadoes:
			if not storm is Dictionary: return invalid
			for key in ["x","y","vx","vy","life","radius","shape"]:
				if not numeric(storm.get(key)): return invalid
			if storm.x < 0 or storm.x > width-1 or storm.y < 0 or storm.y > height-1 or absf(storm.vx) > 2 or absf(storm.vy) > 2 or storm.life <= 0 or storm.life > 24 or storm.radius < 0 or storm.radius > 16 or storm.radius != int(storm.radius) or storm.shape < 0 or storm.shape > 3 or storm.shape != int(storm.shape): return invalid
			var restored=storm.duplicate()
			if data.version>=10:
				if not numeric(storm.get("phase")) or storm.phase<0 or storm.phase>TAU: return invalid
			else: restored.phase=0.0
			for key in ["x","y","vx","vy","life","phase"]: restored[key]=float(restored[key])
			for key in ["radius","shape"]: restored[key]=int(restored[key])
			world.tornadoes.append(restored)
	if data.version>=6:
		if not data.get("spread_enabled") is bool or not data.get("generation_settings") is Dictionary: return invalid
		var settings: Dictionary = data.generation_settings
		for key in ["land_size","islands","coast","trees"]:
			if not numeric(settings.get(key)): return invalid
		if not settings.get("rivers") is bool: return invalid
		if settings.land_size<1 or settings.land_size>10 or settings.land_size!=int(settings.land_size) or settings.islands<0 or settings.islands>12 or settings.islands!=int(settings.islands) or settings.coast<0 or settings.coast>10 or settings.coast!=int(settings.coast) or settings.trees<0 or settings.trees>1: return invalid
		for key in ["lakes","ring_width","strait_width"]:
			if not settings.has(key): continue
			if not numeric(settings[key]) or settings[key]!=int(settings[key]) or settings[key]<1 or settings[key]>(4 if key=="lakes" else 10): return invalid
		var warmth = unpack(data,"warmth",count*4)
		var moisture = unpack(data,"moisture",count*4)
		var elevation = unpack(data,"elevation",count*4)
		if warmth.is_empty() or moisture.is_empty() or elevation.is_empty(): return invalid
		world.warmth=warmth.to_float32_array(); world.moisture=moisture.to_float32_array(); world.elevation=elevation.to_float32_array()
		for i in count:
			if not is_finite(world.warmth[i]) or world.warmth[i]<0 or world.warmth[i]>1 or not is_finite(world.moisture[i]) or world.moisture[i]<0 or world.moisture[i]>1 or not is_finite(world.elevation[i]) or absf(world.elevation[i])>4: return invalid
		world.spread_enabled=data.spread_enabled
		world.generation_settings=settings.duplicate()
	else: world.spread_enabled=false
	if data.version>=7:
		if not data.get("weather_enabled") is bool or not data.get("rain_clouds") is Array: return invalid
		for key in ["weather_due","weather_cycle"]:
			if not numeric(data.get(key)) or data[key]!=int(data[key]) or data[key]<0: return invalid
		if data.weather_due>(180 if data.version<8 else World.YEAR_SECONDS*3) or data.weather_cycle>1000000000 or data.rain_clouds.size()>World.Weather.MAX_CLOUDS: return invalid
		world.weather_enabled=data.weather_enabled; world.weather_due=int(data.weather_due); world.weather_cycle=int(data.weather_cycle)
		for cloud in data.rain_clouds:
			if not cloud is Dictionary or not cloud.get("natural") is bool: return invalid
			for key in ["x","y","vx","vy","life","duration","radius","shape","seed"]:
				if not numeric(cloud.get(key)): return invalid
			if cloud.x<0 or cloud.x>width-1 or cloud.y<0 or cloud.y>height-1 or absf(cloud.vx)>1.1 or absf(cloud.vy)>.3: return invalid
			if cloud.duration<10 or cloud.duration>20 or cloud.life<=0 or cloud.life>cloud.duration: return invalid
			if cloud.radius<0 or cloud.radius>28 or cloud.radius!=int(cloud.radius) or cloud.shape<0 or cloud.shape>3 or cloud.shape!=int(cloud.shape): return invalid
			if cloud.seed<0 or cloud.seed>4294967295 or cloud.seed!=int(cloud.seed): return invalid
			var restored=cloud.duplicate()
			if data.version>=10:
				if not cloud.get("acid") is bool or (cloud.acid and cloud.natural): return invalid
			else: restored.acid=false
			for key in ["radius","shape","seed"]: restored[key]=int(restored[key])
			for key in ["x","y","vx","vy","life","duration"]: restored[key]=float(restored[key])
			world.rain_clouds.append(restored)
	if data.version>=8:
		if not data.get("biome_cooldown") is Array or data.biome_cooldown.size()>count: return invalid
		for item in data.biome_cooldown:
			if not item is Array or item.size()!=2 or not numeric(item[0]) or not numeric(item[1]): return invalid
			if item[0]!=int(item[0]) or item[1]!=int(item[1]) or item[0]<0 or item[0]>=count or item[1]<=world.eco_tick or item[1]>world.eco_tick+World.YEAR_SECONDS*3 or world.biome_cooldown.has(int(item[0])): return invalid
			world.biome_cooldown[int(item[0])]=int(item[1])
	elif data.version>=4:
		world.migrate_sixty_second_calendar()
		if data.version>=7: world.weather_due=roundi(world.weather_due*World.YEAR_SECONDS/60.0)
	if data.version>=9:
		if not data.get("fair_clouds") is Array or data.fair_clouds.size()>World.Weather.MAX_FAIR_CLOUDS: return invalid
		for key in ["fair_due","fair_cycle"]:
			if not numeric(data.get(key)) or data[key]!=int(data[key]) or data[key]<0: return invalid
		if data.fair_due>70 or data.fair_cycle>1000000000: return invalid
		world.fair_due=int(data.fair_due); world.fair_cycle=int(data.fair_cycle)
		for cloud in data.fair_clouds:
			if not cloud is Dictionary: return invalid
			for key in ["x","y","vx","vy","life","duration","radius","seed"]:
				if not numeric(cloud.get(key)): return invalid
			if cloud.radius<8 or cloud.radius>24 or cloud.radius!=int(cloud.radius): return invalid
			if cloud.x<0 or cloud.x>width+cloud.radius*2 or cloud.y< -20 or cloud.y>height+20 or cloud.vx<.3 or cloud.vx>.65 or absf(cloud.vy)>.061: return invalid
			if cloud.duration<140 or cloud.duration>220 or cloud.life<=0 or cloud.life>cloud.duration: return invalid
			if cloud.seed<0 or cloud.seed>4294967295 or cloud.seed!=int(cloud.seed): return invalid
			var restored=cloud.duplicate()
			for key in ["seed","radius"]: restored[key]=int(restored[key])
			for key in ["x","y","vx","vy","life","duration"]: restored[key]=float(restored[key])
			world.fair_clouds.append(restored)
	else:
		# Preserve the fraction of decay already elapsed when opening an older world.
		for i in count:
			if world.plants[i]>0 and world.plant_stage[i]==World.DEAD:
				var former_duration=World.YEAR_SECONDS*2 if data.version>=4 else World.DEAD_SECONDS
				world.plant_age[i]=minf(world.plant_age[i]/former_duration,.999)*world.decay_duration(i)
	world.visual_events.clear()
	world.dirty_rows.clear()
	world.prepare_ecology()
	return {"world": world, "error": ""}

static func path(slot: int) -> String:
	return directory + "/world-%d.json" % clampi(slot, 1, 3)

static func read_slot(slot: int) -> Dictionary:
	if not FileAccess.file_exists(path(slot)): return {"world": null, "error": "这个位置还没有世界"}
	var file = FileAccess.open(path(slot), FileAccess.READ)
	if file == null or file.get_length() > MAX_BYTES: return {"world": null, "error": "无法读取这个世界"}
	var parser = JSON.new()
	if parser.parse(file.get_as_text()) != OK: return {"world": null, "error": "存档损坏或版本不兼容"}
	return decode(parser.data)

static func write_slot(world, slot: int) -> String:
	var result = DirAccess.make_dir_recursive_absolute(directory)
	if result != OK: return "无法创建存档目录"
	# Reads never rewrite old saves. Keep exact bytes before the first v11 overwrite.
	if FileAccess.file_exists(path(slot)):
		var previous = FileAccess.open(path(slot), FileAccess.READ)
		if previous == null: return "无法读取原存档"
		if previous.get_length() <= MAX_BYTES:
			var contents = previous.get_buffer(previous.get_length())
			var parser = JSON.new()
			if parser.parse(contents.get_string_from_utf8()) == OK and parser.data is Dictionary:
				var old_version = int(parser.data.get("version",0)) if numeric(parser.data.get("version",0)) else 0
				if old_version in [1,2,3,4,5,6,7,8,9,10]:
					var backup_path = path(slot) + ".v%d.bak" % int(old_version)
					if not FileAccess.file_exists(backup_path):
						var backup = FileAccess.open(backup_path, FileAccess.WRITE)
						if backup == null: return "无法保留旧版存档"
						backup.store_buffer(contents)
						backup.flush()
						if backup.get_error() != OK: return "旧版存档备份失败"
						backup.close()
		previous.close()
	var file = FileAccess.open(path(slot) + ".tmp", FileAccess.WRITE)
	if file == null: return "无法写入存档"
	file.store_string(JSON.stringify(encode(world),"",true,true))
	file.flush()
	var write_error = file.get_error()
	file.close()
	if write_error != OK: return "存档写入失败"
	if DirAccess.rename_absolute(path(slot) + ".tmp", path(slot)) != OK: return "无法替换存档文件"
	return ""

static func metadata(slot: int) -> Dictionary:
	if not FileAccess.file_exists(path(slot)): return {}
	var file = FileAccess.open(path(slot), FileAccess.READ)
	if file == null or file.get_length() > MAX_BYTES: return {"name": "无法读取", "saved_at": ""}
	var parser = JSON.new()
	if parser.parse(file.get_as_text()) != OK: return {"name": "损坏的存档", "saved_at": ""}
	var data = parser.data
	if not data is Dictionary: return {"name": "损坏的存档", "saved_at": ""}
	return {"name": str(data.get("name", "未命名世界")).left(32), "saved_at": str(data.get("saved_at", "")).replace("T", "  "), "width": data.get("width", 0), "height": data.get("height", 0)}

static func numeric(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))
