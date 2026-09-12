extends RefCounted
const Assets = preload("res://data/world_asset_catalog.gd")
const TYPES: Dictionary = {
	"supermarket": "超市", "house": "住宅", "pharmacy": "药店",
	"restaurant": "餐厅", "warehouse": "仓库", "gas_station": "加油站", "auto_repair": "维修店"
}

static func category(site: Dictionary) -> String:
	if site.vehicle:
		return "车辆"
	var definition: Resource = Assets.asset(site.spec.asset)
	return TYPES.get(definition.poi_type, "建筑")

static func loot(site: Dictionary) -> String:
	return "食物 %d  废料 %d" % [site.spec.food, site.spec.scrap]
