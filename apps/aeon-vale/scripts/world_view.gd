extends Control

signal brush_changed
signal edited
signal hover_changed(type_name: String)
signal distance_changed(value: String)

const World = preload("res://scripts/world_data.gd")
const Flora = preload("res://scripts/pixel_flora.gd")
const Surface = preload("res://scripts/surface_renderer.gd")
const PlantLayer = preload("res://scripts/plant_layer.gd")
const WeatherArt = preload("res://scripts/weather_art.gd")
const TempestArt = preload("res://scripts/tempest_art.gd")
var map_layer: Node2D
var vegetation_clip: Control
var ground_sprite: Node2D
var overview_sprite: Sprite2D
var canopy_sprite: Node2D
var row_nodes: Dictionary = {}
var canopy_dirty: Dictionary = {}
var pending_rows: Dictionary = {}
var canopy_upload_due: bool = false
var canopy_uploaded: float = 0
var layout_signature: Array = []
var plants_visibility: bool = true
var boundary_revision: int = -1
var boundary_solid: bool = false
var cast_accumulator: float = 0.0
var cast_events: Array = []
var cast_serial: int = 0
var invalid_feedback_at: float = -1
var preview_signature: Array = []
var world
var surface_thread: Thread
var surface_world
var surface_job_revision: int = -1
var terrain_textures: Dictionary={}
var pending_terrain_uploads: Dictionary={}
var pending_surface_revision: int=-1
var overview_texture: ImageTexture
var overview_image: Image
var canopy_image: Image
var surface_revision: int = -1
var fit_zoom: float = 1.0
var tool_icon: Texture2D
var preview_blocked: bool = false
var preview_cells: Array = []
var sprites: Array[Texture2D] = []
var plant_draws: Array = []
var plant_rows: Dictionary = {}
var entry_cache: Dictionary = {}
var camera: Vector2 = Vector2.ZERO
var zoom: float = 1.0
var tool: int = -1
var radius: int = 4
var brush_shape: int = 0
var show_plants: bool = true
var panning: bool = false
var painting: bool = false
var last_cell: Vector2i = Vector2i(-100, -100)
var pending_fert_path: Array[Vector2i]=[]
var last_fert_cast: float=-1
var cursor_position: Vector2 = Vector2.ZERO
var cursor_inside: bool = false
var interaction_locked: bool = false
var casting_locked: bool = false
var effects: Control
var clock_time: float = 0.0
var paused: bool = false
var speed: float = 1.0
var effect_accumulator: float = 0.0
var transitions: Dictionary = {}
var disaster_draws: Array = []
var real_time: float = 0
var quake_offset: Vector2 = Vector2.ZERO
var last_visible_plants: int = 0

func _ready() -> void:
	TempestArt.prepare()
	for variant in 4:
		WeatherArt.texture(variant); WeatherArt.texture(variant,true)
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	for i in World.Catalog.MAX_ID: sprites.append(Flora.icon(i + 1))
	map_layer=Node2D.new(); add_child(map_layer)
	ground_sprite=Node2D.new(); map_layer.add_child(ground_sprite)
	vegetation_clip=Control.new(); vegetation_clip.clip_contents=true
	vegetation_clip.mouse_filter=Control.MOUSE_FILTER_IGNORE; map_layer.add_child(vegetation_clip)
	ground_sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	overview_sprite=Sprite2D.new(); overview_sprite.centered=false; map_layer.add_child(overview_sprite)
	canopy_sprite=preload("res://scripts/overview_layer.gd").new(); map_layer.add_child(canopy_sprite)
	overview_sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	canopy_sprite.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	var canopy_material=CanvasItemMaterial.new()
	canopy_material.blend_mode=CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA
	canopy_sprite.material=canopy_material
	effects = Control.new()
	effects.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	effects.mouse_filter = Control.MOUSE_FILTER_IGNORE
	effects.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(effects)
	effects.draw.connect(_draw_effects)
	mouse_entered.connect(func(): cursor_inside = true)
	mouse_exited.connect(func(): cursor_inside = false; effects.queue_redraw())
	resized.connect(func(): if world != null: fit_world())

func set_world(value) -> void:
	if surface_thread!=null:
		finish_surface(surface_thread.wait_to_finish())
		surface_thread=null
	if world!=null: world.defer_surface=false; world.flush_pending_surface()
	world = value
	boundary_revision=-1
	vegetation_clip.size=Vector2(world.width,world.height)*World.TILE
	world.defer_surface=true
	if Flora.atlas_texture == null:
		for species in range(1, World.Catalog.MAX_ID + 1): Flora.prepare_atlas_species(species)
	transitions.clear()
	cast_events.clear()
	preview_signature.clear()
	for node in row_nodes.values(): node.free()
	row_nodes.clear(); canopy_dirty.clear(); pending_rows.clear(); layout_signature.clear(); entry_cache.clear()
	disaster_draws.clear()
	world.visual_events.clear()
	world.disaster_events.clear()
	world.dirty_rows.clear()
	clock_time = world.age
	if world.image == null: world.image = world.bake_image()
	build_terrain_chunks()
	surface_revision = world.surface_revision
	rebuild_plants()
	rebuild_overview()
	fit_world()

