extends RefCounted

# Original pixel frames are prepared once. Funnel animation never repaints terrain.
static var funnels: Array[Texture2D]=[]
static var flames: Array[Texture2D]=[]

static func prepare() -> void:
	if not funnels.is_empty(): return
	var atlas_image=Image.create(384,408,false,Image.FORMAT_RGBA8)
	for frame in 8:
		var image=Image.create(16,24,false,Image.FORMAT_RGBA8)
		for y in 24:
			for x in 16:
				var fill=false
				for tongue in 3:
					var tip=3+((frame+tongue*3)%5)+tongue%2*3
					var center=4+tongue*4+sin(y*.35+frame+tongue)*1.4
					var width=1.0+(y-tip)*.15
					if y>=tip and absf(x-center)<width: fill=true
				if not fill: continue
				var color=Color("ef7139")
				if y>10 and absf(x-8)<(y-8)*.35: color=Color("ffbd45")
				if y>17 and absf(x-8)<2: color=Color("fff1a1")
				image.set_pixel(x,y,color)
		atlas_image.blit_rect(image,Rect2i(0,0,16,24),Vector2i(frame*16,384))
	for frame in 24:
		var image=Image.create(64,96,false,Image.FORMAT_RGBA8)
		var phase=frame*TAU/24.0
		for y in range(10,88):
			var height=float(87-y)/77
			var half=1.2+pow(height,.82)*25
			var center=32+sin(height*4.2-phase)*height*4+sin(height*8+phase)*2
			for x in range(maxi(0,floori(center-half)),mini(64,ceili(center+half))):
				var across=(x-center)/half
				var stripe=fposmod(y+sin(across*2.3+phase)*3.5+phase*5,9)
				var color=Color("96b6c4")
				if across<-.45: color=Color("c1dce0")
				elif across>.58: color=Color("7093a8")
				if stripe<2.2: color=Color("d8e8df")
				elif stripe>7: color=color.darkened(.12)
				color.a=.88 if absf(across)<.9 else .66
				# The broad mouth is a shallow, dark ellipse with a pale rim.
				var rim=pow((x-center)/half,2)+pow((y-15)/6.0,2)
				if y<15 and rim>1: continue
				if y<21 and rim<1: color=Color("738fa2") if rim<.65 else Color("bdd4db")
				image.set_pixel(x,y,color)
		atlas_image.blit_rect(image,Rect2i(0,0,64,96),Vector2i(frame%6*64,frame/6*96))
	var atlas=ImageTexture.create_from_image(atlas_image)
	for frame in 24:
		var texture=AtlasTexture.new(); texture.atlas=atlas
		texture.region=Rect2(frame%6*64,frame/6*96,64,96)
		funnels.append(texture)
	for frame in 8:
		var texture=AtlasTexture.new(); texture.atlas=atlas
		texture.region=Rect2(frame*16,384,16,24)
		flames.append(texture)

static func tornado(canvas: CanvasItem, world, storm: Dictionary, zoom: float) -> void:
	prepare()
	var fraction: float=world.eco_remainder
	var amount: float=world.Forces.tornado_scale(storm,fraction)
	var position=(Vector2(storm.x,storm.y)+Vector2(storm.vx,storm.vy)*fraction).clamp(Vector2.ZERO,Vector2(world.width-1,world.height-1))*world.TILE+Vector2(2,2)
	var width=maxf(12,storm.radius*world.TILE*2)*amount
	var height=maxf(44,storm.radius*world.TILE*2.5)*amount
	var time: float=24-storm.life+fraction
	var frame=posmod(floori(time*16+storm.get("phase",0)*4),24)
	var shadow=PackedVector2Array()
	for n in 12:
		var a=n*TAU/12
		shadow.append(position+Vector2(cos(a)*width*.46,sin(a)*width*.15+3*amount))
	canvas.draw_colored_polygon(shadow,Color(.12,.24,.30,.23*amount))
	canvas.draw_texture_rect(funnels[frame],Rect2(position-Vector2(width*.5,height*.9),Vector2(width,height)),false)
	if zoom<1: return
	for n in 9:
		var a=time*5+n*2.4
		var p=position+Vector2(cos(a)*width*.20,sin(a)*width*.09)-Vector2(0,(n%3)*height*.10)
		canvas.draw_rect(Rect2(p.round(),Vector2(1.3,.7)),Color(.70,.65,.43,amount*.75))

