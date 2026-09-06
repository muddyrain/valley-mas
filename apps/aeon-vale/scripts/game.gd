extends Control

const World = preload("res://scripts/world_data.gd")
const Save = preload("res://scripts/save_store.gd")
const View = preload("res://scripts/world_view.gd")
const Icons = preload("res://scripts/storybook_icons.gd")
const StoryPanel = preload("res://scripts/storybook_panel.gd")
const StoryTheme = preload("res://scripts/storybook_theme.gd")
const Preferences = preload("res://scripts/ui_preferences.gd")
const GOLD = StoryTheme.GOLD
const CREAM = StoryTheme.INK
const MUTED = StoryTheme.MUTED
const TEMPLATES = ["continent", "archipelago", "lagoon", "twin", "highlands", "caldera", "wetlands", "ocean"]
const TEMPLATE_NAMES = ["初生大陆", "星罗群岛", "翡翠环礁", "双生之地", "远古高原", "群山之环", "水泽国度", "无垠之海"]
const PLANT_NAMES = World.Catalog.NAMES

var world
var view
var ui_root: Control
var ui_scale: float = 1.0
var home_content: HBoxContainer
var back_button: Button
var brand_crest: Control
var observation_button: Button
var settings_button: Button
var observation_panel: PanelContainer
var plants_toggle: CheckBox
var brush_button: Button
var brush_options: Array[Button] = []
var future_buttons: Array[Button] = []
var tool_scroll: ScrollContainer
var scale_buttons: Array[Button] = []
var fullscreen_toggle: CheckBox
var hud: Control
var title_screen: Control
var title_card: PanelContainer
var modal: Control
var loading: Control
var progress_bar: ProgressBar
var progress_label: Label
var loading_percent: Label
var loading_emblem: Control
var generation_thread: Thread
var progress_mutex = Mutex.new()
var generation_progress: float = 0.0
var generation_stage: String = "万物酝酿中"
var finishing: bool = false
var title_font: SystemFont
var ui_font: SystemFont
var paused: bool = false
var time_speed: int = 1
var dirty: bool = false
var elapsed_status: float = 0.0
var selected_category: int = -1
var selected_tool: int = -1
var tool_grid: HBoxContainer
var group_buttons: Array[Button] = []
var tool_buttons: Dictionary = {}
var world_label: Label
var age_label: Label
var stat_label: Label
var world_year_bar: ProgressBar
var plant_stats: Array[Label] = []
var hover_label: Label
var save_label: Label
var pause_button: Button
var speed_button: Button
var toast_label: Label
var toast_time: float = 0
var selected_template: String = "continent"
var selected_size: int = 1
var template_buttons: Dictionary = {}
var size_buttons: Array[Button] = []
var previews: Dictionary = {}
var name_input: LineEdit
var map_pattern: int = 0
var density_slider: HSlider
var rivers_toggle: CheckBox
var active_slot: int = 1
var slot_buttons: Array[Button] = []
var distance_label: Label
var power_panel: PanelContainer
var power_picture: TextureRect
var power_name: Label
var power_close: Button
var speed_panel: PanelContainer
var speed_choices: Array[Button] = []
var speed_value_button: Button
var speed_options_row: HBoxContainer
var spread_toggle: CheckBox
var map_preview: TextureRect
var preview_status: Label
var new_world_open: bool = false
var generation_controls: Dictionary = {}
var advanced_panel: VBoxContainer
var template_panel: VBoxContainer

func _ready() -> void:
	get_tree().auto_accept_quit = false
	_build_theme()
	view = View.new()
	view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view.offset_top = 0
	view.offset_bottom = -198
	add_child(view)
	view.visible = false
	view.edited.connect(_on_edited)
	view.brush_changed.connect(_refresh_brush)
	view.hover_changed.connect(func(value): hover_label.text = value)
	ui_root = Control.new()
	ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_root.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(ui_root)
	var preferences = Preferences.read()
	ui_scale = preferences.scale
	view.show_plants = preferences.plants
	resized.connect(_layout_interface)
	_layout_interface()
	_build_hud()
	view.distance_changed.connect(func(value): distance_label.text = value)
	_build_title()
	toast_label = label("", 16, CREAM)
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	toast_label.anchor_left = .5
	toast_label.anchor_right = .5
	toast_label.offset_left = -180
	toast_label.offset_right = 180
	toast_label.offset_top = 20
	toast_label.offset_bottom = 60
	toast_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toast_label.add_theme_stylebox_override("normal", box(StoryTheme.PAPER, GOLD, 2))
	toast_label.visible = false
	ui_root.add_child(toast_label)
	_build_loading()
	if preferences.fullscreen: DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif DisplayServer.get_name()!="headless":
		var usable=DisplayServer.screen_get_usable_rect()
		DisplayServer.window_set_min_size(Vector2i(1100,720).min(Preferences.initial_window_size(usable.size)))
		DisplayServer.window_set_size(Preferences.initial_window_size(usable.size))
		if not OS.get_cmdline_args().has("--position"):
			DisplayServer.window_set_position(usable.position+(usable.size-DisplayServer.window_get_size())/2)
	_prepare_previews()

func _build_theme() -> void:
	ui_font = SystemFont.new()
	ui_font.font_names = PackedStringArray(["Microsoft YaHei UI", "Noto Sans CJK SC", "sans-serif"])
	title_font = SystemFont.new()
	title_font.font_names = PackedStringArray(["STZhongsong", "SimSun", "Noto Serif CJK SC", "serif"])
	theme = StoryTheme.build(ui_font)

func box(fill: Color, border: Color, thickness: int = 1) -> StyleBoxFlat:
	return StoryTheme.box(fill,border,thickness)

func label(value: String, font_size: int = 16, color: Color = CREAM) -> Label:
	var result = Label.new()
	result.text = value
	result.add_theme_font_size_override("font_size", font_size)
	result.add_theme_color_override("font_color", color)
	result.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return result

func button(value: String, action: Callable, minimum: Vector2 = Vector2(90, 42)) -> Button:
	var result = Button.new()
	result.text = value
	result.custom_minimum_size = minimum
	result.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	result.pressed.connect(action)
	return result

func _close_button(action: Callable, caption: String, extent: Vector2=Vector2(40,40)) -> Button:
	var item=button("",action,extent)
	item.tooltip_text=caption
	item.icon=Icons.texture("close"); item.expand_icon=true
	item.icon_alignment=HORIZONTAL_ALIGNMENT_CENTER
	item.add_theme_constant_override("icon_max_width",48)
	_card_action(item)
	return item

func icon_button(key: String, value: String, action: Callable, minimum: Vector2 = Vector2(StoryTheme.TOOL_SIZE, StoryTheme.TOOL_SIZE), texture: Texture2D = null) -> Button:
	var result = button("", action, minimum)
	result.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	result.tooltip_text = value
	var contents = VBoxContainer.new()
	contents.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	contents.offset_left = 4
	contents.offset_right = -4
	contents.offset_top = 4
	contents.offset_bottom = -4
	contents.alignment = BoxContainer.ALIGNMENT_CENTER
	contents.add_theme_constant_override("separation", 2)
	contents.mouse_filter = Control.MOUSE_FILTER_IGNORE
	result.add_child(contents)
	var picture = TextureRect.new()
	picture.texture = texture if texture != null else Icons.texture(key)
	picture.custom_minimum_size = Vector2(34, 34)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	contents.add_child(picture)
	var caption = label(value, 12)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	contents.add_child(caption)
	return result

func selected_style(target: Button, selected: bool) -> void:
	target.set_meta("selected",selected)
	for state in ["normal","hover","pressed","hover_pressed"]:
		if selected: target.add_theme_stylebox_override(state,StoryTheme.selected_box())
		else: target.remove_theme_stylebox_override(state)
	target.queue_redraw()

