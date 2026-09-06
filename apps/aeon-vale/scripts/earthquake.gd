extends RefCounted

# One cast chooses a fault family and one displacement direction. Rendering reads
# the same paths that changed the land; no separate decorative crater mask.
static func paths(center: Vector2i, radius: int, seed: int) -> Array[PackedVector2Array]:
	var rng=RandomNumberGenerator.new(); rng.seed=seed
	var angle=rng.randf_range(0,TAU)
	var axis=Vector2.from_angle(angle); var normal=axis.orthogonal()
	var reach=maxf(1,radius*1.25)
	var main=PackedVector2Array()
	for n in 7:
		var along=(n-3)/3.0*reach
		main.append(Vector2(center)+axis*along+normal*rng.randf_range(-reach*.15,reach*.15))
	var result: Array[PackedVector2Array]=[main]
	for n in 2:
		var branch=PackedVector2Array([main[2+n*2]])
		var direction=axis.rotated((1 if n==0 else -1)*rng.randf_range(.7,1.2))
		for k in range(1,4):
			branch.append(branch[0]+direction*reach*k*.29+direction.orthogonal()*rng.randf_range(-reach*.09,reach*.09))
		result.append(branch)
	return result

static func cast(w, center: Vector2i, radius: int, shape: int) -> Rect2i:
	var bounds=Rect2i(0,0,w.width,w.height)
	if not bounds.has_point(center): return Rect2i()
	var seed: int=w.hash_cell(center.x,center.y,w.world_seed+w.revision*191+w.eco_tick*37)
	var faults=paths(center,radius,seed)
	var levels=[w.DEEP,w.OCEAN,w.SHALLOW,w.BEACH,w.GRASS,w.FOREST,w.HILLS,w.MOUNTAIN]
	var heights=[-.8,-.4,-.1,0.0,.10,.17,.32,.65]
	var direction=1 if seed%2==0 else -1
	if w.terrain[center.y*w.width+center.x]==w.DEEP: direction=1
	elif w.terrain[center.y*w.width+center.x]==w.MOUNTAIN: direction=-1
	var band=maxf(1.25,radius*.27)
	var touched=false
	w.casting=true
	for p in w.brush_cells(center,radius,shape):
		var distance=INF
		for line in faults:
			for n in range(1,line.size()):
				distance=minf(distance,Vector2(p).distance_to(Geometry2D.get_closest_point_to_segment(Vector2(p),line[n-1],line[n])))
		if distance>band: continue
		var i: int=p.y*w.width+p.x
		var previous=w.cell_state(i)
		var level=levels.find(w.terrain[i]); level=4 if level<0 else level
		var amount=clampi(ceili((1-distance/band)*3),1,3)
		level=clampi(level+amount*direction,0,levels.size()-1)
		w.kill_plant(i); w.fires.erase(i)
		w.terrain[i]=levels[level]; w.elevation[i]=heights[level]
		w.quake_scars[i]=0
		w.bare_soil[i]=int(w.terrain[i] in [w.GRASS,w.FOREST,w.HILLS])
		w.reconcile_habitat(i)
		w.dirty_rows[p.y/8]=true; w.site_dirty_rows[p.y/8]=true
		if previous!=w.cell_state(i):
			if not w.stroke.has(i): w.stroke[i]={"before":previous,"after":w.cell_state(i)}
			else: w.stroke[i].after=w.cell_state(i)
			touched=true
	w.casting=false
	if touched:
		w.stroke_changed=true
		if w.disaster_events.size()<96:
			w.disaster_events.append({"tool":w.EARTHQUAKE,"x":center.x,"y":center.y,"radius":radius,"shape":shape,"started":w.age,"faults":faults,"seed":seed})
	var area=Rect2i(center-Vector2i.ONE*radius,Vector2i.ONE*(radius*2+1)).grow(1).intersection(bounds)
	w.refresh_tiles(area)
	return Rect2i(area.position*w.TILE,area.size*w.TILE)

static func draw(canvas: CanvasItem, event: Dictionary, elapsed: float, zoom: float) -> void:
	var fade=1-smoothstep(.65,1.5,elapsed)
	var phase=clampf(elapsed/.4,0,1)
	var paths: Array=event.get("faults",[])
	var budget=64
	for line in paths:
		for n in range(1,line.size()):
			var start: Vector2=line[n-1]*4+Vector2(2,2)
			var end: Vector2=line[n]*4+Vector2(2,2)
			var count=maxi(1,ceili(start.distance_to(end)/5.0))
			for k in count:
				if budget<=0: return
				var p=start.lerp(end,float(k)/count)
				var tile=Vector2i((p-Vector2(2,2))/4)
				if not preload("res://scripts/brush_mask.gd").contains(tile-Vector2i(event.x,event.y),event.radius,event.shape,tile): continue
				var delay=float(n-1)/line.size()*.23+k*.008
				var t=maxf(0,elapsed-delay)
				if t<=0 or phase<(n-1.0)/line.size(): continue
				var lift=Vector2(sin(k*2.1+n)*t*4,-t*7)
				var size=Vector2(3+t*4,2+t*2)
				canvas.draw_rect(Rect2((p+lift-size*.5).round(),size.ceil()),Color(.77,.69,.50,fade*.34))
				canvas.draw_rect(Rect2((p+lift+Vector2(1,-2)).round(),Vector2.ONE*maxf(.65,1.5/zoom)),Color(.92,.86,.67,fade*.55))
				budget-=1
