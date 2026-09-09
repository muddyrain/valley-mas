extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
const Surface=preload("res://scripts/surface_renderer.gd")
var checks=0
var failures: Array=[]

func check(ok: bool,label_text: String) -> void:
	checks+=1
	if not ok: failures.append(label_text); push_error(label_text)

func _initialize() -> void:
	seed_edges()
	shore_edges()
	relief_edits()
	crest_footprints()
	var w=Fixtures.empty({"width":64,"height":48,"seed":17821,"trees":0})
	w.weather_enabled=false; w.spread_enabled=false
	for step in [World.GRASS,World.BIOME_TOOLS+World.BIRCH,World.BEACH,World.MOUNTAIN,World.HILLS,World.MOUNTAIN,World.GRASS_SEEDS]:
		w.begin_stroke(); w.paint(Vector2i(30,24),7,step); w.end_stroke()
		var restored=Save.decode(Save.encode(w)).world; restored.image=restored.bake_image()
		check(restored.image.get_data()==w.image.get_data(),"Local edit and freshly loaded surface agree: %d"%step)
	# Adjacent mountains share a cached patch; a new elevated cell must not reuse
	# the snow coverage computed while that cell was underwater.
	w.begin_stroke(); w.paint(Vector2i(38,24),3,World.MOUNTAIN); w.end_stroke()
	var restored=Save.decode(Save.encode(w)).world; restored.image=restored.bake_image()
	check(restored.image.get_data()==w.image.get_data(),"Extending a mountain refreshes cached snow height")
	check(w.undo(),"Terrain edit can be undone")
	restored=Save.decode(Save.encode(w)).world; restored.image=restored.bake_image()
	check(restored.image.get_data()==w.image.get_data(),"Undo restores the same visible surface as loading")
	# Worker results must match the same model rendered on the main thread,
	# including neighbour joins and downsampled edges after seeded ground changes.
	w.defer_surface=true
	var before=w.image.duplicate(); var overview=before.duplicate()
	overview.resize(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	w.begin_stroke(); w.paint(Vector2i(32,24),12,World.BIOME_TOOLS+World.SAVANNA); w.end_stroke()
	var result=Surface.build(Surface.snapshot(w),before,overview,w.surface_pending_cells)
	restored=Save.decode(Save.encode(w)).world; restored.image=restored.bake_image()
	check(result.surface.get_data()==restored.image.get_data(),"Worker region matches full save reconstruction")
	var full=restored.image.duplicate(); full.resize(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	check(result.overview.get_data()==full.get_data(),"Updated miniature matches full ground downsample")
	var materials=World.Ground.Materials
	check(materials.pixels.size()==144*96,"Ordered material masks retain their world-aligned period")
	var calm=0
	for value in materials.pixels:
		if value>4: check(false,"Imported mask value outside five-tone palette"); break
		if value==2: calm+=1
	check(calm>materials.pixels.size()*.90,"At least 90 percent of the ground material is a quiet body colour")
	var crests=World.Ground.Mountain.crests
	check(crests.size()==4 and crests[0].get_size()==Vector2i(128,96),"Four shaped crest frames use an integer two-pixel art grid")
	var colors={}; var cutout=true; var clear=0; var snow=0
	for crest in crests:
		for y in 96:
			for x in 128:
				var c=crest.get_pixel(x,y); colors[c]=true; cutout=cutout and c.a in [0.0,1.0]
				if c.a==0: clear+=1
				elif c.r>.8: snow+=1
	check(colors.size()<=7 and cutout and clear>3000 and snow>1000,"Crests preserve opaque snowy tops and transparent silhouettes within six colours")
	print("AEON VALE TERRAIN MATERIALS: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)

func relief_edits() -> void:
	var w=Fixtures.empty({"width":32,"height":24,"seed":782341,"trees":0})
	w.terrain.fill(World.HILLS); w.elevation.fill(.32); w.biomes.fill(World.MEADOW); w.bare_soil.fill(0)
	w.prepare_ecology(); w.image=w.bake_image()
	var plants=w.plants.duplicate(); var terrain=w.terrain.duplicate()
	w.begin_stroke(); w.paint(Vector2i(16,12),6,World.BIOME_TOOLS+World.SAKURA); w.end_stroke()
	check(w.terrain==terrain and w.plants==plants,"Seeding rocky hills keeps terrain and existing plant data")
	# This stroke crosses both a 96px cache boundary and interpolated elevation
	# neighbours. Main-thread edits, async patches and reloading must agree.
	w.defer_surface=true
	var source=w.image.duplicate(); var small=source.duplicate()
	small.resize(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,Image.INTERPOLATE_NEAREST)
	w.begin_stroke(); w.paint(Vector2i(16,12),6,World.MOUNTAIN); w.end_stroke()
	var built=Surface.build(Surface.snapshot(w),source,small,w.surface_pending_cells)
	var loaded=Save.decode(Save.encode(w)).world
	check(built.surface.get_data()==loaded.bake_image().get_data(),"Hill-to-mountain worker update matches full render across cache and elevation boundaries")
	w.defer_surface=false; w.image=built.surface
	w.begin_stroke(); w.paint(Vector2i(21,12),3,World.RIVER); w.end_stroke()
	loaded=Save.decode(Save.encode(w)).world
	check(w.image.get_data()==loaded.bake_image().get_data(),"Cutting a river into a snowy mountain refreshes neighbouring snow height")

func crest_footprints() -> void:
	var w=Fixtures.empty({"width":40,"height":32,"seed":91847,"trees":0})
	w.terrain.fill(World.MOUNTAIN); w.elevation.fill(.72)
	w.prepare_ecology(); w.image=w.bake_image()
	# A narrow cut can remove a supporting rock outside the crest's centre cell.
	# Its entire overlapping footprint must refresh across 96px cache boundaries.
	for cell in [Vector2i(8,8),Vector2i(17,16),Vector2i(30,24)]:
		w.begin_stroke(); w.paint(cell,1,World.RIVER); w.end_stroke()
		var restored=Save.decode(Save.encode(w)).world
		check(w.image.get_data()==restored.bake_image().get_data(),"Narrow cut rebuilds complete neighbouring crest footprints: %s"%cell)

func seed_edges() -> void:
	var w=Fixtures.empty({"width":64,"height":48,"seed":17821,"trees":0})
	w.weather_enabled=false; w.spread_enabled=false
	w.begin_stroke(); w.paint(Vector2i(32,24),16,World.GRASS); w.end_stroke()
	w.begin_stroke(); w.paint(Vector2i(32,24),10,World.GRASS_SEEDS); w.end_stroke()
	var missing=0
	for cell in w.brush_cells(Vector2i(32,24),10,0):
		if w.bare_soil[cell.y*w.width+cell.x]>0: missing+=1
	check(missing==0,"Grass seeds cover every eligible cell in the brush")
	# The centre scan crosses soil, one continuous sod patch, then soil.
	# Borrowing colour in both directions instead produced detached green rings.
	var broken_scanlines=0
	for y in range(24*12,25*12):
		var runs=0; var previous=false
		for x in range(17*12,48*12):
			var c=w.image.get_pixel(x,y)
			var grass=c.g>c.r
			if grass and not previous: runs+=1
			previous=grass
		if runs!=1: broken_scanlines+=1
	check(broken_scanlines==0,"Grass boundary has no detached green fringe or internal soil seam")

func shore_edges() -> void:
	var w=Fixtures.empty({"width":64,"height":48,"seed":17821,"trees":0})
	w.terrain.fill(World.BEACH); w.image=w.bake_image()
	w.begin_stroke(); w.paint(Vector2i(32,24),10,World.GRASS); w.end_stroke()
	w.begin_stroke(); w.paint(Vector2i(32,24),10,World.GRASS_SEEDS); w.end_stroke()
	var broken=0
	for y in range(24*12,25*12):
		var runs=0; var previous=false
		for x in range(16*12,49*12):
			var c=w.image.get_pixel(x,y); var green=c.g>c.r
			if green and not previous: runs+=1
			previous=green
		if runs!=1: broken+=1
	check(broken==0,"Inland beach turf joins the grass without a sand seam or detached green lip")
	var restored=Save.decode(Save.encode(w)).world
	check(restored.bake_image().get_data()==w.image.get_data(),"Beach joins after seeding match a freshly loaded world")
