extends RefCounted

const Catalog = preload("res://scripts/plant_catalog.gd")
const CELL = Vector2i(40,48)
const COLUMNS = 30
const NEAR_HEIGHT = 48 * ceili(Catalog.MAX_ID * 18.0 / COLUMNS)

# Original pixel silhouettes. Geometry is drawn on a fixed grid, with no antialiasing.
static var cache: Dictionary = {}
static var icon_cache: Dictionary = {}
static var atlas_image: Image
static var atlas_texture: ImageTexture
var im: Image
var variant: int
var scale: float = 1.0
var life_scale: float = 1.0
var palette: Array[Color]
var plant_id: int = 1

static func texture(species: int, stage: int = 3, variation: int = 0, distant: bool = false) -> ImageTexture:
	var key = "%d/%d/%d/%d" % [species, stage, variation % 3, int(distant)]
	if cache.has(key): return cache[key]
	var painter = new()
	var result = ImageTexture.create_from_image(painter.render(species, stage, variation % 3, distant))
	cache[key] = result
	return result

static func icon(species: int) -> ImageTexture:
	if icon_cache.has(species): return icon_cache[species]
	var source = texture(species).get_image()
	var occupied = source.get_used_rect().grow(1).intersection(Rect2i(Vector2i.ZERO, source.get_size()))
	var result = ImageTexture.create_from_image(source.get_region(occupied))
	icon_cache[species] = result
	return result

static func atlas_region(species: int, stage: int, variation: int, distant: bool = false) -> Rect2i:
	var index = (species - 1) * 18 + stage * 3 + variation % 3
	var cell = Vector2i(20,24) if distant else CELL
	var origin = Vector2i(index % COLUMNS, index / COLUMNS) * cell
	if distant: origin.y += NEAR_HEIGHT
	return Rect2i(origin, cell)

static func prepare_atlas_species(species: int) -> void:
	if atlas_image == null:
		atlas_image = Image.create(CELL.x * COLUMNS, NEAR_HEIGHT + NEAR_HEIGHT / 2, false, Image.FORMAT_RGBA8)
		atlas_image.fill(Color.TRANSPARENT)
	for stage in 6:
		for variation in 3:
			for distant in [false, true]:
				var painter = new()
				var source = painter.render(species, stage, variation, distant)
				var region = atlas_region(species, stage, variation, distant)
				atlas_image.blit_rect(source, Rect2i(Vector2i.ZERO, source.get_size()), region.position)
	if species == Catalog.MAX_ID: atlas_texture = ImageTexture.create_from_image(atlas_image)

func render(species: int, stage: int, variation: int, distant: bool) -> Image:
	variant = variation
	plant_id = species
	scale = 0.5 if distant else 1.0
	im = Image.create(int(40 * scale), int(48 * scale), false, Image.FORMAT_RGBA8)
	im.fill(Color.TRANSPARENT)
	life_scale = 0.56 if stage == 2 else 1.0
	var leaf = Catalog.leaf_color(species)
	palette = [leaf.darkened(.36).lerp(Color("284b40"),.12),leaf.darkened(.22),leaf.darkened(.08),leaf,leaf.lerp(Color("d5da87"),.18),leaf.lightened(.18)]
	if stage == 4:
		for n in palette.size(): palette[n] = palette[n].lerp(Color("bba35b"), 0.32)
	if species in [13,14]: rock(species == 14); return im
	if stage == 0:
		line(Vector2(18,44),Vector2(22,44),Color("8a7145"),1)
		pixel(Vector2(19+variant,43),Color("d8c084"))
		return im
	if stage == 1:
		line(Vector2(20,44),Vector2(20+variant-1,38),Color("556d38"),1)
		polygon([Vector2(20,41),Vector2(14,38),Vector2(15,36),Vector2(19,38)],palette[3])
		polygon([Vector2(20,39),Vector2(22,35),Vector2(26,35),Vector2(24,38)],palette[4])
		return im
	if stage == 5: dead_tree(); return im
	if species >= 55: fantasy(species); return im
	if species in [51,52,53,54]: exotic(species); return im
	if not Catalog.is_tree(species): understory(species); return im
	if species == 10: cactus(); return im
	trunk(species == 2)
	if species in [3,4,11,28,29,30,33]: conifer(species == 4, species in [11,30,33])
	elif species == 9: palm()
	else: broadleaf(species)
	return im

