class_name WeaponModifierData
extends Resource
## Immutable content definition for one weapon modifier.

enum Category {
	STAT,
	MECHANIC,
	SPECIAL,
}

enum Operation {
	ADD,
	MULTIPLY,
	SET,
}

@export var id: String = ""
@export var name: String = ""
@export_multiline var description: String = ""
@export var category: Category = Category.STAT
@export var target_stat: StringName = &""
@export var operation: Operation = Operation.MULTIPLY
@export var value: float = 1.0
@export var rarity_weight: float = 1.0
@export var max_stack: int = 1
@export var conflict_group: StringName = &""
@export var weapon_tags: Array[String] = []
@export var effect_id: StringName = &""
