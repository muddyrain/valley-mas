extends SceneTree
func _initialize() -> void:
 var out="res://test-output/camp-core-props-pass-01"
 DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
 var camp := (load("res://scenes/camp/camp_main.tscn") as PackedScene).instantiate()
 root.add_child(camp)
 await process_frame
 await process_frame
 root.get_texture().get_image().save_png(out+"/A-default-camp.png")
 var hud:=camp.find_child("CampHUD",true,false)
 if hud: hud.visible=false
 await process_frame
 root.get_texture().get_image().save_png(out+"/B-no-hud.png")
 FileAccess.open(out+"/validation.json",FileAccess.WRITE).store_string(JSON.stringify({"objects":Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)}))
 quit(0)
