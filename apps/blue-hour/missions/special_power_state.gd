extends RefCounted

var power_id: String = ""
var upgraded: bool = false
var used_today: bool = false
var active: bool = false
var remaining_duration: float = 0.0
var remaining_cooldown: float = 0.0
var definition: Resource

func _init(effect: Resource) -> void:
	definition = effect
	power_id = effect.id
	upgraded = effect.is_upgraded