func _build_title() -> void:
	title_screen = Control.new()
	title_screen.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(title_screen)
	var backdrop = TextureRect.new()
	backdrop.texture = load("res://assets/storybook-valley.png")
	backdrop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	backdrop.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	title_screen.add_child(backdrop)
	var card = StoryPanel.new()
	title_card=card
	card.name="TitleCard"
	card.anchor_left = .065
	card.anchor_right = .065
	card.anchor_top = .5
	card.anchor_bottom = .5
	card.offset_right = 420
	var title_box=box(Color(.98,.97,.91,.94),Color("d2c99e"))
	title_box.content_margin_left=28; title_box.content_margin_right=28
	title_box.content_margin_top=28; title_box.content_margin_bottom=28
	card.add_theme_stylebox_override("panel",title_box)
	title_screen.add_child(card)
	var stack = VBoxContainer.new()
	stack.add_theme_constant_override("separation",12)
	card.add_child(stack)
	var crest = TextureRect.new()
	crest.texture = Icons.texture("world")
	crest.custom_minimum_size = Vector2(68,68)
	crest.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	crest.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	stack.add_child(crest)
	var title = label("纪 元 谷",64,CREAM)
	title.add_theme_font_override("font",title_font)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(title)
	var english = label("A E O N   V A L E",17,GOLD)
	english.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(english)
	var tagline = label("一粒种子，一方天地。",16,MUTED)
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stack.add_child(tagline)
	var space = Control.new()
	space.custom_minimum_size.y = 14
	stack.add_child(space)
	var start = button("创 造 世 界",_open_new_world,Vector2(320,52))
	start.add_theme_font_size_override("font_size",20)
	selected_style(start,true)
	stack.add_child(start)
	stack.add_child(button("载入世界",func(): _open_slots(false),Vector2(320,44)))
	var extras = HBoxContainer.new()
	extras.alignment = BoxContainer.ALIGNMENT_CENTER
	extras.add_theme_constant_override("separation",12)
	var settings_button=button("游戏设置",_open_settings,Vector2(0,42))
	var help_button=button("操作手记",_open_help,Vector2(0,42))
	settings_button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	help_button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	extras.add_child(settings_button); extras.add_child(help_button)
	stack.add_child(extras)
	card.minimum_size_changed.connect(func(): call_deferred("_layout_title"))
	call_deferred("_layout_title")
	var foot = label("纪元谷 · 沧海桑田   /   0.14",12,CREAM)
	foot.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	foot.offset_top = -36
	foot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_screen.add_child(foot)

func _build_hud() -> void:
	hud = Control.new()
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(hud)
	hud.hide()
	var bottom = StoryPanel.new()
	bottom.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_top = -StoryTheme.HUD_HEIGHT
	var surface = box(StoryTheme.PAPER,Color("b8c2a0"),2)
	surface.set_corner_radius_all(0)
	surface.set_content_margin_all(18)
	# Reserve a gutter for horizontal scrolling without shifting the button rows.
	surface.content_margin_bottom=10
	bottom.add_theme_stylebox_override("panel",surface)
	hud.add_child(bottom)
	var tabs = HBoxContainer.new()
	tabs.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	tabs.offset_top = -240
	tabs.offset_bottom = -191
	tabs.alignment = BoxContainer.ALIGNMENT_CENTER
	tabs.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tabs.add_theme_constant_override("separation",10)
	hud.add_child(tabs)
	for index in 3:
		var tab = button("",func(): _select_category(index),Vector2(76,46))
		tab.tooltip_text = ["世界塑造 · 塑造海洋、土地与山川","自然及灾难 · 播撒生态、滋养草木、呼唤风雨","动物、生物与怪物 · 尚未开放"][index]
		tab.icon = StoryTheme.small_icon(["terrain","lightning","creatures"][index],36)
		tab.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tab.add_theme_font_size_override("font_size",16)
		tabs.add_child(tab)
		group_buttons.append(tab)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation",StoryTheme.TOOL_GAP)
	bottom.add_child(row)
	var back_slot = Control.new()
	back_slot.custom_minimum_size = Vector2(64,162)
	back_slot.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	row.add_child(back_slot)
	back_button = icon_button("back","返回",func(): _select_category(-1),Vector2(64,138))
	back_button.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	back_button.offset_top=24
	back_slot.add_child(back_button)
	var back_contents = back_button.get_child(0)
	back_contents.alignment = BoxContainer.ALIGNMENT_CENTER
	back_contents.get_child(0).custom_minimum_size = Vector2(56,56)
	back_contents.get_child(1).add_theme_font_size_override("font_size",14)
	brand_crest = VBoxContainer.new()
	brand_crest.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	brand_crest.offset_top=24
	brand_crest.alignment = BoxContainer.ALIGNMENT_CENTER
	brand_crest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	back_slot.add_child(brand_crest)
	var mark = TextureRect.new()
	mark.texture = Icons.texture("world")
	mark.custom_minimum_size = Vector2(68,68)
	mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	brand_crest.add_child(mark)
	var brand = label("纪元谷",16,GOLD)
	brand.add_theme_font_override("font",title_font)
	brand.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	brand_crest.add_child(brand)
	var permanent = VBoxContainer.new()
	permanent.add_theme_constant_override("separation",6)
	permanent.size_flags_vertical=Control.SIZE_SHRINK_BEGIN
	var time_heading=label("时间",12,MUTED); time_heading.custom_minimum_size.y=18
	permanent.add_child(time_heading)
	var time_tiles=VBoxContainer.new()
	time_tiles.add_theme_constant_override("separation",StoryTheme.TOOL_GAP)
	permanent.add_child(time_tiles)
	row.add_child(permanent)
	pause_button = icon_button("pause","暂停",_toggle_pause)
	time_tiles.add_child(pause_button)
	speed_button = icon_button("speed","1x",_toggle_speed_panel)
	time_tiles.add_child(speed_button)
	row.add_child(VSeparator.new())
	home_content = HBoxContainer.new()
	home_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	home_content.add_theme_constant_override("separation",StoryTheme.GROUP_GAP)
	row.add_child(home_content)
	var management_section=VBoxContainer.new()
	management_section.add_theme_constant_override("separation",6)
	management_section.size_flags_vertical=Control.SIZE_SHRINK_BEGIN
	var management_heading=label("世界",12,MUTED); management_heading.custom_minimum_size.y=18
	management_section.add_child(management_heading)
	home_content.add_child(management_section)
	var management = GridContainer.new()
	management.columns = 3
	management.add_theme_constant_override("h_separation",StoryTheme.TOOL_GAP)
	management.add_theme_constant_override("v_separation",StoryTheme.TOOL_GAP)
	management.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	management_section.add_child(management)
	management.add_child(icon_button("new","新建世界",_open_new_world,Vector2(64,64)))
	management.add_child(icon_button("save","保存世界",func(): _open_slots(true),Vector2(64,64)))
	management.add_child(icon_button("load","载入世界",func(): _open_slots(false),Vector2(64,64)))
	settings_button = icon_button("settings","游戏设置",_open_settings,Vector2(64,64))
	management.add_child(settings_button)
	observation_button = icon_button("observe","观察",_toggle_observation,Vector2(64,64))
	management.add_child(observation_button)
	management.add_child(icon_button("home","主菜单",_request_title,Vector2(64,64)))
	var information = PanelContainer.new()
	information.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var info_surface=StoryTheme.box(Color.TRANSPARENT,Color.TRANSPARENT,0)
	info_surface.set_content_margin_all(8)
	information.add_theme_stylebox_override("panel",info_surface)
	home_content.add_child(information)
	var info_row = HBoxContainer.new()
	info_row.add_theme_constant_override("separation",24)
	information.add_child(info_row)
	var info = VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info.add_theme_constant_override("separation",8)
	info_row.add_child(info)
	var heading = HBoxContainer.new()
	world_label = label("初生之谷",22,CREAM)
	world_label.add_theme_font_override("font",title_font)
	world_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	world_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	heading.add_child(world_label)
	save_label = label("未保存",12,MUTED)
	heading.add_child(save_label)
	info.add_child(heading)
	age_label = label("萌芽纪元 · 第 1 年",16,GOLD)
	info.add_child(age_label)
	world_year_bar = ProgressBar.new()
	world_year_bar.custom_minimum_size.y = 6
	var bar_track=StoryTheme.box(Color("dce4cf"),Color.TRANSPARENT,0); bar_track.set_content_margin_all(0)
	var bar_fill=StoryTheme.box(Color("8da779"),Color.TRANSPARENT,0); bar_fill.set_content_margin_all(0)
	world_year_bar.add_theme_stylebox_override("background",bar_track)
	world_year_bar.add_theme_stylebox_override("fill",bar_fill)
	world_year_bar.show_percentage = false
	info.add_child(world_year_bar)
	stat_label = label("",12,MUTED)
	info.add_child(stat_label)
	info_row.add_child(VSeparator.new())
	var census = HBoxContainer.new()
	census.add_theme_constant_override("separation",16)
	info_row.add_child(census)
	for index in 3:
		var column = VBoxContainer.new()
		column.alignment = BoxContainer.ALIGNMENT_CENTER
		column.custom_minimum_size.x = 56
		census.add_child(column)
		var image = TextureRect.new()
		image.texture = Icons.texture("dead_tree") if index == 2 else Icons.plant_texture([1,17][index])
		image.custom_minimum_size = Vector2(38,38)
		image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		column.add_child(image)
		var value = label("0",24,CREAM)
		value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		plant_stats.append(value)
		column.add_child(value)
		var caption = label(["植物","幼苗","枯树"][index],12,MUTED)
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(caption)
	tool_grid = HBoxContainer.new()
	tool_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tool_grid.add_theme_constant_override("separation",StoryTheme.GROUP_GAP)
	tool_scroll = ScrollContainer.new()
	tool_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tool_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tool_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	tool_scroll.add_child(tool_grid)
	row.add_child(tool_scroll)
	_build_power_panels()
	_build_observation()
	_select_category(-1)

