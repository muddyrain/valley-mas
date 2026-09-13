extends Node3D

const Actor = preload("res://camp/camp_actor.gd")
const VisualStyle = preload("res://camp/camp_visual_style.gd")
const Dressing = preload("res://camp/camp_dressing.gd")
const AmbientBehavior = preload("res://camp/camp_ambient_behavior.gd")
var members: Dictionary = {}
var visual_style: Node
var ambient_behavior: Node
@onready var departure: Node = $CampDepartureController

func _ready() -> void:
	visual_style = VisualStyle.new()
	add_child(visual_style)
	visual_style.configure(self)
	var dressing := Dressing.new()
	dressing.name = "CampDressing"
	add_child(dressing)
	dressing.configure(self)

func configure(game: RefCounted) -> void:
	var slots := $Characters.get_children()
	for index: int in range(mini(game.data.members.size(), slots.size())):
		var id: String = game.data.members[index]
		var placeholder := slots[index] as Node3D
		var actor := Actor.new()
		actor.name = "Crew_" + id.replace(":", "_")
		$Characters.add_child(actor)
		actor.transform = placeholder.transform
		actor.setup(game, id)
		visual_style.register_actor(actor)
		members[id] = actor
	# Authored models supply spawn transforms, never additional camp residents.
	for placeholder: Node3D in slots:
		$Characters.remove_child(placeholder)
		placeholder.queue_free()

	ambient_behavior = AmbientBehavior.new()
	ambient_behavior.name = "CampAmbientBehavior"
	add_child(ambient_behavior)
	ambient_behavior.setup(self, int(game.data.seed))

func begin_departure(party: Array[String]) -> void:
	if ambient_behavior != null:
		ambient_behavior.departure_override()
	departure.begin(self, party)