func fit_world() -> void:
	if world == null: return
	fit_zoom = minf((size.x - 80) / (world.width * World.TILE), (size.y - 54) / (world.height * World.TILE))
	zoom = fit_zoom
	camera = (size - Vector2(world.width, world.height) * World.TILE * zoom) / 2
	queue_redraw()
	effects.queue_redraw()
	distance_changed.emit(distance_name())

func rebuild_plants(region: Rect2i = Rect2i()) -> void:
	var first = 0
	var last = ceili(world.height / 8.0)
	if region.has_area() and not plant_rows.is_empty():
		first = maxi(0, region.position.y / World.TILE / 8)
		last = mini(last, ceili(float(region.end.y) / World.TILE / 8))
	else: plant_rows.clear()
	for group in range(first, last):
		plant_rows[group] = build_plant_rows(group * 8, mini(world.height, group * 8 + 8))
		refresh_row_node(group)
	plant_draws.clear()
	for group in ceili(world.height / 8.0): plant_draws.append_array(plant_rows[group])

func build_plant_rows(first: int, last: int) -> Array:
	var result: Array = []
	var plants: PackedByteArray = world.plants
	var objects: PackedByteArray = world.objects
	var stages: PackedByteArray = world.plant_stage
	var columns: int = world.width
	var seed_value: int = world.world_seed
	for y in range(first, last):
		for x in columns:
			var i = y * columns + x
			if plants[i] == 0 and objects[i] == 0: continue
			var species = plants[i] if plants[i] > 0 else 12 + objects[i]
			var stage = stages[i] if plants[i] > 0 else World.ADULT
			var existing=entry_cache.get(i)
			if existing!=null and existing[0]==species-1 and existing[4]==stage:
				result.append(existing)
				continue
			var sample = World.hash_cell(x, y, seed_value)
			var base = World.Landscape.plant_anchor(world,i)
			var extent = Vector2(16, 19.2) * (0.90 + sample % 5 * 0.045)
			if World.Catalog.is_ground_cover(species): extent*=.72
			var rect = Rect2(base - Vector2(extent.x / 2, extent.y * 0.94), extent)
			var variation = sample % 3
			# Cache both silhouettes before drawing; the same bounds anchor every observation distance.
			var near_region = Flora.atlas_region(species, stage, variation)
			var far_region = Flora.atlas_region(species, stage, variation, true)
			var entry=[species - 1, rect, base, 0.94 + (sample % 5) * 0.012, stage, i, near_region, far_region]
			entry_cache[i]=entry
			result.append(entry)
	return result

func refresh_edit(region: Rect2i = Rect2i()) -> void:
	preview_signature.clear()
	refresh_ecology()
	effects.queue_redraw()

func refresh_ecology() -> void:
	request_surface()
	consume_events()
	if world.dirty_rows.is_empty(): return
	for group in world.dirty_rows:
		pending_rows[group]=true
	world.dirty_rows.clear()

func process_plant_updates() -> void:
	if pending_rows.is_empty() and canopy_dirty.is_empty() and not canopy_upload_due: return
	var started=Time.get_ticks_usec()
	var redraw_budget=0
	# queue_redraw executes later in the frame; reserve its measured cost too.
	while not pending_rows.is_empty() and Time.get_ticks_usec()-started+redraw_budget<2200:
		var group: int=pending_rows.keys()[0]
		pending_rows.erase(group)
		plant_rows[group]=build_plant_rows(group*8,mini(world.height,group*8+8))
		refresh_row_node(group)
		redraw_budget+=row_nodes[group].redraw_usec
		for neighbor in range(maxi(0,group-1),mini(ceili(world.height/8.0),group+2)): canopy_dirty[neighbor]=true
	if Time.get_ticks_usec()-started+redraw_budget<3500: update_canopy_rows()
	if canopy_upload_due and (canopy_dirty.is_empty() or real_time-canopy_uploaded>.2):
		canopy_sprite.flush(overview_image,canopy_image)
		canopy_upload_due=not canopy_sprite.pending.is_empty(); canopy_uploaded=real_time
	if pending_rows.is_empty():
		plant_draws.clear()
		for group in plant_rows: plant_draws.append_array(plant_rows[group])

