extends Panel
## Data-driven Camp roster presentation. Campaign state remains owned by the caller.

signal survivor_selected(survivor_id: String)
## Compatibility signal for existing presentation probes; selection is ID-based internally.
signal selection_changed(index: int)

const PortraitSlot = preload("res://ui/camp_hud/portrait_slot.gd")
const SlotScene = preload("res://ui/camp_hud/portrait_slot.tscn")
const RosterAdapter = preload("res://ui/camp_hud/survivor_roster_adapter.gd")

var selected_survivor_id: String = ""
var selected_index: int = -1

var _catalog: RefCounted
var _campaign: RefCounted
var _views: Array[Dictionary] = []
var _entries: Array[PortraitSlot] = []
var _syncing_scrollbar: bool = false

@onready var _scroll: ScrollContainer = $RosterContainer/ScrollContainer
@onready var _native_scrollbar: VScrollBar = _scroll.get_v_scroll_bar()
@onready var _overlay_scrollbar: VScrollBar = $RosterContainer/OverlayScrollBar

func _ready() -> void:
	_native_scrollbar.visible = false
	_overlay_scrollbar.value_changed.connect(_on_overlay_scroll_changed)
	_rebuild()
	_sync_overlay_scrollbar()

func _process(_delta: float) -> void:
	_sync_overlay_scrollbar()

func configure(catalog: RefCounted, campaign: RefCounted) -> void:
	_catalog = catalog
	_campaign = campaign
	_rebuild()

func refresh() -> void:
	_rebuild()

func _rebuild() -> void:
	if not is_node_ready() or _catalog == null:
		return
	_views = RosterAdapter.build(_catalog, _campaign)
	var party_count := 0
	for view: Dictionary in _views:
		if bool(view.get("is_party_member", false)):
			party_count += 1
	$Header/Count.text = "%d/%d" % [party_count, _views.size()]
	var container := $RosterContainer/ScrollContainer/VBoxContainer as VBoxContainer
	for child: Node in container.get_children():
		if child.name != "EntryTemplate":
			child.queue_free()
	_entries.clear()
	for view: Dictionary in _views:
		var entry := SlotScene.instantiate() as PortraitSlot
		entry.name = "SurvivorEntry_" + str(view.get("survivor_id", ""))
		container.add_child(entry)
		entry.bind_survivor(view)
		entry.pressed.connect(_select_survivor.bind(str(view.get("survivor_id", ""))))
		_entries.append(entry)
	_refresh_selection()
	_scroll.scroll_vertical = 0
	_sync_overlay_scrollbar()

func _on_overlay_scroll_changed(value: float) -> void:
	if _syncing_scrollbar:
		return
	_scroll.scroll_vertical = int(round(clampf(value, 0.0, _max_scroll())))

func _sync_overlay_scrollbar() -> void:
	if not is_node_ready():
		return
	var max_scroll := _max_scroll()
	_scroll.scroll_vertical = mini(_scroll.scroll_vertical, int(max_scroll))
	_overlay_scrollbar.visible = max_scroll > 0.0
	if not _overlay_scrollbar.visible:
		return
	_syncing_scrollbar = true
	_overlay_scrollbar.min_value = _native_scrollbar.min_value
	_overlay_scrollbar.max_value = max_scroll
	_overlay_scrollbar.step = 1.0
	_overlay_scrollbar.page = _scroll.size.y
	_overlay_scrollbar.value = _scroll.scroll_vertical
	_syncing_scrollbar = false

func _max_scroll() -> float:
	if _scroll.get_child_count() == 0:
		return 0.0
	var content := _scroll.get_child(0) as Control
	var content_height := maxf(content.size.y, content.get_combined_minimum_size().y)
	return maxf(0.0, content_height - _scroll.size.y)

func _select_survivor(survivor_id: String) -> void:
	if survivor_id.is_empty() or get_survivor_view_data(survivor_id).is_empty():
		return
	if selected_survivor_id == survivor_id:
		return
	selected_survivor_id = survivor_id
	selected_index = _index_for_id(survivor_id)
	_refresh_selection()
	survivor_selected.emit(survivor_id)
	selection_changed.emit(selected_index)

func select_survivor(survivor_id: String) -> void:
	_select_survivor(survivor_id)

func select_index(index: int) -> void:
	# Kept only for older callers; all roster state is still keyed by survivor_id.
	if index >= 0 and index < _views.size():
		_select_survivor(str(_views[index].get("survivor_id", "")))

func get_survivor_view_data(survivor_id: String) -> Dictionary:
	for view: Dictionary in _views:
		if str(view.get("survivor_id", "")) == survivor_id:
			return view
	return {}

func _index_for_id(survivor_id: String) -> int:
	for index: int in range(_views.size()):
		if str(_views[index].get("survivor_id", "")) == survivor_id:
			return index
	return -1

func _refresh_selection() -> void:
	for index: int in range(_entries.size()):
		_entries[index].set_selected(str(_views[index].get("survivor_id", "")) == selected_survivor_id)
