extends Node3D

const Actor = preload("res://camp/camp_actor.gd")
var members: Dictionary = {}
@onready var departure: Node = $CampDepartureController

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
		members[id] = actor
		placeholder.queue_free()

func begin_departure(party: Array[String]) -> void:
	departure.begin(self, party)