func consume_events() -> void:
	var visible_rect = Rect2(-camera / zoom, size / zoom).grow(30)
	for event in world.visual_events:
		var base = Vector2(event.cell % world.width, event.cell / world.width) * World.TILE + Vector2(0, 3)
		var active: bool=event.get("active",false)
		if (active or distance_name()=="近景") and transitions.size() < 128 and visible_rect.has_point(base):
			event.started = real_time
			event.duration=1.25 if active else .65
			transitions[event.cell] = event
	world.visual_events.clear()
	for event in world.disaster_events:
		if disaster_draws.size() >= 128: disaster_draws.pop_front()
		event.real_started = real_time
		disaster_draws.append(event)
	world.disaster_events.clear()

func distance_name() -> String:
	return "远景" if overview_weight() > 0.5 else ("中景" if zoom < maxf(3.2, fit_zoom * 3.0) else "近景")

func set_distance(level: int) -> void:
	if world == null: return
	if level == 0: fit_world()
	else: zoom_at(size / 2, (maxf(2.2, fit_zoom * 2.4) if level == 1 else maxf(5.0, fit_zoom * 3.5)) / zoom)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), World.COLORS[World.DEEP])
	if world == null: return
	sync_map_layers()

func refresh_row_node(group: int) -> void:
	if not row_nodes.has(group):
		var node=PlantLayer.new(); node.owner_view=self
		node.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
		vegetation_clip.add_child(node); row_nodes[group]=node
		# The opaque overview composite fades above the detailed scene as one image.
		map_layer.move_child(overview_sprite,-1); map_layer.move_child(canopy_sprite,-1)
	row_nodes[group].entries=plant_rows.get(group,[])
	row_nodes[group].queue_redraw()

func sync_map_layers() -> void:
	map_layer.position=camera+quake_offset
	var signature=[camera,zoom,show_plants,size]
	if layout_signature==signature: return
	var changed_plants=plants_visibility!=show_plants
	plants_visibility=show_plants
	layout_signature=signature
	map_layer.scale=Vector2.ONE*zoom
	var overview=overview_weight()
	var far=overview>.5
	# Both levels share anchors and footprint. A short fade avoids the old whole-map
	# pop at 1.25x while every miniature still represents its actual living plant.
	ground_sprite.visible=overview<1
	overview_sprite.visible=overview>0 and not show_plants
	overview_sprite.modulate.a=overview
	canopy_sprite.visible=overview>0 and show_plants
	# Premultiplied textures must fade RGB and alpha together, or crowns glow.
	canopy_sprite.modulate=Color(overview,overview,overview,overview)
	var area=Rect2(-camera/zoom,size/zoom).grow(24)
	last_visible_plants=0
	for group in row_nodes:
		var node=row_nodes[group]
		var compact=zoom<2.0
		if node.compact!=compact:
			node.compact=compact; node.queue_redraw()
		node.visible=area.intersects(Rect2(0,group*8*World.TILE-24,world.width*World.TILE,8*World.TILE+48))
		# Keep commands prepared under the overview, avoiding a full first-zoom rebuild.
		node.modulate.a=0.0 if overview==1.0 else 1.0
		if changed_plants: node.queue_redraw()
		if node.visible: last_visible_plants+=node.entries.size()
	if far: last_visible_plants=plant_draws.size()

func update_canopy_rows() -> void:
	if canopy_image==null or canopy_dirty.is_empty(): return
	canopy_image.clear_mipmaps()
	var started=Time.get_ticks_usec()
	while not canopy_dirty.is_empty() and Time.get_ticks_usec()-started<1500:
		var group: int=canopy_dirty.keys()[0]
		canopy_dirty.erase(group)
		var pixels=World.Landscape.OVERVIEW_PIXELS
		var row_height=8*pixels
		var strip=Image.create(world.width*pixels,mini(row_height,world.height*pixels-group*row_height),false,Image.FORMAT_RGBA8)
		for neighbour in range(maxi(0,group-1),mini(ceili(world.height/8.0),group+2)):
			for entry in plant_rows.get(neighbour,[]): World.Landscape.paint_crown(strip,world,entry[5],Vector2i(0,group*row_height))
		canopy_image.blit_rect(strip,Rect2i(Vector2i.ZERO,strip.get_size()),Vector2i(0,group*row_height))
		canopy_sprite.mark(Rect2i(0,group*row_height,strip.get_width(),strip.get_height()))
	canopy_upload_due=true

