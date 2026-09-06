extends RefCounted

const World=preload("res://scripts/world_data.gd")
const CHUNK=32

static func chunk_image(w, surface: Image, coordinate: Vector2i) -> Image:
	var area=Rect2i(coordinate*CHUNK,Vector2i.ONE*CHUNK).intersection(Rect2i(0,0,w.width,w.height))
	var result=surface.get_region(Rect2i(area.position*World.Ground.PIXELS,area.size*World.Ground.PIXELS))
	return result

static func snapshot(w):
	var copy=World.new()
	copy.width=w.width; copy.height=w.height; copy.world_seed=w.world_seed
	copy.terrain=w.terrain.duplicate(); copy.biomes=w.biomes.duplicate()
	copy.quake_scars=w.quake_scars.duplicate()
	copy.bare_soil=w.bare_soil.duplicate()
	copy.elevation=w.elevation.duplicate()
	return copy

static func build(w, source: Image, overview: Image, cells: Dictionary) -> Dictionary:
	# The worker only owns snapshots and new images. Published images stay immutable.
	w.prepare_noise()
	var surface=source.duplicate()
	var small=overview.duplicate()
	var patches: Dictionary={}
	var chunks: Dictionary={}
	for i in cells:
		w.draw_tile(surface,i%w.width,i/w.width)
		chunks[Vector2i(i%w.width/CHUNK,i/w.width/CHUNK)]=true
		# A changed source pixel also influences nearby downsampled pixels.
		var affected=Rect2i(Vector2i(i%w.width,i/w.width)-Vector2i(2,2),Vector2i(5,5)).intersection(Rect2i(0,0,w.width,w.height))
		for cy in range(affected.position.y/4,(affected.end.y-1)/4+1):
			for cx in range(affected.position.x/4,(affected.end.x-1)/4+1): patches[Vector2i(cx,cy)]=true
	for coordinate in patches:
		var area=Rect2i(coordinate*4,Vector2i(4,4)).intersection(Rect2i(0,0,w.width,w.height))
		var margin=area.grow(2).intersection(Rect2i(0,0,w.width,w.height))
		var patch=surface.get_region(Rect2i(margin.position*World.Ground.PIXELS,margin.size*World.Ground.PIXELS))
		patch.resize(margin.size.x*2,margin.size.y*2,Image.INTERPOLATE_LANCZOS)
		small.blit_rect(patch,Rect2i((area.position-margin.position)*2,area.size*2),area.position*2)
	for coordinate in chunks: chunks[coordinate]=chunk_image(w,surface,coordinate)
	return {"surface":surface,"chunks":chunks,"overview":small}
