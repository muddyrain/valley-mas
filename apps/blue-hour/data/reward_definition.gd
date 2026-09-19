class_name RewardDefinition
extends Resource

enum Category { RESOURCE, WEAPON, EQUIPMENT, POWER, CHARACTER_UNLOCK, QUEST, SPECIAL }
enum Rarity { COMMON, UNCOMMON, RARE, EPIC, LEGENDARY }

@export var id: String = ""
@export var category: Category = Category.SPECIAL
@export var rarity: Rarity = Rarity.COMMON
@export var tags: Array[String] = []

func is_basic_resource() -> bool:
	return category == Category.RESOURCE and rarity < Rarity.RARE and "basic_resource" in tags
