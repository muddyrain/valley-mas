extends Node2D

# Retained draw commands: moving the camera only changes the parent transform.
var owner_view
var entries: Array=[]
var compact: bool=false

func _draw() -> void:
	for entry in entries:
		var species: int=entry[0]+1
		if not owner_view.show_plants and species not in [13,14]: continue
		if owner_view.transitions.has(entry[5]) and owner_view.transitions[entry[5]].kind in ["grow","appear","fertilize"]: continue
		var base: Vector2=entry[2]
		if entry[4]>=owner_view.World.YOUNG:
			var shadow=4.5 if owner_view.World.is_tree(species) else 2.0
			draw_colored_polygon(PackedVector2Array([base+Vector2(-shadow*.7,0),base+Vector2(1,-1),base+Vector2(shadow*1.8,1.5),base+Vector2(shadow*1.2,2.2),base+Vector2(-shadow*.4,1.1)]),Color(.12,.21,.16,.23))
	# Keep the shared atlas contiguous instead of alternating a polygon and texture for every plant.
	for entry in entries:
		var species: int=entry[0]+1
		if not owner_view.show_plants and species not in [13,14]: continue
		if owner_view.transitions.has(entry[5]) and owner_view.transitions[entry[5]].kind in ["grow","appear","fertilize"]: continue
		var tint=Color(entry[3],entry[3],entry[3],1)
		draw_texture_rect_region(owner_view.Flora.atlas_texture,entry[1],entry[7] if compact else entry[6],tint)
