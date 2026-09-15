extends Node3D
## Standalone locomotion validation harness; it never mutates formal survivor scenes.

enum LocomotionState { IDLE, WALK, JOG, RUN }

const STATE_ANIMATIONS: Dictionary[LocomotionState, StringName] = {
	LocomotionState.IDLE: &"idle_relaxed",
	LocomotionState.WALK: &"walk_forward",
	LocomotionState.JOG: &"jog_forward",
	LocomotionState.RUN: &"run_forward",
}
const SOURCE_ANIMATIONS: Dictionary[StringName, StringName] = {
	&"Armature|Idle_3": &"idle_relaxed",
	&"Armature|Walking": &"walk_forward",
	&"Armature|01a0a570-436a-7724-86d1-22c27d156833": &"jog_forward",
	&"Armature|Running": &"run_forward",
	&"Idle_3": &"idle_relaxed",
	&"Walking": &"walk_forward",
	&"01a0a570-436a-7724-86d1-22c27d156833": &"jog_forward",
	&"Running": &"run_forward",
	&"Armature|Armature|01a0a570-436a-7724-86d1-22c27d156833": &"jog_forward",
	&"Armature|Armature|Idle_3": &"idle_relaxed",
	&"Armature|Armature|Walking": &"walk_forward",
	&"Armature|Armature|Running": &"run_forward",
}
const CROSS_FADE_SECONDS: float = 0.18

@export var preview_speed: float = 0.0

var locomotion_state: LocomotionState = LocomotionState.IDLE
var _animation_player: AnimationPlayer
var _library: AnimationLibrary

func _ready() -> void:
	_animation_player = _find_animation_player(self)
	if _animation_player == null:
		push_error("survivor_animation_template: AnimationPlayer was not imported")
		return
	_library = _animation_player.get_animation_library(&"")
	if _library == null:
		for library_name: StringName in _animation_player.get_animation_library_list():
			_library = _animation_player.get_animation_library(library_name)
			if _library != null:
				break
	if _library == null:
		push_error("survivor_animation_template: default AnimationLibrary was not imported")
		return
	_normalize_animation_names()
	set_locomotion_state(LocomotionState.IDLE, true)

func _process(_delta: float) -> void:
	set_locomotion_from_speed(preview_speed)

func set_locomotion_from_speed(speed: float) -> void:
	var next_state := LocomotionState.IDLE
	if speed >= 5.0:
		next_state = LocomotionState.RUN
	elif speed >= 2.8:
		next_state = LocomotionState.JOG
	elif speed > 0.08:
		next_state = LocomotionState.WALK
	set_locomotion_state(next_state)

func set_locomotion_state(next_state: LocomotionState, immediate: bool = false) -> void:
	if _animation_player == null or not STATE_ANIMATIONS.has(next_state):
		return
	if not immediate and next_state == locomotion_state and _animation_player.is_playing():
		return
	locomotion_state = next_state
	var animation_name: StringName = STATE_ANIMATIONS[next_state]
	if not _library.has_animation(animation_name):
		push_error("Missing locomotion animation: " + String(animation_name))
		return
	_animation_player.play(animation_name, CROSS_FADE_SECONDS if not immediate else 0.0)

func _normalize_animation_names() -> void:
	for source_name: StringName in SOURCE_ANIMATIONS:
		var final_name: StringName = SOURCE_ANIMATIONS[source_name]
		if _library.has_animation(source_name) and not _library.has_animation(final_name):
			_library.rename_animation(source_name, final_name)
	for animation_name: StringName in STATE_ANIMATIONS.values():
		if _library.has_animation(animation_name):
			_library.get_animation(animation_name).loop_mode = Animation.LOOP_LINEAR

func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child: Node in node.get_children():
		var found := _find_animation_player(child)
		if found != null:
			return found
	return null