func _select_category(category: int) -> void:
	selected_category = category
	var home = category < 0
	home_content.visible = home
	tool_grid.visible = not home
	tool_scroll.visible = not home
	tool_scroll.scroll_horizontal = 0
	future_buttons.clear()
	back_button.visible = not home
	brand_crest.visible = home
	if is_instance_valid(observation_panel): observation_panel.hide()
	for child in tool_grid.get_children():
		tool_grid.remove_child(child)
		child.queue_free()
	tool_buttons.clear()
	for i in group_buttons.size(): selected_style(group_buttons[i], i == category)
	if category == 0:
		var waters = _tool_group("海洋与河流", 3)
		for type in [World.DEEP, World.OCEAN, World.SHALLOW, World.BEACH, World.RIVER]:
			_add_tool(waters, type, World.NAMES[type], Icons.terrain_texture(type))
		var land = _tool_group("土地与山川", 3)
		for type in [World.GRASS, World.FOREST, World.HILLS, World.MOUNTAIN]:
			_add_tool(land, type, World.NAMES[type], Icons.terrain_texture(type))
		_add_tool(land, World.ROCK_TOOL, "石簇", Icons.plant_texture(13))
		_add_tool(land, World.BOULDER_TOOL, "巨岩", Icons.plant_texture(14))
	elif category == 1:
		var temperatures = _tool_group("气温",1)
		_add_future(temperatures,"气温上升","warm")
		_add_future(temperatures,"气温降低","cold")
		var disasters = _tool_group("天象与灾难",3)
		for value in [World.LIGHTNING,World.TORNADO,World.FIRE,World.EARTHQUAKE,World.RAIN,World.ACID_RAIN]:
			var info = _tool_info(value)
			_add_tool(disasters,value,info.name,info.texture)
		var seeds = _tool_group("生态种子",9)
		for biome in [World.MEADOW,World.BIRCH,World.SAVANNA,World.TEMPERATE,World.CONIFER,World.TROPICAL,World.GOLDEN,World.TUNDRA,World.ARID,World.MARSH,World.SAKURA,World.BAMBOO,World.FLOWERLAND,World.MUSHROOM,World.CITRUS,World.CRYSTAL,World.JADE,World.SWEET]:
			_add_tool(seeds,World.BIOME_TOOLS+biome,World.BIOME_NAMES[biome],Icons.biome_texture(biome))
		var tending = _tool_group("滋养",2)
		_add_tool(tending,World.PLANT_FERTILIZER,"植物肥料",Icons.texture("fertilizer"))
		_add_tool(tending,World.TREE_FERTILIZER,"树木肥料",Icons.texture("tree_fertilizer"))
		_add_tool(tending,World.BERRY_SEEDS,"浆果丛",Icons.plant_texture(16))
	elif category == 2:
		var races = _tool_group("智慧生灵",2)
		for name in ["人类","精灵","兽人","矮人"]: _add_future(races,name,"creatures")
		var animals = _tool_group("动物",5)
		for name in ["猫","狗","鸡","兔子","狐狸","狼","熊","牛","羊"]: _add_future(animals,name,"paw")
		var monsters = _tool_group("怪物",1)
		_add_future(monsters,"怪物","monster")
	_select_tool(selected_tool)

func _tool_group(title: String, columns: int) -> GridContainer:
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 6)
	column.size_flags_vertical=Control.SIZE_SHRINK_END
	var heading=label(title,12,MUTED); heading.custom_minimum_size.y=18
	column.add_child(heading)
	var grid = GridContainer.new()
	grid.columns = columns
	grid.add_theme_constant_override("h_separation", StoryTheme.TOOL_GAP)
	grid.add_theme_constant_override("v_separation", StoryTheme.TOOL_GAP)
	column.add_child(grid)
	tool_grid.add_child(column)
	return grid

func _add_tool(group: GridContainer, value: int, caption: String, texture: Texture2D) -> void:
	var item = icon_button("", caption, func(): _select_tool(value), Vector2(64, 64), texture)
	item.tooltip_text = caption
	if value >= World.BIOME_TOOLS and value < World.BIOME_TOOLS+World.BIOME_NAMES.size(): item.tooltip_text = caption+"种子 · 改变适生土壤，草木自然生长"
	elif value == World.PLANT_FERTILIZER: item.tooltip_text = "植物肥料 · 催生草花灌木，催熟幼苗"
	elif value == World.TREE_FERTILIZER: item.tooltip_text = "树木肥料 · 催生树木或巨菇，催熟幼苗"
	elif value >= World.PLANT_TOOLS and value < World.CLEAR_PLANTS: item.tooltip_text = "播下" + caption + " · 在适生土地萌发"
	group.add_child(item)
	tool_buttons[value] = item

func _add_future(group: GridContainer, caption: String, key: String) -> void:
	var item = icon_button(key,caption,func(): pass,Vector2(64,64))
	item.disabled = true
	item.tooltip_text = caption+" · 尚未开放"
	item.mouse_default_cursor_shape = Control.CURSOR_ARROW
	item.get_child(0).modulate = Color(.66,.70,.67,.58)
	var tag = label("◇",10,MUTED)
	tag.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	tag.position = Vector2(39,0)
	item.add_child(tag)
	group.add_child(item)
	future_buttons.append(item)

