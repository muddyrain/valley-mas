extends "res://tests/tree_assets_runtime.gd"

# Reuse same-seed distance captures, live-overview regression and warmed motion run.
func life_sheet(tag: String) -> void:
	await super.life_sheet(tag)
	for biome in [World.MEADOW,World.BIRCH,World.SAVANNA,World.GOLDEN]:
		var w=Fixtures.empty({"width":128,"height":96,"seed":17821,"trees":0})
		w.terrain.fill(World.ecology_soil(biome)); w.biomes.fill(biome); w.elevation.fill(.1)
		w.prepare_ecology(); World.Landscape.populate(w,.8,Callable())
		w.prepare_ecology(); w.weather_enabled=false; w.spread_enabled=false
		w.image=w.bake_image(); setup_world(w); game._update_status()
		for z in [.8,2.2,5.0]:
			focus_cell(Vector2(64,48),z)
			await capture(tag+"-biome-"+str(biome)+"-"+str(z))
		game.view.show_plants=false; focus_cell(Vector2(64,48),2.2)
		await capture(tag+"-biome-"+str(biome)+"-ground")
		game.view.show_plants=true