func broadleaf(species: int) -> void:
	var clusters: Array
	match species:
		2: clusters = [[9,26,7,4],[30,23,8,5],[11,16,8,5],[27,12,8,5],[18,7,8,5],[20,21,8,5]]
		5: clusters = [[10,24,8,4],[29,21,8,4],[19,11,9,5],[19,29,10,4]]
		6: clusters = [[10,27,7,5],[28,24,7,6],[16,17,9,6],[25,10,6,7]]
		7: clusters = [[12,24,8,7],[27,22,9,7],[15,14,8,7],[25,11,7,7],[21,28,9,5]]
		12: clusters = [[9,25,6,8],[30,25,6,8],[13,16,8,7],[25,14,8,8],[20,10,8,7]]
		21: clusters = [[9,19,7,6],[29,17,7,6],[18,8,8,6],[21,20,10,7],[14,28,6,4]]
		22: clusters = [[18,8,6,6],[25,14,7,7],[12,16,6,7],[19,23,10,7],[27,28,6,5]]
		23: clusters = [[9,28,5,4],[29,25,6,5],[11,16,5,5],[28,13,6,5],[19,7,6,5],[20,22,6,5]]
		24: clusters = [[9,25,7,3],[29,20,8,4],[19,12,8,4],[18,28,6,3]]
		25: clusters = [[10,25,7,8],[27,25,8,8],[12,15,8,7],[25,11,8,8],[20,23,10,9]]
		26: clusters = [[8,22,6,5],[31,20,6,5],[12,14,7,5],[26,10,7,5],[20,21,10,7]]
		27: clusters = [[9,24,6,4],[29,21,7,4],[14,14,7,5],[24,8,6,5],[20,26,8,5]]
		31: clusters = [[17,9,5,7],[23,17,6,8],[15,25,7,7],[25,30,5,5]]
		32: clusters = [[7,20,6,3],[15,15,9,4],[27,16,9,4],[32,22,6,3],[20,21,11,4]]
		34: clusters = [[10,24,6,6],[27,26,7,5],[13,15,7,6],[25,12,7,7],[20,23,8,8]]
		_: clusters = [[10,25,7,6],[29,24,7,6],[13,16,8,7],[26,13,8,8],[19,9,7,7],[21,26,9,7]]
	for c in clusters:
		var fork=Vector2(c[0],c[1]+2)
		line(Vector2(20,37),fork,Color("536044") if species==2 else Color("5c5034"),2)
		if species==2: line(Vector2(19,36),fork-Vector2(1,0),Color("dddcc0"),1)
	for n in clusters.size():
		var c: Array = clusters[n]
		var center = Vector2(c[0] + (variant-1) * (1 if n%2==0 else -1), c[1] + (variant * n)%3-1)
		foliage(center,Vector2(c[2],c[3]),n)
	if species == 12:
		for n in 10:
			var x = 5 + n * 3
			line(Vector2(x,23),Vector2(x+1,33+n%4),palette[1+n%3],1)
	if species == 2:
		for y in range(30,43,4): line(Vector2(19,y),Vector2(21,y),Color("535c4b"),1)
	if species in [7,34]:
		for n in 9:
			var c: Array = clusters[n%clusters.size()]
			var p = Vector2(c[0]+(n%3-1)*3,c[1]+n%4)
			line(p-Vector2(1,0),p+Vector2(1,0),Color("f3d8d7") if species==7 else Color("eee6cb"),2)
			pixel(p+Vector2(0,1),Color("d7b36e"))

