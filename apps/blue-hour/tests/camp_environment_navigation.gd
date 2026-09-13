extends SceneTree

const PATHS: Array[Array] = [
	[Vector3(0, 0, -3.5), Vector3(0, 0, 0.2)],
	[Vector3(0, 0, 0.2), Vector3(-4.7, 0, -2.1)],
	[Vector3(-3.95, 0, 1.0), Vector3(-3.0, 0, 3.5)],
	[Vector3(-3.0, 0, 3.5), Vector3(-3.0, 0, 8.0)],
]

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var camp := (load("res://scenes/camp/camp_main.tscn") as PackedScene).instantiate() as Node3D
	root.add_child(camp)
	for _index in range(8):
		await physics_frame
	var map: RID = (camp.get_node("NavigationRegion3D") as NavigationRegion3D).get_navigation_map()
	var failures := 0
	for pair: Array in PATHS:
		if NavigationServer3D.map_get_path(map, pair[0], pair[1], true).size() < 2:
			failures += 1
	print("CAMP ENV NAVIGATION: %d paths, %d failures" % [PATHS.size(), failures])
	quit(0 if failures == 0 else 1)
