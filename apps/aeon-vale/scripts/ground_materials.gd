extends RefCounted

# Quiet, ordered surface marks. Most of each material is its unmodified body
# colour; the pattern is tied to world pixels, never to the camera or a RNG.
const SIZE=48
const GRASS=0
const DRY=1
const SAND=2
const LOAM=3
const ROCK=4
const SNOW=5
static var pixels: PackedByteArray

static func _static_init() -> void:
	pixels.resize(SIZE*SIZE*6)
	for material in 6:
		for y in SIZE:
			for x in SIZE:
				var value=2
				if material in [GRASS,DRY]:
					if posmod(x-y,12)==0 and y%12<3: value=3
				elif material in [SAND,LOAM]:
					if posmod(x-y,12)==0 and y%12<4: value=3
				elif material==ROCK:
					if y%16==0 and x%16<5: value=1
				else:
					if posmod(x+y,24)==0 and y%12<2: value=3
				pixels[((material/3)*SIZE+y)*SIZE*3+(material%3)*SIZE+x]=value

static func tone(material: int,x: int,y: int) -> int:
	return pixels[((material/3)*SIZE+posmod(y,SIZE))*SIZE*3+(material%3)*SIZE+posmod(x,SIZE)]

static func palette(base: Color,material: int) -> Array[Color]:
	var contrast=.035 if material in [GRASS,DRY] else .045
	return [base.darkened(contrast),base.darkened(contrast*.45),base,base.lightened(contrast*.45),base.lightened(contrast)]

static func tile(w,base: Color,material: int,phase: Vector2i) -> Image:
	var key="material/%s/%d/%s"%[base,material,phase]
	if w.ground_cache.has(key): return w.ground_cache[key]
	var image=Image.create(12,12,false,Image.FORMAT_RGBA8)
	var colors=palette(base,material)
	for y in 12:
		for x in 12: image.set_pixel(x,y,colors[tone(material,phase.x*12+x,phase.y*12+y)])
	w.ground_cache[key]=image
	return image
