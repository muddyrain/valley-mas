extends Resource
## One destination's presentation and rules, applied to a private city snapshot.

@export var id: String = ""
@export var display_name: String = ""
@export var subtitle: String = ""
@export var description: String = ""
@export var danger: String = ""
@export var accent: Color = Color.WHITE
@export var thumbnail: Texture2D
@export var food_multiplier: float = 1.0
@export var scrap_multiplier: float = 1.0
@export var spawn_interval_multiplier: float = 1.0
@export var initial_enemy_fraction: float = 1.0
@export var weapon_sites: PackedStringArray = []


func make_map(base: Resource) -> Resource:
	var destination: Resource = base.duplicate(true)
	destination.id = id
	destination.display_name = display_name
	for site: Dictionary in destination.buildings + destination.vehicles:
		site.food = roundi(float(site.food) * food_multiplier)
		site.scrap = roundi(float(site.scrap) * scrap_multiplier)
	for field: String in ["day_spawn_interval", "blue_spawn_interval", "night_spawn_interval"]:
		destination.set(field, float(base.get(field)) * spawn_interval_multiplier)
	var count := maxi(1, ceili(base.initial_enemies.size() * initial_enemy_fraction))
	destination.initial_enemies = destination.initial_enemies.slice(0, count)
	return destination
