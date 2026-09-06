extends RefCounted

static var cache: Dictionary = {}

static func texture(key: String) -> ImageTexture:
	if cache.has(key): return cache[key]
	var im = Image.create(24, 24, false, Image.FORMAT_RGBA8)
	im.fill(Color.TRANSPARENT)
	var gold = Color("efce87")
	var white = Color("dee9d7")
	var green = Color("82bc78")
	var blue = Color("65bbd0")
	match key:
		"pause":
			im.fill_rect(Rect2i(6, 5, 4, 14), blue)
			im.fill_rect(Rect2i(14, 5, 4, 14), blue)
		"play":
			for x in range(7, 18): im.fill_rect(Rect2i(x, 5 + (x - 7) / 2, 1, 14 - (x - 7)), gold)
		"speed":
			im.fill_rect(Rect2i(4,2,16,3), Color("93704a"))
			im.fill_rect(Rect2i(4,19,16,3), Color("93704a"))
			im.fill_rect(Rect2i(5,2,13,1), gold)
			im.fill_rect(Rect2i(5,19,13,1), gold)
			for y in range(5,19):
				var half = maxi(1, absi(y - 12))
				im.fill_rect(Rect2i(12-half,y,half*2,1), Color("9dbab5"))
				if y < 9 or y > 14: im.fill_rect(Rect2i(13-half,y,maxi(1,half*2-2),1), gold)
			im.fill_rect(Rect2i(11,9,2,7), Color("f4df9c"))
		"new":
			for y in range(3, 21):
				for x in range(3, 21):
					if Vector2(x - 12, y - 12).length() < 9:
						im.set_pixel(x, y, green if (x * 3 + y * 5) % 13 < 6 else blue)
			im.fill_rect(Rect2i(17, 2, 2, 8), gold)
			im.fill_rect(Rect2i(14, 5, 8, 2), gold)
		"save", "load":
			im.fill_rect(Rect2i(4, 3, 16, 18), Color("6898a0"))
			im.fill_rect(Rect2i(7, 3, 9, 7), white)
			im.fill_rect(Rect2i(7, 14, 10, 7), Color("243c49"))
			im.fill_rect(Rect2i(13, 4, 2, 5), Color("243c49"))
			if key == "load": im.fill_rect(Rect2i(9, 16, 6, 2), gold)
		"undo", "redo":
			im.fill_rect(Rect2i(6, 8, 12, 3), white)
			im.fill_rect(Rect2i(16, 10, 3, 8), white)
			im.fill_rect(Rect2i(10, 17, 8, 3), white)
			for i in 5: im.fill_rect(Rect2i(3 + i, 9 - i, 1, 1 + 2 * i), white)
			if key == "redo": im.flip_x()
		"home":
			for y in 8: im.fill_rect(Rect2i(11 - y, 3 + y, 2 + y * 2, 1), gold)
			im.fill_rect(Rect2i(6, 11, 12, 10), white)
			im.fill_rect(Rect2i(10, 15, 4, 6), Color("263c43"))
		"fit", "photo":
			im.fill_rect(Rect2i(3, 6, 18, 15), white)
			im.fill_rect(Rect2i(5, 8, 14, 11), Color("263c43"))
			im.fill_rect(Rect2i(9, 3, 7, 4), gold)
			for y in range(9, 18):
				for x in range(8, 17):
					if Vector2(x - 12, y - 13).length() < 4: im.set_pixel(x, y, blue)
		"tree":
			im.fill_rect(Rect2i(11, 14, 3, 8), gold)
			for y in 15: im.fill_rect(Rect2i(12 - y / 2, 2 + y, 2 + y, 1), green.darkened((y % 5) * 0.04))
		"seed":
			im.fill_rect(Rect2i(10, 8, 2, 11), green)
			im.fill_rect(Rect2i(5, 8, 5, 3), green.lightened(0.2))
			im.fill_rect(Rect2i(12, 5, 5, 4), green)
			im.fill_rect(Rect2i(5, 19, 14, 2), Color("9d794b"))
			for p in [Vector2i(6,16), Vector2i(16,15), Vector2i(17,20)]: im.fill_rect(Rect2i(p, Vector2i(2, 2)), gold)
		"fertilizer", "tree_fertilizer":
			im.fill_rect(Rect2i(7, 7, 12, 14), Color("b59358"))
			im.fill_rect(Rect2i(9, 4, 8, 4), gold)
			im.fill_rect(Rect2i(8, 8, 2, 11), Color("d7b875"))
			im.fill_rect(Rect2i(12, 12, 2, 6), green)
			if key == "tree_fertilizer":
				for y in 6: im.fill_rect(Rect2i(13 - y / 2, 10 + y, 1 + y, 1), Color("385f38"))
			else:
				im.fill_rect(Rect2i(10, 11, 3, 2), green)
				im.fill_rect(Rect2i(14, 13, 3, 2), green)
			im.fill_rect(Rect2i(2, 4, 1, 5), white)
			im.fill_rect(Rect2i(0, 6, 5, 1), white)
		"forest":
			im.fill_rect(Rect2i(3, 17, 18, 5), Color("8a7950"))
			im.fill_rect(Rect2i(3, 16, 18, 2), green)
			for x in [8, 16]:
				im.fill_rect(Rect2i(x, 10, 2, 8), gold)
				for y in 10: im.fill_rect(Rect2i(x - y / 3, 3 + y, 2 + y / 2, 1), green.darkened(y % 3 * 0.06))
		"erase":
			im.fill_rect(Rect2i(7, 3, 10, 11), Color("de877e"))
			im.fill_rect(Rect2i(7, 14, 10, 7), white)
		"brush":
			im.fill_rect(Rect2i(10, 3, 4, 13), gold)
			im.fill_rect(Rect2i(7, 15, 10, 6), white)
		"terrain":
			for y in range(4, 21): im.fill_rect(Rect2i(12 - (y - 4) / 2, y, maxi(2, y - 3), 1), white if y < 9 else Color("8a9c8e"))
		"close":
			for i in range(5, 19):
				im.fill_rect(Rect2i(i, i, 2, 2), Color("ec9180"))
				im.fill_rect(Rect2i(23 - i, i, 2, 2), Color("ec9180"))
		_:
			im.fill_rect(Rect2i(5, 5, 14, 14), gold)
	var result = ImageTexture.create_from_image(im)
	cache[key] = result
	return result

