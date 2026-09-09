extends RefCounted

const PATCH=96
const CREST_STEP=84
const INFLUENCE=11
const CREST_TEXTURE=preload("res://assets/terrain/snow-crests.png")
static var crests: Array[Image]=[]
static var small_crests: Array[Image]=[]

static func _static_init() -> void:
	var atlas=CREST_TEXTURE.get_image()
	atlas.convert(Image.FORMAT_RGBA8)
	for i in 4:
		var crest=atlas.get_region(Rect2i(i%2*64,i/2*48,64,48))
		small_crests.append(crest.duplicate())
		# Two source pixels form one art pixel, matching the bedrock's grid.
		crest.resize(128,96,Image.INTERPOLATE_NEAREST)
		crests.append(crest)

static func paint(target: Image, world, x: int, y: int) -> void:
	var pixel=Vector2i(x,y)*12
	if world.terrain[y*world.width+x]==world.HILLS:
		paint_hill(target,world,x,y); return
	var coordinate=Vector2i(pixel.x/PATCH,pixel.y/PATCH)
	if not world.mountain_cache.has(coordinate): world.mountain_cache[coordinate]=patch(world,coordinate)
	target.blit_rect(world.mountain_cache[coordinate],Rect2i(pixel-coordinate*PATCH,Vector2i(12,12)),pixel)

static func paint_hill(target: Image, world, x: int, y: int) -> void:
	var key="hill/%d/%d/%d"%[x,y,world.bare_soil[y*world.width+x]]
	if not world.ground_cache.has(key):
		# A changing hill cell needs only 12x12 pixels, not an entire 96x96
		# mountain patch or interpolated snow heights for its 63 neighbours.
		var tile=Image.create(12,12,false,Image.FORMAT_RGBA8)
		var mass=world.noise_for(world.world_seed+2711,.008,2)
		var detail=world.noise_for(world.world_seed+6217,.052,2)
		var base=Color("827b65") if world.bare_soil[y*world.width+x]>0 else Color("666860")
		for py in range(0,12,2):
			for px in range(0,12,2):
				var color=rock_color(base,mass.get_noise_2d(x*12+px,y*12+py),detail.get_noise_2d(x*12+px,y*12+py))
				tile.fill_rect(Rect2i(px,py,2,2),color)
		if world.ground_cache.size()>18000: world.ground_cache.clear()
		world.ground_cache[key]=tile
	target.blit_rect(world.ground_cache[key],Rect2i(0,0,12,12),Vector2i(x,y)*12)

static func rock_color(base: Color,shelf: float,stone: float) -> Color:
	if shelf>.18: base=base.lightened(.045)
	elif shelf<-.18: base=base.darkened(.04)
	if stone>.28: base=base.lightened(.03)
	elif stone<-.28: base=base.darkened(.035)
	return base

static func patch(world, coordinate: Vector2i) -> Image:
	var result=Image.create(PATCH,PATCH,false,Image.FORMAT_RGBA8)
	var origin=coordinate*PATCH
	var mass=world.noise_for(world.world_seed+2711,.008,2)
	var detail=world.noise_for(world.world_seed+6217,.052,2)
	# Quiet bedrock supports whole crest silhouettes. There is no binary white
	# elevation fill: each PNG owns its lit top, shaded face and exposed foot.
	for y in range(0,PATCH,2):
		for x in range(0,PATCH,2):
			var gx=origin.x+x; var gy=origin.y+y
			var cell=Vector2i(clampi(gx/12,0,world.width-1),clampi(gy/12,0,world.height-1))
			var i=cell.y*world.width+cell.x
			if world.terrain[i]!=world.MOUNTAIN: continue
			var shelf=mass.get_noise_2d(gx,gy)
			var stone=detail.get_noise_2d(gx,gy)
			var color=rock_color(Color("4f514d"),shelf,stone)
			result.fill_rect(Rect2i(x,y,2,2),color)
	# Enumerate the same world-anchored candidates in every patch, including
	# overlapping neighbours. Stable ordering keeps cache seams and reloads exact.
	var bounds=Rect2i(origin,Vector2i.ONE*PATCH).grow(92)
	for row in range(floori(bounds.position.y/float(CREST_STEP)),floori(bounds.end.y/float(CREST_STEP))+1):
		for column in range(floori(bounds.position.x/float(CREST_STEP)),floori(bounds.end.x/float(CREST_STEP))+1):
			var key=absi(hash(Vector3i(column,row,world.world_seed)))
			var center=Vector2i(column,row)*CREST_STEP+Vector2i(42,42)+Vector2i(key%49-24,(key/49)%49-24)
			var height=elevation_at(world,center.x,center.y)
			var ridge=mass.get_noise_2d(center.x,center.y)
			if height+ridge*.10 < .53+float((key/289)%100)*.001: continue
			var variant=absi(hash(Vector3i(column,row,world.world_seed+913)))%4
			var sprite: Image=crests[variant]
			var anchor=center-sprite.get_size()/2
			if not crest_site(world,Rect2i(anchor,sprite.get_size())):
				# Narrow summits use the same complete art at its native size.
				# This keeps little mountains readable without clipping a large cap.
				sprite=small_crests[variant]; anchor=center-sprite.get_size()/2
				if not crest_site(world,Rect2i(anchor,sprite.get_size())): continue
			var area=Rect2i(anchor,sprite.get_size()).intersection(Rect2i(origin,Vector2i.ONE*PATCH))
			for gy in range(area.position.y,area.end.y):
				for gx in range(area.position.x,area.end.x):
					var local=Vector2i(gx,gy)-origin
					if result.get_pixelv(local).a==0: continue
					var tone=sprite.get_pixel(gx-anchor.x,gy-anchor.y)
					if tone.a>0: result.set_pixelv(local,tone)
	return result

static func crest_site(world, footprint: Rect2i) -> bool:
	# Support the complete silhouette, so an outcrop never ends at an artificial
	# straight tile cut. The same finite footprint defines redraw dependencies.
	var first=Vector2i(floori(footprint.position.x/12.0),floori(footprint.position.y/12.0))
	var last=Vector2i(floori((footprint.end.x-1)/12.0),floori((footprint.end.y-1)/12.0))
	if first.x<0 or first.y<0 or last.x>=world.width or last.y>=world.height: return false
	for y in range(first.y,last.y+1):
		for x in range(first.x,last.x+1):
			if world.terrain[y*world.width+x]!=world.MOUNTAIN: return false
	return true

static func elevation_at(world, gx: int, gy: int) -> float:
	if world.elevation.size()!=world.terrain.size(): return .3
	var position=Vector2(gx,gy)/12-Vector2(.5,.5)
	var lo=Vector2i(position.floor()); var f=position-Vector2(lo)
	var a=clampi(lo.y,0,world.height-1)*world.width
	var b=clampi(lo.y+1,0,world.height-1)*world.width
	var left=clampi(lo.x,0,world.width-1); var right=clampi(lo.x+1,0,world.width-1)
	return lerpf(lerpf(world.elevation[a+left],world.elevation[a+right],f.x),lerpf(world.elevation[b+left],world.elevation[b+right],f.x),f.y)
