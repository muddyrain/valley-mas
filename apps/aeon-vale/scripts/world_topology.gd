extends RefCounted

# Geometry uses the shorter map side as its unit. Circles stay round in a
# rectangular world; all deformations are bounded by the template's safe core.
static func point(w, i: int) -> Vector2:
	return (Vector2(i%w.width+.5,i/w.width+.5)-Vector2(w.width,w.height)*.5)/mini(w.width,w.height)

static func outline(p: Vector2, radius: Vector2, phase: float, coast: float) -> float:
	var q=p/radius
	var angle=q.angle()
	var lobes=sin(angle*3+phase)*.13+sin(angle*5-phase*.7)*.065+sin(angle*9+phase*2)*.020
	return (1+lobes*coast-q.length())*minf(radius.x,radius.y)

static func fit_outline(radius: Vector2, phase: float, coast: float, angle: float, half: Vector2) -> Vector2:
	var extent=Vector2.ZERO
	for n in 360:
		var a=n*TAU/360.0
		var lobes=sin(a*3+phase)*.13+sin(a*5-phase*.7)*.065+sin(a*9+phase*2)*.020
		var p=(Vector2(cos(a),sin(a))*radius*(1+lobes*coast)).rotated(angle)
		extent=extent.max(p.abs())
	return radius*minf(1,minf(half.x/extent.x,half.y/extent.y))

static func rounded_box(p: Vector2, half: Vector2, radius: float) -> float:
	var q=p.abs()-half+Vector2.ONE*radius
	return radius-maxf(q.x,q.y) if q.x<0 and q.y<0 else radius-q.max(Vector2.ZERO).length()

static func build(w, report: Callable) -> void:
	var rng=RandomNumberGenerator.new(); rng.seed=w.world_seed+4117
	var s: Dictionary=w.generation_settings
	var extent=lerpf(.32,.425,(s.land_size-1)/9.0)
	var coast: float=s.coast/10.0
	var phase=rng.randf_range(0,TAU)
	var angle=rng.randf_range(-.48,.48)
	var aspect: float=float(w.width)/mini(w.width,w.height)
	var main_radius=Vector2(extent*minf(1.4,aspect*.96),extent*.88)
	var fjord_radius=Vector2(extent*minf(1.49,aspect),extent*.93)
	var safe_half=Vector2(aspect*.5-.045,.455)
	main_radius=fit_outline(main_radius,phase,1+coast*.65,angle,safe_half)
	fjord_radius=fit_outline(fjord_radius,phase,.65+coast*.4,angle,safe_half)
	var blobs: Array=[]
	var lakes: Array=[]
	if w.template=="islands":
		# Seeded separated islands. Candidate rejection leaves navigable sea
		# between even the widest possible lobes, instead of placing a grid.
		# Reserve sea between islands before packing, including square worlds.
		var capacity=sqrt((aspect-.08)*.84*.48/(PI*s.islands))/1.32
		for k in s.islands:
			var radius=minf(lerpf(.097,.142,(s.land_size-1)/9.0),capacity)*rng.randf_range(.87,1.06)
			var best=Vector2.ZERO; var clearance=-INF
			for attempt in 600:
				var p=Vector2(rng.randf_range(-aspect*.5+.04+radius*1.3,aspect*.5-.04-radius*1.3),rng.randf_range(-.46+radius*1.3,.46-radius*1.3))
				var space=radius
				for other in blobs: space=minf(space,(p.distance_to(other[0])-.028)/1.3-other[1].x)
				if space>clearance: clearance=space; best=p
				if space>=radius: break
			radius=minf(radius,clearance)
			blobs.append([best,Vector2(radius,radius*rng.randf_range(.82,1.0)),rng.randf_range(0,TAU)])
	elif w.template in ["continent","fjords"]:
		# Attachments are placed beyond the main body's widest possible coast.
		var offshore_count: int=s.islands if w.template=="continent" else 1+abs(w.world_seed)%2
		var reserve=main_radius if w.template=="continent" else fjord_radius
		for k in offshore_count:
			var best: Array=[]
			for attempt in 120:
				var radius=rng.randf_range(.024,.047)
				var p=Vector2(rng.randf_range(-aspect*.5+.065,aspect*.5-.065),rng.randf_range(-.43,.43))
				if outline(p.rotated(-angle),reserve,phase,1+coast*.65)>-radius-.037: continue
				var clear=true
				for other in blobs:
					if p.distance_to(other[0])<radius+other[1].x+.03: clear=false
				if clear: best=[p,Vector2.ONE*radius,rng.randf_range(0,TAU)]; break
			if not best.is_empty(): blobs.append(best)
		for k in (2 if w.template=="continent" else 0):
			var a=phase+k*2.7
			var center=Vector2(cos(a)*main_radius.x,sin(a)*main_radius.y)*.95
			lakes.append([center,Vector2(main_radius.x*.25,main_radius.y*.25),a])
		if w.template=="continent" and rng.randf()<.65:
			lakes.append([Vector2(rng.randf_range(-.17,.17),rng.randf_range(-.13,.13)),Vector2(.033,.043),phase])
	elif w.template=="box_world":
		for k in s.lakes:
			var a=phase+k*TAU/s.lakes
			var p=Vector2(cos(a)*.29,sin(a)*.20)
			var r=lerpf(.18,.065,(s.land_size-1)/9.0)
			lakes.append([p,Vector2(r*1.25,r*.85),a])
	var detail=w.noise_for(w.world_seed+173,29,2)
	var count: int=w.terrain.size()
	w.elevation.resize(count); w.moisture.resize(count); w.warmth.resize(count)
	for i in count:
		var p=point(w,i)
		var q=p.rotated(-angle)
		var h=0.1
		match w.template:
			"continent":
				h=outline(q,main_radius,phase,1+coast*.65)
				for lake in lakes: h=minf(h,-outline(q-lake[0],lake[1],lake[2],.6+coast*.5))
			"islands": h=-1
			"boring_plains": h=.15
			"box_world":
				for lake in lakes: h=minf(h,-outline(p-lake[0],lake[1],lake[2],.5+coast))
			"donut":
				var outer=extent+sin(p.angle()*3+phase)*.008+sin(p.angle()*7-phase)*coast*.006
				var thickness=lerpf(.078,.155,(s.ring_width-1)/9.0)
				var inner=extent-thickness+sin(p.angle()*4-phase)*.012+sin(p.angle()*7+phase)*coast*.004
				h=minf(outer-p.length(),p.length()-inner)
			"toast": h=rounded_box(p,Vector2.ONE*extent,.057)+sin(p.x*32+phase)*sin(p.y*23)*coast*.004
			"pancake": h=extent-p.length()+sin(p.angle()*5+phase)*coast*.006
			"fjords":
				h=outline(q,fjord_radius,phase,.65+coast*.4)
				var center=sin(q.y*9+phase)*.042+sin(q.y*18-phase)*coast*.012
				var channel=lerpf(.028,.066,(s.strait_width-1)/9.0)
				var inlets=pow(maxf(0,sin(q.y*23+phase)),6)*coast*.048
				h=minf(h,absf(q.x-center)-channel-inlets)
		for blob in blobs: h=maxf(h,outline(p-blob[0],blob[1],blob[2],.8+coast*.6))
		if w.template not in ["boring_plains","box_world"]:
			h=minf(h,aspect*.5-absf(p.x)-.025)
			h=minf(h,.475-absf(p.y))
		if w.template not in ["boring_plains","donut"]: h+=detail.get_noise_2d(p.x,p.y)*coast*.005
		w.elevation[i]=clampf(h,-.5,.2)
		w.terrain[i]=w.GRASS if h>0 else w.DEEP
		if i% (w.width*24)==0 and report.is_valid(): report.call(.08+.22*i/count,"铺展陆块 · 勾勒海岸")

