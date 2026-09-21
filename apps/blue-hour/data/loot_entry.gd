class_name LootEntry
extends Resource

@export var loot_id: String = ""
@export var weight: float = 1.0
@export var min_amount: int = 0
@export var max_amount: int = 0
@export_range(0, 4, 1) var rarity: int = 0
