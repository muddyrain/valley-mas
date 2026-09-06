extends RefCounted

const PATCH=96
const ROCK=[Color("434744"),Color("484c48"),Color("4c514c"),Color("525851")]
const SNOW=[Color("c9d8d5"),Color("e2e9df"),Color("edf0e4")]

static func paint(target: Image, world, x: int, y: int) -> void:
	var pixel=Vector2i(x,y)*12
	var coordinate=Vector2i(pixel.x/PATCH,pixel.y/PATCH)
	if not world.mountain_cache.has(coordinate): world.mountain_cache[coordinate]=patch(world,coordinate)
	target.blit_rect(world.mountain_cache[coordinate],Rect2i(pixel-coordinate*PATCH,Vector2i(12,12)),pixel)

static func patch(world, coordinate: Vector2i) -> Image:
	var result=Image.create(PATCH,PATCH,false,Image.FORMAT_RGBA8)
	var origin=coordinate*PATCH
	var shelves=world.noise_for(world.world_seed+2711,.016,2)
	var fractures=world.noise_for(world.world_seed+817,.075,2)
	var snowfield=world.noise_for(world.world_seed+1337,.006,2)
	# Shared world coordinates join rock shelves and irregular snow across tile edges.
	# Relief belongs to the ground field, rather than a grid of separate peak icons.
	for y in range(0,PATCH,2):
		for x in range(0,PATCH,2):
			var gx=origin.x+x; var gy=origin.y+y
			var height=shelves.get_noise_2d(gx,gy)
			var detail=fractures.get_noise_2d(gx,gy)
			var slope=shelves.get_noise_2d(gx-3,gy-4)-height
			var shade=2 if height>.24 else (0 if height<-.22 else 1)
			var color: Color=ROCK[shade]
			if detail>.30 and slope<-.015: color=color.darkened(.12)
			elif detail<-.36 and slope>.02: color=color.lightened(.07)
			var cell=Vector2i(clampi(gx/12,0,world.width-1),clampi(gy/12,0,world.height-1))
			var elevation: float=world.elevation[cell.y*world.width+cell.x] if world.elevation.size()==world.terrain.size() else .3
			var snow=snowfield.get_noise_2d(gx+height*28,gy+height*16)+detail*.10+maxf(0,elevation-.2)*.32
			if snow>.34:
				color=SNOW[0 if snow<.35 else (2 if slope>.0 else 1)]
				if detail>.36 and snow<.38: color=ROCK[1]
			else:
				var grain: int=world.hash_cell(gx/2,gy/2,world.world_seed+137)
				if grain%31==0: color=color.darkened(.07)
				elif grain%47==0: color=color.lightened(.055)
			result.fill_rect(Rect2i(x,y,2,2),color)
	return result
