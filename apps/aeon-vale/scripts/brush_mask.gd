extends RefCounted

const NAMES = ["圆形", "方形", "菱形", "喷洒"]
const SIZES = [[0,1,2,3,4,6,8,10,13,16],[1,3,5,9,14],[2,4,7,11,16],[3,5,8,12,16]]

static func contains(offset: Vector2i, radius: int, shape: int, cell: Vector2i = Vector2i.ZERO) -> bool:
	match shape:
		1: return maxi(absi(offset.x),absi(offset.y)) <= radius
		2: return absi(offset.x)+absi(offset.y) <= radius
		3:
			if Vector2(offset).length() > radius+.25: return false
			var sample = absi((cell.x*73856093) ^ (cell.y*19349663) ^ 83492791)
			return offset == Vector2i.ZERO or sample%100 < 42
		_: return Vector2(offset).length() <= radius+.25

static func cells(center: Vector2i, radius: int, shape: int, extent: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	var low = (center-Vector2i.ONE*radius).max(Vector2i.ZERO)
	var high = (center+Vector2i.ONE*radius).min(extent-Vector2i.ONE)
	for y in range(low.y,high.y+1):
		for x in range(low.x,high.x+1):
			var cell = Vector2i(x,y)
			if contains(cell-center,radius,shape,cell): result.append(cell)
	return result
