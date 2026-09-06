extends RefCounted

static var path: String = "user://interface.cfg"

static func initial_window_size(usable: Vector2i) -> Vector2i:
	return Vector2i(mini(1600,usable.x-48),mini(1000,usable.y-56))

static func read() -> Dictionary:
	var config = ConfigFile.new()
	if config.load(path) != OK: return {"scale":1.0,"fullscreen":false,"plants":true}
	var scale_value = config.get_value("display","scale",1.0)
	var scale_number = float(scale_value) if scale_value is float or scale_value is int else 1.0
	if not is_finite(scale_number): scale_number = 1.0
	return {"scale":clampf(scale_number,.9,1.15),"fullscreen":config.get_value("display","fullscreen",false) == true,"plants":config.get_value("display","plants",true) == true}

static func write(scale_value: float, fullscreen: bool, plants: bool) -> Error:
	var config = ConfigFile.new()
	config.set_value("display","scale",scale_value)
	config.set_value("display","fullscreen",fullscreen)
	config.set_value("display","plants",plants)
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	return config.save(path)
