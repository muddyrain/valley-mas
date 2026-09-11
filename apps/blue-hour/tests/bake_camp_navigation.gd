extends SceneTree

## Rebuilds the Camp V1 navigation mesh from its static collision geometry.

const CAMP_SCENE_PATH := "res://scenes/camp/camp_main.tscn"
const NAVIGATION_MESH_PATH := "res://scenes/camp/camp_navigation_mesh.tres"


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var packed_scene := load(CAMP_SCENE_PATH) as PackedScene
	if packed_scene == null:
		push_error("Camp scene could not be loaded")
		quit(1)
		return

	var camp := packed_scene.instantiate() as Node3D
	root.add_child(camp)
	var region := camp.get_node("NavigationRegion3D") as NavigationRegion3D
	region.bake_navigation_mesh(false)
	var navigation_mesh := region.navigation_mesh
	if navigation_mesh == null or navigation_mesh.get_polygon_count() == 0:
		push_error("Camp navigation bake produced no polygons")
		quit(1)
		return

	var save_error := ResourceSaver.save(navigation_mesh, NAVIGATION_MESH_PATH)
	if save_error != OK:
		push_error("Camp navigation mesh could not be saved: %s" % error_string(save_error))
		quit(1)
		return

	print(
		"CAMP NAVIGATION BAKE: %d vertices, %d polygons"
		% [navigation_mesh.get_vertices().size(), navigation_mesh.get_polygon_count()]
	)
	quit()
