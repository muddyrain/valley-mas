extends RefCounted
## Profiles adapt POIs to the existing Food/Scrap search and equipment reward pipeline.

const PROFILES: Dictionary = {
	"general": {"food": 2, "scrap": 3, "search_seconds": 38.0},
	"food_high": {"food": 6, "scrap": 4, "search_seconds": 71.0},
	"food_medium": {"food": 3, "scrap": 3, "search_seconds": 46.0},
	"medical_basic": {"food": 1, "scrap": 5, "search_seconds": 65.0},
	"materials_tools": {"food": 0, "scrap": 8, "search_seconds": 75.0},
	"fuel_vehicle": {"food": 1, "scrap": 5, "search_seconds": 50.0},
	"vehicle_parts_tools": {"food": 0, "scrap": 3, "search_seconds": 1.2},
	"vehicle_supply": {"food": 1, "scrap": 4, "search_seconds": 1.0},
	"vehicle_salvage": {"food": 0, "scrap": 2, "search_seconds": 1.0},
	"vehicle_food": {"food": 2, "scrap": 3, "search_seconds": 1.2},
}

static func apply(site: Dictionary, profile: String) -> void:
	var values: Dictionary = PROFILES.get(profile, PROFILES.general)
	site.merge(values, true)
	site.loot_profile = profile
	site.loot_table = _table_for(profile, values)

static func _table_for(profile: String, values: Dictionary) -> Dictionary:
	# One weighted roll keeps the first foundation small while preserving legacy fields.
	var food: int = int(values.food)
	var scrap: int = int(values.scrap)
	var variable: bool = profile not in ["food_medium", "vehicle_supply"]
	return {"id": profile, "entries": [
		{"loot_id": "food", "weight": 1.0 if food > 0 else 0.0, "min_amount": maxi(0, food - (1 if variable else 0)), "max_amount": food + (1 if variable else 0)},
		{"loot_id": "scrap", "weight": 1.0 if scrap > 0 else 0.0, "min_amount": maxi(0, scrap - (1 if variable else 0)), "max_amount": scrap + (1 if variable else 0)}
	]}
