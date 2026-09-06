extends RefCounted

const MAX_CLOUDS=12
const MAX_FAIR_CLOUDS=4

static func add_fair_cloud(w) -> void:
	if w.fair_clouds.size()>=MAX_FAIR_CLOUDS: return
	w.fair_cycle+=1
	var sample: int=w.hash_cell(w.fair_cycle,891,w.world_seed)
	var duration=140.0+sample%81
	var radius=clampi(mini(w.width,w.height)/9,8,24)
	w.fair_clouds.append({"x":float(sample%w.width),"y":float((sample/997)%w.height),"vx":float(30+sample%36)/100.0,"vy":float(sample%13-6)/100.0,"life":duration,"duration":duration,"radius":radius,"seed":sample})

static func step_fair(w) -> void:
	for n in range(w.fair_clouds.size()-1,-1,-1):
		var cloud=w.fair_clouds[n]
		cloud.life-=1.0
		# Whole simulation steps use hundredths of a cell; interpolation stays smooth,
		# while decimal JSON round trips cannot accumulate position drift.
		cloud.x=float(roundi(cloud.x*100)+roundi(cloud.vx*100))/100.0
		cloud.y=float(roundi(cloud.y*100)+roundi(cloud.vy*100))/100.0
		if cloud.life<=0 or cloud.x>w.width+cloud.radius*2: w.fair_clouds.remove_at(n)
	if not w.weather_enabled: return
	w.fair_due-=1
	if w.fair_due<=0:
		add_fair_cloud(w)
		w.fair_due=38+w.hash_cell(w.fair_cycle,991,w.world_seed)%33

static func add_cloud(w, center: Vector2i, radius: int, shape: int, natural: bool=false, acid: bool=false) -> void:
	if not Rect2i(0,0,w.width,w.height).has_point(center): return
	if not natural:
		for cloud in w.rain_clouds:
			if not cloud.natural and cloud.get("acid",false)==acid and cloud.radius==radius and cloud.shape==shape and Vector2(cloud.x,cloud.y).distance_to(Vector2(center))<maxf(2,radius*.6):
				cloud.life=cloud.duration
				return
	if w.rain_clouds.size()>=MAX_CLOUDS: return
	w.weather_cycle+=1
	var sample: int=w.hash_cell(center.x,center.y,w.world_seed+w.weather_cycle*97)
	var duration=10.0+sample%11
	w.rain_clouds.append({"x":float(center.x),"y":float(center.y),"vx":.45+(sample%60)*.01,"vy":-.2+(sample%41)*.01,"life":duration,"duration":duration,"radius":radius,"shape":shape,"seed":sample,"natural":natural,"acid":acid})

static func step(w) -> void:
	step_fair(w)
	for cloud in w.rain_clouds:
		cloud.life-=1.0
		cloud.x=clampf(cloud.x+cloud.vx,0,w.width-1)
		cloud.y=clampf(cloud.y+cloud.vy,0,w.height-1)
		if cloud.x==w.width-1 or cloud.x==0: cloud.vx=-cloud.vx
		if cloud.y==w.height-1 or cloud.y==0: cloud.vy=-cloud.vy
		var center=Vector2i(cloud.x,cloud.y)
		if cloud.get("acid",false):
			for p in w.brush_cells(center,int(cloud.radius),int(cloud.shape)): w.kill_plant(p.y*w.width+p.x)
			continue
		for i in w.fires.keys():
			var cell=Vector2i(i%w.width,i/w.width)
			if w.Brush.contains(cell-center,int(cloud.radius),int(cloud.shape),cell): w.fires.erase(i)
	for n in range(w.rain_clouds.size()-1,-1,-1):
		if w.rain_clouds[n].life<=0: w.rain_clouds.remove_at(n)
	if not w.weather_enabled: return
	w.weather_due-=1
	if w.weather_due>0: return
	var best=Vector2i.ZERO; var best_score=-1.0
	for n in 6:
		var sample: int=w.hash_cell(w.weather_cycle,n,w.world_seed+5719)
		var point=Vector2i(sample%w.width,(sample/997)%w.height)
		var i: int=point.y*w.width+point.x
		var score: float=w.moisture[i]+(.4 if not w.is_water(w.terrain[i]) else 0)
		if score>best_score: best=point; best_score=score
	add_cloud(w,best,clampi(mini(w.width,w.height)/9,10,28),0,true)
	w.weather_due=int(w.YEAR_SECONDS)+w.hash_cell(w.weather_cycle,0,w.world_seed+773)%(int(w.YEAR_SECONDS*2)+1)
