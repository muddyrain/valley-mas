extends Resource
@export var end_day: int = 5
@export var initial_food: int = 6
@export var food_per_member: int = 1
@export var hunger_health_multiplier: float = 0.8
@export var shop_size: int = 3
@export var weapon_prices: Dictionary = {"pistol": 12, "smg": 20, "shotgun": 24, "crowbar": 10}
@export var reward_pools: Dictionary = {"garage": ["pistol", "smg", "crowbar"], "depot": ["shotgun", "smg"], "car_west": ["pistol", "crowbar"]}
