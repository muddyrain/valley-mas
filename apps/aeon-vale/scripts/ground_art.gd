extends RefCounted

const PIXELS=12
const Mountain=preload("res://scripts/mountain_art.gd")
const Soil=preload("res://scripts/soil_art.gd")

static func paint(target: Image,world,x: int,y: int) -> void:
	var i: int=y*world.width+x; var type: int=world.terrain[i]
	if world.quake_scars.size()>i and world.quake_scars[i]>0 and type!=world.RIFT:
		paint_fault(target,world,x,y); return
	if type==world.MOUNTAIN:
		Mountain.paint(target,world,x,y); return
	if type in [world.GRASS,world.FOREST,world.HILLS]:
		Soil.paint(target,world,x,y); return
	var base: Color=world.COLORS[type]
	var n=type if y==0 else int(world.terrain[i-world.width])
	var s=type if y==world.height-1 else int(world.terrain[i+world.width])
	var w=type if x==0 else int(world.terrain[i-1])
	var e=type if x==world.width-1 else int(world.terrain[i+1])
	var phase=Vector2i(x%4,y%4)
	var key="water/%d/%d/%d/%d/%d/%s" % [type,n,s,w,e,phase]
	var origin=Vector2i(x,y)*PIXELS
	if world.ground_cache.has(key):
		target.blit_rect(world.ground_cache[key],Rect2i(0,0,PIXELS,PIXELS),origin); return
	var tile=Image.create(PIXELS,PIXELS,false,Image.FORMAT_RGBA8)
	var wet: bool=world.is_water(type)
	var wn: bool=world.is_water(n); var ws: bool=world.is_water(s)
	var ww: bool=world.is_water(w); var we: bool=world.is_water(e)
	for py in PIXELS:
		for px in PIXELS:
			var gx=phase.x*PIXELS+px; var gy=phase.y*PIXELS+py
			var color=base
			if wet:
				var shore=minf(minf(py if not wn else 99,11-py if not ws else 99),minf(px if not ww else 99,11-px if not we else 99))
				var lighter=minf(minf(py if wn and n>type and n<=2 else 99,11-py if ws and s>type and s<=2 else 99),minf(px if ww and w>type and w<=2 else 99,11-px if we and e>type and e<=2 else 99))
				if lighter<2: color=color.lerp(world.COLORS[mini(type+1,2)],.12*(1-lighter/2))
				if type in [world.SHALLOW,world.RIVER]:
					if shore<2: color=color.lerp(Color("c8dec8"),.24*(1-shore/2))
					if gy%4==0 and posmod(gx+(gy/4)%2*3,7)<4: color=color.lightened(.045)
				elif type==world.OCEAN:
					if gy%17==0 and gx%17<2: color=color.lightened(.016)
			elif type==world.BEACH:
				var shore=minf(minf(py if wn else 99,11-py if ws else 99),minf(px if ww else 99,11-px if we else 99))
				if shore<3: color=color.lerp(Color("c6cbab"),.24*(1-shore/3))
				if shore==0: color=color.lerp(Color("eaf0c6"),.16)
				if posmod(gy+gx/4,29)==0 and gx%4<2: color=color.lightened(.025)
			elif type==world.RIFT:
				color=Color("30382f")
				if w!=type and px<3: color=Color("6e7659") if px<2 else Color("4a553e")
				if n!=type and py<2: color=Color("9c997b")
				if s!=type and py>9 or e!=type and px>9: color=color.darkened(.18)
			tile.set_pixel(px,py,color)
	if world.ground_cache.size()>18000: world.ground_cache.clear()
	world.ground_cache[key]=tile
	target.blit_rect(tile,Rect2i(0,0,PIXELS,PIXELS),origin)

static func paint_fault(target: Image,world,x: int,y: int) -> void:
	var i: int=y*world.width+x
	var pale: bool=world.quake_scars[i]==2
	var base=Color("d5bd83") if pale else Color("b28b54")
	var sample: int=world.hash_cell(x/3,y/3,world.world_seed)
	base=base.lightened(float(sample%4)*.018)
	for py in PIXELS:
		for px in PIXELS:
			var color=base
			if posmod(x*PIXELS+px+(y*PIXELS+py)/3,37)==0: color=color.darkened(.04)
			if py<2 and y>0 and world.quake_scars[i-world.width]==0: color=color.lightened(.10)
			elif py>9 and y<world.height-1 and world.quake_scars[i+world.width]==0: color=color.darkened(.12)
			target.set_pixel(x*PIXELS+px,y*PIXELS+py,color)
