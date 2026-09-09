extends Node2D

# Retained draw commands: moving the camera only changes the parent transform.
var owner_view
var entries: Array=[]
var compact: bool=false
var redraw_usec: int=0
static var contact_shadow: Texture2D

static func shadow_texture() -> Texture2D:
	if contact_shadow==null:
		# Reuse the same five-sided contact shadow as a batchable quad.
		# Its horizontal size still follows the species; vertical size is fixed.
		var image=Image.create(64,32,false,Image.FORMAT_RGBA8)
		image.fill(Color.TRANSPARENT)
		var outline=PackedVector2Array([Vector2(0,.7/2.2),Vector2(.7/2.05,0),Vector2(1,1.2/2.2),Vector2(1.75/2.05,1),Vector2(.3/2.05,1.8/2.2)])
		for y in image.get_height():
			for x in image.get_width():
				if Geometry2D.is_point_in_polygon(Vector2(x+.5,y+.5)/Vector2(image.get_size()),outline): image.set_pixel(x,y,Color(.22,.27,.12,.20))
		contact_shadow=ImageTexture.create_from_image(image)
	return contact_shadow

func _draw() -> void:
	var started=Time.get_ticks_usec()
	for entry in entries:
		var species: int=entry[0]+1
		if not owner_view.show_plants and species not in [13,14]: continue
		if owner_view.transitions.has(entry[5]) and owner_view.transitions[entry[5]].kind in ["grow","appear","fertilize"]: continue
		var base: Vector2=entry[2]
		if entry[4]>=owner_view.World.YOUNG:
			var shadow=3.4 if owner_view.World.is_tree(species) else 1.5
			# A short contact shadow attaches the trunk without repeating a long slash.
			draw_texture_rect(shadow_texture(),Rect2(base+Vector2(-shadow*.7,-.7),Vector2(shadow*2.05,2.2)),false)
	# Keep the shared atlas contiguous instead of alternating a polygon and texture for every plant.
	for entry in entries:
		var species: int=entry[0]+1
		if not owner_view.show_plants and species not in [13,14]: continue
		if owner_view.transitions.has(entry[5]) and owner_view.transitions[entry[5]].kind in ["grow","appear","fertilize"]: continue
		var tint=Color(entry[3],entry[3],entry[3],1)
		draw_texture_rect_region(owner_view.Flora.atlas_texture,entry[1],entry[7] if compact else entry[6],tint)
	redraw_usec=Time.get_ticks_usec()-started
