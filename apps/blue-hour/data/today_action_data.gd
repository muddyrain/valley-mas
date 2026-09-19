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
## Generation type is not an objective: legacy `rescue` does not implement rescue.
@export var mission_type: String = "supply_search"
@export var objective: String = "SEARCH_AND_RETURN"
@export var threat_profile: String = "low"
@export var reward_tendency: String = "food"
@export var poi_preference: PackedStringArray = []
@export var spawn_batch_multiplier: float = 1.0
@export var weapon_reward_chance: float = 0.05
@export var weapon_categories: PackedStringArray = ["industrial", "vehicles"]
@export var weapon_loot_tags: PackedStringArray = ["tools"]
@export var weapon_profiles: PackedStringArray = ["materials_tools", "vehicle_parts_tools"]
@export var weapon_pool: Array[String] = []


func encounter_rules(base: Resource, capacity: int = -1) -> Resource:
	var result: Resource = base.duplicate(true)
	var limit: int = base.population_limit if capacity < 0 else mini(capacity, base.population_limit)
	result.initial_zombie_min = mini(limit, roundi(base.initial_zombie_min * initial_enemy_fraction))
	result.initial_zombie_max = maxi(result.initial_zombie_min, mini(limit, roundi(base.initial_zombie_max * initial_enemy_fraction)))
	result.arrival_population = mini(base.arrival_population, result.initial_zombie_min)
	result.daytime_min_population = mini(limit, roundi(base.daytime_min_population * initial_enemy_fraction))
	result.daytime_respawn_batch = maxi(1, roundi(base.daytime_respawn_batch * spawn_batch_multiplier))
	for field: String in ["daytime_respawn_interval", "blue_hour_spawn_interval"]:
		result.set(field, float(base.get(field)) * spawn_interval_multiplier)
	return result


func modify_loot(rolled: Dictionary) -> Dictionary:
	var result := rolled.duplicate(true)
	result.food = maxi(0, roundi(float(result.get("food", 0)) * food_multiplier))
	result.scrap = maxi(0, roundi(float(result.get("scrap", 0)) * scrap_multiplier))
	return result


func weapon_chance_for(site: Dictionary) -> float:
	var definition: Resource = preload("res://data/world_asset_catalog.gd").asset(str(site.get("asset", ""))) if site.has("asset") else null
	var category: String = str(site.get("category", "")) if definition == null else definition.category
	var tags: Variant = site.get("loot_tags", []) if definition == null else definition.loot_tags
	if category in weapon_categories or str(site.get("loot_profile", "")) in weapon_profiles:
		return weapon_reward_chance
	for tag: String in tags:
		if tag in weapon_loot_tags:
			return weapon_reward_chance
	return 0.0


func make_map(base: Resource) -> Resource:
	var destination: Resource = base.duplicate(true)
	destination.mission_profile = duplicate(true)
	destination.encounter = encounter_rules(base.encounter)
	destination.id = id
	destination.display_name = display_name
	# Loot is modified once, after the final site's base profile is rolled.
	return destination
