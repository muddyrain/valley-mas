extends Node2D

# A texel is one world cell. Keep edits local and use exact nearest sampling;
# mip averaging would merge the deliberately limited-colour tree clusters.
const CHUNK=64
const GUTTER=1
var chunks: Dictionary={}
var pending: Dictionary={}
var bounds: Rect2i

func area(coordinate: Vector2i) -> Rect2i:
	return Rect2i(coordinate*CHUNK,Vector2i.ONE*CHUNK).intersection(bounds)

func patch(ground: Image,crowns: Image,coordinate: Vector2i) -> Image:
	var padded=area(coordinate).grow(GUTTER).intersection(bounds)
	var result=ground.get_region(padded)
	result.blend_rect(crowns,padded,Vector2i.ZERO)
	return result

func rebuild(ground: Image,crowns: Image) -> void:
	for child in get_children(): child.free()
	chunks.clear(); pending.clear()
	bounds=Rect2i(Vector2i.ZERO,ground.get_size())
	for y in ceili(bounds.size.y/float(CHUNK)):
		for x in ceili(bounds.size.x/float(CHUNK)):
			var coordinate=Vector2i(x,y)
			var rect=area(coordinate)
			var padded=rect.grow(GUTTER).intersection(bounds)
			var sprite=Sprite2D.new()
			sprite.centered=false; sprite.position=rect.position
			sprite.region_enabled=true
			sprite.region_rect=Rect2(rect.position-padded.position,rect.size)
			sprite.use_parent_material=true
			sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
			sprite.texture=ImageTexture.create_from_image(patch(ground,crowns,coordinate))
			add_child(sprite); chunks[coordinate]=sprite

func mark(rect: Rect2i) -> void:
	var dirty=rect.grow(GUTTER).intersection(bounds)
	if not dirty.has_area(): return
	for y in range(dirty.position.y/CHUNK,(dirty.end.y-1)/CHUNK+1):
		for x in range(dirty.position.x/CHUNK,(dirty.end.x-1)/CHUNK+1): pending[Vector2i(x,y)]=true

func flush(ground: Image,crowns: Image) -> void:
	var started=Time.get_ticks_usec()
	while not pending.is_empty() and Time.get_ticks_usec()-started<1800:
		var coordinate: Vector2i=pending.keys()[0]
		pending.erase(coordinate)
		chunks[coordinate].texture.update(patch(ground,crowns,coordinate))

func read_image() -> Image:
	# Read actual uploaded images for save/edit regression checks.
	var result=Image.create(bounds.size.x,bounds.size.y,false,Image.FORMAT_RGBA8)
	for coordinate in chunks:
		var sprite=chunks[coordinate]
		result.blit_rect(sprite.texture.get_image(),Rect2i(sprite.region_rect),area(coordinate).position)
	return result
