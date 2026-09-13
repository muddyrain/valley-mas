extends Node3D
## Facility-root interaction survives replacing any visual descendants.
@export var id := ""
@export var display_name := ""
@export var interaction_type := "facility"
@export var enabled := true
@export var panel_type := "facility"
@export_multiline var description := ""
@export var actions: PackedStringArray = []
@export var pick_size := Vector3.ONE
@export var pick_center := Vector3.ZERO

func _ready() -> void:
	add_to_group("camp_interactables")
	var area := Area3D.new()
	area.collision_layer = 8
	area.collision_mask = 0
	area.input_ray_pickable = false
	area.set_meta("camp_interactable", self)
	add_child(area)
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = pick_size
	collision.shape = box
	collision.position = pick_center
	area.add_child(collision)