static func drop(canvas: CanvasItem, base: Vector2, phase: float, strength: float, acid: bool, zoom: float) -> void:
	var color=Color("a8ea36") if acid else Color("42cfff")
	var highlight=Color("e0f98d") if acid else Color("d1f8ff")
	color.a=strength; highlight.a=strength*.9
	var pixel=clampf(1/maxf(zoom,.2),.5,1)
	if phase<.78:
		var fall=phase/.78
		var p=(base+Vector2(3*(1-fall),-26*(1-fall))).snapped(Vector2.ONE*pixel)
		canvas.draw_rect(Rect2(p,Vector2(pixel,3*pixel)),color)
		canvas.draw_rect(Rect2(p+Vector2(-pixel,2*pixel),Vector2(3*pixel,2*pixel)),color)
		canvas.draw_rect(Rect2(p+Vector2(0,2*pixel),Vector2(pixel,2*pixel)),highlight)
	else:
		var t=(phase-.78)/.22
		color.a*=1-t; highlight.a*=1-t
		var spread=pixel*(1+t*3)
		for offset in [Vector2(-spread,-pixel),Vector2(spread,0),Vector2(0,-spread)]:
			canvas.draw_rect(Rect2(base+offset,Vector2.ONE*pixel),highlight)
		canvas.draw_rect(Rect2(base-Vector2(spread,0),Vector2(spread*2,pixel)),color)

static func lightning(canvas: CanvasItem, center: Vector2, radius: int, time: float, seed: int) -> void:
	if time>.48: return
	var alpha=1.0 if time<.10 or (time>.17 and time<.25) else .24*(1-time/.48)
	var height=74+radius*2
	var bolt=PackedVector2Array()
	for n in 8:
		var sway=sin(n*4.7+seed)*5 if n<7 else 0.0
		bolt.append((center+Vector2(sway,-height*(1-n/7.0))).round())
	canvas.draw_polyline(bolt,Color(.49,.83,1,alpha*.35),6,false)
	canvas.draw_polyline(bolt,Color(1,1,.93,alpha),2.8,false)
	for n in [2,4]:
		var direction=-1 if n==2 else 1
		var p=bolt[n]
		canvas.draw_polyline(PackedVector2Array([p,p+Vector2(direction*9,-4),p+Vector2(direction*7,-12),p+Vector2(direction*14,-21)]),Color(.9,.99,1,alpha*.85),1,false)
	for n in 8:
		var a=n*TAU/8
		var p=center+Vector2(cos(a),sin(a))*(3+time*20)
		canvas.draw_rect(Rect2(p,Vector2(1.2,1.2)),Color(1,.89,.57,alpha*(1-time*2)))

static func waves(canvas: CanvasItem, world, visible: Rect2, zoom: float) -> void:
	var count=0
	for n in 180:
		var x: int=world.hash_cell(n,8,world.world_seed)%world.width
		var y: int=world.hash_cell(n,27,world.world_seed)%world.height
		if world.terrain[y*world.width+x]>world.SHALLOW: continue
		var t=fposmod(world.age*.16+n*.618,1)
		if t>.64: continue
		var p=Vector2(x,y)*world.TILE+Vector2(t*3,0)
		if not visible.has_point(p): continue
		var opacity=sin(t/.64*PI)*.72
		var pixel=clampf(1/maxf(zoom,.3),.5,1)
		var tint=Color(.86,.96,1,opacity)
		for offset in [Vector2(0,-2),Vector2(1,-1),Vector2(1,0),Vector2(0,1)]:
			canvas.draw_rect(Rect2(p+offset*pixel,Vector2.ONE*pixel),tint)
		count+=1
		if count>=64: break