func _select_tool(value: int) -> void:
	if speed_panel.visible and value != selected_tool: _close_speed_panel()
	selected_tool = value
	view.finish_stroke()
	view.tool = value
	var info = _tool_info(value)
	view.tool_icon = info.texture
	power_panel.visible = value >= 0 and not speed_panel.visible
	brush_button.visible = power_panel.visible
	power_picture.texture = info.texture
	power_name.text = info.name
	power_panel.tooltip_text = info.name
	view.effects.queue_redraw()
	for key in tool_buttons: selected_style(tool_buttons[key], key == value)

func _prepare_previews() -> void:
	var began = Time.get_ticks_msec()
	for species in range(1, World.Catalog.MAX_ID + 1):
		View.Flora.prepare_atlas_species(species)
		Icons.plant_texture(species)
		progress_bar.value = 70.0 * species / World.Catalog.MAX_ID
		progress_label.text = "描绘万物 · " + PLANT_NAMES[species - 1]
		loading_percent.text = "%d%%" % progress_bar.value
		await get_tree().process_frame
	for index in TEMPLATES.size():
		var name = TEMPLATES[index]
		previews[name] = load("res://assets/maps/%s.png" % name)
		progress_bar.value = 70.0 + 30.0 * (index + 1) / TEMPLATES.size()
		progress_label.text = "准备世界图鉴 · " + TEMPLATE_NAMES[index]
		loading_percent.text = "%d%%" % progress_bar.value
		await get_tree().process_frame
	# Keep the completed state visible briefly; percentage above is actual prepared content.
	var remaining = maxf(0.0, 0.65 - (Time.get_ticks_msec() - began) / 1000.0)
	await get_tree().create_timer(remaining).timeout
	var transition = create_tween()
	transition.tween_property(loading, "modulate:a", 0.0, 0.2)
	await transition.finished
	loading.queue_free()
	loading = null

func _new_modal(title: String, width: int = 730) -> VBoxContainer:
	if is_instance_valid(speed_panel) and speed_panel.visible: _close_speed_panel()
	_close_modal()
	view.finish_stroke()
	view.interaction_locked = true
	modal = ColorRect.new()
	modal.color = Color(0.15, 0.25, 0.20, 0.48)
	modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(modal)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal.add_child(center)
	var panel = StoryPanel.new()
	panel.custom_minimum_size.x = minf(width,ui_root.size.x-48)
	var modal_style=box(StoryTheme.PAPER,StoryTheme.EDGE)
	modal_style.set_content_margin_all(24)
	panel.add_theme_stylebox_override("panel",modal_style)
	center.add_child(panel)
	var contents = VBoxContainer.new()
	contents.add_theme_constant_override("separation", 20)
	panel.add_child(contents)
	var heading = HBoxContainer.new()
	var text = label(title.replace(" ",""),24,CREAM)
	text.add_theme_font_override("font", title_font)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(text)
	heading.add_child(_close_button(_close_modal,"关闭窗口",Vector2(40,40)))
	contents.add_child(heading)
	return contents

func _close_modal() -> void:
	new_world_open = false
	if is_instance_valid(modal):
		ui_root.remove_child(modal)
		modal.queue_free()
	modal = null
	view.interaction_locked = false

func _open_new_world() -> void:
	var panel_width=minf(1024,ui_root.size.x-48)
	var contents=_new_modal("创造新世界",int(panel_width))
	var body_height=minf(460,ui_root.size.y-200)
	var columns=HBoxContainer.new()
	columns.custom_minimum_size.y=body_height
	columns.add_theme_constant_override("separation",28)
	contents.add_child(columns)
	var preview_column=VBoxContainer.new()
	preview_column.custom_minimum_size.x=(panel_width-48)*.44
	preview_column.add_theme_constant_override("separation",12)
	columns.add_child(preview_column)
	var frame=PanelContainer.new()
	var sea=box(Color("285896"),Color("285896")); sea.set_content_margin_all(8)
	frame.add_theme_stylebox_override("panel",sea)
	frame.custom_minimum_size.y=body_height-172
	preview_column.add_child(frame)
	map_preview=TextureRect.new(); map_preview.texture=previews.get(selected_template)
	map_preview.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	map_preview.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	map_preview.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST_WITH_MIPMAPS
	frame.add_child(map_preview)
	var preview_heading=HBoxContainer.new()
	preview_heading.add_theme_constant_override("separation",8)
	preview_status=label(TEMPLATE_NAMES[TEMPLATES.find(selected_template)]+" · 地形示意",12,MUTED)
	preview_status.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	preview_status.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	preview_heading.add_child(preview_status)
	preview_column.add_child(preview_heading)
	var naming=VBoxContainer.new(); naming.add_theme_constant_override("separation",6)
	naming.add_child(label("世界名称",14,MUTED))
	name_input=LineEdit.new(); name_input.text="初生之谷"; name_input.max_length=32
	name_input.placeholder_text="世界名称"; name_input.custom_minimum_size.y=40
	naming.add_child(name_input); preview_column.add_child(naming)
	var ecology=HBoxContainer.new(); ecology.add_theme_constant_override("separation",8)
	ecology.add_child(label("植被",14,MUTED))
	density_slider=HSlider.new(); density_slider.min_value=0; density_slider.max_value=1
	density_slider.step=.05; density_slider.value=.8; density_slider.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	density_slider.size_flags_vertical=Control.SIZE_SHRINK_CENTER; density_slider.custom_minimum_size.y=26
	ecology.add_child(density_slider)
	var abundance=label("80%",12,MUTED); abundance.custom_minimum_size.x=32; ecology.add_child(abundance)
	density_slider.value_changed.connect(func(value): abundance.text="%d%%" % roundi(value*100))
	rivers_toggle=CheckBox.new(); rivers_toggle.text="自然河流"; rivers_toggle.button_pressed=true
	rivers_toggle.add_theme_font_size_override("font_size",14)
	rivers_toggle.custom_minimum_size.y=40
	ecology.add_child(rivers_toggle); preview_column.add_child(ecology)
	var pages=Control.new(); pages.custom_minimum_size=Vector2(392,body_height)
	pages.size_flags_horizontal=Control.SIZE_EXPAND_FILL; columns.add_child(pages)
	var body=VBoxContainer.new(); template_panel=body
	body.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	body.add_theme_constant_override("separation",14); pages.add_child(body)
	body.add_child(label("地形图案",14,MUTED))
	var choices=GridContainer.new(); choices.columns=2
	choices.add_theme_constant_override("h_separation",8); choices.add_theme_constant_override("v_separation",8)
	body.add_child(choices); template_buttons.clear()
	for i in TEMPLATES.size():
		var template_name=TEMPLATES[i]
		var item=button("",func():
			selected_template=template_name
			for key in template_buttons: selected_style(template_buttons[key],key==template_name)
			map_preview.texture=previews.get(template_name)
			preview_status.text=TEMPLATE_NAMES[TEMPLATES.find(template_name)]+" · 地形示意"
		,Vector2(192,minf(60,(body_height-150)/4)))
		item.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		item.tooltip_text=TEMPLATE_NAMES[i]
		var row=HBoxContainer.new(); row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		row.offset_left=8; row.offset_right=-8; row.offset_top=8; row.offset_bottom=-8
		row.add_theme_constant_override("separation",12); row.mouse_filter=Control.MOUSE_FILTER_IGNORE
		item.add_child(row)
		var picture=TextureRect.new(); picture.texture=previews.get(template_name)
		picture.custom_minimum_size=Vector2(58,44); picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED; picture.mouse_filter=Control.MOUSE_FILTER_IGNORE
		row.add_child(picture)
		var caption=label(TEMPLATE_NAMES[i],14); caption.size_flags_vertical=Control.SIZE_SHRINK_CENTER
		row.add_child(caption); choices.add_child(item); template_buttons[template_name]=item
		selected_style(item,selected_template==template_name)
	var sizes=VBoxContainer.new(); sizes.add_theme_constant_override("separation",6)
	sizes.add_child(label("世界大小",14,MUTED))
	var size_row=HBoxContainer.new(); size_row.add_theme_constant_override("separation",8)
	sizes.add_child(size_row); size_buttons.clear()
	for i in 3:
		var item=button(["小型","标准","广阔"][i],func():
			selected_size=i
			for j in size_buttons.size(): selected_style(size_buttons[j],j==i)
		,Vector2(0,40))
		item.tooltip_text=["192 × 128","288 × 192","384 × 256"][i]
		item.size_flags_horizontal=Control.SIZE_EXPAND_FILL; item.add_theme_font_size_override("font_size",14)
		size_buttons.append(item); size_row.add_child(item); selected_style(item,selected_size==i)
	body.add_child(sizes)
	var advanced=Button.new(); advanced.text="地形细调  ›"
	advanced.custom_minimum_size.y=40; advanced.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND
	advanced.pressed.connect(func():
		template_panel.hide(); advanced_panel.show()
	)
	body.add_child(advanced)
	advanced_panel=VBoxContainer.new(); advanced_panel.add_theme_constant_override("separation",24)
	advanced_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pages.add_child(advanced_panel); generation_controls.clear()
	advanced_panel.add_child(button("‹  返回地形图案",func(): advanced_panel.hide(); template_panel.show(),Vector2(0,40)))
	advanced_panel.add_child(label("地形细调",20,CREAM))
	for item in [["land_size","陆块大小",1,10,6],["islands","额外岛屿",0,12,4],["coast","海岸曲折",0,10,4]]:
		var row=VBoxContainer.new(); row.add_theme_constant_override("separation",12)
		var heading=HBoxContainer.new(); row.add_child(heading)
		var caption=label(item[1],14,MUTED); caption.size_flags_horizontal=Control.SIZE_EXPAND_FILL; heading.add_child(caption)
		var slider=HSlider.new(); slider.min_value=item[2]; slider.max_value=item[3]; slider.step=1; slider.value=item[4]
		slider.custom_minimum_size.y=26; row.add_child(slider)
		var value=label(str(item[4]),14,CREAM); value.custom_minimum_size.x=24; value.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT; heading.add_child(value)
		slider.value_changed.connect(func(amount): value.text=str(int(amount)))
		generation_controls[item[0]]=slider; advanced_panel.add_child(row)
	advanced_panel.hide()
	var footer=HBoxContainer.new(); footer.alignment=BoxContainer.ALIGNMENT_END
	footer.add_theme_constant_override("separation",12)
	footer.add_child(button("返回",_close_modal,Vector2(96,44)))
	var create=button("让世界诞生",_submit_new_world,Vector2(204,44))
	create.add_theme_font_size_override("font_size",17); StoryTheme.primary(create)
	footer.add_child(create); contents.add_child(footer)
	new_world_open=true

