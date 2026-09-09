extends SceneTree

const Fixtures=preload("res://tests/world_fixtures.gd")

const World=preload("res://scripts/world_data.gd")
const View=preload("res://scripts/world_view.gd")
var checks=0
var failures: Array[String]=[]

func check(ok: bool,message: String) -> void:
	checks+=1
	if not ok: failures.append(message); push_error(message)

func marker(w,i: int) -> Image:
	var im=Image.create(w.width*World.Landscape.OVERVIEW_PIXELS,w.height*World.Landscape.OVERVIEW_PIXELS,false,Image.FORMAT_RGBA8)
	World.Landscape.paint_crown(im,w,i)
	return im

func occupied(im: Image) -> int:
	var count=0
	for y in im.get_height():
		for x in im.get_width():
			if im.get_pixel(x,y).a>0: count+=1
	return count

func _initialize() -> void:
	check(World.Landscape.OVERVIEW_PIXELS==1,"Overview has one stable map pixel per terrain cell")
	var compact=true
	for species in range(1,World.Catalog.MAX_ID+1):
		for stage in range(World.SPROUT,World.DEAD+1):
			var frame=World.Landscape.Sprites.frame(species,stage,1,2)
			var colors={}
			for y in frame.get_height():
				for x in frame.get_width():
					var c=frame.get_pixel(x,y)
					if c.a>0: colors[c]=true
			compact=compact and colors.size()<=3 and frame.get_width()<=4 and frame.get_height()<=5 and occupied(frame)>0
	check(compact,"Every living and dead overview object has a compact visible mark with at most three opaque colours")
	var flora=World.Landscape.Flora
	for species in range(1,World.Catalog.MAX_ID+1): flora.prepare_atlas_species(species)
	var preserved=true
	for species in range(1,World.Catalog.MAX_ID+1):
		for stage in 6:
			for variant in 3:
				for distant in [false,true]:
					var region=flora.atlas_region(species,stage,variant,distant)
					var source=World.Landscape.Sprites.frame(species,stage,variant,1 if distant else 0)
					if region.size!=source.get_size() or flora.atlas_image.get_region(region).get_data()!=source.get_data(): preserved=false
	check(preserved,"All 2520 near/middle frames survive atlas packing across 70 objects and six life stages")
	var painter=flora.new()
	var legacy=flora.atlas_region(13,3,0)
	check(flora.atlas_image.get_region(legacy).get_data()==painter.render(13,3,0,false).get_data(),"Ground objects use the same canonical atlas")
	var w=Fixtures.empty({"width":32,"height":32,"trees":0})
	w.terrain.fill(World.FOREST); w.biomes.fill(World.BIRCH)
	var i=16*w.width+16
	w.plants[i]=2; w.plant_stage[i]=World.ADULT
	var footprint=occupied(marker(w,i))/pow(World.Landscape.OVERVIEW_PIXELS/2.0,2)
	check(footprint>10 and footprint<=80,"A PNG tree retains its connected miniature crown within the same world footprint")
	var appearances: Array=[]
	for stage in [World.SPROUT,World.YOUNG,World.ADULT,World.DEAD]:
		w.plant_stage[i]=stage
		var im=marker(w,i)
		check(occupied(im)>0,"Overview retains a visible plant at life stage %d"%stage)
		appearances.append(im.get_data())
	check(appearances[0]!=appearances[1] and appearances[1]!=appearances[2] and appearances[2]!=appearances[3],"Growth and death change the distant mark")
	w.plant_stage[i]=World.ADULT; w.plants[i]=54
	check(occupied(marker(w,i))>=4,"A giant mushroom remains a canopy in the distant view")
	w.plants[i]=0
	check(occupied(marker(w,i))==0,"Removing a plant removes its overview mark")
	var view=View.new()
	view.zoom=.8; view.fit_zoom=.4
	var distant=view.overview_weight()
	view.fit_zoom=1.6
	check(is_equal_approx(distant,view.overview_weight()),"The same screen pixel size uses the same detail on different map sizes")
	view.zoom=5
	check(view.overview_weight()==0,"Close inspection always restores full silhouettes")
	view.free()
	print("AEON VALE OVERVIEW: "+JSON.stringify({"checks":checks,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