static func colors(values: Array) -> Array[Color]:
	var result: Array[Color] = []
	for value in values: result.append(Color(value))
	return result

func foliage(center: Vector2, radii: Vector2, branch: int=0) -> void:
	# Broken leaf masses with directional light; no concentric outline or soft spherical cap.
	var contour: Array=[]
	for v in [Vector2(-1,.12),Vector2(-.88,-.36),Vector2(-.55,-.48),Vector2(-.45,-.87),Vector2(.06,-1),Vector2(.39,-.77),Vector2(.73,-.69),Vector2(.79,-.24),Vector2(1,.02),Vector2(.82,.42),Vector2(.53,.52),Vector2(.27,.86),Vector2(-.17,.73),Vector2(-.5,.84),Vector2(-.68,.44)]:
		contour.append(center+v*radii)
	polygon(contour,palette[1])
	polygon([center+Vector2(-.91,-.05)*radii,center+Vector2(-.62,-.49)*radii,center+Vector2(-.36,-.81)*radii,center+Vector2(.08,-.91)*radii,center+Vector2(.54,-.57)*radii,center+Vector2(.81,-.19)*radii,center+Vector2(.68,.20)*radii,center+Vector2(.30,.16)*radii,center+Vector2(.18,.43)*radii,center+Vector2(-.37,.36)*radii],palette[3])
	polygon([center+Vector2(-.75,-.18)*radii,center+Vector2(-.40,-.65)*radii,center+Vector2(.05,-.80)*radii,center+Vector2(.44,-.47)*radii,center+Vector2(.23,-.23)*radii,center+Vector2(-.08,-.28)*radii,center+Vector2(-.22,-.02)*radii],palette[4])
	for n in 1:
		var p=center+Vector2(-radii.x*.62+float((n*7+branch*3+variant)%11)/11*radii.x*1.2,-radii.y*.45+float((n*3+branch)%7)/7*radii.y*.9)
		line(p,p+Vector2(1+(n+branch)%2,0),palette[2 if n%3==0 else 4],1)
	line(center+Vector2(radii.x*.25,radii.y*.52),center+Vector2(radii.x*.66,radii.y*.40),palette[0],1)

func point(value: Vector2) -> Vector2:
	var local = value - Vector2(20,45)
	local.x = local.x * (0.92 + variant * 0.055) + local.y * (variant - 1) * 0.042
	return (Vector2(20,45) + local * life_scale) * scale

func pixel(value: Vector2, color: Color) -> void:
	var p = Vector2i(point(value).round())
	var width = maxi(1, ceili(scale * life_scale))
	var area = Rect2i(p,Vector2i.ONE * width).intersection(Rect2i(Vector2i.ZERO,im.get_size()))
	if area.has_area(): im.fill_rect(area,color)

func line(a: Vector2, b: Vector2, color: Color, thickness: int = 1) -> void:
	var count = maxi(1, ceili(a.distance_to(b) * scale * life_scale))
	for n in range(count + 1):
		var p = a.lerp(b, float(n) / count)
		for w in thickness: pixel(p + Vector2(w, 0), color)

func polygon(vertices: Array, color: Color) -> void:
	var points = PackedVector2Array()
	for vertex in vertices: points.append(point(vertex))
	var bounds = Rect2(points[0],Vector2.ZERO)
	for p in points: bounds = bounds.expand(p)
	for y in range(maxi(0,floori(bounds.position.y)),mini(im.get_height(),ceili(bounds.end.y)+1)):
		for x in range(maxi(0,floori(bounds.position.x)),mini(im.get_width(),ceili(bounds.end.x)+1)):
			if Geometry2D.is_point_in_polygon(Vector2(x + 0.5, y + 0.5), points): im.set_pixel(x, y, color)

