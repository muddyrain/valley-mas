extends SceneTree
func _initialize() -> void:
 var out="res://test-output/camp-core-props-pass-01/F-workshop-alt-angle.png"
 var camp := (load("res://scenes/camp/camp_main.tscn") as PackedScene).instantiate() as Node3D
 root.add_child(camp)
 await process_frame
 var camera:=camp.get_node("CameraRig/PitchPivot/Camera3D") as Camera3D
 camera.global_position=Vector3(-7.0,4.0,-12.0)
 camera.look_at(Vector3(-7.0,0,-5.0),Vector3.UP)
 camera.size=5.5
 await process_frame
 await RenderingServer.frame_post_draw
 root.get_texture().get_image().save_png(out)
 quit(0)

