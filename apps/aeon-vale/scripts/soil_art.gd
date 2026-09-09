extends RefCounted

const PIXELS=12
const Materials=preload("res://scripts/ground_materials.gd")
const PLAIN=Color("d5a064")
const FOREST=Color("b88950")
const FLOORS=[Color("a3c953"),Color("7da441"),Color("c6a04e"),Color("dce5d8"),Color("cdb36a"),Color("819766"),Color("a1c461"),Color("98c24f"),Color("749450"),Color("c2ad60"),Color("70953f"),Color("8fb250"),Color("aecb64"),Color("898f62"),Color("b1c65e"),Color("89b4a2"),Color("76a37b"),Color("c5b9a2")]
const OFFSETS=[Vector2i(0,-1),Vector2i(0,1),Vector2i(-1,0),Vector2i(1,0)]

static func soil_color(w,i: int) -> Color:
	if w.bare_soil.size()>i and w.bare_soil[i]>0:
		return FOREST if w.terrain[i]==w.FOREST else PLAIN
	return FLOORS[w.biomes[i]]

static func material(w,i: int) -> int:
	if w.bare_soil[i]>0: return Materials.LOAM
	if w.biomes[i]==w.TUNDRA: return Materials.SNOW
	if w.biomes[i] in [w.ARID,w.SAVANNA,w.GOLDEN]: return Materials.DRY
	return Materials.GRASS

static func cover(w,x: int,y: int) -> Color:
	var i: int=y*w.width+x
	var base=soil_color(w,i)
	if w.bare_soil[i]>0: return base
	# Three connected floor planes, fixed in world coordinates. Individual trees
	# never bake changing shadows into the ground cache.
	var field: float=w.ground_noise.get_noise_2d(x*.72,y*.72)
	if w.biomes[i]==w.TUNDRA:
		return base.lerp(Color("adbfac"),.20) if field>.23 else base
	if w.biomes[i] in [w.ARID,w.SAVANNA,w.GOLDEN]:
		if field>.24: return base.lerp(Color("949d4c"),.18)
		if field<-.22: return base.lerp(Color("e1c87b"),.23)
		return base
	if field<-.24: return base.lerp(Color("cbcc7a"),.19)
	if field>.22: return base.darkened(.065)
	return base

static func paint(target: Image,w,x: int,y: int) -> void:
	var i: int=y*w.width+x
	var base=cover(w,x,y)
	var kind=material(w,i)
	var adjoining: Array[Color]=[]
	var edges: Array[int]=[]
	var materials: Array[int]=[]
	for offset in OFFSETS:
		var p=Vector2i(x,y)+offset
		var next=base; var edge=0; var next_kind=kind
		if Rect2i(0,0,w.width,w.height).has_point(p):
			var j: int=p.y*w.width+p.x
			var type: int=w.terrain[j]
			if type in [w.GRASS,w.FOREST]:
				next=cover(w,p.x,p.y)
				next_kind=material(w,j)
				# Sod owns the join: only the bare side receives a connected lip.
				# Swapping colours on both sides cut a soil trench behind a green rim.
				if w.bare_soil[i]!=w.bare_soil[j]: edge=3 if w.bare_soil[i]>0 else -1
			elif type in [w.BEACH,w.HILLS]:
				# The beach owns its inland lip; drawing sand here as well would
				# split a connected grass edge with a detached pale seam.
				edge=-1
			elif w.is_water(type): edge=1
		adjoining.append(next); edges.append(edge); materials.append(next_kind)
	var phase=Vector2i(x%4,y%4)
	var key="soil/%d/%s/%s/%s/%s/%s" % [kind,base,adjoining,edges,materials,phase]
	var origin=Vector2i(x,y)*PIXELS
	if w.ground_cache.has(key):
		target.blit_rect(w.ground_cache[key],Rect2i(0,0,PIXELS,PIXELS),origin); return
	# Cache the material interior independently. Joining four edges touches only
	# their short perimeter strips, rather than re-evaluating all four per pixel.
	var tile=Materials.tile(w,base,kind,phase).duplicate()
	for edge in 4:
		if edges[edge]<0: continue
		if edges[edge]==0: continue
		var next_kind=materials[edge]
		var colors=Materials.palette(adjoining[edge],next_kind)
		for along in PIXELS:
			for distance in 1:
				var px=along if edge<2 else (distance if edge==2 else 11-distance)
				var py=along if edge>=2 else (distance if edge==0 else 11-distance)
				var color: Color=colors[Materials.tone(next_kind,phase.x*12+px,phase.y*12+py)]
				if edges[edge]==1: color=Color("dce1a5")
				tile.set_pixel(px,py,color)
	# Round the corners of colour patches with one connected cut, instead of
	# decorating every boundary pixel with independently changing teeth.
	for corner in [[0,2],[0,3],[1,2],[1,3]]:
		var a: int=corner[0]; var b: int=corner[1]
		if edges[a]!=0 or edges[b]!=0: continue
		if adjoining[a]!=adjoining[b] or adjoining[a].get_luminance()<=base.get_luminance(): continue
		for dy in 3:
			for dx in 3:
				if Vector2(3-dx,3-dy).length()<=3.4: continue
				tile.set_pixel(dx if b==2 else 11-dx,dy if a==0 else 11-dy,adjoining[a])
	if w.ground_cache.size()>18000: w.ground_cache.clear()
	w.ground_cache[key]=tile
	target.blit_rect(tile,Rect2i(0,0,PIXELS,PIXELS),origin)