func ellipse(center: Vector2, radii: Vector2, shades: Array[Color]) -> void:
	var c = point(center)
	var r = radii * scale * life_scale
	for y in range(maxi(0, floori(c.y - r.y)), mini(im.get_height(), ceili(c.y + r.y + 1))):
		for x in range(maxi(0, floori(c.x - r.x)), mini(im.get_width(), ceili(c.x + r.x + 1))):
			var p = (Vector2(x, y) - c) / r
			var edge = p.length_squared()
			if edge > 1.0: continue
			var grain = ((x / 3 * 17 + y / 3 * 31 + variant * 11) ^ (x / 5 * 7 + y / 4 * 13)) % 17
			var shade = 1 if edge > 0.82 else 2
			if p.y < 0.18 and p.x < 0.48 and edge < 0.79: shade = 3
			if p.y < -0.1 and p.x < 0.05 and edge < 0.57: shade = 4
			if grain == 0 and shade >= 3 and p.y > -.2: shade -= 1
			if grain == 16 and shade == 4: shade = 5
			im.set_pixel(x, y, shades[shade])

func trunk(birch: bool) -> void:
	line(Vector2(18, 44), Vector2(21, 18), Color("475139") if birch else Color("4d4630"), 3 if birch else 4)
	line(Vector2(18, 43), Vector2(20, 20), Color("e5e5ca") if birch else Color("a18b51"), 2)
	line(Vector2(21, 34), Vector2(28, 25), Color("535336"), 2)
	line(Vector2(19, 31), Vector2(12, 22), Color("716039"), 2)
	line(Vector2(19, 42), Vector2(16, 45), Color("675b37"), 2)
	line(Vector2(21, 42), Vector2(24, 44), Color("434b2e"), 2)
	if birch:
		for y in [25,32,39]: line(Vector2(19,y),Vector2(20,y),Color("64745c"),1)
	else: line(Vector2(20,40),Vector2(22,28),Color("76643b"),1)

func conifer(snow: bool, narrow: bool) -> void:
	var tiers = 7 if plant_id == 28 else (4 if plant_id == 30 else (6 if plant_id in [29,33] else 5))
	for n in range(tiers-1,-1,-1):
		var y = 5 + n * (4 if tiers==7 else (5 if tiers==6 else 6))
		var half = (3.0 + n * 2.0) * (0.85 if plant_id==30 else (0.60 if narrow else 1.0)) + variant * 0.35
		var lean = (variant-1)*n*0.35
		polygon([Vector2(20+lean,y),Vector2(18-half+lean,y+10),Vector2(21-half*.5+lean,y+9),Vector2(20+lean,y+12),Vector2(23+half+lean,y+10)],palette[1])
		polygon([Vector2(20+lean,y),Vector2(19-half+lean,y+8),Vector2(20+lean,y+10),Vector2(22+half+lean,y+8)],palette[2])
		polygon([Vector2(20+lean,y),Vector2(21-half+lean,y+7),Vector2(20+lean,y+5)],palette[4])
		for branch in range(-int(half),int(half)+1,6):
			line(Vector2(20+branch+lean,y+8),Vector2(21+branch+lean,y+6),palette[2+(branch+n+18)%3],1)
		if snow:
			polygon([Vector2(20+lean,y-1),Vector2(17-half/2+lean,y+6),Vector2(20+lean,y+4),Vector2(23+half/2+lean,y+6)],Color("e4e9db"))

