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
	# MapData's encounter Resource must be isolated per destination. Without an
	# explicit duplicate, sequential previews mutate the shared base encounter.
	destination.encounter = base.encounter.duplicate(true)
	destination.id = id
	destination.display_name = display_name
	for site: Dictionary in destination.buildings + destination.vehicles:
		site.food = roundi(float(site.food) * food_multiplier)
		site.scrap = roundi(float(site.scrap) * scrap_multiplier)
		for entry: Dictionary in site.get("loot_table", {}).get("entries", []):
			var multiplier: float = food_multiplier if entry.get("loot_id") == "food" else scrap_multiplier if entry.get("loot_id") == "scrap" else 1.0
			entry.min_amount = maxi(0, roundi(float(entry.min_amount) * multiplier))
			entry.max_amount = maxi(entry.min_amount, roundi(float(entry.max_amount) * multiplier))
	for field: String in ["daytime_respawn_interval", "blue_hour_spawn_interval"]:
		destination.encounter.set(field, float(base.encounter.get(field)) * spawn_interval_multiplier)
	# Quieter destinations reduce the upper bound without creating empty daytime maps.
	destination.encounter.initial_zombie_max = roundi(lerpf(base.encounter.initial_zombie_min, base.encounter.initial_zombie_max, initial_enemy_fraction))
	return destination
