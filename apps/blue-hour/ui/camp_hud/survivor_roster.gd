extends Panel
## Local presentation selection; the fixture roster does not change the campaign.

signal selection_changed(index: int)

const PortraitSlot = preload("res://ui/camp_hud/portrait_slot.gd")

var selected_index: int = -1
var _slots: Array[PortraitSlot] = []

func _ready() -> void:
	for child: Node in get_children():
		if child is PortraitSlot:
			var slot := child as PortraitSlot
			slot.pressed.connect(select_index.bind(_slots.size()))
			_slots.append(slot)
	$Header/Count.text = "%d/%d" % [_slots.size(), _slots.size()]
	_refresh_frames()

func select_index(index: int) -> void:
	if index < 0 or index >= _slots.size() or index == selected_index:
		return
	selected_index = index
	_refresh_frames()
	selection_changed.emit(selected_index)

func _refresh_frames() -> void:
	for index: int in range(_slots.size()):
		_slots[index].set_selected(index == selected_index)
