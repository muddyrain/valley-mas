extends Node3D
## Lightweight world feedback layer for Expedition commands.
## All geometry is generated at runtime; no gameplay state lives here.
const Visuals = preload("res://vfx/visuals.gd")
const HudArt = preload("res://ui/expedition/hud_skin.gd")

const RING_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_add;
uniform vec4 tint : source_color = vec4(0.35, 0.82, 1.0, 1.0);
uniform float radius = 0.5;
uniform float width = 0.08;
uniform float pulse = 0.0;
uniform float focus_mode = 0.0;
uniform float opacity = 1.0;
void fragment() {
    vec2 p = UV - vec2(0.5);
    float d = length(p) * 2.0;
    float edge = 1.0 - smoothstep(width * 0.58, width, abs(d - radius));
    float soft = 1.0 - smoothstep(width, width * 2.5, abs(d - radius));
    float ring = max(edge, soft * 0.24);
    float breathe = 0.94 + 0.06 * sin(pulse * 4.18879);
    float alpha = ring * breathe * opacity;
    if (focus_mode > 0.5) {
        float angle = atan(p.y, p.x);
        float sector = abs(cos(angle * 2.0));
        float ticks = smoothstep(0.86, 0.98, sector) * smoothstep(0.42, 0.18, abs(d - radius * 0.72));
        alpha = max(alpha * 0.74, ticks * opacity);
    }
    if (alpha < 0.002) { discard; }
    ALBEDO = tint.rgb;
    ALPHA = alpha * tint.a;
}
"""

const MOVE_POOL_SIZE := 6
const COMMAND_LINE_SECONDS: float = .8
const COMMAND_LINE_WIDTH: float = .035
const COMMAND_LINE_UPDATE_INTERVAL: float = 1.0 / 20.0
const COMMAND_LINE_SEGMENT_LENGTH: float = 1.0
const COMMAND_LINE_COLOR: Color = Color(.30, .80, 1.0, .62)
const COMMAND_ARROW_LENGTH: float = .24
const COMMAND_ARROW_WIDTH: float = .16
const SEARCH_COMPLETE_COLOR: Color = Color(.72, .96, .92, .92)
const LOOT_FOOD_COLOR: Color = Color("#f6d58c")
const LOOT_SCRAP_COLOR: Color = Color("#a9d7e2")
const LOOT_WEAPON_COLOR: Color = Color("#c6b5ff")
const LOOT_FEEDBACK_SECONDS: float = 1.5
const Ground = preload("res://maps/expedition/walkable_ground.gd")
var command_lines: Dictionary = {}
var mission: Node3D
var selected_member: Node3D
var selection_ring: MeshInstance3D
var search_feedback: MeshInstance3D
var focus_feedback: MeshInstance3D
var search_complete_feedback: MeshInstance3D
var move_pool: Array[MeshInstance3D] = []
var move_cursor := 0
var _time := 0.0
var _selection_fade: Tween
var command_visual_update_count: int = 0
var _command_line_update_elapsed: float = COMMAND_LINE_UPDATE_INTERVAL

func setup(owner: Node3D) -> void:

	mission = owner
	selection_ring = _make_ring("SelectionRing", 1.7, 0.56, 0.09, Color("#d9f6ff"), 0.0)
	search_feedback = _make_ring("SearchTargetFeedback", 1.5, 0.68, 0.09, Color("#57c8ff"), 0.0)
	search_complete_feedback = _make_ring("SearchCompleteFeedback", 1.65, 0.72, 0.08, SEARCH_COMPLETE_COLOR, 1.0)
	focus_feedback = _make_ring("FocusTargetFeedback", 1.45, 0.78, 0.085, Color("#ff9a86"), 1.0)
	search_feedback.visible = false
	search_complete_feedback.visible = false
	focus_feedback.visible = false
	for i in MOVE_POOL_SIZE:
		var marker := _make_ring("MoveClickFeedback%02d" % i, 1.15, 0.55, 0.085, Color("#e3f8ff"), 1.0)
		marker.visible = false
		move_pool.append(marker)

func _process(delta: float) -> void:
	if not is_instance_valid(mission):
		return
	_time += delta
	_advance_command_lines(delta)
	_command_line_update_elapsed += delta
	if _command_line_update_elapsed >= COMMAND_LINE_UPDATE_INTERVAL:
		_redraw_command_lines()
		_command_line_update_elapsed = fmod(_command_line_update_elapsed, COMMAND_LINE_UPDATE_INTERVAL)
	if is_instance_valid(selected_member):
		var valid: bool = not selected_member.dead and not selected_member.inside_building and not selected_member.boarding
		selection_ring.visible = valid
		if valid:
			selection_ring.global_position = _ground_point(selected_member.global_position)
			_set_pulse(selection_ring, _time)
	else:
		selection_ring.visible = false
	if search_feedback.visible:
		_set_pulse(search_feedback, _time)
	if search_complete_feedback.visible:
		_set_pulse(search_complete_feedback, _time)
	if focus_feedback.visible:
		var target: Node3D = mission.focus_target
		var valid_focus: bool = is_instance_valid(target) and target.active and mission.exploration.is_visible(target.position)
		focus_feedback.visible = valid_focus
		if valid_focus:
			focus_feedback.global_position = _ground_point(target.global_position)
			_set_pulse(focus_feedback, _time)

func set_selected_member(member: Node3D) -> void:
	if selected_member == member:
		return
	var previous := selected_member
	selected_member = member
	if _selection_fade != null:
		_selection_fade.kill()
	if is_instance_valid(previous) and is_instance_valid(member):
		_set_alpha(selection_ring, 0.0)
	selection_ring.scale = Vector3.ONE * 0.78
	_selection_fade = create_tween().set_parallel(true)
	_selection_fade.tween_method(func(value: float): _set_alpha(selection_ring, value), 0.0, 1.0, 0.14)
	_selection_fade.tween_property(selection_ring, "scale", Vector3.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func play_move_feedback(point: Vector3) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	var marker := move_pool[move_cursor]
	move_cursor = (move_cursor + 1) % move_pool.size()
	var tween: Tween = marker.get_meta("vfx_tween") as Tween if marker.has_meta("vfx_tween") else null
	if tween != null:
		tween.kill()
	marker.global_position = _ground_point(point, .025)
	marker.visible = true
	marker.scale = Vector3.ONE * 0.42
	_set_alpha(marker, 0.0)
	tween = create_tween().set_parallel(true)
	tween.tween_property(marker, "scale", Vector3.ONE * 1.05, 0.16).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_method(func(value: float): _set_alpha(marker, value), 0.0, 0.98, 0.10)
	tween.chain().tween_interval(0.08)
	tween.chain().tween_method(func(value: float): _set_alpha(marker, value), 0.98, 0.0, 0.30)
	tween.chain().tween_callback(marker.hide)
	marker.set_meta("vfx_tween", tween)

func play_command_line(member: Node3D, point: Vector3, search_order: bool = false) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	# Reuse one short-lived ribbon per recipient during held steering.
	var id: int = member.get_instance_id()
	if not command_lines.has(id):
		var view := MeshInstance3D.new()
		view.name = "CommandLine"
		view.mesh = ImmediateMesh.new()
		view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.cull_mode = BaseMaterial3D.CULL_DISABLED
		material.albedo_color = COMMAND_LINE_COLOR
		view.material_override = material
		add_child(view)
		command_lines[id] = {"member": weakref(member), "view": view, "target": point, "elapsed": 0.0}
	var line: Dictionary = command_lines[id]
	line.target = point
	line.search_order = search_order
	line.elapsed = 0.0
	_draw_command_line(line, member)

func _advance_command_lines(delta: float) -> void:
	for id: int in command_lines.keys():
		var line: Dictionary = command_lines[id]
		line.elapsed += delta
		var member: Node3D = line.member.get_ref() as Node3D
		if not is_instance_valid(member) or line.elapsed >= COMMAND_LINE_SECONDS:
			line.view.queue_free()
			command_lines.erase(id)
			continue
		var task: RefCounted = mission.task_for(member)
		var approaching: bool = line.get("search_order", false) and task != null and not task.search_started
		if member.dead or member.boarding or member.inside_building or (task != null and not approaching):
			line.view.queue_free()
			command_lines.erase(id)

func _redraw_command_lines() -> void:
	for id: int in command_lines:
		var line: Dictionary = command_lines[id]
		var member: Node3D = line.member.get_ref() as Node3D
		if not is_instance_valid(member):
			continue
		_draw_command_line(line, member)

func _draw_command_line(line: Dictionary, member: Node3D) -> void:
	command_visual_update_count += 1
	var view: MeshInstance3D = line.view
	var mesh: ImmediateMesh = view.mesh as ImmediateMesh
	var start: Vector3 = member.global_position
	var end: Vector3 = mission.to_global(line.target)
	var offset: Vector3 = end - start
	offset.y = 0
	mesh.clear_surfaces()
	if offset.length_squared() < .0025:
		return
	var side: Vector3 = offset.normalized().cross(Vector3.UP) * COMMAND_LINE_WIDTH * .5
	var segments: int = maxi(1, ceili(offset.length() / COMMAND_LINE_SEGMENT_LENGTH))
	mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for index: int in segments:
		var a: Vector3 = _ground_point(start.lerp(end, float(index) / segments), .045)
		var b: Vector3 = _ground_point(start.lerp(end, float(index + 1) / segments), .045)
		for vertex: Vector3 in [a - side, a + side, b + side, a - side, b + side, b - side]:
			mesh.surface_add_vertex(to_local(vertex))
	var direction: Vector3 = offset.normalized()
	var arrow_tip: Vector3 = _ground_point(end, .06)
	var arrow_base: Vector3 = _ground_point(end - direction * COMMAND_ARROW_LENGTH, .06)
	var arrow_side: Vector3 = direction.cross(Vector3.UP).normalized() * COMMAND_ARROW_WIDTH * .5
	mesh.surface_add_vertex(to_local(arrow_tip))
	mesh.surface_add_vertex(to_local(arrow_base + arrow_side))
	mesh.surface_add_vertex(to_local(arrow_base - arrow_side))
	var flow_phase: float = fmod(float(line.elapsed) * 1.8, 1.0)
	for progress: float in [0.42 + flow_phase * .12, 0.70 + flow_phase * .10]:
		if progress >= .88:
			continue
		var flow_center: Vector3 = _ground_point(start.lerp(end, progress), .055)
		var flow_tip: Vector3 = flow_center + direction * .09
		var flow_base: Vector3 = flow_center - direction * .07
		var flow_side: Vector3 = direction.cross(Vector3.UP).normalized() * .05
		mesh.surface_add_vertex(to_local(flow_tip))
		mesh.surface_add_vertex(to_local(flow_base + flow_side))
		mesh.surface_add_vertex(to_local(flow_base - flow_side))
	mesh.surface_end()
	var material: StandardMaterial3D = view.material_override as StandardMaterial3D
	var color: Color = COMMAND_LINE_COLOR
	color.a *= 1.0 - smoothstep(.2, COMMAND_LINE_SECONDS, float(line.elapsed))
	color.a *= .92 + .08 * sin(float(line.elapsed) * TAU / .24)
	material.albedo_color = color

func play_search_feedback(point: Vector3) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	search_feedback.global_position = _ground_point(point)
	search_feedback.visible = true
	search_feedback.scale = Vector3.ONE * 0.72
	_set_alpha(search_feedback, 0.0)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(search_feedback, "scale", Vector3.ONE, 0.28).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_method(func(value: float): _set_alpha(search_feedback, value), 0.0, 0.9, 0.2)
	tween.chain().tween_interval(0.38)
	tween.chain().tween_method(func(value: float): _set_alpha(search_feedback, value), 0.9, 0.0, 0.3)
	tween.chain().tween_callback(search_feedback.hide)

func play_search_complete(point: Vector3) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	if search_complete_feedback.has_meta("vfx_tween"):
		var previous: Tween = search_complete_feedback.get_meta("vfx_tween") as Tween
		if previous != null:
			previous.kill()
	search_complete_feedback.global_position = _ground_point(point, .04)
	search_complete_feedback.scale = Vector3.ONE * .56
	search_complete_feedback.visible = true
	_set_alpha(search_complete_feedback, 0.0)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(search_complete_feedback, "scale", Vector3.ONE * 1.18, 0.20).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_method(func(value: float): _set_alpha(search_complete_feedback, value), 0.0, 1.0, 0.12)
	tween.chain().tween_interval(0.16)
	tween.chain().tween_property(search_complete_feedback, "scale", Vector3.ONE * .92, .24)
	tween.chain().tween_method(func(value: float): _set_alpha(search_complete_feedback, value), 1.0, 0.0, 0.24)
	tween.chain().tween_callback(search_complete_feedback.hide)
	search_complete_feedback.set_meta("vfx_tween", tween)

func play_loot_feedback(point: Vector3, loot: Dictionary) -> void:
	if not bool(get_meta("p02_dynamic_enabled", true)):
		return
	var entries: PackedStringArray = []
	if int(loot.get("food", 0)) > 0:
		entries.append("+食物 %d" % int(loot.food))
	if int(loot.get("scrap", 0)) > 0:
		entries.append("+废料 %d" % int(loot.scrap))
	if not loot.get("weapon", {}).is_empty():
		entries.append("+武器")
	if entries.is_empty():
		return
	var has_weapon: bool = not loot.get("weapon", {}).is_empty()
	var label_color: Color = LOOT_WEAPON_COLOR if has_weapon else LOOT_FOOD_COLOR if int(loot.get("food", 0)) > 0 else LOOT_SCRAP_COLOR
	var icon_name: String = "weapon_ranged" if has_weapon else "icon_bag" if int(loot.get("food", 0)) > 0 else "icon_loot"
	var loot_group := Node3D.new()
	loot_group.name = "LootFeedback"
	add_child(loot_group)
	loot_group.global_position = _reward_feedback_origin(point)
	loot_group.set_meta("lifetime", LOOT_FEEDBACK_SECONDS)
	var icon := Sprite3D.new()
	icon.texture = HudArt.texture(icon_name)
	icon.pixel_size = .0034
	icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	icon.no_depth_test = true
	icon.modulate = label_color
	icon.position = Vector3(-.31, 0, 0)
	loot_group.add_child(icon)
	var label: Label3D = Visuals.label(loot_group, " · ".join(entries), Vector3(.06, 0, 0), label_color, 24)
	label.pixel_size = .014
	label.outline_size = 2
	loot_group.scale = Vector3.ONE * .64
	var tween := create_tween().set_parallel(true)
	tween.tween_property(loot_group, "global_position", loot_group.global_position + Vector3.UP * .5,
		LOOT_FEEDBACK_SECONDS).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_property(loot_group, "scale", Vector3.ONE * .78, .14).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.tween_property(label, "modulate:a", 0.0, .32).set_delay(LOOT_FEEDBACK_SECONDS - .32)
	tween.tween_property(icon, "modulate:a", 0.0, .32).set_delay(LOOT_FEEDBACK_SECONDS - .32)
	tween.chain().tween_callback(loot_group.queue_free)

func _reward_feedback_origin(fallback: Vector3) -> Vector3:
	var nearest: Node3D
	var nearest_distance: float = INF
	if mission != null and mission.has_method("living"):
		for member: Node3D in mission.living():
			if member.inside_building:
				continue
			var distance: float = member.global_position.distance_squared_to(fallback)
			if distance < nearest_distance:
				nearest = member
				nearest_distance = distance
	if not is_instance_valid(nearest):
		return _ground_point(fallback) + Vector3.UP * 1.15
	var side := Vector3.RIGHT
	if is_instance_valid(mission.camera):
		side = mission.camera.global_basis.x
		side.y = 0.0
		side = side.normalized() if side.length_squared() > 0.001 else Vector3.RIGHT
	return nearest.global_position + side * .62 + Vector3.UP * 1.25

func set_focus_target(target: Node3D) -> void:
	if not is_instance_valid(target):
		focus_feedback.visible = false
		return
	focus_feedback.global_position = _ground_point(target.global_position)
	focus_feedback.scale = Vector3.ONE * 0.8
	focus_feedback.visible = true
	_set_alpha(focus_feedback, 0.0)
	var tween := create_tween()
	tween.tween_method(func(value: float): _set_alpha(focus_feedback, value), 0.0, 1.0, 0.16)

func clear_focus() -> void:
	focus_feedback.visible = false

func _ground_point(point: Vector3, legacy_clearance: float = .03) -> Vector3:
	if mission != null and mission.city.has_method("project_to_ground"):
		var projected: Vector3 = mission.city.project_to_ground(point)
		if projected.is_finite():
			return projected + Vector3.UP * Ground.MARKER_CLEARANCE
	return point + Vector3.UP * legacy_clearance

func _make_ring(node_name: String, size: float, radius: float, width: float, color: Color, focus: float) -> MeshInstance3D:
	var view := MeshInstance3D.new()
	view.name = node_name
	var plane := QuadMesh.new()
	plane.size = Vector2.ONE * size
	view.mesh = plane
	view.rotation.x = -PI * 0.5
	view.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var shader := Shader.new()
	shader.code = RING_SHADER
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("tint", color)
	material.set_shader_parameter("radius", radius)
	material.set_shader_parameter("width", width)
	material.set_shader_parameter("focus_mode", focus)
	material.set_shader_parameter("opacity", 1.0)
	view.material_override = material
	add_child(view)
	return view

func _set_pulse(view: MeshInstance3D, value: float) -> void:
	var material := view.material_override as ShaderMaterial
	if material != null:
		material.set_shader_parameter("pulse", value)

func _set_alpha(view: MeshInstance3D, alpha: float) -> void:
	var material := view.material_override as ShaderMaterial
	if material == null:
		return
	material.set_shader_parameter("opacity", alpha)
