extends "res://tests/cohesion_runtime.gd"

func life_sheet(tag: String) -> void:
	await super.life_sheet(tag)
	# One whole-island view at the extent of the user's far-distance reference.
	var w=World.generate({"width":384,"height":256,"seed":168760530,"template":"continent","trees":.8})
	setup_world(w); game._select_category(-1); game._select_tool(-1); game._update_status()
	focus_cell(Vector2(192,124),.60)
	await capture(tag+"-whole-island")
