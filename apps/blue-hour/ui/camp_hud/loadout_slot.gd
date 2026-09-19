extends StateButton
## One reusable view; slot_index identifies the underlying slot across pages.

enum SlotState { EMPTY, LOCKED, EQUIPPED }

var slot_index: int = -1
var slot_state: SlotState = SlotState.EMPTY

@onready var item_icon: TextureRect = $VisualRoot/Content/ItemIcon

func show_slot(index: int, unlocked: bool, item: Dictionary) -> void:
	slot_index = index
	disabled = not unlocked
	slot_state = SlotState.LOCKED if disabled else (SlotState.EMPTY if item.is_empty() else SlotState.EQUIPPED)
	# Page data changes replace the base image, never the hover state image.
	var base: Texture2D = get_meta("empty_texture") as Texture2D
	if slot_state == SlotState.EQUIPPED:
		base = get_meta("item_texture") as Texture2D
	set_state_textures(base, hover_texture, null, disabled_texture)
	item_icon.texture = item.get("icon") as Texture2D if slot_state == SlotState.EQUIPPED else null
	item_icon.visible = slot_state == SlotState.EQUIPPED
	mouse_default_cursor_shape = Control.CURSOR_ARROW if disabled else Control.CURSOR_POINTING_HAND
	tooltip_text = "尚未解锁" if disabled else str(item.get("name", "装备道具"))
