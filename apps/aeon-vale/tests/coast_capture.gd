extends "res://tests/seasons_runtime.gd"

func run() -> void:
	Save.directory="user://test-runs/coast-%d" % Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	var w=World.generate({"width":288,"height":192,"seed":68324,"template":"continent","trees":.85})
	setup_world(w); game._select_category(-1)
	var best=-INF; var point=Vector2(100,80)
	for y in range(20,w.height-20,4):
		for x in range(24,w.width-24,4):
			if w.biomes[y*w.width+x]!=World.BIRCH or w.terrain[y*w.width+x] not in [World.GRASS,World.FOREST]: continue
			var water=0; var rocks=0
			for oy in range(-12,13,6):
				for ox in range(-24,25,6):
					var type: int=w.terrain[(y+oy)*w.width+x+ox]
					if World.is_water(type): water+=1
					if type==World.MOUNTAIN: rocks+=1
			var score=water*(45-water)-rocks*28
			if score>best: best=score; point=Vector2(x,y)
	game.view.zoom=4.6; game.view.camera=game.view.size/2-point*World.TILE*4.6
	await capture("118-coast-native")
	print("COAST CAPTURE: "+str(point))
	quit()
