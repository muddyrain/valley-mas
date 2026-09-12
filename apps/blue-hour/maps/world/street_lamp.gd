extends "res://maps/world/world_asset.gd"

const LENS: Material = preload("res://assets/world/materials/street_lamp_lens.tres")

func register_lighting(city: Node3D, powered: bool) -> void:
	city.lamp_materials.append(LENS)
	city.lamps.append($LampLens)
	if powered:
		city.accent_lights.append($StreetLight)
	else:
		$StreetLight.visible = false