func _randomize_pattern() -> void:
	var previous=map_pattern
	while map_pattern==previous: map_pattern=randi_range(1,999999999)

func _current_new_config() -> Dictionary:
	var dimensions: Vector2i=[Vector2i(192,128),Vector2i(288,192),Vector2i(384,256)][selected_size]
	var config={"seed":map_pattern,"name":name_input.text,"width":dimensions.x,"height":dimensions.y,"template":selected_template,"trees":density_slider.value,"rivers":rivers_toggle.button_pressed,"spread":true}
	for key in generation_controls: config[key]=int(generation_controls[key].value)
	return config

func _submit_new_world() -> void:
	var config=_current_new_config()
	if dirty: _confirm("离开当前世界？","未保存的修改将丢失。","创建新世界",func(): _start_generation(config))
	else: _start_generation(config)

func _start_generation(config: Dictionary) -> void:
	if generation_thread!=null or loading!=null: return
	_randomize_pattern()
	config=config.duplicate(); config.seed=map_pattern
	_close_modal(); _build_loading(); view.interaction_locked=true
	generation_progress=0; generation_stage="万物酝酿中"; finishing=false
	generation_thread=Thread.new()
	if generation_thread.start(func(): return World.generate(config,_report_progress)) != OK:
		generation_thread=null; loading.queue_free(); loading=null; view.interaction_locked=false
		_show_toast("世界生成未能启动，请重试")

func _report_progress(value: float, stage: String) -> void:
	progress_mutex.lock()
	generation_progress = value
	generation_stage = stage
	progress_mutex.unlock()

func _build_loading() -> void:
	loading = Control.new()
	loading.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.add_child(loading)
	var art = TextureRect.new()
	art.texture = load("res://assets/storybook-valley.png")
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	loading.add_child(art)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	loading.add_child(center)
	var panel = StoryPanel.new()
	panel.add_theme_stylebox_override("panel",box(Color(.98,.97,.91,.94),Color("c8c39d")))
	center.add_child(panel)
	var column = VBoxContainer.new()
	column.custom_minimum_size.x = 430
	column.add_theme_constant_override("separation",18)
	panel.add_child(column)
	loading_emblem = Control.new()
	loading_emblem.custom_minimum_size = Vector2(120,130)
	loading_emblem.draw.connect(func():
		var p = Vector2(loading_emblem.size.x/2,65)
		var amount = progress_bar.value/100.0 if progress_bar != null else 0.0
		loading_emblem.draw_arc(p,49,-PI/2,TAU-PI/2,80,Color("d4d9b7"),1,true)
		loading_emblem.draw_arc(p,49,-PI/2,-PI/2+maxf(.03,amount)*TAU,80,Color("9caf7b"),3,true)
		var extent = 48 + amount*24
		loading_emblem.draw_texture_rect(Icons.texture("seed"),Rect2(p-Vector2.ONE*extent/2,Vector2.ONE*extent),false)
		var angle = Time.get_ticks_msec()*.001
		loading_emblem.draw_circle(p+Vector2(cos(angle),sin(angle))*49,3,GOLD,true,-1,true)
	)
	column.add_child(loading_emblem)
	var heading = label("一 个 世 界，正 在 诞 生",25,CREAM)
	heading.add_theme_font_override("font",title_font)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)
	progress_label = label("万物酝酿中",15,MUTED)
	progress_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(progress_label)
	progress_bar = ProgressBar.new()
	progress_bar.custom_minimum_size = Vector2(430,14)
	progress_bar.show_percentage = false
	column.add_child(progress_bar)
	loading_percent = label("0%",13,GOLD)
	loading_percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(loading_percent)

func _finish_generation(result) -> void:
	world = result
	view.set_world(world)
	view.visible = true
	hud.visible = true
	title_screen.visible = false
	paused = false
	time_speed = 1
	dirty = true
	_update_pause_buttons()
	_update_status()
	_select_tool(-1)
	_select_category(-1)
	await get_tree().create_timer(0.25).timeout
	var tween = create_tween()
	tween.tween_property(loading, "modulate:a", 0.0, 0.30)
	await tween.finished
	loading.queue_free()
	loading = null
	view.interaction_locked = false
	finishing = false