static func mountains(w, sea_distance: PackedFloat32Array) -> void:
	if w.template not in ["continent","box_world","islands","fjords"]: return
	var rng=RandomNumberGenerator.new(); rng.seed=w.world_seed+8183
	var paths: Array=[]
	var count=2 if w.template!="islands" else 3
	var unit: float=mini(w.width,w.height)
	# Put ranges inside wide land, far apart, with tapered ends and a pass.
	for k in count:
		var best=-1; var score=-INF
		for trial in 180:
			var i=rng.randi_range(0,w.terrain.size()-1)
			if w.terrain[i]==w.DEEP or sea_distance[i]<unit*.065: continue
			var p=point(w,i)
			if absf(p.x)>.57 or absf(p.y)>.35: continue
			var value=sea_distance[i]/unit+rng.randf()*.09
			for path in paths: value=minf(value,p.distance_to(path[0])-.14)
			if value>score: best=i; score=value
		if best<0 or score<.01: continue
		var p=point(w,best)
		var axis=Vector2.from_angle(rng.randf_range(0,TAU))
		var length=rng.randf_range(.13,.24) if w.template!="islands" else rng.randf_range(.08,.13)
		var points: Array[Vector2]=[]
		for j in 7:
			var t=(j/6.0-.5)*2
			points.append(p+axis*length*t+axis.orthogonal()*sin(t*3.5+k)*.025)
		paths.append([p,points,rng.randf_range(.047,.069) if w.template!="islands" else rng.randf_range(.024,.037)])
	var relief=w.noise_for(w.world_seed+4911,24,2)
	for i in w.terrain.size():
		if w.template=="box_world" and (i%w.width<maxi(2,roundi(unit*.028)) or i%w.width>=w.width-maxi(2,roundi(unit*.028)) or i/w.width<maxi(2,roundi(unit*.028)) or i/w.width>=w.height-maxi(2,roundi(unit*.028))):
			w.terrain[i]=w.MOUNTAIN; w.elevation[i]=.32; continue
		if w.terrain[i]==w.DEEP: continue
		var p=point(w,i)
		if sea_distance[i]<unit*.027: continue
		var ridge=0.0
		for path in paths:
			for j in 6:
				var a: Vector2=path[1][j]; var b: Vector2=path[1][j+1]
				var t=clampf((p-a).dot(b-a)/(b-a).length_squared(),0,1)
				var along=(j+t)/6.0
				var taper=smoothstep(0,.18,along)*(1-smoothstep(.82,1,along))
				var pass_width=.065
				var gap=smoothstep(pass_width,pass_width+.07,absf(along-.58))
				var width: float=path[2]*(.64+.26*sin(along*PI)+.24*sin(along*16+path[0].x*9))*(1+relief.get_noise_2d(p.x,p.y)*.55)
				var value=(1-smoothstep(width*.25,width,p.distance_to(a.lerp(b,t))))*taper*gap
				ridge=maxf(ridge,value)
		if ridge>.38: w.terrain[i]=w.MOUNTAIN; w.elevation[i]=.29+ridge*.44
		elif ridge>.08: w.terrain[i]=w.HILLS; w.elevation[i]=.16+ridge*.2
