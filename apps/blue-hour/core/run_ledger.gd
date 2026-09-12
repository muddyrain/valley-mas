extends RefCounted
var food: int = 0
var scrap: int = 0
var stored_food: int = 0
var stored_scrap: int = 0
var settled: bool = false
var last_result: Dictionary = {}
var weapons: Array[Dictionary] = []
var resource_remainders := Vector2.ZERO

func begin() -> void:
	food = 0
	scrap = 0
	settled = false
	weapons.clear()
	resource_remainders = Vector2.ZERO

func collect_resources(food_amount: int, scrap_amount: int, multiplier: float) -> Vector2i:
	if settled:
		return Vector2i.ZERO
	# Carry fractional yield across small pickups; item identities never enter this calculation.
	var exact := Vector2(maxi(0, food_amount), maxi(0, scrap_amount)) * maxf(0.0, multiplier) + resource_remainders
	var gained := Vector2i(floori(exact.x + 0.000001), floori(exact.y + 0.000001))
	resource_remainders = exact - Vector2(gained)
	add_loot(gained.x, gained.y)
	return gained

func add_weapon(value: Dictionary) -> void:
	if settled:
		return
	for existing in weapons:
		if existing.uid == value.uid:
			return
	weapons.append(value.duplicate(true))

func add_loot(food_amount: int, scrap_amount: int) -> void:
	if settled:
		return
	food = maxi(0, food + food_amount)
	scrap = maxi(0, scrap + scrap_amount)

func finish(returned: Array, lost: Array, seconds: float, kills: int, wiped: bool) -> Dictionary:
	if settled:
		return last_result
	settled = true
	last_result = {
		"returned": returned.duplicate(), "lost": lost.duplicate(),
		"food": 0 if wiped else food, "scrap": 0 if wiped else scrap,
		"seconds": seconds, "kills": kills, "wiped": wiped,
		"weapons": [] if wiped else weapons.duplicate(true)
	}
	stored_food += last_result.food
	stored_scrap += last_result.scrap
	return last_result
