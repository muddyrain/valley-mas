class_name SurvivorDefinition
extends "res://data/survivor_data.gd"
## Content identity is separate from the legacy save/template key `id`.

@export var survivor_id: String = ""
@export var trait_definition: Resource
@export var recommended_weapon_tags: Array[String] = []

var background_title: String:
	get: return profession_name
var background_description: String:
	get: return description
var trait_name: String:
	get: return trait_definition.display_name if trait_definition != null else ""
var trait_description: String:
	get: return trait_definition.description if trait_definition != null else ""
var trait_levels: PackedFloat32Array:
	get: return trait_definition.levels if trait_definition != null else PackedFloat32Array()
var model_resource: String:
	get: return model_path
var portrait: String:
	get: return portrait_path
var base_hp: float:
	get: return max_hp
var base_move_speed: float:
	get: return move_speed
