extends RefCounted

const PIXELS=12
const PLAIN=Color("d2a263")
const FOREST=Color("b88950")

static func soil_color(w,i: int) -> Color:
	if w.bare_soil.size()>i and w.bare_soil[i]>0:
		return FOREST if w.terrain[i]==w.FOREST else PLAIN
	var base: Color=w.BIOME_COLORS[w.biomes[i]]
	return base.darkened(.035) if w.terrain[i]==w.FOREST else base

static func paint(target: Image,w,x: int,y: int) -> void:
	var i: int=y*w.width+x
	var bare: bool=w.bare_soil.size()>i and w.bare_soil[i]>0
	var base=soil_color(w,i)
	# The surface has a quiet pixel grain and small tonal terraces. No interpolated
	# contour fields: ecological colour comes from the cells the player actually seeded.
	var tone=clampi(roundi(w.ground_noise.get_noise_2d(x*.8,y*.8)*3),-1,1)
	if not bare: base=base.lightened(tone*.032) if tone>=0 else base.darkened(-tone*.025)
	var adjoining: Array[Color]=[]
	var shores: Array[bool]=[]
	for offset in [Vector2i(0,-1),Vector2i(0,1),Vector2i(-1,0),Vector2i(1,0)]:
		var p=Vector2i(x,y)+offset
		var next=base; var shore=false
		if Rect2i(0,0,w.width,w.height).has_point(p):
			var j: int=p.y*w.width+p.x
			shore=w.is_water(w.terrain[j])
			if w.terrain[j] in [w.GRASS,w.FOREST,w.HILLS] and (w.biomes[j]!=w.biomes[i] or (w.bare_soil.size()>j and w.bare_soil[j]!=int(bare))): next=soil_color(w,j)
		adjoining.append(next); shores.append(shore)
	var sample: int=w.hash_cell(x,y,w.world_seed+311)%8
	var slope=0
	if w.terrain[i]==w.HILLS:
		slope=clampi(roundi((w.ridge_noise.get_noise_2d(x-1,y-1)-w.ridge_noise.get_noise_2d(x+1,y+1))*12),-2,2)
	var key="soil14/%s/%s/%s/%s/%d/%d" % [base,adjoining,shores,Vector2i(x%2,y%2),sample,slope]
	var origin=Vector2i(x,y)*PIXELS
	if w.ground_cache.has(key):
		target.blit_rect(w.ground_cache[key],Rect2i(0,0,PIXELS,PIXELS),origin); return
	var tile=Image.create(PIXELS,PIXELS,false,Image.FORMAT_RGBA8)
	for py in PIXELS:
		for px in PIXELS:
			var color=base
			var grain=posmod(px*13+py*7+sample*11,31)
			if grain<5: color=color.lightened(.023 if bare else .018)
			elif grain==9: color=color.darkened(.015)
			# One-pixel step edges join neighbouring soil/biome cells. The interior
			# stays one material, instead of broad curved marbling in every biome.
			var distances=[py,11-py,px,11-px]
			for edge in 4:
				if shores[edge] and distances[edge]==0: color=Color("d9d6a0")
				elif adjoining[edge]!=base and distances[edge]<2 and (px+py+sample)%3==0:
					color=color.lerp(adjoining[edge],.38)
			if slope!=0: color=color.lightened(slope*.028) if slope>0 else color.darkened(-slope*.028)
			tile.set_pixel(px,py,color)
	if w.ground_cache.size()>18000: w.ground_cache.clear()
	w.ground_cache[key]=tile
	target.blit_rect(tile,Rect2i(0,0,PIXELS,PIXELS),origin)
