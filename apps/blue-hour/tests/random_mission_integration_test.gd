extends SceneTree
const Mission=preload("res://missions/mission.gd")
const Catalog=preload("res://data/catalog.gd")
const Ledger=preload("res://core/run_ledger.gd")
func _initialize():
 var ok := true
 var cases = [
  {"mission_type":"rescue","seed":2001,"layout":"LAYOUT_SMALL_3X3","expected":7},
  {"mission_type":"supply_search","seed":3001,"layout":"LAYOUT_MEDIUM_3X4","expected":10},
  {"mission_type":"food_supply","seed":4001,"layout":"LAYOUT_MEDIUM_4X4","expected":12}
 ]
 for cfg in cases:
  var m=Mission.new(); root.add_child(m); await process_frame
  var c=Catalog.new(); var l=Ledger.new()
  cfg["use_random_map"] = true
  cfg["zombie_density"] = 1.0
  m.setup(c,l,["WPN_002_P9_PISTOL"],int(cfg.seed),null,[],cfg)
  await process_frame
  var count: int = m.city.data.buildings.size()
  var paths_ok := true
  for b in m.city.data.buildings:
   if m.city.path(m.city.data.bus_position,b.entry).is_empty(): paths_ok=false
  print("RANDOM MISSION layout=%s buildings=%d expected=%d paths=%s sites=%d" % [cfg.layout,count,cfg.expected,paths_ok,m.city.sites.size()])
  if count != int(cfg.expected) or not paths_ok: ok=false
  m.queue_free(); await process_frame
 quit(0 if ok else 1)

