extends RefCounted
## View-only tuning. Baked PNG light is attenuated independently of text and portraits.
const HUD_GLOW_MULTIPLIER: float = .60
const WORLD_MARKER_GLOW_MULTIPLIER: float = .50
const HUD_ALPHA_MULTIPLIER: float = .92
const WORLD_MARKER_ALPHA_MULTIPLIER: float = 1.0
const TIME_SCALE: float = 1.0
const PARTY_SCALE: float = 1.0
const OBJECTIVE_SCALE: float = 1.0
const ACTION_SCALE: float = 1.09
const RETURN_SCALE: float = 1.0
const HOVER_BRIGHTNESS: float = 1.20
const ACTIVE_BRIGHTNESS: float = 1.35
const HOVER_SCALE: float = 1.02
const HOVER_SECONDS: float = .15
const INTERACTION_SECONDS: float = .18
const COMPACT_SIZE: Vector2 = Vector2(264, 108)
const SEARCH_SIZE: Vector2 = Vector2(282, 184)
const SECONDARY_TEXT: Color = Color("#93a7ae")
const SELECT_ALPHA: float = .75
const OTHER_SELECT_ALPHA: float = .16
const SITE_ALPHA: float = .62
const SITE_HOVER_ALPHA: float = .90
const SEARCH_ALPHA: float = .74
const SEARCH_ROTATION_SECONDS: float = 9.0
const MOVE_SCALE: float = .88
const MOVE_ALPHA: float = .82
const MOVE_SHOW: float = .11
const MOVE_HOLD: float = .30
const MOVE_FADE: float = .22
const RETURN_ZONE_SCALE: float = .68
const RETURN_ZONE_ALPHA: float = .45
const RETURN_ZONE_ACTIVE_ALPHA: float = .70
const BUS_ALPHA: float = .50
const BUS_ACTIVE_ALPHA: float = .78
const BUS_LABEL_IDLE: Color = Color("#a5b3b0aa")
const BUS_LABEL_ACTIVE: Color = Color("#d3d6cde6")

static func border_tint(name: String, brightness: float = 1.0) -> Color:
	var strength: float = HUD_GLOW_MULTIPLIER
	if name == "hud_party_card":
		strength *= .70 / .60
	elif name in ["hud_objective_panel", "hud_world_interact_panel"] or name.begins_with("hud_return"):
		strength *= .65 / .60
	return Color(strength * brightness, strength * brightness, strength * brightness, HUD_ALPHA_MULTIPLIER)

static func panel_interior(name: String) -> Color:
	return Color(.025, .06, .09, .66 if name == "hud_objective_panel" else .88) * Color(1, 1, 1, HUD_ALPHA_MULTIPLIER)

static func world_tint(alpha: float, brightness: float = 1.0) -> Color:
	var strength: float = WORLD_MARKER_GLOW_MULTIPLIER * brightness
	return Color(strength, strength * .98, strength * .94, alpha * WORLD_MARKER_ALPHA_MULTIPLIER)

static func return_zone_tint(active: bool) -> Color:
	var strength: float = WORLD_MARKER_GLOW_MULTIPLIER
	return Color(strength * .96, strength, strength * .94, (RETURN_ZONE_ACTIVE_ALPHA if active else RETURN_ZONE_ALPHA) * WORLD_MARKER_ALPHA_MULTIPLIER)