func draw_ground_details(visible_rect: Rect2) -> void:
	var low = Vector2i(visible_rect.position / World.TILE).max(Vector2i.ZERO)
	var high = Vector2i(visible_rect.end / World.TILE).min(Vector2i(world.width - 1, world.height - 1))
	for y in range(low.y, high.y + 1):
		for x in range(low.x, high.x + 1):
			var i = y * world.width + x
			if World.is_water(world.terrain[i]) or world.terrain[i] in [World.BEACH, World.MOUNTAIN]: continue
			var sample = World.hash_cell(x, y, world.world_seed + 79)
			if sample % 17 != 0: continue
			var color: Color = World.BIOME_COLORS[world.biomes[i]].lightened(0.12)
			var p = Vector2(x, y) * World.TILE + Vector2(1, 2)
			draw_rect(Rect2(p, Vector2(0.5, 1)), color)
			draw_rect(Rect2(p + Vector2(1, -0.5), Vector2(0.5, 1.5)), color)

func draw_plant_transition(rect: Rect2, source: Rect2, tint: Color=Color.WHITE) -> void:
	# Animated crowns obey the same world bounds as the retained plant rows.
	var clipped=rect.intersection(Rect2(Vector2.ZERO,Vector2(world.width,world.height)*World.TILE))
	if not clipped.has_area(): return
	var region=Rect2(source.position+(clipped.position-rect.position)/rect.size*source.size,clipped.size/rect.size*source.size)
	effects.draw_texture_rect_region(Flora.atlas_texture,clipped,region,tint)

func world_boundary_rect() -> Rect2:
	return Rect2((camera+quake_offset).round(),(Vector2(world.width,world.height)*World.TILE*zoom).round())

func draw_world_boundary() -> void:
	if boundary_revision!=world.surface_revision:
		boundary_revision=world.surface_revision; boundary_solid=true
		for x in world.width:
			if World.is_water(world.terrain[x]) or World.is_water(world.terrain[(world.height-1)*world.width+x]): boundary_solid=false; break
		if boundary_solid:
			for y in world.height:
				if World.is_water(world.terrain[y*world.width]) or World.is_water(world.terrain[y*world.width+world.width-1]): boundary_solid=false; break
	var rect=world_boundary_rect()
	# Draw in screen space: the frame remains fine at every observation distance.
	if boundary_solid:
		effects.draw_rect(rect,Color("465847"),false,1.0)
	else:
		var corners=[rect.position,Vector2(rect.end.x,rect.position.y),rect.end,Vector2(rect.position.x,rect.end.y)]
		for n in 4: effects.draw_dashed_line(corners[n],corners[(n+1)%4],Color(.70,.81,.88,.52),1.0,5.0)

func _draw_effects() -> void:
	if world == null: return
	effects.draw_set_transform(camera+quake_offset, 0, Vector2.ONE * zoom)
	TempestArt.waves(effects,world,Rect2(-camera/zoom,size/zoom),zoom)
	if show_plants:
		var particle_budget=192 if distance_name()=="近景" else (96 if overview_weight()<=.5 else 32)
		var visible=Rect2(-camera/zoom,size/zoom).grow(20)
		for event in transitions.values():
			var progress = clampf((real_time - event.started) / event.duration, 0, 1)
			var i: int = event.cell
			var sample = World.hash_cell(i % world.width, i / world.width, world.world_seed)
			var base = World.Landscape.plant_anchor(world,i)
			if not visible.has_point(base): continue
			if event.kind in ["grow","appear","fertilize"] and overview_weight()<=.5 and world.plants[i]==event.species and world.plant_stage[i]==event.stage:
				var extent=Vector2(16,19.2)*(.90+sample%5*.045)
				if World.Catalog.is_ground_cover(event.species): extent*=.72
				var growth=lerpf(.25 if event.get("active",false) else .86,1.0,1-pow(1-progress,3))
				growth+=sin(progress*PI)*.10
				var rect=Rect2(base-Vector2(extent.x/2,extent.y*.94)*growth,extent*growth)
				draw_plant_transition(rect,Flora.atlas_region(event.species,event.stage,sample%3))
			if event.kind in ["wither", "fade", "clear", "water", "decay"] and event.species > 0 and overview_weight()<=.5:
				var extent = Vector2(16, 19.2) * (0.90 + sample % 5 * 0.045)
				if World.Catalog.is_ground_cover(event.species): extent*=.72
				var rect = Rect2(base - Vector2(extent.x / 2, extent.y * 0.94) + Vector2(0, progress * 2), extent)
				var tint = Color("c2aa72") if event.kind == "wither" else Color.WHITE
				tint.a = 1 - progress
				draw_plant_transition(rect,Flora.atlas_region(event.species,event.stage,sample%3),tint)
			var effect_color = Color("c6ca7f")
			if event.kind in ["wither", "decay"]: effect_color = Color("b39862")
			if event.kind == "water": effect_color = Color("a4d8e1")
			if event.kind == "fertilize": effect_color = Color("d6e996")
			effect_color.a = (1 - progress) * 0.8
			for n in 4:
				if particle_budget<=0: break
				var p = base + Vector2((n - 1.5) * (1 + progress * 4), -3 - sin(progress * PI) * (3 + n))
				var particle=Rect2(p,Vector2.ONE*.7).intersection(Rect2(Vector2.ZERO,Vector2(world.width,world.height)*World.TILE))
				if particle.has_area(): effects.draw_rect(particle,effect_color)
				particle_budget-=1
	_draw_disasters()
	WeatherArt.draw(effects,world,camera,zoom,size,cloud_visibility())
	_draw_casts()
	if preview_visible():
		var p = (cursor_position - camera) / zoom
		var cell = Vector2i(floori(p.x / World.TILE), floori(p.y / World.TILE))
		var signature=[cell,radius,brush_shape,tool,world.revision,world.eco_tick,world.surface_revision]
		if signature!=preview_signature:
			preview_signature=signature
			preview_cells=world.preview_for(world.brush_cells(cell,radius,brush_shape),tool)
		for entry in preview_cells:
			var location: Vector2i=entry[0]
			var fill=Color(.96,.97,.94,.28) if entry[1] else Color(.76,.80,.77,.18)
			if radius>2 and brush_shape==0 and Vector2(location-cell).length()>radius-.6: fill.a*=.65
			effects.draw_rect(Rect2(Vector2(location)*World.TILE,Vector2.ONE*World.TILE),fill)
	else:
		preview_cells.clear(); preview_signature.clear()
	effects.draw_set_transform(Vector2.ZERO)
	draw_world_boundary()
	if preview_visible() and tool_icon != null and not preview_cells.is_empty():
		var location = cursor_position + Vector2(10,-18)
		effects.draw_set_transform(location, -0.30)
		effects.draw_texture_rect(tool_icon,Rect2(Vector2(-17,-17),Vector2(34,34)),false)
		effects.draw_set_transform(Vector2.ZERO)

