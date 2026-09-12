extends RefCounted
## Profiles adapt POIs to the existing Food/Scrap search and equipment reward pipeline.

const PROFILES: Dictionary = {
	"general": {"food": 2, "scrap": 3, "search_seconds": 38.0},
	"food_high": {"food": 6, "scrap": 4, "search_seconds": 71.0},
	"food_medium": {"food": 3, "scrap": 3, "search_seconds": 46.0},
	"medical_basic": {"food": 2, "scrap": 10, "search_seconds": 65.0},
	"materials_tools": {"food": 0, "scrap": 20, "search_seconds": 75.0},
	"fuel_vehicle": {"food": 1, "scrap": 8, "search_seconds": 50.0},
	"vehicle_parts_tools": {"food": 0, "scrap": 12, "search_seconds": 54.0},
	"vehicle_supply": {"food": 1, "scrap": 4, "search_seconds": 29.0},
	"vehicle_salvage": {"food": 0, "scrap": 6, "search_seconds": 34.0},
	"vehicle_food": {"food": 3, "scrap": 6, "search_seconds": 44.0},
}

static func apply(site: Dictionary, profile: String) -> void:
	site.merge(PROFILES[profile], true)
	site.loot_profile = profile

