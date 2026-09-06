extends RefCounted

const Earthquake=preload("res://scripts/earthquake.gd")

# Persistent effects use world seconds and deterministic cell hashes; drawing owns no simulation.
static func ignite(w, i: int) -> void:
	if w.fires.size() >= 2048 or w.is_water(w.terrain[i]) or w.plants[i] == 0: return
	if not w.fires.has(i): w.fires[i] = 12.0

static func cast(w, center: Vector2i, radius: int, shape: int, tool: int) -> Rect2i:
	if tool==w.EARTHQUAKE: return Earthquake.cast(w,center,radius,shape)
	var cells = w.brush_cells(center,radius,shape)
	var touched = false
	var bounds = Rect2i(0,0,w.width,w.height)
	if tool in [w.RAIN,w.ACID_RAIN]:
		w.Weather.add_cloud(w,center,radius,shape,false,tool==w.ACID_RAIN)
	if tool == w.TORNADO:
		if not bounds.has_point(center) or w.tornadoes.size() >= 20: return Rect2i()
		var angle = w.hash_cell(center.x,center.y,w.eco_tick+w.world_seed)*.01
		w.tornadoes.append({"x":float(center.x),"y":float(center.y),"vx":snappedf(cos(angle)*1.1,.01),"vy":snappedf(sin(angle)*1.1,.01),"life":24.0,"radius":radius,"shape":shape,"phase":snappedf(fposmod(angle,TAU),.01)})
		touched = true
	w.casting=true
	for p in cells:
		var i: int = p.y*w.width+p.x
		if not w.tool_affects(i,tool): continue
		var previous = w.cell_state(i)
		match tool:
			w.LIGHTNING:
				if w.hash_cell(p.x,p.y,w.eco_tick)%3 == 0: ignite(w,i)
				w.kill_plant(i)
			w.FIRE: ignite(w,i)
			w.RAIN: w.fires.erase(i)
			w.ACID_RAIN: w.kill_plant(i)
			w.TORNADO:
				if w.Brush.contains(p-center,tornado_radius(w.tornadoes.back()),shape,p): w.kill_plant(i)
		if previous != w.cell_state(i): w.stroke[i] = {"before":previous,"after":w.cell_state(i)}
		touched = true
	w.casting=false
	if touched:
		w.stroke_changed = true
		if w.disaster_events.size() < 96: w.disaster_events.append({"tool":tool,"x":center.x,"y":center.y,"radius":radius,"shape":shape,"started":w.age})
	var area = Rect2i(center-Vector2i.ONE*radius,Vector2i.ONE*(radius*2+1)).grow(1).intersection(bounds)
	if tool == w.EARTHQUAKE: w.refresh_tiles(area)
	return Rect2i(area.position*w.TILE,area.size*w.TILE)

static func tornado_scale(storm: Dictionary, fraction: float=0) -> float:
	var life=clampf(float(storm.life)-fraction,0,24)
	if life<=0: return 0
	return .12+.88*pow(maxf(0,sin(PI*(24-life)/24)),.8)

static func tornado_radius(storm: Dictionary) -> int:
	return mini(int(storm.radius),maxi(0,roundi(float(storm.radius)*tornado_scale(storm))))

static func step(w) -> void:
	var spread: Array[int] = []
	for i in w.fires.keys():
		if w.is_water(w.terrain[i]): w.fires.erase(i); continue
		w.fires[i] -= 1.0
		if w.fires[i] <= 9 and w.plants[i] > 0:
			w.kill_plant(i)
			w.remove_plant(i,"clear")
		if w.fires[i] <= 0: w.fires.erase(i); continue
		for offset in [Vector2i(2,0),Vector2i(-2,0),Vector2i(0,2),Vector2i(0,-2)]:
			var p = Vector2i(i%w.width,i/w.width)+offset
			if not Rect2i(0,0,w.width,w.height).has_point(p): continue
			var other: int = p.y*w.width+p.x
			if w.plants[other] > 0 and w.hash_cell(other,w.eco_tick,w.world_seed)%100 < 28: spread.append(other)
	for i in spread: ignite(w,i)
	for storm in w.tornadoes:
		storm.life -= 1
		if storm.life<=0: continue
		var velocity=Vector2(storm.vx,storm.vy).rotated(.32*sin((24-storm.life)*.65+storm.get("phase",0)))
		storm.vx=snappedf(velocity.x,.01); storm.vy=snappedf(velocity.y,.01)
		storm.x=float(roundi(storm.x*100)+roundi(storm.vx*100))/100.0
		storm.y=float(roundi(storm.y*100)+roundi(storm.vy*100))/100.0
		if storm.x < 0 or storm.x > w.width-1: storm.vx *= -1; storm.x = clampf(storm.x,0,w.width-1)
		if storm.y < 0 or storm.y > w.height-1: storm.vy *= -1; storm.y = clampf(storm.y,0,w.height-1)
		for p in w.brush_cells(Vector2i(storm.x,storm.y),tornado_radius(storm),int(storm.shape)):
			w.kill_plant(p.y*w.width+p.x)
	for n in range(w.tornadoes.size()-1,-1,-1):
		if w.tornadoes[n].life <= 0: w.tornadoes.remove_at(n)
	for n in range(w.disaster_events.size()-1,-1,-1):
		if w.age-w.disaster_events[n].started > 2: w.disaster_events.remove_at(n)