func _process(delta: float) -> void:
	if surface_thread!=null and not surface_thread.is_alive():
		finish_surface(surface_thread.wait_to_finish())
		surface_thread=null
	process_surface_uploads()
	request_surface()
	real_time += delta
	quake_offset=Vector2.ZERO
	for event in disaster_draws:
		var elapsed=real_time-event.real_started
		if event.tool==World.EARTHQUAKE and elapsed<1.15:
			var point=Vector2(event.x,event.y)*World.TILE*zoom+camera
			if Rect2(Vector2.ZERO,size).grow(64).has_point(point):
				quake_offset+=Vector2(sin(elapsed*67),sin(elapsed*49+1.2))*4.0*pow(1-elapsed/1.15,2)
	quake_offset=quake_offset.limit_length(6).round()
	if painting and not preview_blocked and cursor_inside:
		cast_accumulator+=delta
		if cast_accumulator>=.13:
			cast_accumulator=fmod(cast_accumulator,.13)
			paint_at(cursor_position,true)
	for n in range(cast_events.size()-1,-1,-1):
		if real_time-cast_events[n].started>1.1: cast_events.remove_at(n)
	for n in range(disaster_draws.size()-1,-1,-1):
		if real_time-disaster_draws[n].real_started > 1.5: disaster_draws.remove_at(n)
	if world != null and not paused: clock_time = world.age
	if not transitions.is_empty():
		for key in transitions.keys():
			if real_time - transitions[key].started > transitions[key].duration or (not transitions[key].get("active",false) and distance_name()!="近景"):
				transitions.erase(key)
				var group=int(key/world.width)/8
				if row_nodes.has(group): row_nodes[group].queue_redraw()
	if world!=null:
		process_plant_updates()
		sync_map_layers()
	effect_accumulator += delta
	if effect_accumulator > (0.033 if world!=null and (not world.rain_clouds.is_empty() or not world.fair_clouds.is_empty() or not world.tornadoes.is_empty() or not disaster_draws.is_empty() or painting) else 0.066):
		effect_accumulator = 0
		if effects != null: effects.queue_redraw()

func cloud_visibility() -> float:
	var near_limit=maxf(3.2,fit_zoom*3.0)
	return 1.0-smoothstep(near_limit*.78,near_limit,zoom)

func request_surface() -> void:
	if world==null or surface_thread!=null or world.surface_pending_cells.is_empty(): return
	var snapshot=Surface.snapshot(world)
	var source: Image=world.image
	var small: Image=overview_image
	var cells: Dictionary=world.surface_pending_cells
	world.surface_pending_cells={}
	surface_world=world; surface_job_revision=world.surface_revision
	surface_thread=Thread.new()
	if surface_thread.start(func(): return Surface.build(snapshot,source,small,cells))!=OK:
		surface_thread=null
		finish_surface(Surface.build(snapshot,source,small,cells))

