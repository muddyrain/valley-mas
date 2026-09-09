extends SceneTree
const World=preload("res://scripts/world_data.gd")
const Save=preload("res://scripts/save_store.gd")
const View=preload("res://scripts/world_view.gd")
var checks=0
var failures=[]
var metrics={}
func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)
func _initialize() -> void:
	check(World.MAP_SIZES==[Vector2i(288,288),Vector2i(384,384),Vector2i(480,480)],"Three square creation sizes")
	var view=View.new()
	check(view.has_method("draw_world_boundary"),"World bounds have a visible outline")
	view.free()
	for side in [288,384,480]:
		var w=World.create({"width":side,"height":side,"template":"boring_plains","seed":781936,"trees":1.0})
		check(w.width==side and w.height==side,"Square grid allocated: "+str(side))
		var encoded=Save.encode(w); var bytes=JSON.stringify(encoded).to_utf8_buffer().size()
		metrics[str(side)]={"save_bytes":bytes,"plants":w.plant_count()}
		check(bytes<=Save.MAX_BYTES,"Complete square world fits save limit: "+str(side)+" / "+str(bytes))
		var restored=Save.decode(encoded).world
		check(restored!=null and restored.width==side and restored.height==side and restored.plants==w.plants,"Square save round trip: "+str(side))
	var legacy=Save.decode(JSON.parse_string(FileAccess.get_file_as_string("res://test-output/ground-world.json"))).world
	check(legacy!=null and legacy.width==384 and legacy.height==256,"Existing rectangular world keeps its real dimensions")
	var report={"checks":checks,"failures":failures,"metrics":metrics}
	FileAccess.open("res://test-output/square-worlds.json",FileAccess.WRITE).store_string(JSON.stringify(report))
	print("SQUARE WORLDS: "+JSON.stringify(report)); quit(0 if failures.is_empty() else 1)