func _open_slots(saving: bool) -> void:
	var contents = _new_modal("铭 记 世 界" if saving else "重 返 世 界", 600)
	slot_buttons.clear()
	for slot in range(1, 4):
		var meta = Save.metadata(slot)
		var title = "空白世界" if meta.is_empty() else str(meta.name)
		var subtitle = "尚无存档" if meta.is_empty() else str(meta.get("saved_at", ""))
		var item = button("", func():
			if saving:
				if meta.is_empty(): _save_to_slot(slot)
				else: _confirm("覆盖这个世界？", title + " 的已有存档将被替换。", "覆盖保存", func(): _save_to_slot(slot))
			elif dirty: _confirm("载入另一个世界？", "当前未保存的修改将丢失。", "载入世界", func(): _load_slot(slot))
			else: _load_slot(slot)
		, Vector2(570, 90))
		item.tooltip_text = title
		var row = HBoxContainer.new()
		row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		row.offset_left = 16
		row.offset_right = -16
		row.offset_top = 12
		row.offset_bottom = -12
		row.add_theme_constant_override("separation",16)
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		item.add_child(row)
		var number = label("%02d" % slot,20,GOLD)
		row.add_child(number)
		var emblem = TextureRect.new()
		emblem.texture = Icons.texture("save" if saving else "load")
		emblem.custom_minimum_size = Vector2(48,48)
		emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		emblem.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(emblem)
		var words = VBoxContainer.new()
		words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		words.alignment = BoxContainer.ALIGNMENT_CENTER
		words.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(words)
		var name_label = label(title,18,CREAM if not meta.is_empty() else MUTED)
		name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		words.add_child(name_label)
		words.add_child(label(subtitle,12,MUTED))
		if not saving and meta.is_empty(): item.disabled = true
		contents.add_child(item)
		slot_buttons.append(item)

func _save_to_slot(slot: int) -> void:
	var error = Save.write_slot(world, slot)
	if error != "": _show_toast(error); return
	active_slot = slot
	dirty = false
	_close_modal()
	_update_status()
	_show_toast("世界已保存 · 位置 %d" % slot)

func _load_slot(slot: int) -> void:
	var result = Save.read_slot(slot)
	if result.error != "": _show_toast(result.error); return
	world = result.world
	view.set_world(world)
	view.clock_time = world.age
	paused = false
	time_speed = 1
	_update_pause_buttons()
	view.visible = true
	hud.visible = true
	title_screen.visible = false
	dirty = false
	active_slot = slot
	_close_modal()
	_select_tool(-1)
	_select_category(-1)
	_update_status()
	_show_toast("欢迎回到 " + world.world_name)

func _confirm(title: String, message: String, verb: String, action: Callable) -> void:
	var contents = _new_modal(title, 560)
	contents.add_child(label(message, 16, CREAM))
	var row = HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_END
	row.add_theme_constant_override("separation", 12)
	row.add_child(button("取消", _close_modal))
	row.add_child(button(verb, func(): _close_modal(); action.call()))
	contents.add_child(row)

func _request_title() -> void:
	if dirty: _confirm("返回主菜单？", "当前世界仍保留在本次游戏中。", "返回", _show_title)
	else: _show_title()

func _show_title() -> void:
	_close_modal()
	title_screen.visible = true
	hud.visible = false
	view.visible = false
	if world != null:
		_show_toast("Esc 返回当前世界")

func _open_help() -> void:
	var contents=_new_modal("造世手记",660)
	contents.add_theme_constant_override("separation",12)
	var scroll=ScrollContainer.new(); scroll.custom_minimum_size=Vector2(0,minf(416,ui_root.size.y-184))
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	contents.add_child(scroll)
	var body=VBoxContainer.new(); body.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation",8); scroll.add_child(body)
	for section in [
		["观察世界",[["右键 / 中键拖动","移动视野"],["W A S D","移动视野"],["鼠标滚轮","缩放地图"],["F","俯瞰世界"]]],
		["塑造与管理",[["左键拖动","使用当前神力"],["Alt + 滚轮","调整笔刷大小"],["空格","暂停 / 继续"],["Ctrl + S","保存世界"],["Esc","关闭窗口 / 取消神力 / 设置"]]]
	]:
		body.add_child(label(section[0],14,GOLD))
		for entry in section[1]:
			var row=HBoxContainer.new(); row.custom_minimum_size.y=30
			row.add_theme_constant_override("separation",20)
			var key=label(entry[0],14,CREAM); key.custom_minimum_size.x=172
			row.add_child(key)
			var meaning=label(entry[1],14,MUTED); meaning.size_flags_horizontal=Control.SIZE_EXPAND_FILL
			row.add_child(meaning); body.add_child(row)
	var footer=HBoxContainer.new(); footer.alignment=BoxContainer.ALIGNMENT_END
	footer.add_child(button("继续造世",_close_modal,Vector2(156,44))); contents.add_child(footer)

func _toggle_pause() -> void:
	paused = not paused
	_update_pause_buttons()

func _toggle_speed_panel() -> void:
	speed_panel.visible = not speed_panel.visible
	observation_panel.hide()
	view.finish_stroke()
	view.interaction_locked = modal != null
	view.casting_locked = speed_panel.visible
	speed_options_row.hide()
	speed_value_button.show()
	speed_value_button.text = "%dx" % time_speed
	power_panel.visible = selected_tool >= 0 and not speed_panel.visible
	brush_button.visible = power_panel.visible
	for i in speed_choices.size(): selected_style(speed_choices[i], time_speed == i + 1)
	selected_style(speed_button, speed_panel.visible)

func _set_speed(value: int) -> void:
	time_speed = clampi(value, 1, 5)
	_close_speed_panel()
	selected_style(speed_button, false)
	_update_pause_buttons()

func _update_pause_buttons() -> void:
	view.paused = paused
	view.speed = time_speed
	selected_style(pause_button,paused)
	var pause_contents = pause_button.get_child(0)
	pause_contents.get_child(0).texture = Icons.texture("play" if paused else "pause")
	pause_contents.get_child(1).text = "继续" if paused else "暂停"
	speed_button.get_child(0).get_child(1).text = "%dx" % time_speed
	_update_status()

func _on_edited() -> void:
	dirty = true
	_update_status()

func _update_status() -> void:
	if world == null: return
	world_label.text = world.world_name
	save_label.text = "未保存" if dirty else "已保存"
	age_label.text = "%s · 第 %d 年" % ["时光静止" if paused else "萌芽纪元", 1 + int(world.age / World.YEAR_SECONDS)]
	var life = world.life_counts()
	for index in plant_stats.size(): plant_stats[index].text = str([life.living,life.young,life.dead][index])
	stat_label.text = "%d × %d  ·  种子 %d" % [world.width,world.height,world.world_seed]
	world_year_bar.value = fmod(world.age,World.YEAR_SECONDS)/World.YEAR_SECONDS*100.0
	distance_label.text = view.distance_name()

func _show_toast(message: String) -> void:
	toast_label.text = message
	var width = minf(ui_root.size.x-40,maxf(240,ui_font.get_string_size(message,HORIZONTAL_ALIGNMENT_LEFT,-1,16).x+44))
	toast_label.offset_left = -width/2
	toast_label.offset_right = width/2
	toast_time = 3.0
	toast_label.visible = true
	ui_root.move_child(toast_label, ui_root.get_child_count() - 1)

