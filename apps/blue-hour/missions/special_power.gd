extends RefCounted
const State = preload("res://missions/special_power_state.gd")
const ThreatSelector = preload("res://missions/threat_selector.gd")

var mission: Node3D
var states: Dictionary = {}
var day: int = -1
var focus_target: Node3D

func _init(owner_mission: Node3D) -> void:
	mission = owner_mission
	if mission.campaign != null:
		start_day(mission.campaign.data.day, mission.campaign.equipped_effects("power"))

func start_day(value: int, definitions: Array[Resource]) -> bool:
	if value == day:
		return false
	clear()
	states.clear()
	day = value
	for definition: Resource in definitions:
		states[definition.id] = State.new(definition)
	return true

func can_activate(id: String) -> bool:
	if not states.has(id) or states[id].used_today or not mission.active or not mission.input_enabled or mission.closing_left >= 0 or mission.living().is_empty():
		return false
	var values: Dictionary = states[id].definition.modifiers()
	return not values.has("freeze_day_clock") or mission.clock.phase != mission.clock.NIGHT

func activate(id: String = "") -> bool:
	# The no-argument shortcut is only unambiguous for a single equipped power.
	if id.is_empty() and states.size() == 1:
		id = states.keys()[0]
	if not can_activate(id):
		return false
	var state: RefCounted = states[id]
	state.used_today = true
	state.remaining_duration = state.definition.active_duration()
	state.active = state.remaining_duration > 0
	var values: Dictionary = state.definition.modifiers()
	if state.active:
		mission.effects.set_source("power:" + id, values)
	if values.has("heal_fraction"):
		for member: Node3D in mission.living():
			member.hp = minf(member.data.max_hp, member.hp + member.data.max_hp * float(values.heal_fraction))
	refresh_target()
	mission.notice.emit(state.definition.display_name + " · " + state.definition.description())
	return true

func advance(delta: float) -> void:
	for state: RefCounted in states.values():
		if not state.active:
			continue
		state.remaining_duration = maxf(0.0, state.remaining_duration - maxf(0.0, delta))
		if state.remaining_duration <= 0:
			state.active = false
			mission.effects.remove_source("power:" + state.power_id)
	refresh_target()

func next_expiry() -> float:
	var seconds := INF
	for state: RefCounted in states.values():
		if state.active:
			seconds = minf(seconds, state.remaining_duration)
	return seconds

func clear() -> void:
	for state: RefCounted in states.values():
		state.active = false
		state.remaining_duration = 0.0
		mission.effects.remove_source("power:" + state.power_id)
	focus_target = null

func refresh_target() -> void:
	focus_target = ThreatSelector.select(mission.enemies, mission.squad_center()) if mission.effects.amount("focus_damage") > 0 else null

func target() -> Node3D:
	if not is_instance_valid(focus_target) or not focus_target.active:
		refresh_target()
	return focus_target

func caption(id: String) -> String:
	if not states.has(id):
		return ""
	var state: RefCounted = states[id]
	var title: String = state.definition.display_name + (" ★" if state.upgraded else "")
	if state.active:
		return "%s · %.1f 秒" % [title, state.remaining_duration]
	return title + (" · 本日已用" if state.used_today else " · 1/1")