func finish_surface(result: Dictionary) -> void:
	if surface_world!=world: return
	world.image=result.surface
	pending_terrain_uploads.merge(result.chunks,true)
	overview_image=result.overview
	overview_texture.update(overview_image)
	# A ground-only edit must also refresh the composed distant scene.
	for coordinate in result.chunks:
		canopy_sprite.mark(Rect2i(coordinate*Surface.CHUNK*World.Landscape.OVERVIEW_PIXELS,Vector2i.ONE*Surface.CHUNK*World.Landscape.OVERVIEW_PIXELS).grow(World.Landscape.OVERVIEW_PIXELS*2))
	canopy_upload_due=true
	pending_surface_revision=surface_job_revision

func process_surface_uploads() -> void:
	if pending_terrain_uploads.is_empty(): return
	var started=Time.get_ticks_usec(); var count=0
	while not pending_terrain_uploads.is_empty() and count<2 and Time.get_ticks_usec()-started<1500:
		var coordinate=pending_terrain_uploads.keys()[0]
		terrain_textures[coordinate].update(pending_terrain_uploads[coordinate])
		pending_terrain_uploads.erase(coordinate)
		count+=1
	if pending_terrain_uploads.is_empty(): surface_revision=pending_surface_revision

func build_terrain_chunks() -> void:
	for child in ground_sprite.get_children(): child.free()
	terrain_textures.clear()
	pending_terrain_uploads.clear()
	for y in ceili(world.height/float(Surface.CHUNK)):
		for x in ceili(world.width/float(Surface.CHUNK)):
			var at=Vector2i(x,y)
			var texture=ImageTexture.create_from_image(Surface.chunk_image(world,world.image,at))
			var sprite=Sprite2D.new(); sprite.centered=false; sprite.texture=texture
			sprite.position=Vector2(at)*Surface.CHUNK*World.TILE
			sprite.scale=Vector2.ONE*World.TILE/World.Ground.PIXELS
			ground_sprite.add_child(sprite); terrain_textures[at]=texture

func _exit_tree() -> void:
	if surface_thread!=null: surface_thread.wait_to_finish()

func pan_camera(offset: Vector2) -> void:
	if world==null or interaction_locked: return
	camera+=offset
	constrain_camera()
	if painting: paint_at(cursor_position)
	queue_redraw(); effects.queue_redraw()

func zoom_at(point: Vector2, factor: float) -> void:
	if world == null: return
	var anchor = (point - camera) / zoom
	zoom = clampf(zoom * factor, 0.3, 32.0)
	camera = point - anchor * zoom
	constrain_camera()
	queue_redraw()
	effects.queue_redraw()
	distance_changed.emit(distance_name())

func constrain_camera() -> void:
	var extent = Vector2(world.width, world.height) * World.TILE * zoom
	camera.x = clampf(camera.x, -extent.x + 80, size.x - 80)
	camera.y = clampf(camera.y, -extent.y + 80, size.y - 80)

func _gui_input(event: InputEvent) -> void:
	if world == null or interaction_locked: return
	if event is InputEventMouseButton:
		cursor_position = event.position
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
			var direction = 1 if event.button_index == MOUSE_BUTTON_WHEEL_UP else -1
			if event.alt_pressed and tool >= 0:
				var sizes: Array = World.Brush.SIZES[brush_shape]
				var index = 0
				for n in sizes.size():
					if sizes[n] <= radius: index = n
				radius = sizes[clampi(index+direction,0,sizes.size()-1)]
				brush_changed.emit()
				effects.queue_redraw()
			else: zoom_at(event.position,1.18 if direction > 0 else 1/1.18)
		elif event.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			panning = event.pressed
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if tool < 0 or casting_locked: panning = event.pressed
			elif event.pressed:
				painting = true
				last_cell = Vector2i(-100, -100)
				pending_fert_path.clear(); last_fert_cast=-1
				world.begin_stroke()
				paint_at(event.position)
			else: finish_stroke()
		accept_event()
	elif event is InputEventMouseMotion:
		cursor_position = event.position
		if panning:
			camera += event.relative
			constrain_camera()
			queue_redraw()
		if painting: paint_at(event.position)
		var cell = Vector2i(((event.position - camera) / zoom) / World.TILE)
		if Rect2i(0, 0, world.width, world.height).has_point(cell): hover_changed.emit(world.describe_cell(cell.y * world.width + cell.x))
		effects.queue_redraw()

