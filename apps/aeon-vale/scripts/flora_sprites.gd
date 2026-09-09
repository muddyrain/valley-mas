extends RefCounted

# One canonical raster family covers every catalog object and life stage.
const SHEETS=[preload("res://assets/vegetation/near.png"),preload("res://assets/vegetation/middle.png"),preload("res://assets/vegetation/far.png")]
const CELLS=[Vector2i(40,48),Vector2i(20,24),Vector2i(4,5)]
const COLUMNS=30
static var images: Array[Image]=[]

static func _static_init() -> void:
	for sheet in SHEETS:
		var decoded: Image=sheet.get_image()
		decoded.convert(Image.FORMAT_RGBA8)
		images.append(decoded)

static func region(species: int,stage: int,variant: int,level: int=0) -> Rect2i:
	var index=(species-1)*18+stage*3+posmod(variant,3)
	return Rect2i(Vector2i(index%COLUMNS,index/COLUMNS)*CELLS[level],CELLS[level])

static func frame(species: int,stage: int,variant: int,level: int=0) -> Image:
	return images[level].get_region(region(species,stage,variant,level))
