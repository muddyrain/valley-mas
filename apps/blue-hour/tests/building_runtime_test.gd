extends SceneTree
const Catalog = preload("res://data/world_asset_catalog.gd")
func _initialize() -> void:
 var ids := {}
 for d in Catalog.ALL:
  if String(d.id).begins_with("BLD_"):
   assert(not ids.has(d.id), "duplicate building id")
   ids[d.id] = true
   assert(d.scene != null and ResourceLoader.exists(d.scene.resource_path), "missing scene: "+d.id)
   var n = d.scene.instantiate()
   assert(n.has_node("Anchors/FrontMarker"), "missing front marker: "+d.id)
   assert(n.has_node("Anchors/EntranceMarker"), "missing entrance marker: "+d.id)
   assert(n.has_node("Anchors/SearchMarker"), "missing search marker: "+d.id)
   assert(n.has_node("Anchors/CenterMarker"), "missing center marker: "+d.id)
   assert(n.get_node("Collision/Shape0").shape is BoxShape3D, "collision shape: "+d.id)
   assert(n.find_children("*", "MeshInstance3D", true, false).size() > 0, "missing mesh: "+d.id)
   n.free()
 assert(ids.size() == 22, "expected 22 buildings")
 for i in range(1, 23):
  assert(Catalog.asset("BLD_%03d" % i) != null, "short registry lookup failed: BLD_%03d" % i)
 print("BUILDING RUNTIME: PASS (22 definitions)")
 quit()
