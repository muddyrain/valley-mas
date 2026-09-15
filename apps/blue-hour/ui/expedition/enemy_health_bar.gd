extends Node3D
## Two camera-facing sprites share a fixed pixel scale; only the fill's region changes.
const HudArt = preload("res://ui/expedition/hud_skin.gd")
var background: Sprite3D
var fill: Sprite3D
var ratio: float = 1.0

func _init() -> void:
	background = _sprite("hp_enemy_bg")
	fill = _sprite("hp_enemy_fill")
	fill.render_priority = 1
	fill.region_enabled = true
	set_ratio(1.0)

func set_ratio(value: float) -> void:
	ratio = clampf(value, 0, 1)
	var dimensions: Vector2 = fill.texture.get_size()
	fill.visible = ratio > 0
	fill.region_rect = Rect2(Vector2.ZERO, dimensions * Vector2(ratio, 1))
	fill.offset.x = -(dimensions.x * (1.0 - ratio)) * .5

func _sprite(asset: String) -> Sprite3D:
	var sprite := Sprite3D.new()
	sprite.texture = HudArt.texture(asset)
	sprite.pixel_size = .65 / 711.0
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.shaded = false
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	add_child(sprite)
	return sprite
