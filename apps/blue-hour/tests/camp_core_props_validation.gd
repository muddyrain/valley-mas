extends SceneTree
func _initialize() -> void:
 var camp := (load("res://scenes/camp/camp_main.tscn") as PackedScene).instantiate()
 root.add_child(camp)
 await process_frame
 var ids=["CAMP_PROP_001_workbench","CAMP_PROP_002_storage_shelf","CAMP_PROP_003_notice_board","CAMP_PROP_004_portable_generator"]
 for id in ids:
  var nodes:=camp.find_children(id,"Node3D",true,false)
  print(id, " count=", nodes.size())
  if nodes.size()>0:
   var n:=nodes[0] as Node3D
   print(" pos=",n.global_position," scale=",n.scale," collision=",n.find_children("CollisionShape3D","CollisionShape3D",true,false).size())
 print("placeholders=", camp.get_node("DecorationPlaceholders").get_child_count())
 quit(0)
