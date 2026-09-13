extends Control

signal confirmed
signal cancelled

const UI = preload("res://ui/ui_style.gd")
const MenuArt = preload("res://ui/menu_art.gd")
const NewRunArt = preload("res://ui/new_run_art.gd")

var confirmation_card: PanelContainer
var keep_progress_button: Button
var create_run_button: Button
var return_focus: Control
var closing := false

func setup(heading: String, message: String, confirm_text: String, cancel_text: String) -> void:
	name = "NewRunConfirmation"
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 200
	theme = MenuArt.theme()
	return_focus = get_viewport().gui_get_focus_owner()

	var shade := ColorRect.new()
	shade.name = "ConfirmationShade"
	shade.color = Color(0.015, 0.03, 0.055, 0.68)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)

	var center := CenterContainer.new()
	center.name = "ConfirmationCenter"
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var card_stack := Control.new()
	card_stack.name = "ConfirmationCardStack"
	card_stack.custom_minimum_size = Vector2(620, 334)
	card_stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(card_stack)

	var paper_backing := PanelContainer.new()
	paper_backing.name = "ConfirmationPaperBacking"
	paper_backing.mouse_filter = Control.MOUSE_FILTER_IGNORE
	paper_backing.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# Keep the solid backing inside the illustrated cut corners of the paper texture.
	paper_backing.offset_left = 38
	paper_backing.offset_top = 28
	paper_backing.offset_right = -38
	paper_backing.offset_bottom = -28
	var backing_style := UI.panel(Color("#f1e7d4"), Color.TRANSPARENT)
	backing_style.set_corner_radius_all(10)
	paper_backing.add_theme_stylebox_override("panel", backing_style)
	card_stack.add_child(paper_backing)

	confirmation_card = PanelContainer.new()
	confirmation_card.name = "ConfirmationCard"
	confirmation_card.custom_minimum_size = Vector2(620, 334)
	confirmation_card.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	confirmation_card.add_theme_stylebox_override("panel", MenuArt.dialog_paper())
	card_stack.add_child(confirmation_card)

	var column := VBoxContainer.new()
	column.name = "ConfirmationContent"
	column.add_theme_constant_override("separation", 16)
	confirmation_card.add_child(column)

	var title := UI.label(heading, 36, NewRunArt.INK)
	title.name = "ConfirmationTitle"
	title.custom_minimum_size.y = 52
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_font_override("font", NewRunArt.title_font())
	column.add_child(title)

	var accent_center := CenterContainer.new()
	accent_center.custom_minimum_size.y = 3
	accent_center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(accent_center)
	var accent := ColorRect.new()
	accent.name = "ConfirmationAccent"
	accent.color = NewRunArt.ORANGE
	accent.custom_minimum_size = Vector2(84, 3)
	accent.mouse_filter = Control.MOUSE_FILTER_IGNORE
	accent_center.add_child(accent)

	var body := UI.wrapped(message, 20, NewRunArt.INK_SOFT)
	body.name = "ConfirmationMessage"
	body.custom_minimum_size.y = 82
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	body.add_theme_font_override("font", NewRunArt.body_font())
	body.add_theme_constant_override("line_spacing", 7)
	column.add_child(body)

	var actions := HBoxContainer.new()
	actions.name = "ConfirmationActions"
	actions.add_theme_constant_override("separation", 14)
	column.add_child(actions)

	keep_progress_button = MenuArt.button(cancel_text, _cancel)
	keep_progress_button.name = "KeepProgressButton"
	keep_progress_button.custom_minimum_size = Vector2(0, 64)
	keep_progress_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	keep_progress_button.add_theme_font_size_override("font_size", 20)
	actions.add_child(keep_progress_button)

	create_run_button = MenuArt.button(confirm_text, _confirm, true)
	create_run_button.name = "CreateRunButton"
	create_run_button.custom_minimum_size = Vector2(0, 64)
	create_run_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	create_run_button.add_theme_font_size_override("font_size", 20)
	actions.add_child(create_run_button)

	MenuArt.flow_focus([keep_progress_button, create_run_button])
	keep_progress_button.focus_neighbor_right = create_run_button.get_path()
	create_run_button.focus_neighbor_left = keep_progress_button.get_path()
	keep_progress_button.grab_focus.call_deferred()
	_animate_in.call_deferred(shade)

func _animate_in(shade: ColorRect) -> void:
	if not is_instance_valid(confirmation_card) or not is_instance_valid(shade):
		return
	confirmation_card.pivot_offset = confirmation_card.size * 0.5
	confirmation_card.scale = Vector2.ONE * 0.97
	confirmation_card.modulate.a = 0.0
	shade.modulate.a = 0.0
	var tween := create_tween().set_parallel(true)
	tween.tween_property(shade, "modulate:a", 1.0, 0.14).set_trans(Tween.TRANS_SINE)
	tween.tween_property(confirmation_card, "modulate:a", 1.0, 0.14).set_trans(Tween.TRANS_SINE)
	tween.tween_property(confirmation_card, "scale", Vector2.ONE, 0.14).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)

func _confirm() -> void:
	_close(true)

func _cancel() -> void:
	_close(false)

func _close(accepted: bool) -> void:
	if closing:
		return
	closing = true
	queue_free()
	if accepted:
		confirmed.emit()
	else:
		cancelled.emit()
		if is_instance_valid(return_focus):
			return_focus.grab_focus.call_deferred()

func _input(event: InputEvent) -> void:
	var escape_pressed: bool = event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE
	if escape_pressed or event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		_cancel()
