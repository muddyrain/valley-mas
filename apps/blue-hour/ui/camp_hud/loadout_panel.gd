extends Control
## Presentation data only. Empty dictionaries preserve gaps in the slot-indexed array.

signal slot_requested(slot_index: int, item: Dictionary)
signal page_changed(page_index: int)

const SLOTS_PER_PAGE: int = 2

var equipped_items: Array[Dictionary] = []
var unlocked_slot_count: int = 1
var total_slot_count: int = 2
var page_index: int = 0
var slots_per_page: int:
	get:
		return SLOTS_PER_PAGE

@onready var slots: Array[Node] = $SlotContainer.get_children()

func _ready() -> void:
	for slot: Button in slots:
		slot.pressed.connect(_request_slot.bind(slot))
	$Pagination/PrevButton.pressed.connect(func() -> void: set_page(page_index - 1))
	$Pagination/NextButton.pressed.connect(func() -> void: set_page(page_index + 1))
	_refresh()

func show_loadout(items: Array[Dictionary], unlocked_count: int, total_count: int = 0) -> void:
	equipped_items = items.duplicate(true)
	unlocked_slot_count = maxi(0, unlocked_count)
	total_slot_count = maxi(SLOTS_PER_PAGE, maxi(unlocked_slot_count, total_count))
	page_index = clampi(page_index, 0, get_page_count() - 1)
	if unlocked_slot_count <= SLOTS_PER_PAGE:
		page_index = 0
	if is_node_ready():
		_refresh()

func get_page_count() -> int:
	return ceili(float(total_slot_count) / SLOTS_PER_PAGE)

func set_page(index: int) -> void:
	var target: int = clampi(index, 0, get_page_count() - 1) if unlocked_slot_count > SLOTS_PER_PAGE else 0
	if target == page_index:
		return
	page_index = target
	_refresh()
	page_changed.emit(page_index)

func _item_at(index: int) -> Dictionary:
	if index >= unlocked_slot_count or index >= equipped_items.size():
		return {}
	return equipped_items[index]

func _refresh() -> void:
	var equipped_count: int = 0
	for index: int in range(mini(unlocked_slot_count, equipped_items.size())):
		if not equipped_items[index].is_empty():
			equipped_count += 1
	$Header/CountLabel.text = "%d/%d" % [equipped_count, unlocked_slot_count]
	for index: int in range(slots.size()):
		var absolute_index: int = page_index * SLOTS_PER_PAGE + index
		slots[index].show_slot(absolute_index, absolute_index < unlocked_slot_count, _item_at(absolute_index))
	$Pagination.visible = unlocked_slot_count > SLOTS_PER_PAGE
	$Pagination/PageLabel.text = "%d / %d" % [page_index + 1, get_page_count()]
	$Pagination/PrevButton.disabled = page_index == 0
	$Pagination/NextButton.disabled = page_index == get_page_count() - 1

func _request_slot(slot: Button) -> void:
	var index: int = slot.slot_index
	if index >= 0 and index < unlocked_slot_count:
		slot_requested.emit(index, _item_at(index).duplicate(true))