func palm() -> void:
	line(Vector2(19, 43), Vector2(23, 27), Color("675536"), 3)
	line(Vector2(23, 27), Vector2(20, 16), Color("a0874b"), 2)
	for tip in [Vector2(2, 23), Vector2(3, 12), Vector2(12, 5), Vector2(26, 5), Vector2(37, 13), Vector2(36, 25)]:
		var middle: Vector2 = (Vector2(20, 16) + tip) / 2 + Vector2(0, -4)
		polygon([Vector2(20, 16), middle + Vector2(1, -2), tip, middle + Vector2(0, 3)], palette[2])
		line(Vector2(20, 16), middle, palette[4], 1)
		line(middle, tip, palette[3], 1)
		for leaflet in range(2,6):
			var p=middle.lerp(tip,leaflet/6.0)
			var side=(tip-Vector2(20,16)).normalized().orthogonal()
			line(p,p+side*(3.2-leaflet*.3)+Vector2(0,2),palette[2],1)
			line(p,p-side*(2.4-leaflet*.2)+Vector2(0,2),palette[4],1)
	ellipse(Vector2(20, 19), Vector2(2, 2), colors(["574029", "79522c", "927242", "a78342", "b49258", "c6aa69"]))

func cactus() -> void:
	var dark = Color("4e6b39")
	line(Vector2(18, 43), Vector2(18, 17), dark, 6)
	line(Vector2(19, 40), Vector2(19, 18), Color("94aa51"), 2)
	line(Vector2(12, 31), Vector2(19, 31), dark, 2)
	line(Vector2(10, 31), Vector2(10, 23), dark, 4)
	line(Vector2(11, 28), Vector2(11, 23), Color("94aa51"), 1)
	line(Vector2(22, 34), Vector2(28, 34), dark, 3)
	line(Vector2(26, 34), Vector2(26, 26), dark, 4)
	line(Vector2(27, 31), Vector2(27, 26), Color("b3bd67"), 1)
	for y in [21, 27, 35]: pixel(Vector2(22, y), Color("d5d39a"))
	pixel(Vector2(20, 16), Color("d68866"))

func dead_tree() -> void:
	var bark = Color("9d9b80") if plant_id==2 else Color("6b7056")
	line(Vector2(19, 44), Vector2(21, 14), Color("4a4e41"), 3)
	line(Vector2(19, 43), Vector2(20, 18), Color("a49a78"), 1)
	for branch in [[Vector2(20, 33), Vector2(9, 23)], [Vector2(20, 28), Vector2(30, 19)], [Vector2(20, 22), Vector2(14, 14)]]:
		line(branch[0], branch[1], bark, 2)
		line(branch[1], branch[1] + Vector2(1, -6), bark, 1)
	line(Vector2(10, 25), Vector2(7, 26), bark, 1)
	line(Vector2(28, 21), Vector2(33, 22), bark, 1)
	line(Vector2(19, 42), Vector2(15, 45), bark, 2)

