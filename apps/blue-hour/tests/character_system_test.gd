extends SceneTree
## CharacterRegistry must expose the twelve production SurvivorDefinitions.

const CharacterRegistry = preload("res://data/character_registry.gd")


func _init() -> void:
	var survivors: Array[Resource] = CharacterRegistry.all_survivors()
	var traits: Array[Resource] = CharacterRegistry.all_traits()
	assert(survivors.size() == 12, "Production registry must contain twelve Survivors")
	assert(traits.size() == 12, "Production registry must contain twelve Traits")
	var survivor_ids: Array[String] = []
	var trait_ids: Array[String] = []
	for survivor: Resource in survivors:
		assert(survivor is SurvivorDefinition, survivor.id + " must use SurvivorDefinition")
		assert(survivor.survivor_id.begins_with("SUR_"), survivor.id + " must have stable SUR ID")
		assert(survivor.trait_levels.size() == 5, survivor.id + " must have five Trait levels")
		assert(ResourceLoader.exists(survivor.model_resource), survivor.id + " model must resolve")
		assert(not survivor.id in survivor_ids, survivor.id + " must be unique")
		survivor_ids.append(survivor.id)
	for trait_definition: Resource in traits:
		assert(trait_definition.levels.size() == 5, trait_definition.id + " must have five levels")
		assert(not trait_definition.id in trait_ids, trait_definition.id + " must be unique")
		trait_ids.append(trait_definition.id)
	assert(CharacterRegistry.get_definition("xia_zhiyao").trait_id == "search_instinct")
	assert(CharacterRegistry.get_definition("su_wanxing").trait_id == "resource_efficiency")
	assert(CharacterRegistry.get_trait("search_instinct").levels == PackedFloat32Array([0.12, 0.15, 0.18, 0.21, 0.25]))
	assert(CharacterRegistry.get_trait("resource_efficiency").levels == PackedFloat32Array([0.08, 0.10, 0.12, 0.14, 0.16]))
	print("CHARACTER SYSTEM: 12 SurvivorDefinitions and 12 Traits")
	quit()
