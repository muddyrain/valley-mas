extends "res://tests/seasons_runtime.gd"

func run() -> void:
	Save.directory = "user://test-runs/canopy-%d" % Time.get_ticks_usec()
	Preferences.path = Save.directory+"/interface.cfg"
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	while game.loading != null: await process_frame
	var started = Time.get_ticks_usec()
	var natural = World.generate({"width":288,"height":192,"seed":48217,"trees":.85})
	metrics.generation_seconds = (Time.get_ticks_usec()-started)/1000000.0
	setup_world(natural)
	game._update_status()
	await capture("70-canopy-overview")
	game.view.set_distance(1)
	await capture("71-canopy-middle")
	game.view.set_distance(2)
	await capture("72-canopy-close")
	game.view.show_plants = false; game.view.queue_redraw()
	await capture("73-canopy-ground")
	game.view.show_plants = true
	game.view.camera = game.view.size/2-Vector2(218,104)*World.TILE*game.view.zoom
	game.view.queue_redraw()
	await capture("74-canopy-coast")
	await garden()
	await fertilizer()
	await catalog_pages()
	var file = FileAccess.open("res://test-output/canopy-runtime-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics})); file.close()
	print("AEON VALE CANOPY RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func garden() -> void:
	var w = Fixtures.empty({"width":216,"height":144,"seed":5912,"trees":0})
	for biome in 18:
		w.begin_stroke(); w.paint(Vector2i(18+(biome%6)*36,24+(biome/6)*48),15,World.GRASS,1); w.end_stroke()
	setup_world(w)
	game.view.radius=15; game.view.brush_shape=1
	await click(game.group_buttons[1])
	for biome in 18:
		game.tool_scroll.ensure_control_visible(game.tool_buttons[World.BIOME_TOOLS+biome])
		await click(game.tool_buttons[World.BIOME_TOOLS+biome])
		var cell = Vector2i(18+(biome%6)*36,24+(biome/6)*48)
		await cast(game.view.camera+(Vector2(cell)*World.TILE+Vector2(2,2))*game.view.zoom)
		check(w.biomes[cell.y*w.width+cell.x]==biome,"Actual seed input paints habitat %d" % biome)
	game._select_tool(-1)
	w.advance(World.YEAR_SECONDS*6); game.view.refresh_ecology(); game._update_status()
	await click(game.back_button)
	await capture("75-eighteen-habitats")
	check(Save.decode(Save.encode(w)).world != null,"All eighteen mature habitats persist")
	for row in 3:
		for pair in 3:
			game.view.zoom=4.0
			game.view.camera=game.view.size/2-Vector2(36+pair*72,24+row*48)*World.TILE*4
			game.view.queue_redraw()
			await capture("76-habitat-%d-%d" % [row,pair])

func fertilizer() -> void:
	var w = Fixtures.empty({"width":64,"height":48,"seed":239,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.BIRCH); w.prepare_ecology()
	var seeds: Array[int] = []
	for y in range(16,30,4):
		for x in range(24,42,4):
			var i = y*w.width+x
			w.sow(i,2); seeds.append(i)
	w.image=w.bake_image(); setup_world(w)
	game.view.zoom=5
	game.view.camera=game.view.size/2-Vector2(32,24)*World.TILE*5
	await click(game.group_buttons[1])
	game.tool_scroll.ensure_control_visible(game.tool_buttons[World.TREE_FERTILIZER])
	await click(game.tool_buttons[World.TREE_FERTILIZER])
	game.view.radius=12; game.view.brush_shape=1
	await capture("77-fertilizer-before")
	await cast(game.view.camera+Vector2(32,24)*World.TILE*5)
	check(w.plant_stage[seeds[0]]==World.ADULT,"Real fertilizer click matures the seedlings")
	check(w.surface_revision==0,"Fertilizer does not rebake an unchanged terrain surface")
	check(game.view.overview_weight()==0,"Small-map close view shows fully opaque tree silhouettes")
	await capture("78-fertilizer-applied-paused")
	check(w.plant_stage[seeds[0]]==World.ADULT,"Paused fertilizer completes active maturation")
	await click(game.pause_button)
	var started = Time.get_ticks_usec()
	await create_timer(1.15).timeout
	await capture("79-fertilizer-growing")
	await create_timer(3.0).timeout
	await click(game.pause_button)
	metrics.fertilizer_wall_seconds=(Time.get_ticks_usec()-started)/1000000.0
	var adults=0
	for i in seeds:
		if w.plant_stage[i]==World.ADULT: adults+=1
	check(adults==seeds.size(),"All fertilized existing birches mature after four actual seconds at 1x")
	game._select_tool(-1)
	await capture("80-fertilizer-grown")

func catalog_pages() -> void:
	for page in 3:
		var sheet = ColorRect.new()
		sheet.color=Color("f7f3e4"); sheet.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		game.add_child(sheet)
		var heading=game.label("纪元谷 · 草木图鉴  %d / 3" % (page+1),24,game.GOLD)
		heading.position=Vector2(40,20); sheet.add_child(heading)
		for slot in 24:
			var species=page*24+slot+1
			if species>World.Catalog.MAX_ID or species in [13,14]: continue
			var position=Vector2(35+(slot%6)*233,80+(slot/6)*185)
			for variation in 3:
				var sprite=TextureRect.new()
				sprite.texture=game.View.Flora.texture(species,World.ADULT,variation)
				sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
				sprite.position=position+Vector2(variation*62,0); sprite.size=Vector2(64,110)
				sprite.expand_mode=TextureRect.EXPAND_IGNORE_SIZE; sprite.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
				sheet.add_child(sprite)
			var caption=game.label(World.Catalog.NAMES[species-1],14,game.CREAM)
			caption.position=position+Vector2(12,118); sheet.add_child(caption)
		await capture("81-catalog-page-%d" % page)
		sheet.queue_free(); await process_frame
