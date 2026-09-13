extends SceneTree
func _initialize() -> void:
 var catalog=load("res://data/catalog.gd").new(); var game=load("res://core/campaign.gd").new(catalog); game.new_run(77,"",["xia_zhiyao","su_wanxing"])
 var camp=load("res://scenes/camp/camp_main.tscn").instantiate(); root.add_child(camp); await process_frame; camp.configure(game)
 for i in 240: await physics_frame
 var ambient=camp.ambient_behavior
 print("AMBIENT present=",ambient!=null," states=",ambient.state_for("xia_zhiyao"),",",ambient.state_for("su_wanxing")," poi=",ambient.poi_for("xia_zhiyao"))
 camp.begin_departure(game.data.members)
 await physics_frame
 print("DEPARTURE states=",ambient.state_for("xia_zhiyao"),",",ambient.state_for("su_wanxing"))
 quit(0)