func understory(species: int) -> void:
	var spread = variant - 1
	if species in [8,50]:
		for n in range(2 + variant):
			var p = Vector2(14+n*5,41-n%2*4)
			line(p,p-Vector2(0,6+n%2),Color("c9c6a1"),2)
			ellipse(p-Vector2(0,6+n%2),Vector2(4+n%2,2.5),palette)
			pixel(p-Vector2(1,7),palette[5])
	elif species == 20:
		for n in 6:
			var tip = Vector2(9+n*4,34+n%3*3)
			line(Vector2(20,44),tip,palette[1],1)
			line(tip+Vector2(0,2),tip+Vector2(-3,-2),palette[3],1)
			pixel(tip+Vector2(1,0),palette[4])
	elif species == 40:
		for n in 6+variant:
			var tip = Vector2(10+n*3,35+n%3*2)
			line(Vector2(20,44),tip,Color("647d45"),1)
			for h in 3: ellipse(tip+Vector2(0,h*2),Vector2(1.5,1),palette)
	elif species in [16,19,49]:
		for n in 3:
			var p = Vector2(11+n*8,40-n%2*4+spread)
			line(Vector2(20,45),p,palette[0],1)
			foliage(p,Vector2(6+variant%2,4+n%2),n)
			if species in [16,49]:
				line(p,p+Vector2(1,0),Color("b74647") if species==16 else Color("d5a0b8"),2)
				pixel(p-Vector2(0,1),Color("ed9879") if species==16 else Color("efc7d7"))
				pixel(p+Vector2(3,-2),Color("d46555"))
	elif species == 35:
		for n in 7:
			var start = Vector2(20,44)
			var tip = Vector2(7+n*4,29+absi(n-3)*2+variant)
			line(start,tip,palette[4],1)
			for step in range(2,6):
				var p = start.lerp(tip,step/6.0)
				line(p,p+Vector2(-3,-1),palette[2],1)
				line(p,p+Vector2(3,-3),palette[3],1)
	elif species in [43,44]:
		for n in 7:
			var tip = Vector2(6+n*4,29+absi(n-3)*3-variant)
			polygon([Vector2(19,44),tip,Vector2(23,44)],palette[1+n%3])
			line(Vector2(20,43),tip,palette[4],1)
	elif species == 45:
		ellipse(Vector2(20,39),Vector2(8,6),palette)
		for n in 7:
			line(Vector2(13+n,44),Vector2(24+n%4,34+n%3),palette[n%4],1)
	elif species == 36:
		for n in 4+variant:
			var p = Vector2(11+n*4,39+n%2*3)
			line(p+Vector2(1,5),p,palette[0],1)
			for offset in [Vector2(-2,0),Vector2(2,0),Vector2(0,-2)]: ellipse(p+offset,Vector2(2,1.5),palette)
	elif species in [42,48]:
		for n in 9:
			var bottom = Vector2(20+(n%3-1)*2,44)
			var tip = Vector2(6+n*3,32+absi(n-4)*2+variant)
			var elbow = bottom.lerp(tip,0.65)-Vector2(0,3)
			line(bottom,elbow,palette[2+n%3],1)
			line(elbow,tip,palette[3],1)
			if species==42: pixel(tip,palette[5])
	elif species == 41:
		for n in 3+variant:
			var p = Vector2(12+n*5,40-n%2*4)
			line(p+Vector2(0,4),p,Color("788e74"),1)
			for petal in 5:
				var tip = p + Vector2.from_angle(petal * TAU / 5) * 3
				line(p,tip,Color("e2e5ce"),1)
			pixel(p,Color("c3ac5c"))
	elif species == 47:
		for n in 3:
			var p = Vector2(12+n*7,33+n%2*3+variant)
			line(p+Vector2(0,11),p,Color("789b55"),1)
			polygon([p,p+Vector2(-3,-4),p+Vector2(0,-6),p+Vector2(2,-3)],palette[4])
			polygon([p,p+Vector2(-4,2),p+Vector2(-2,4),p+Vector2(1,1)],palette[2])
			line(p,p+Vector2(4,2),palette[3],2)
			pixel(p,Color("e8ce79"))
	else:
		for n in range(4+variant):
			var base = Vector2(10+n*4,44-n%2)
			var tip = base+Vector2((n%3-1)*2,-5-n%3*2-variant)
			var leaf = Color("94ae59") if species not in [42,48] else palette[3]
			line(base,tip,leaf,1)
			line(base-Vector2(0,2),base+Vector2(3,-3),leaf.darkened(0.2),1)
			if species == 18:
				for h in 4: line(tip-Vector2(0,h),tip+Vector2(3-h,-h-2),Color("b6ac7c"),1)
			elif species == 46:
				line(tip,tip-Vector2(0,5),Color("936e43"),3)
			elif species == 38:
				for h in 4: line(tip-Vector2(1,h*2),tip+Vector2(1,-h*2),palette[2+h%3],1)
			elif species in [15,37,39,41,47]:
				var petal = palette[4] if species!=15 else [Color("efdb95"),Color("d6a1b7"),Color("e4e8ce")][n%3]
				var r = 2 if species in [39,47] else 1
				for offset in [Vector2(-r,0),Vector2(r,0),Vector2(0,-r),Vector2(0,r)]:
					line(tip+offset,tip+offset+Vector2(1,0),petal,1)
				pixel(tip,Color("d9ad51"))