static func biome_texture(biome: int) -> ImageTexture:
	var key = "biome_%d" % biome
	if cache.has(key): return cache[key]
	var World = preload("res://scripts/world_data.gd")
	var Flora = preload("res://scripts/pixel_flora.gd")
	var im = Image.create(24, 24, false, Image.FORMAT_RGBA8)
	im.fill(Color.TRANSPARENT)
	var color: Color = World.BIOME_COLORS[biome]
	for y in range(12, 22):
		var half = 10 - absi(y - 17) / 2
		im.fill_rect(Rect2i(12 - half, y, half * 2, 1), color.darkened(0.12) if y > 19 else color)
	var plant = Flora.texture([1, 2, 5, 4, 10, 12, 7][biome]).get_image()
	plant.resize(20, 24, Image.INTERPOLATE_NEAREST)
	im.blend_rect(plant, Rect2i(0, 0, 20, 24), Vector2i(2, -3))
	var result = ImageTexture.create_from_image(im)
	cache[key] = result
	return result

static func terrain_texture(type: int) -> ImageTexture:
	var key = "terrain_%d" % type
	if cache.has(key): return cache[key]
	var colors = preload("res://scripts/world_data.gd").COLORS
	var im = Image.create(24, 24, false, Image.FORMAT_RGBA8)
	im.fill(Color.TRANSPARENT)
	var color: Color = colors[type]
	for y in range(5, 19):
		var half = 9 - absi(y - 12) / 2
		im.fill_rect(Rect2i(12 - half, y, half * 2, 1), color if y < 14 else color.darkened(0.2))
	if type in [0, 1, 2, 12]:
		im.fill_rect(Rect2i(6, 9, 7, 1), color.lightened(0.35))
		im.fill_rect(Rect2i(11, 13, 6, 1), color.lightened(0.3))
	elif type == 10:
		for y in range(2, 13): im.fill_rect(Rect2i(11 - y / 3, y, 2 + y / 2, 1), Color("d6e2d6") if y < 6 else color.lightened(0.1))
	else:
		im.fill_rect(Rect2i(8, 7, 2, 5), color.lightened(0.3))
		im.fill_rect(Rect2i(15, 9, 2, 4), color.darkened(0.15))
	var result = ImageTexture.create_from_image(im)
	cache[key] = result
	return result
