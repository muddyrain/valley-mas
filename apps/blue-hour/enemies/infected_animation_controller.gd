extends Node
class_name InfectedAnimationController

const BLEND_SECONDS: float = 0.15
const WALK_MIN_SPEED: float = 0.85
const WALK_MAX_SPEED: float = 1.15
const CHASE_MIN_SPEED: float = 0.90
const CHASE_MAX_SPEED: float = 1.20

var animation_player: AnimationPlayer
var current_animation: StringName = &""
var animation_start_offset: float = 0.0
var playback_speed_variation: float = 1.0

func configure(player: AnimationPlayer, random_source: RandomNumberGenerator) -> void:
	animation_player = player
	animation_start_offset = random_source.randf_range(0.0, 0.9)
	playback_speed_variation = random_source.randf_range(0.95, 1.05)

func set_locomotion(animation_name: StringName) -> void:
	if animation_player == null or not animation_player.has_animation(animation_name):
		return
	if current_animation == animation_name:
		return
	current_animation = animation_name
	animation_player.play(animation_name, BLEND_SECONDS, playback_speed_variation)
	var animation: Animation = animation_player.get_animation(animation_name)
	if animation != null and animation.length > 0.0:
		animation_player.seek(fmod(animation_start_offset, animation.length), true)

func update_motion_speed(horizontal_speed: float, nominal_speed: float) -> void:
	if animation_player == null or nominal_speed <= 0.001:
		return
	var ratio: float = horizontal_speed / nominal_speed
	var lower: float = WALK_MIN_SPEED
	var upper: float = WALK_MAX_SPEED
	if current_animation == &"Zombie_Chase":
		lower = CHASE_MIN_SPEED
		upper = CHASE_MAX_SPEED
	animation_player.speed_scale = clampf(ratio * playback_speed_variation, lower, upper)
