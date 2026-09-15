extends SceneTree
const Generator=preload("res://maps/random/random_map_generator.gd")
func _initialize():
 var checks=0; var failures=[]
 for mission in ["supply_search","food_supply","rescue"]:
  for seed in [1001,1002,1003]:
   var a=Generator.generate(mission,seed); var b=Generator.generate(mission,seed); checks+=1
   if not a.get("ok", false) or not b.get("ok", false): failures.append("generation failed %s %d"%[mission,seed]); continue
   if var_to_str(a)!=var_to_str(b): failures.append("determinism %s %d"%[mission,seed])
   if a.buildings.is_empty() or a.spawn==a.extraction: failures.append("spawn/extraction")
   if mission=="food_supply" and a.poi not in ["BLD_001_supermarket","BLD_015_convenience_store_a"]: failures.append("food poi")
   if mission=="rescue" and a.target_building_id=="": failures.append("rescue target")
   for x in a.buildings:
    if x.footprint.x>24 or x.footprint.y>24: failures.append("bounds "+x.asset)
    if x.yaw not in [0.0,PI/2,PI,3.0*PI/2]: failures.append("yaw")
 print("RANDOM MAP: %d cases, %d failures"%[checks,failures.size()]); print(failures); quit(0 if failures.is_empty() else 1)