func _process(delta: float) -> void:
	var focus = get_viewport().gui_get_focus_owner()
	if world != null and hud.visible and modal == null and loading == null and not (focus is LineEdit or focus is TextEdit) and not Input.is_key_pressed(KEY_CTRL) and not Input.is_key_pressed(KEY_ALT):
		var movement = Vector2(float(_held(KEY_D))-float(_held(KEY_A)),float(_held(KEY_S))-float(_held(KEY_W)))
		if movement != Vector2.ZERO: view.pan_camera(-movement.normalized()*520*delta)
	if generation_thread != null:
		progress_mutex.lock()
		progress_bar.value = generation_progress * 100
		progress_label.text = generation_stage
		loading_percent.text = "%d%%" % (generation_progress * 100)
		progress_mutex.unlock()
		loading_emblem.queue_redraw()
		if not generation_thread.is_alive():
			var result = generation_thread.wait_to_finish()
			generation_thread = null
			finishing = true
			_finish_generation(result)
	elif is_instance_valid(loading_emblem) and loading != null: loading_emblem.queue_redraw()
	view.preview_blocked = speed_panel.visible
	for overlay in [power_panel,brush_button,speed_panel,observation_panel]:
		if overlay.visible and overlay.get_global_rect().has_point(get_global_mouse_position()): view.preview_blocked = true
	for tab in group_buttons:
		if tab.get_global_rect().has_point(get_global_mouse_position()): view.preview_blocked = true
	var running = world != null and not paused and modal == null and loading == null and hud.visible
	view.paused = not running
	if running:
		if world.advance(delta * time_speed):
			view.refresh_ecology()
			dirty = true
	elapsed_status += delta
	if elapsed_status > 1.0:
		elapsed_status = 0
		_update_status()
	if toast_time > 0:
		toast_time -= delta
		if toast_time <= 0: toast_label.visible = false

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo or loading != null: return
	if event.keycode == KEY_ESCAPE:
		if modal != null: _close_modal()
		elif speed_panel.visible: _close_speed_panel()
		elif observation_panel.visible: observation_panel.hide()
		elif selected_tool >= 0 and hud.visible: _select_tool(-1)
		elif title_screen.visible and world != null:
			title_screen.visible = false
			hud.visible = true
			view.visible = true
		elif world != null and hud.visible: _open_settings()
		get_viewport().set_input_as_handled()
		return
	if world == null or modal != null or title_screen.visible: return
	if event.keycode == KEY_SPACE: _toggle_pause()
	elif event.ctrl_pressed and event.keycode == KEY_S: _open_slots(true)
	elif event.keycode == KEY_F: view.fit_world()
	else: return
	get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if loading != null: return
		if dirty: _confirm("离开纪元谷？", "未保存的修改将丢失。", "离开游戏", func(): get_tree().quit())
		else: get_tree().quit()

func _exit_tree() -> void:
	if generation_thread != null and generation_thread.is_started(): generation_thread.wait_to_finish()

func _tool_info(value: int) -> Dictionary:
	if value < 0: return {"name": "", "texture": null}
	if value >= World.COMBO_TOOLS:
		return {"name": "森林土地", "texture": Icons.texture("forest")}
	if value >= World.BIOME_TOOLS and value < World.BIOME_TOOLS + World.BIOME_NAMES.size():
		return {"name": World.BIOME_NAMES[value - World.BIOME_TOOLS]+"种子", "texture": Icons.biome_texture(value - World.BIOME_TOOLS)}
	if value >= World.PLANT_TOOLS and value < World.PLANT_TOOLS + World.Catalog.MAX_ID:
		return {"name": PLANT_NAMES[value - World.PLANT_TOOLS], "texture": Icons.plant_texture(value - World.PLANT_TOOLS + 1)}
	var special = {World.LIGHTNING:["闪电","lightning"],World.TORNADO:["龙卷风","tornado"],World.FIRE:["火焰","fire"],World.EARTHQUAKE:["地震","earthquake"],World.RAIN:["雨","rain"],World.ACID_RAIN:["酸雨","acid_rain"],World.GRASS_SEEDS: ["草种子", "seed"], World.BERRY_SEEDS: ["浆果丛", "seed"], World.PLANT_FERTILIZER: ["植物肥料", "fertilizer"], World.TREE_FERTILIZER: ["树木肥料", "tree_fertilizer"], World.CLEAR_PLANTS: ["清除植物", "erase"]}
	if value == World.BERRY_SEEDS: return {"name":"浆果丛","texture":Icons.plant_texture(16)}
	if special.has(value): return {"name": special[value][0], "texture": Icons.texture(special[value][1])}
	if value in [World.ROCK_TOOL, World.BOULDER_TOOL]:
		return {"name": "石簇" if value == World.ROCK_TOOL else "巨岩", "texture": Icons.plant_texture(13 if value == World.ROCK_TOOL else 14)}
	return {"name": World.NAMES[value], "texture": Icons.terrain_texture(value)}

func _build_power_panels() -> void:
	power_panel=PanelContainer.new()
	power_panel.add_theme_stylebox_override("panel",_power_card_style())
	power_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	power_panel.offset_left=20; power_panel.offset_right=84
	power_panel.offset_top=-324; power_panel.offset_bottom=-220
	hud.add_child(power_panel)
	var stack=VBoxContainer.new(); stack.add_theme_constant_override("separation",0)
	power_panel.add_child(stack)
	power_picture=_card_picture(null); stack.add_child(power_picture)
	power_name=label("",12); power_name.hide(); stack.add_child(power_name)
	power_close=_close_button(func(): _select_tool(-1),"取消神力",Vector2(64,44))
	stack.add_child(power_close); power_panel.hide()
	brush_button=button("",_open_brush_picker,Vector2(64,64))
	brush_button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	brush_button.offset_left=20; brush_button.offset_right=84
	brush_button.offset_top=-398; brush_button.offset_bottom=-334
	brush_button.icon_alignment=HORIZONTAL_ALIGNMENT_CENTER; brush_button.expand_icon=true
	brush_button.add_theme_constant_override("icon_max_width",40)
	hud.add_child(brush_button); brush_button.hide(); _refresh_brush()
	speed_panel=PanelContainer.new()
	speed_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	speed_panel.offset_left=20; speed_panel.offset_top=-398; speed_panel.offset_bottom=-220
	speed_panel.add_theme_stylebox_override("panel",StyleBoxEmpty.new()); hud.add_child(speed_panel)
	var speed_stack=VBoxContainer.new(); speed_stack.add_theme_constant_override("separation",10)
	speed_panel.add_child(speed_stack)
	var header=HBoxContainer.new(); header.add_theme_constant_override("separation",10)
	speed_stack.add_child(header)
	speed_value_button=button("1x",func():
		speed_options_row.show(); speed_value_button.hide()
	,Vector2(64,64))
	speed_value_button.tooltip_text="选择时间流速"; header.add_child(speed_value_button)
	speed_options_row=HBoxContainer.new(); speed_options_row.add_theme_constant_override("separation",10)
	header.add_child(speed_options_row)
	for value in range(1,6):
		var option=button("%dx" % value,func(): _set_speed(value),Vector2(64,64))
		speed_choices.append(option); speed_options_row.add_child(option)
	speed_options_row.hide()
	var card_frame=PanelContainer.new(); card_frame.add_theme_stylebox_override("panel",_power_card_style())
	card_frame.size_flags_horizontal=Control.SIZE_SHRINK_BEGIN; speed_stack.add_child(card_frame)
	var card=VBoxContainer.new(); card.add_theme_constant_override("separation",0); card_frame.add_child(card)
	card.add_child(_card_picture(Icons.texture("speed")))
	var close=_close_button(_close_speed_panel,"关闭时间选择",Vector2(64,44)); close.name="CloseTime"
	card.add_child(close); speed_panel.hide()

func _card_picture(texture: Texture2D) -> TextureRect:
	var picture=TextureRect.new(); picture.texture=texture
	picture.custom_minimum_size=Vector2(64,60)
	picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.mouse_filter=Control.MOUSE_FILTER_IGNORE
	return picture

func _power_card_style() -> StyleBoxFlat:
	var style=StoryTheme.box(StoryTheme.PAPER,Color("9daa8e"))
	style.set_content_margin_all(0)
	return style

func _card_action(item: Button) -> void:
	item.add_theme_stylebox_override("normal",StyleBoxEmpty.new())
	var hover=StoryTheme.box(Color("f0e2d5"),Color.TRANSPARENT,0)
	hover.set_content_margin_all(0)
	for state in ["hover","pressed","hover_pressed"]: item.add_theme_stylebox_override(state,hover)

func _held(key: Key) -> bool:
	return Input.is_physical_key_pressed(key) or Input.is_key_pressed(key)

