class_name SurvivorDefinition
extends "res://data/survivor_data.gd"
## Content identity is separate from the legacy save/template key `id`.

@export var survivor_id: String = ""
@export var recommended_weapon_tags: Array[String] = []
@export var base_stats: Dictionary = {}
@export var starting_trait: Resource
@export var starting_equipment: Resource

var background_title: String:
	get: return profession_name
var background_description: String:
	get: return description
var trait_name: String:
	get: return starting_trait.display_name if starting_trait != null else ""
var trait_description: String:
	get: return starting_trait.description if starting_trait != null else ""
var trait_levels: PackedFloat32Array:
	get: return starting_trait.levels if starting_trait != null else PackedFloat32Array()
var model_resource: String:
	get: return model_path
var portrait: String:
	get: return portrait_path
var base_hp: float:
	get: return max_hp
var base_move_speed: float:
	get: return move_speed
var model_reference: String:
	get: return model_path
var name: String:
	get: return display_name
var trait_definition: Resource:
	get: return starting_trait
