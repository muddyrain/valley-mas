extends Button

const NORMAL_FRAME: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_normal.png")
const SELECTED_FRAME: Texture2D = preload("res://assets/ui/camp/m04/m04_portrait_frame_selected.png")
const NORMAL_TINT := Color(0.78, 0.78, 0.78, 1)
const HOVER_TINT := Color(0.90, 0.93, 0.94, 1)

var selected: bool = false
var _hovered: bool = false
var _held: bool = false
var _transition: Tween

func bind_survivor(view_data: Dictionary) -> void:
	var is_recruited := bool(view_data.get("is_recruited", false))
	var is_discovered := bool(view_data.get("is_discovered", false))
	$PortraitTexture.texture = view_data.get("portrait") as Texture2D
	$Fallback.visible = $PortraitTexture.texture == null
	$Fallback/Initials.text = "?" if not is_recruited and not is_discovered else _initials(str(view_data.get("display_name", "")))
	$NameLabel.text = str(view_data.get("display_name", ""))
	var survivor_id := str(view_data.get("survivor_id", ""))
	var english_name := str(view_data.get("name_en", survivor_id)).replace("_", " ")
	$EnglishLabel.text = english_name if is_recruited else survivor_id
	var role_tags := str(view_data.get("tags", ""))
	$MetaLabel.text = "Lv.%02d · %s" % [int(view_data.get("level", 1)), role_tags] if is_recruited else str(view_data.get("status", ""))
	$MetaLabel.modulate.a = 1.0 if is_recruited else 0.72
	$NameLabel.modulate.a = 1.0 if is_recruited or is_discovered else 0.72
	$EnglishLabel.modulate.a = 0.86 if is_recruited else 0.62

func _initials(display_name: String) -> String:
	if display_name.is_empty():
		return "?"
	return display_name.left(2)

func _ready() -> void:
	pivot_offset = size * 0.5
	mouse_entered.connect(func() -> void:
		_hovered = true
		_update_visual())
	mouse_exited.connect(func() -> void:
		_hovered = false
		_update_visual())
	button_down.connect(func() -> void:
		_held = true
		_update_visual())
	button_up.connect(func() -> void:
		_held = false
		_update_visual())
	visibility_changed.connect(_reset_transient_state)
	_update_visual(true)

func set_selected(value: bool) -> void:
	selected = value
	_update_visual()

func _reset_transient_state() -> void:
	if not is_visible_in_tree():
		_hovered = false
		_held = false
		_update_visual(true)

func _update_visual(immediate: bool = false) -> void:
	if not is_node_ready():
		return
	if _transition != null:
		_transition.kill()
	var frame: TextureRect = $FrameTexture
	var portrait: TextureRect = $PortraitTexture
	var info_band: Panel = $InfoBand
	var name_label: Label = $NameLabel
	var english_label: Label = $EnglishLabel
	var meta_label: Label = $MetaLabel
	frame.texture = SELECTED_FRAME if selected else NORMAL_FRAME
	var tint: Color = Color.WHITE if selected else (HOVER_TINT if _hovered else NORMAL_TINT)
	var portrait_tint := Color(1.06, 1.06, 1.06, 1) if _hovered and not selected else Color.WHITE
	var info_tint := Color(1.10, 1.14, 1.16, 1) if selected else (Color(1.05, 1.08, 1.10, 1) if _hovered else Color(0.94, 0.97, 0.98, 1))
	var name_tint := Color(1.10, 1.16, 1.18, 1) if selected else Color.WHITE
	var target_scale := Vector2.ONE * (0.98 if _held else (1.02 if _hovered and not selected else 1.0))
	if immediate:
		frame.self_modulate = tint
		portrait.self_modulate = portrait_tint
		info_band.self_modulate = info_tint
		name_label.self_modulate = name_tint
		english_label.self_modulate = Color(1.04, 1.08, 1.10, 1) if selected else Color.WHITE
		meta_label.self_modulate = Color(1.06, 1.10, 1.12, 1) if selected else Color.WHITE
		scale = target_scale
		return
	_transition = create_tween().set_parallel(true)
	_transition.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_transition.tween_property(frame, "self_modulate", tint, 0.12)
	_transition.tween_property(portrait, "self_modulate", portrait_tint, 0.12)
	_transition.tween_property(info_band, "self_modulate", info_tint, 0.12)
	_transition.tween_property(name_label, "self_modulate", name_tint, 0.12)
	_transition.tween_property(english_label, "self_modulate", Color(1.04, 1.08, 1.10, 1) if selected else Color.WHITE, 0.12)
	_transition.tween_property(meta_label, "self_modulate", Color(1.06, 1.10, 1.12, 1) if selected else Color.WHITE, 0.12)
	_transition.tween_property(self, "scale", target_scale, 0.10)