func paint_at(point: Vector2, repeat: bool=false) -> void:
	if casting_locked or interaction_locked: return
	var raw = ((point - camera) / zoom) / World.TILE
	var cell = Vector2i(floori(raw.x), floori(raw.y))
	if not Rect2i(-radius, -radius, world.width + radius * 2, world.height + radius * 2).has_point(cell): return
	if tool in [World.TREE_FERTILIZER,World.PLANT_FERTILIZER]:
		if pending_fert_path.is_empty():
			pending_fert_path.append(cell if last_cell.x==-100 else last_cell)
		if pending_fert_path[-1]!=cell:
			if pending_fert_path.size()>1 and Vector2(pending_fert_path[-1]-pending_fert_path[-2]).cross(Vector2(cell-pending_fert_path[-1]))==0 and Vector2(pending_fert_path[-1]-pending_fert_path[-2]).dot(Vector2(cell-pending_fert_path[-1]))>0:
				pending_fert_path[-1]=cell
			else: pending_fert_path.append(cell)
		if last_cell.x!=-100 and real_time-last_fert_cast<.13: return
		if cell==last_cell and not repeat and pending_fert_path.size()==1: return
		collect_cast(cell)
		var region=world.fertilize_path(pending_fert_path,radius,brush_shape,tool)
		pending_fert_path.clear(); last_cell=cell; last_fert_cast=real_time
		preview_signature.clear(); refresh_edit(region)
		return
	if cell == last_cell and not repeat: return
	if tool in [World.TORNADO,World.LIGHTNING,World.EARTHQUAKE] and last_cell.x != -100: return
	var affected = Rect2i()
	if last_cell.x == -100 or cell==last_cell:
		collect_cast(cell)
		affected = world.paint(cell, radius, tool, brush_shape)
	else:
		var steps = maxi(absi(cell.x - last_cell.x), absi(cell.y - last_cell.y))
		for s in range(1, steps + 1):
			var interpolated = Vector2(last_cell).lerp(Vector2(cell), float(s) / steps)
			if s==steps: collect_cast(Vector2i(interpolated.round()))
			var region = world.paint(Vector2i(interpolated.round()), radius, tool, brush_shape)
			affected = affected.merge(region) if affected.has_area() else region
	last_cell = cell
	preview_signature.clear()
	refresh_edit(affected)

func collect_cast(cell: Vector2i) -> void:
	if cast_events.size()>190: return
	var cells=world.brush_cells(cell,radius,brush_shape)
	var stride=maxi(1,ceili(cells.size()/float(clampi(radius+6,8,20))))
	cast_serial+=1
	var crosses=0
	var show_invalid=real_time-invalid_feedback_at>.32
	var sampled: Array[Vector2i]=[]
	if Rect2i(0,0,world.width,world.height).has_point(cell): sampled.append(cell)
	for n in range(cast_serial%stride,cells.size(),stride):
		if cells[n]!=cell: sampled.append(cells[n])
	for at in sampled:
		var i: int=at.y*world.width+at.x
		var valid: bool=world.tool_affects(i,tool)
		var cross=world.invalid_cast_site(i,tool) and show_invalid and crosses<2
		if cross: crosses+=1
		cast_events.append({"position":Vector2(at)*World.TILE+Vector2(2,2),"started":real_time,"invalid":not valid,"cross":cross,"sample":World.hash_cell(i,cast_serial,world.world_seed),"tool":tool})
	if crosses>0: invalid_feedback_at=real_time

func _draw_casts() -> void:
	for event in cast_events:
		var t=clampf((real_time-event.started)/1.1,0,1)
		var p: Vector2=event.position
		if event.get("cross",false) and t>.38:
			var extent=1.3+sin(t*PI)*.6
			var color=Color(.92,.35,.31,sin((t-.38)/.62*PI)*.82)
			effects.draw_line(p-Vector2(extent,extent),p+Vector2(extent,extent),color,1.0)
			effects.draw_line(p+Vector2(-extent,extent),p+Vector2(extent,-extent),color,1.0)
		if t<.72:
			var color=Color("bfa269")
			if event.tool>=World.BIOME_TOOLS and event.tool<World.BIOME_TOOLS+World.BIOME_NAMES.size(): color=World.BIOME_COLORS[event.tool-World.BIOME_TOOLS].lightened(.38)
			elif event.tool==World.BERRY_SEEDS: color=Color("b6c66a")
			elif event.tool==World.TREE_FERTILIZER: color=Color("8ca561")
			var fall=clampf(t/.62,0,1)
			for n in (2 if zoom>1.5 else 1):
				var offset=Vector2(sin(fall*PI)*(event.sample%7-3)+n*1.2,-22*pow(1-fall,1.4)-n*2)
				color.a=minf(1,(.72-t)*7)
				effects.draw_rect(Rect2(p+offset,Vector2.ONE*(.65+event.sample%3*.15)),color)
		if not event.invalid and t>.45:
			var pulse=(t-.45)/.55
			var color=Color(.87,.88,.66,(1-pulse)*.35)
			for n in 3:
				var point=p+Vector2((n-1)*(1+pulse*3),-sin(pulse*PI)*2)
				effects.draw_rect(Rect2(point,Vector2(.8,.55)),color)

