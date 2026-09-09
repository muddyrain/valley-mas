extends RefCounted
var path: String

func _init(save_path: String = "user://homeward/run.json") -> void:
	path = save_path

func _read_file(file_path: String) -> Dictionary:
	if not FileAccess.file_exists(file_path):
		return {}
	var file := FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return {}
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return {}
	var envelope = parser.data
	if not envelope is Dictionary or not envelope.get("payload") is String or not envelope.get("sha256") is String:
		return {}
	if envelope.payload.sha256_text() != envelope.sha256:
		return {}
	if parser.parse(envelope.payload) != OK:
		return {}
	var payload = parser.data
	return payload if payload is Dictionary else {}

func read(validator: Callable = Callable()) -> Dictionary:
	var data := _read_file(path)
	if not data.is_empty() and (not validator.is_valid() or validator.call(data)):
		return {"ok": true, "data": data, "recovered": false}
	data = _read_file(path + ".bak")
	if not data.is_empty() and (not validator.is_valid() or validator.call(data)):
		return {"ok": true, "data": data, "recovered": true}
	return {"ok": false, "missing": not FileAccess.file_exists(path) and not FileAccess.file_exists(path + ".bak"), "data": {}}

func write(data: Dictionary, validator: Callable = Callable()) -> String:
	if validator.is_valid() and not validator.call(data):
		return "存档状态不完整，原记录已保留。"
	var absolute := ProjectSettings.globalize_path(path)
	if DirAccess.make_dir_recursive_absolute(absolute.get_base_dir()) != OK:
		return "无法创建存档目录"
	var temporary := path + ".tmp"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return "无法写入存档，请检查磁盘空间和权限"
	var payload := JSON.stringify(data)
	file.store_string(JSON.stringify({"payload": payload, "sha256": payload.sha256_text()}))
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK or _read_file(temporary).is_empty():
		return "存档写入不完整，原记录已保留"
	# Never rotate a corrupt primary over the last valid backup.
	var moved := false
	var previous := _read_file(path)
	var previous_valid: bool = not previous.is_empty() and (not validator.is_valid() or validator.call(previous))
	# Keep the original schema beyond normal rotating backups, including recovered backups.
	var migration_source := path
	if not previous_valid:
		previous = _read_file(path + ".bak")
		migration_source = path + ".bak"
	if previous.get("version") == 1 and data.get("version") == 2 and (not validator.is_valid() or validator.call(previous)) and not FileAccess.file_exists(path + ".v1.bak"):
		if DirAccess.copy_absolute(ProjectSettings.globalize_path(migration_source), absolute + ".v1.bak") != OK:
			return "无法保留旧版存档，升级已取消"
	if FileAccess.file_exists(path) and previous_valid:
		if FileAccess.file_exists(path + ".bak") and DirAccess.remove_absolute(absolute + ".bak") != OK:
			return "无法更新存档备份，原记录已保留"
		if DirAccess.rename_absolute(absolute, absolute + ".bak") != OK:
			return "无法替换存档，原记录已保留"
		moved = true
	elif FileAccess.file_exists(path):
		if DirAccess.remove_absolute(absolute) != OK:
			return "无法替换损坏的存档"
	if DirAccess.rename_absolute(absolute + ".tmp", absolute) != OK:
		if moved:
			DirAccess.rename_absolute(absolute + ".bak", absolute)
		return "无法完成保存，原记录已保留"
	return ""