func rock(large: bool) -> void:
	life_scale = 1.0 if large else 0.60
	polygon([Vector2(8, 43), Vector2(7, 35), Vector2(12, 28), Vector2(25, 27), Vector2(32, 34), Vector2(30, 43)], Color("535e58"))
	polygon([Vector2(9, 35), Vector2(14, 29), Vector2(24, 29), Vector2(29, 34), Vector2(22, 38), Vector2(12, 38)], Color("8b9584"))
	polygon([Vector2(14, 29), Vector2(24, 29), Vector2(19, 33), Vector2(10, 35)], Color("b1b5a0"))
	polygon([Vector2(22, 38), Vector2(29, 34), Vector2(28, 42), Vector2(21, 43)], Color("68766a"))
	line(Vector2(11, 39), Vector2(16, 40), Color("61714d"), 2)

func exotic(species: int) -> void:
	if species == 51:
		for n in range(3+variant):
			var x = 10+n*5
			var top = 8+(n*7+variant*3)%17
			line(Vector2(x,44),Vector2(x+2,top),palette[1],3)
			line(Vector2(x+1,43),Vector2(x+3,top),palette[4],1)
			for y in range(top+4,40,7):
				line(Vector2(x,y),Vector2(x+3,y),palette[5],1)
				for side in [-1,1]:
					polygon([Vector2(x+1,y),Vector2(x+side*9,y-5),Vector2(x+side*4,y+1)],palette[2+(y+n)%3])
	elif species in [52,53]:
		var crown = Vector2(20,21 if species == 53 else 34)
		line(Vector2(20,44),crown,Color("8e9560"),3)
		for n in range(5+variant):
			var a = n*TAU/(5+variant)-.8
			var tip = crown+Vector2(cos(a)*15,sin(a)*12-5)
			polygon([crown,crown.lerp(tip,.45)+Vector2(-3,4),tip,crown.lerp(tip,.6)+Vector2(4,-4)],palette[1+n%4])
			line(crown,tip,palette[4],1)
		if species == 53: ellipse(Vector2(23,29),Vector2(2,4),colors(["866538","b89348","d9be62","d9be62","e7d67a","f1e7a0"]))
	else:
		for n in range(2+variant):
			var x = 12+n*7
			var y = 15+(n*9+variant*3)%16
			line(Vector2(x,44),Vector2(x,y),Color("d1b9c7"),3)
			ellipse(Vector2(x,y),Vector2(10-n,7),palette)
			line(Vector2(x-7,y+4),Vector2(x+7,y+4),Color("e4d1d8"),1)
			for k in 4: pixel(Vector2(x-5+k*3,y-2+k%2),Color("efe0c9"))

