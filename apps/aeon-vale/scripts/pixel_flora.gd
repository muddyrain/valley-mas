extends RefCounted

const Sprites=preload("res://scripts/flora_sprites.gd")
static var cache: Dictionary={}
static var icon_cache: Dictionary={}
static var atlas_image: Image
static var atlas_texture: ImageTexture

static func texture(species: int,stage: int=3,variation: int=0,distant: bool=false) -> ImageTexture:
	var key=Vector4i(species,stage,posmod(variation,3),int(distant))
	if not cache.has(key): cache[key]=ImageTexture.create_from_image(Sprites.frame(species,stage,variation,int(distant)))
	return cache[key]

static func icon(species: int) -> ImageTexture:
	if not icon_cache.has(species):
		var source=Sprites.frame(species,3,0)
		var occupied=source.get_used_rect().grow(1).intersection(Rect2i(Vector2i.ZERO,source.get_size()))
		icon_cache[species]=ImageTexture.create_from_image(source.get_region(occupied))
	return icon_cache[species]

static func atlas_region(species: int,stage: int,variation: int,distant: bool=false) -> Rect2i:
	var region=Sprites.region(species,stage,variation,int(distant))
	if distant: region.position.y+=Sprites.images[0].get_height()
	return region

static func prepare_atlas_species(_species: int) -> void:
	if atlas_texture!=null: return
	var near=Sprites.images[0]; var middle=Sprites.images[1]
	atlas_image=Image.create(near.get_width(),near.get_height()+middle.get_height(),false,Image.FORMAT_RGBA8)
	atlas_image.blit_rect(near,Rect2i(Vector2i.ZERO,near.get_size()),Vector2i.ZERO)
	atlas_image.blit_rect(middle,Rect2i(Vector2i.ZERO,middle.get_size()),Vector2i(0,near.get_height()))
	atlas_texture=ImageTexture.create_from_image(atlas_image)

func render(species: int,stage: int,variation: int,distant: bool) -> Image:
	return Sprites.frame(species,stage,variation,int(distant))
