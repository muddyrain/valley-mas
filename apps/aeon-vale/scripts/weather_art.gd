extends RefCounted

static var clouds: Dictionary={}
const Tempest=preload("res://scripts/tempest_art.gd")

static func texture(variant: int=0, shadow: bool=false) -> ImageTexture:
	var key=Vector2i(variant%4,int(shadow))
	if clouds.has(key): return clouds[key]
	var image=Image.create(96,56,false,Image.FORMAT_RGBA8)
	# Discrete colours and a stepped contour remain readable at extreme zoom.
	var lobes=[Vector3(27,31,20),Vector3(43,22,20),Vector3(62,28,19),Vector3(73,34,15),Vector3(47,36,22)]
	for y in 56:
		for x in 96:
			var p=Vector2(x,y); var density=-10.0
			for n in lobes.size():
				var lobe: Vector3=lobes[n]
				var offset=Vector2(sin(n*2.3+variant)*4,cos(n*1.7+variant)*3)
				var d=(p-Vector2(lobe.x,lobe.y)-offset)*Vector2(.9,1.35)
				density=maxf(density,1.0-d.length()/lobe.z)
			var edge=sin(floorf(x/3.0)*1.6+variant)*.026+sin(floorf(y/2.0)*2.4)*.025
			if density<.04+edge: continue
			var color=Color(1,1,1,.9) if shadow else Color("b3cbd7")
			if not shadow:
				if density>.36+edge: color=Color("d0dfde")
				if density>.63+edge and y<34: color=Color("e7ede5")
				color.a=.52 if density<.13 else (.77 if density<.36 else .93)
			image.set_pixel(x,y,color)
	clouds[key]=ImageTexture.create_from_image(image)
	return clouds[key]

static func draw_body(canvas: CanvasItem, center: Vector2, radius: float, zoom: float, seed: int, strength: float, rainy: bool, acid: bool=false) -> void:
	var extent=Vector2(radius*3.4,radius*2.0)
	var opacity=lerpf(.75,.10,smoothstep(1.5,10.0,zoom))
	var shift=Vector2(radius*.20,radius*.68)
	canvas.draw_texture_rect(texture(seed%4,true),Rect2(center-extent*.5+shift,extent*Vector2(1,.65)),false,Color(.10,.21,.31,strength*.22*lerpf(1,.35,smoothstep(3,16,zoom))))
	var tint=Color(.78,.87,.92,strength*opacity*.58) if rainy else Color(1,1,1,strength*opacity)
	if acid: tint=Color(.75,.89,.42,strength*opacity*.65)
	canvas.draw_texture_rect(texture(seed%4),Rect2(center-extent*.5-Vector2(0,radius*.30),extent),false,tint)

static func draw(canvas: CanvasItem, world, camera: Vector2, zoom: float, viewport: Vector2, cloud_visibility: float=1.0) -> void:
	var visible=Rect2(-camera/zoom,viewport/zoom).grow(200)
	var tick: float=world.eco_remainder
	for cloud in world.fair_clouds if cloud_visibility>0 else []:
		var center=(Vector2(cloud.x,cloud.y)+Vector2(cloud.vx,cloud.vy)*tick)*world.TILE
		var radius: float=cloud.radius*world.TILE
		if not visible.intersects(Rect2(center-Vector2.ONE*radius*2,Vector2.ONE*radius*4)): continue
		var elapsed: float=cloud.duration-cloud.life+tick
		var strength=smoothstep(0,7,elapsed)*smoothstep(0,8,cloud.life-tick)
		draw_body(canvas,center,radius,zoom,int(cloud.seed),strength*cloud_visibility,false)
	var remaining=240
	for cloud in world.rain_clouds:
		var center=(Vector2(cloud.x,cloud.y)+Vector2(cloud.vx,cloud.vy)*tick)*world.TILE+Vector2(2,2)
		var radius=maxf(3,cloud.radius*world.TILE)
		if not visible.intersects(Rect2(center-Vector2.ONE*radius*2,Vector2.ONE*radius*4)): continue
		var elapsed: float=cloud.duration-cloud.life+tick
		var strength=clampf((elapsed+.8)/2,0,1)*clampf((cloud.life-tick)/2,0,1)
		var acid: bool=cloud.get("acid",false)
		if cloud_visibility>0: draw_body(canvas,center,radius,zoom,int(cloud.seed),strength*cloud_visibility,true,acid)
		var drops=mini(remaining,clampi(int(radius*radius*.012*minf(zoom,3)),10,100))
		var cloud_center=Vector2i(cloud.x,cloud.y)
		for n in drops:
			var sample: int=world.hash_cell(n,cloud.seed,37)
			var offset=Vector2i(sample%maxi(1,cloud.radius*2+1)-cloud.radius,(sample/997)%maxi(1,cloud.radius*2+1)-cloud.radius)
			if not world.Brush.contains(offset,int(cloud.radius),int(cloud.shape),cloud_center+offset): continue
			var t=fposmod(world.age*1.7+sample*.001,1)
			var base=center+Vector2(offset)*world.TILE
			Tempest.drop(canvas,base,t,strength*.83,acid,zoom)
		remaining-=drops