# Each family has its own structure; variations alter branches, stems and silhouette.
func fantasy(species: int) -> void:
	if species in [55,56,57,68]:
		trunk(false)
		broadleaf(7 if species == 68 else (32 if species == 57 else (22 if species == 55 else 25)))
		for n in 7:
			var p = Vector2(10+(n*7+variant*3)%20,15+(n*11)%15)
			if species == 68:
				line(p,p+Vector2(0,3),Color("c1a4d9"),2)
			else:
				ellipse(p,Vector2(1.5,2),colors(["957232","ae8b38","cca844","ead275","f4e3a3","fff0b1"]))
	elif species in [58,59,60]:
		for n in range((2 if species == 59 else 3)+variant):
			var x = 10+n*(8 if species == 59 else 6)
			var y = (8 if species in [59,60] else 20)+(n*11+variant*5)%14
			var foot = Vector2(19+(n-1)*3,44)
			var tip = Vector2(x,y)
			var shoulder = tip+Vector2(4,7)
			polygon([tip,shoulder,foot+Vector2(3,0),foot-Vector2(3,0),tip+Vector2(-4,7)],palette[1])
			polygon([tip,tip+Vector2(-4,7),foot-Vector2(3,0),foot],palette[3])
			polygon([tip,shoulder,foot,tip+Vector2(0,8)],palette[4])
			line(tip,tip+Vector2(-3,7),palette[5],1)
			line(tip+Vector2(0,8),foot,palette[2],1)
	elif species in [61,62]:
		trunk(false)
		for n in range(5+variant):
			var p = Vector2(8+(n*9)%26,10+(n*7)%22)
			line(Vector2(20,35),p,Color("488474"),2)
		for n in range(5+variant):
			var p = Vector2(8+(n*9)%26,10+(n*7)%22)
			polygon([p+Vector2(0,-5),p+Vector2(5,-1),p+Vector2(4,5),p+Vector2(-3,6),p+Vector2(-5,0)],palette[1])
			polygon([p+Vector2(0,-4),p+Vector2(4,-1),p,p+Vector2(-4,0)],palette[5])
			polygon([p,p+Vector2(4,-1),p+Vector2(3,4),p+Vector2(-2,4)],palette[3])
			pixel(p+Vector2(-1,-1),Color("cff0b3"))
	elif species == 63:
		trunk(false)
		for n in range(3+variant):
			var p = Vector2(9+n*7,14+(n*9+variant*3)%14)
			line(Vector2(20,36),p,Color("a78387"),2)
			ellipse(p,Vector2(7,6),palette)
			# Faceted sugar petals, with a honey centre rather than copied candy spirals.
			for k in 5:
				var q = p+Vector2.from_angle(k*TAU/5)*3
				line(p,q,Color("f6ddc9"),1)
			pixel(p,Color("efbb76"))
	elif species in [64,69]:
		trunk(false)
		conifer(species == 64,false)
		if species == 69:
			line(Vector2(18,43),Vector2(19,29),Color("9f6945"),3)
			line(Vector2(19,43),Vector2(20,29),Color("c28e5d"),1)
	elif species == 65:
		polygon([Vector2(13,44),Vector2(12,34),Vector2(16,21),Vector2(23,19),Vector2(26,33),Vector2(26,44)],Color("62573e"))
		polygon([Vector2(15,43),Vector2(15,32),Vector2(18,22),Vector2(21,22),Vector2(22,42)],Color("aa8b59"))
		for n in 3+variant:
			var p = Vector2(7+n*6,14+(n*7)%8)
			line(Vector2(20,29),p,Color("6c6141"),2)
			ellipse(p,Vector2(7,3.5),palette)
	elif species == 66:
		for n in range(2+variant):
			var p = Vector2(11+n*8,40-n%2*3)
			ellipse(p,Vector2(5,4),palette)
			for k in 3: line(p+Vector2(k*2-2,2),p+Vector2(k-1,-3),palette[4-k%2],1)
			line(p+Vector2(0,-2),p+Vector2(-2, -19+n*3),Color("68944d"),2)
			line(p+Vector2(1,-2),p+Vector2(5,-14),Color("95b06c"),1)
	elif species == 67:
		for n in range(2+variant):
			var p = Vector2(11+n*8,24+n%2*7)
			line(Vector2(p.x-2,44),p,Color("5b8550"),2)
			polygon([p+Vector2(-1,12),p+Vector2(-8,8),p+Vector2(-3,8)],Color("82a55e"))
			for k in 6:
				var q = p+Vector2.from_angle(k*TAU/6)*4
				ellipse(q,Vector2(3,2.5),palette)
			ellipse(p,Vector2(2.5,2.5),colors(["9b7239","b89343","d4b354","e7ce75","f6df91","ffeead"]))
	elif species == 70:
		for n in 3+variant:
			var p = Vector2(9+n*6,19+(n*7)%13)
			line(Vector2(20,44),p,Color("538165"),1)
			for k in 7:
				var tip = p+Vector2(k-3,-2+absi(k-3)*.7)*2
				line(p,tip,palette[2+k%3],1)
