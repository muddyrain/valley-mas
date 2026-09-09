extends RefCounted
const World=preload("res://scripts/world_data.gd")

static func empty(config: Dictionary={}):
	var w=World.create_grid(config)
	w.terrain.fill(World.DEEP)
	w.generation_settings=World.Landscape.settings(config)
	w.spread_enabled=bool(config.get("spread",true))
	w.prepare_ecology()
	w.image=w.bake_image()
	return w
