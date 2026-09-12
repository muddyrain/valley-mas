extends Node3D
## Wrappers own source corrections and simple physical shapes. No gameplay clock lives here.

@export var asset_id: String = ""

func bind_site(id: String) -> void:
	set_meta("world_asset", asset_id)
	for body: Node in find_children("*", "CollisionObject3D", true, false):
		body.set_meta("site_id", id)

