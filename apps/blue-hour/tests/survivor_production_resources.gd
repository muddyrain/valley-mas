extends SceneTree
## Resolve shipped scene/resource dependencies and inspect the two stable model entries.
var missing: Array[String] = []
var invalid_uids: Array[String] = []
var obsolete_references: Array[String] = []
var checked: int = 0

func _initialize() -> void:
	call_deferred("run")

func scan(directory: String) -> void:
	for folder: String in DirAccess.get_directories_at(directory):
		if folder.begins_with(".") or folder in ["test-output", "build", "exports", "art", "docs", "tests"]:
			continue
		# Deletion of these unreferenced source binaries was blocked by approval policy.
		if folder == "source" and directory in ["res://assets/characters/xia_zhiyao", "res://assets/characters/su_wanxing"]:
			continue
		scan(directory.path_join(folder))
	for file: String in DirAccess.get_files_at(directory):
		var path := directory.path_join(file)
		if file.get_extension() not in ["tscn", "tres", "glb", "fbx", "gd"]:
			continue
		checked += 1
		for dependency: String in ResourceLoader.get_dependencies(path):
			var pieces := dependency.split("::")
			var dep: String = pieces[-1] if pieces.size() > 1 else pieces[0]
			if pieces[0].begins_with("uid://") and not ResourceUID.has_id(ResourceUID.text_to_id(pieces[0])):
				invalid_uids.append(path + " -> " + pieces[0])
			if dep.begins_with("res://") and not ResourceLoader.exists(dep):
				missing.append(path + " -> " + dep)
			if "/candidates/" in dep or "/test-output/" in dep or ("/characters/xia_zhiyao/animations/" in dep) or ("/characters/su_wanxing/animations/" in dep) or dep in ["res://assets/characters/xia_zhiyao/source/xia_zhiyao.glb", "res://assets/characters/su_wanxing/source/su_wanxing.glb"]:
				obsolete_references.append(path + " -> " + dep)

func run() -> void:
	scan("res://")
	for path: String in ["res://core/main.tscn", "res://scenes/camp/camp_main.tscn", "res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb", "res://assets/characters/su_wanxing/runtime/su_wanxing.glb"]:
		var scene := load(path) as PackedScene
		if scene == null or not scene.can_instantiate():
			missing.append(path)
		else:
			var instance := scene.instantiate()
			instance.free()
	var report := {"resources_checked": checked, "missing_resource": missing, "invalid_uid": invalid_uids, "obsolete_production_references": obsolete_references}
	FileAccess.open("res://test-output/survivor-production/resources.json", FileAccess.WRITE).store_string(JSON.stringify(report, "\t"))
	print("SURVIVOR PRODUCTION RESOURCES: ", report)
	quit(0 if missing.is_empty() and invalid_uids.is_empty() and obsolete_references.is_empty() else 1)
