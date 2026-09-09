extends SceneTree

const World=preload("res://scripts/world_data.gd")

# Offline asset build only. The game loads these PNGs without generating a world.
func _initialize() -> void:
	DirAccess.make_dir_recursive_absolute("res://assets/maps")
	for template in World.Landscape.Templates.IDS:
		var world=World.generate({"seed":48217,"width":192,"height":192,"template":template,"trees":.85,"rivers":true})
		var picture=World.Landscape.preview(world)
		var result=picture.save_png("res://assets/maps/%s.png" % template)
		if result!=OK: push_error("Thumbnail export failed: "+template); quit(1); return
		print("THUMBNAIL "+template)
	quit(0)
