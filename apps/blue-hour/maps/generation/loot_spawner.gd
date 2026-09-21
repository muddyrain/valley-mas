extends RefCounted
## Profiles adapt POIs to the existing Food/Scrap search and equipment reward pipeline.

const Assets = preload("res://data/world_asset_catalog.gd")
const SEARCH_SECONDS: Dictionary = {"vehicle": 4.0, "residential": 8.0, "commercial": 12.0, "large": 18.0}
# Each resource rolls independently: [chance, minimum, maximum]. Medicine,
# fuel and distinct parts are intentionally absent until real resources exist.
const PROFILES: Dictionary = {
	"general": {"food": [0.8, 2, 3], "scrap": [1.0, 1, 3]},
	"food_high": {"food": [1.0, 4, 7], "scrap": [0.65, 1, 3]},
	"food_medium": {"food": [1.0, 3, 5], "scrap": [0.6, 1, 2]},
	"medical_basic": {"food": [0.25, 1, 2], "scrap": [1.0, 3, 5]},
	"materials_tools": {"food": [0.2, 1, 2], "scrap": [1.0, 6, 10]},
	"fuel_vehicle": {"food": [0.3, 1, 2], "scrap": [1.0, 4, 6]},
	"vehicle_parts_tools": {"food": [0.15, 1, 1], "scrap": [1.0, 4, 7]},
	"vehicle_supply": {"food": [0.6, 1, 2], "scrap": [1.0, 2, 4]},
	"vehicle_salvage": {"food": [0.2, 1, 1], "scrap": [1.0, 1, 3]},
	"vehicle_food": {"food": [1.0, 2, 3], "scrap": [0.7, 1, 3]},
}

static func apply(site: Dictionary, profile: String) -> void:
	var definition: Resource = Assets.asset(site.asset) if site.has("asset") else null
	var category: String = str(site.get("category", "")) if definition == null else definition.category
	var poi: String = str(site.get("poi_type", "")) if definition == null else definition.poi_type
	var vehicle: bool = str(site.get("poi_type", "")) == "vehicle" or category == "vehicles"
	# Newer building assets already supply category/tags but use the default profile.
	if profile == "general" and definition != null and category == "commercial":
		profile = "materials_tools" if "tools" in definition.loot_tags else "food_medium" if "food" in definition.loot_tags else "general"
	var kind: String = "residential"
	if vehicle:
		kind = "vehicle"
	elif category in ["industrial", "special"] or poi in ["warehouse", "auto_repair", "gas_station"] or (category.is_empty() and profile in ["materials_tools", "vehicle_parts_tools", "fuel_vehicle"]):
		kind = "large"
	elif category == "commercial" or poi in ["supermarket", "pharmacy", "restaurant"] or profile in ["food_high", "food_medium", "medical_basic"]:
		kind = "commercial"
	var values: Dictionary = PROFILES.get(profile, PROFILES.general)
	site.search_kind = kind
	site.search_seconds = SEARCH_SECONDS[kind]
	site.loot_profile = profile
	var interaction_categories: Array[String] = []
	if vehicle:
		interaction_categories.assign(["vehicle", "mechanical"])
	elif definition != null:
		interaction_categories.assign(definition.interaction_tags)
	site.interaction_categories = interaction_categories
	site.loot_table = _table_for(profile, values)
	# Keep legacy previews/action modifiers compatible; actual totals replace these on completion.
	site.food = int(values.food[2])
	site.scrap = int(values.scrap[2])

static func _table_for(profile: String, values: Dictionary) -> Dictionary:
	var entries: Array[Dictionary] = []
	for id: String in ["food", "scrap"]:
		var rule: Array = values[id]
		entries.append({"loot_id": id, "weight": 1.0, "chance": rule[0], "min_amount": rule[1], "max_amount": rule[2]})
	return {"id": profile, "entries": entries}