func finish_stroke() -> void:
	if not painting: return
	if tool in [World.TREE_FERTILIZER,World.PLANT_FERTILIZER] and pending_fert_path.size()>1:
		collect_cast(pending_fert_path[-1])
		refresh_edit(world.fertilize_path(pending_fert_path,radius,brush_shape,tool))
	pending_fert_path.clear()
	painting = false
	if world.end_stroke(): edited.emit()

func _input(event: InputEvent) -> void:
	# Release outside the map still commits the drag as one undoable stroke.
	if event is InputEventMouseButton and not event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT: finish_stroke()
		if event.button_index in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]: panning = false

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		panning = false
		finish_stroke()

func overview_weight() -> float:
	# The same on-screen tile footprint uses the same detail, on every world size.
	return 1.0 - smoothstep(4.0,6.0,zoom*World.TILE)

func preview_visible() -> bool:
	return world != null and cursor_inside and tool >= 0 and not interaction_locked and not preview_blocked and visible

func rebuild_overview() -> void:
	overview_image = world.image.duplicate()
	overview_image.resize(world.width * World.Landscape.OVERVIEW_PIXELS, world.height * World.Landscape.OVERVIEW_PIXELS, Image.INTERPOLATE_NEAREST)
	if overview_texture == null: overview_texture = ImageTexture.create_from_image(overview_image)
	else: overview_texture.set_image(overview_image)
	overview_sprite.texture=overview_texture; overview_sprite.scale=Vector2.ONE*World.TILE/World.Landscape.OVERVIEW_PIXELS
	rebuild_overview_plants()

func rebuild_overview_plants() -> void:
	# Rasterise crowns on the same overview grid, so zooming cannot make rectangles shimmer.
	canopy_image = Image.create(world.width*World.Landscape.OVERVIEW_PIXELS,world.height*World.Landscape.OVERVIEW_PIXELS,false,Image.FORMAT_RGBA8)
	canopy_image.fill(Color(0,0,0,0))
	for entry in plant_draws:
		World.Landscape.paint_crown(canopy_image,world,entry[5])
	canopy_sprite.rebuild(overview_image,canopy_image)
	canopy_sprite.scale=Vector2.ONE*World.TILE/World.Landscape.OVERVIEW_PIXELS

func _draw_disasters() -> void:
	var visible_area = Rect2(-camera/zoom,size/zoom).grow(60)
	for i in world.fires:
		var p = Vector2(i%world.width,i/world.width)*World.TILE+Vector2(2,2)
		if not visible_area.has_point(p): continue
		var flicker = sin(clock_time*9+i)*1.1
		var frame=posmod(floori(clock_time*12)+i,8)
		effects.draw_texture_rect(TempestArt.flames[frame],Rect2(p-Vector2(4,14),Vector2(8,15)),false)
		effects.draw_circle(p+Vector2(sin(clock_time+i)*2,-11-flicker),1.6,Color(.30,.29,.28,.24))
	for storm in world.tornadoes:
		var p = Vector2(storm.x,storm.y)*World.TILE
		if not visible_area.grow(160).has_point(p): continue
		TempestArt.tornado(effects,world,storm,zoom)
	var drops_left=160
	for event in disaster_draws:
		var t = real_time-event.real_started
		if t > 1.5: continue
		var center = Vector2(event.x,event.y)*World.TILE+Vector2(2,2)
		if not visible_area.grow(50).has_point(center): continue
		if event.tool == World.LIGHTNING:
			TempestArt.lightning(effects,center,event.radius,t,World.hash_cell(event.x,event.y,int(event.started)))
		elif event.tool in [World.RAIN,World.ACID_RAIN]:
			var cells = world.brush_cells(Vector2i(event.x,event.y),event.radius,event.shape)
			for n in range(0,cells.size(),maxi(1,cells.size()/48)):
				if drops_left<=0: break
				var p = Vector2(cells[n])*World.TILE+Vector2(2,2)
				TempestArt.drop(effects,p,fposmod(t*1.65+n*.618,1),(1-t/1.5)*.95,event.tool==World.ACID_RAIN,zoom)
				drops_left-=1
		elif event.tool == World.EARTHQUAKE:
			World.Forces.Earthquake.draw(effects,event,t,zoom)
