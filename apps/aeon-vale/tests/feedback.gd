extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
var checks=0
var failures: Array=[]

func check(ok: bool, message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func _initialize() -> void:
	var w=Fixtures.empty({"width":32,"height":32,"seed":98417,"trees":0})
	for biome in World.BIOME_NAMES.size():
		for tool in [World.TREE_FERTILIZER,World.PLANT_FERTILIZER]:
			w.terrain.fill(World.HILLS); w.biomes.fill(biome); w.plants.fill(0); w.objects.fill(0)
			w.plant_stage.fill(0); w.plant_age.fill(0); w.boost.fill(0); w.life_limit.fill(0)
			w.prepare_ecology(); w.begin_stroke()
			w.paint(Vector2i(16,16),12,tool); w.end_stroke()
			var correct=true
			for i in w.plants.size():
				if w.plants[i]>0:
					correct=correct and w.can_live(i,w.plants[i]) and (World.is_tree(w.plants[i]) or w.plants[i]==54)==(tool==World.TREE_FERTILIZER) and w.plant_stage[i]==World.ADULT
			check(correct,"Fertilizer family and habitat agree for ecology %d tool %d" % [biome,tool])
			check(w.plant_count()>0,"Every ecology produces actual plants for fertilizer %d / %d" % [biome,tool])
			check(w.terrain.count(World.HILLS)==w.terrain.size(),"Fertilizer preserves relief")
			var count=w.plant_count(); var births=w.births
			w.begin_stroke(); w.paint(Vector2i(16,16),12,tool); w.end_stroke()
			check(w.plant_count()==count and w.births==births,"Repeated casting respects occupancy and density")
			var loaded=Save.decode(Save.encode(w)).world
			check(loaded!=null and loaded.plants==w.plants and loaded.plant_stage==w.plant_stage,"Active cast result persists without transient animation state")
	w.terrain.fill(World.GRASS); w.biomes.fill(World.MEADOW); w.plants.fill(0); w.objects.fill(0)
	w.plant_stage.fill(0); w.plant_age.fill(0); w.boost.fill(0); w.prepare_ecology()
	var site=9*w.width+9
	w.plants[site]=World.HERB; w.plant_stage[site]=World.ADULT; w.plant_age[site]=60
	w.begin_stroke(); w.paint(Vector2i(9,9),0,World.TREE_FERTILIZER); w.end_stroke()
	check(World.is_tree(w.plants[site]),"Active tree fertilizer replaces low grass on an odd-coordinate site")
	var before=w.plant_age[site]; var species=w.plants[site]
	w.begin_stroke(); w.paint(Vector2i(9,9),0,World.TREE_FERTILIZER); w.end_stroke()
	check(w.plants[site]==species and w.plant_age[site]==before,"Repeated fertilizer preserves an existing adult tree and its age")
	w.begin_stroke(); w.paint(Vector2i(10,9),0,World.TREE_FERTILIZER); w.end_stroke()
	check(w.plants[site+1]==0,"Actual tree spacing prevents overlapping trunks")
	var open_site=9*w.width+17
	w.begin_stroke(); w.paint(Vector2i(17,9),0,World.TREE_FERTILIZER); w.end_stroke()
	check(World.is_tree(w.plants[open_site]),"An open odd-coordinate site has no permanent natural-spawn whitelist")
	var berry_site=21*w.width+9
	w.plants[berry_site]=World.BERRY; w.plant_stage[berry_site]=World.ADULT; w.plant_age[berry_site]=90
	w.begin_stroke(); w.paint(Vector2i(9,21),0,World.TREE_FERTILIZER); w.end_stroke()
	check(w.plants[berry_site]==World.BERRY,"Tree fertilizer retains established berry shrubs")
	var ground_site=21*w.width+21
	w.begin_stroke(); w.paint(Vector2i(21,21),0,World.PLANT_FERTILIZER); w.end_stroke()
	check(w.plants[ground_site]>0 and not World.is_tree(w.plants[ground_site]),"Plant fertilizer also works outside the natural spawn grid")
	var tree_age=w.plant_age[open_site]; var ground_age=w.plant_age[ground_site]
	w.advance(1)
	check(w.plant_age[open_site]>tree_age and w.plant_age[ground_site]>ground_age,"Off-grid active plants remain in the natural lifecycle")
	var roundtrip=Save.decode(Save.encode(w)).world
	check(roundtrip!=null and roundtrip.plants==w.plants,"Off-grid active plants and their original species survive saving")
	var cells=w.brush_cells(Vector2i(16,16),15,0)
	for selected in [World.TREE_FERTILIZER,World.PLANT_FERTILIZER]:
		var matches=true
		for entry in w.preview_for(cells,selected):
			if entry[1]!=w.tool_affects(entry[0].y*w.width+entry[0].x,selected): matches=false
		check(matches,"Batched preview preserves individual suitability, occupancy and spacing rules")
	var routed=Fixtures.empty({"width":32,"height":32,"trees":0})
	routed.terrain.fill(World.GRASS); routed.biomes.fill(World.MEADOW); routed.prepare_ecology()
	var path: Array[Vector2i]=[Vector2i(3,4),Vector2i(26,4),Vector2i(26,26)]
	routed.begin_stroke(); routed.fertilize_path(path,0,0,World.TREE_FERTILIZER); routed.end_stroke()
	var reaches=true
	for point in path:
		var nearby=false
		for i in routed.plants.size():
			if routed.plants[i]>0 and Vector2(i%32,i/32).distance_to(Vector2(point))<4: nearby=true
		reaches=reaches and nearby
	check(reaches,"Batched drag reaches both ends and the intermediate corner within trunk spacing")
	var spaced=true; var inside=true
	for i in routed.plants.size():
		if routed.plants[i]==0: continue
		if not (i/32==4 or i%32==26): inside=false
		if not routed.fertilizer_space(i,true): spaced=false
	check(spaced and inside,"Swept tree fertilizer preserves trunk spacing and never leaves the drawn path")
	w.terrain.fill(World.DEEP); w.plants.fill(0)
	for tool in [World.BERRY_SEEDS,World.TREE_FERTILIZER,World.PLANT_FERTILIZER]:
		w.begin_stroke(); w.paint(Vector2i(16,16),8,tool); w.end_stroke()
		check(w.plant_count()==0,"Plant powers reject water")
	print("AEON VALE FEEDBACK: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
