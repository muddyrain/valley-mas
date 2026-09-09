extends "res://tests/refinement_runtime.gd"

func run() -> void:
	var args=OS.get_cmdline_user_args()
	var tag=args[0] if not args.is_empty() else "art-after"
	Save.directory="user://test-runs/art-%d"%Time.get_ticks_usec()
	Preferences.path=Save.directory+"/interface.cfg"
	game=load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	await process_frame
	while game.loading!=null: await process_frame
	DisplayServer.window_set_size(Vector2i(1600,1000)); await process_frame
	var w=Fixtures.empty({"width":128,"height":96,"seed":17821,"trees":0})
	w.terrain.fill(World.FOREST); w.elevation.fill(.1)
	var types=[World.MEADOW,World.BIRCH,World.MUSHROOM,World.CRYSTAL]
	var ids=[1,2,54,58]
	for i in w.terrain.size(): w.biomes[i]=types[mini(3,(i%w.width)/32)]
	w.prepare_ecology(); w.weather_enabled=false; w.spread_enabled=false
	for y in range(10,86,6):
		for x in range(5,124,6):
			var i=y*w.width+x
			w.plants[i]=ids[mini(3,x/32)]; w.plant_age[i]=w.maturity(i)*2; w.plant_stage[i]=World.ADULT
	w.prepare_ecology(); w.image=w.bake_image(); setup_world(w)
	game._select_category(-1); game._select_tool(-1); game._update_status()
	for z in [.85,2.2,5.0]:
		focus_cell(Vector2(64,48),z); await capture(tag+"-target-"+str(z))
	if tag=="art-target": quit(); return
	await life_sheet(tag)
	await biome_review(tag)
	await live_overview()
	await motion_sample()
	FileAccess.open("res://test-output/"+tag+".json",FileAccess.WRITE).store_string(JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics},"\t"))
	print("ART RUNTIME: "+JSON.stringify({"checks":checks,"failures":failures,"metrics":metrics}))
	quit(0 if failures.is_empty() else 1)

func biome_review(tag: String) -> void:
	for biome in 18:
		var w=Fixtures.empty({"width":96,"height":72,"seed":17821,"trees":0})
		w.terrain.fill(World.FOREST); w.biomes.fill(biome); w.elevation.fill(.1)
		w.prepare_ecology(); w.weather_enabled=false; w.spread_enabled=false
		World.Landscape.populate(w,.62,Callable())
		w.prepare_ecology(); w.image=w.bake_image(); setup_world(w)
		game._select_tool(-1); game._update_status()
		for z in [1.1,4.0]:
			focus_cell(Vector2(48,36),z); await capture(tag+"-biome-%02d-"%biome+str(z))
		check(w.plant_count()>0,"Biome %d retains its actual populated vegetation"%biome)
	# All 70 objects, viewed through the actual engine atlas, at native and 2x size.
	var panel=ColorRect.new(); panel.color=Color("b4ce7a")
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); game.add_child(panel)
	for species in range(1,71):
		var at=Vector2((species-1)%10*140+18,(species-1)/10*122+8)
		var label_node=game.label(World.Catalog.NAMES[species-1],15,game.CREAM)
		label_node.position=at; panel.add_child(label_node)
		for scale_factor in [1,2]:
			var sprite=TextureRect.new(); sprite.texture=game.View.Flora.texture(species,World.ADULT,2)
			sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
			sprite.position=at+Vector2(8 if scale_factor==2 else 91,21 if scale_factor==2 else 62)
			sprite.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
			sprite.size=Vector2(40,48)*scale_factor; panel.add_child(sprite)
	await capture(tag+"-catalog"); panel.queue_free(); await process_frame
