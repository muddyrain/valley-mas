extends "res://tests/terrain_runtime.gd"

func life_sheet(tag: String) -> void:
	await super.life_sheet(tag)
	var w=Fixtures.empty({"width":96,"height":72,"seed":17821,"trees":0})
	w.weather_enabled=false; w.spread_enabled=false
	w.begin_stroke(); w.paint(Vector2i(48,36),16,World.GRASS); w.end_stroke()
	w.begin_stroke(); w.paint(Vector2i(48,36),10,World.GRASS_SEEDS); w.end_stroke()
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	focus_cell(Vector2(48,36),5.0); await capture(tag+"-seed-edge")
	# A fast pointer move must fill the intermediate ground as well as both ends.
	game.view.tool=World.GRASS_SEEDS; game.view.radius=2
	w.begin_stroke(); game.view.last_cell=Vector2i(-100,-100)
	game.view.paint_at(game.view.camera+Vector2(38.5,28.5)*World.TILE*game.view.zoom)
	game.view.paint_at(game.view.camera+Vector2(57.5,28.5)*World.TILE*game.view.zoom)
	w.end_stroke(); await settle_surface()
	var missing=0
	for x in range(38,58):
		if w.bare_soil[28*w.width+x]>0: missing+=1
	check(missing==0,"Continuous grass-seed stroke has no skipped cells")
	game._select_tool(-1); await capture(tag+"-seed-stroke")