func _close_speed_panel() -> void:
	speed_panel.hide()
	view.casting_locked = false
	selected_style(speed_button,false)
	view.interaction_locked = modal != null
	power_panel.visible = selected_tool >= 0
	brush_button.visible = power_panel.visible

func _refresh_brush() -> void:
	if not is_instance_valid(brush_button): return
	brush_button.icon = Icons.brush_texture(view.brush_shape,view.radius,40)
	brush_button.tooltip_text = "%s笔刷 · %d
Alt＋滚轮调整大小" % [World.Brush.NAMES[view.brush_shape],view.radius]

func _set_brush(shape: int, radius: int) -> void:
	view.brush_shape = shape
	view.radius = radius
	_refresh_brush()
	view.effects.queue_redraw()
	_close_modal()

func _open_brush_picker() -> void:
	if selected_tool < 0: return
	var contents = _new_modal("神 力 笔 刷",510)
	brush_options.clear()
	for shape in 4:
		contents.add_child(label(World.Brush.NAMES[shape],13,GOLD))
		var grid = GridContainer.new()
		grid.columns = 5
		grid.add_theme_constant_override("h_separation",10)
		grid.add_theme_constant_override("v_separation",8)
		contents.add_child(grid)
		for radius in World.Brush.SIZES[shape]:
			var option = button("",func(): _set_brush(shape,radius),Vector2(86,60 if ui_root.size.y >= 750 else 48))
			option.icon = Icons.brush_texture(shape,radius,48)
			option.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
			option.tooltip_text = "%s · %d" % [World.Brush.NAMES[shape],radius]
			option.set_meta("shape",shape)
			option.set_meta("radius",radius)
			selected_style(option,view.brush_shape == shape and view.radius == radius)
			grid.add_child(option)
			brush_options.append(option)

func _layout_interface() -> void:
	if not is_instance_valid(ui_root): return
	ui_root.scale = Vector2.ONE*ui_scale
	ui_root.size = size/ui_scale
	view.offset_bottom = -StoryTheme.HUD_HEIGHT*ui_scale
	_layout_title()

func _layout_title() -> void:
	if not is_instance_valid(title_card): return
	var height=title_card.get_combined_minimum_size().y
	title_card.offset_top=-height*.5
	title_card.offset_bottom=height*.5

func _save_preferences() -> void:
	var error = Preferences.write(ui_scale,DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN,view.show_plants)
	if error != OK: _show_toast("设置未能保存")

func _set_ui_scale(value: float) -> void:
	var old_zoom: float = view.zoom
	var anchor: Vector2 = (view.size/2-view.camera)/old_zoom
	ui_scale = clampf(value,.9,1.15)
	_layout_interface()
	if world != null:
		view.zoom = old_zoom
		view.camera = view.size/2-anchor*old_zoom
		view.queue_redraw()
		view.effects.queue_redraw()
		view.distance_changed.emit(view.distance_name())
	_save_preferences()
	for index in scale_buttons.size():
		if is_instance_valid(scale_buttons[index]): selected_style(scale_buttons[index],is_equal_approx(ui_scale,[.9,1.0,1.15][index]))

func _build_observation() -> void:
	observation_panel = StoryPanel.new()
	observation_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	observation_panel.offset_left = 264
	observation_panel.offset_right = 640
	observation_panel.offset_top = -446
	observation_panel.offset_bottom = -254
	hud.add_child(observation_panel)
	var stack = VBoxContainer.new()
	stack.add_theme_constant_override("separation",8)
	observation_panel.add_child(stack)
	var heading = HBoxContainer.new()
	heading.add_child(label("观察世界",16,CREAM))
	distance_label = label("远景",13,MUTED)
	distance_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.add_child(distance_label)
	heading.add_child(_close_button(func(): observation_panel.hide(),"关闭观察",Vector2(36,36)))
	stack.add_child(heading)
	var distances = HBoxContainer.new()
	for index in 3:
		distances.add_child(button(["俯瞰","中景","近景"][index],func(): view.set_distance(index); observation_panel.hide(),Vector2(100,36)))
	stack.add_child(distances)
	plants_toggle = CheckBox.new()
	plants_toggle.text = "显示植物"
	plants_toggle.button_pressed = view.show_plants
	plants_toggle.toggled.connect(func(value): view.show_plants = value; view.queue_redraw(); _save_preferences())
	stack.add_child(plants_toggle)
	hover_label = label("",12,MUTED)
	stack.add_child(hover_label)
	observation_panel.hide()

func _toggle_observation() -> void:
	observation_panel.visible = not observation_panel.visible
	_close_speed_panel()
	selected_style(speed_button,false)
	plants_toggle.set_pressed_no_signal(view.show_plants)

func _open_settings() -> void:
	var contents=_new_modal("游戏设置",600)
	var display=VBoxContainer.new(); display.add_theme_constant_override("separation",10)
	display.add_child(label("画面",14,GOLD)); contents.add_child(display)
	fullscreen_toggle=CheckBox.new(); fullscreen_toggle.text="全屏显示"
	fullscreen_toggle.custom_minimum_size.y=44
	fullscreen_toggle.button_pressed=DisplayServer.window_get_mode()==DisplayServer.WINDOW_MODE_FULLSCREEN
	fullscreen_toggle.toggled.connect(func(value):
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if value else DisplayServer.WINDOW_MODE_WINDOWED)
		_save_preferences()
	)
	display.add_child(fullscreen_toggle)
	var size_row=HBoxContainer.new(); size_row.add_theme_constant_override("separation",16)
	var caption=label("界面大小",14,MUTED); caption.custom_minimum_size.x=80; size_row.add_child(caption)
	var scales=HBoxContainer.new(); scales.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	scales.add_theme_constant_override("separation",8); size_row.add_child(scales)
	scale_buttons.clear()
	for index in 3:
		var value=[.9,1.0,1.15][index]
		var option=button(["小巧 90%","标准 100%","舒展 115%"][index],func(): _set_ui_scale(value),Vector2(0,44))
		option.add_theme_font_size_override("font_size",14); option.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		selected_style(option,is_equal_approx(ui_scale,value)); scale_buttons.append(option); scales.add_child(option)
	display.add_child(size_row)
	if world!=null:
		contents.add_child(HSeparator.new())
		var world_options=VBoxContainer.new(); world_options.add_theme_constant_override("separation",8)
		world_options.add_child(label("世界",14,GOLD)); contents.add_child(world_options)
		spread_toggle=CheckBox.new(); spread_toggle.text="生态扩散"; spread_toggle.custom_minimum_size.y=44
		spread_toggle.button_pressed=world.spread_enabled
		spread_toggle.tooltip_text="相邻生态随时间交融；关闭后植物仍正常生长"
		spread_toggle.toggled.connect(func(value): world.spread_enabled=value; dirty=true; _update_status())
		world_options.add_child(spread_toggle)
		var weather_toggle=CheckBox.new(); weather_toggle.name="NaturalWeather"
		weather_toggle.text="自然天气"; weather_toggle.custom_minimum_size.y=44
		weather_toggle.button_pressed=world.weather_enabled
		weather_toggle.tooltip_text="偶尔有雨云经过；关闭后仍可使用雨神力"
		weather_toggle.toggled.connect(func(value): world.weather_enabled=value; dirty=true; _update_status())
		world_options.add_child(weather_toggle)
	var footer=HBoxContainer.new(); footer.add_theme_constant_override("separation",12)
	footer.add_child(button("操作手记",_open_help,Vector2(120,44)))
	var space=Control.new(); space.size_flags_horizontal=Control.SIZE_EXPAND_FILL; footer.add_child(space)
	var done=button("完成",_close_modal,Vector2(128,44)); StoryTheme.primary(done)
	footer.add_child(done); contents.add_child(footer)
