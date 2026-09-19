extends Node3D
## Lightweight world feedback layer for Expedition commands.
## All geometry is generated at runtime; no gameplay state lives here.

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
const COMMAND_LINE_COLOR: Color = Color(.30, .80, 1.0, .62)
const Ground = preload("res://maps/expedition/walkable_ground.gd")
var command_lines: Dictionary = {}
var mission: Node3D
var selected_member: Node3D
var selection_ring: MeshInstance3D
var search_feedback: MeshInstance3D
var focus_feedback: MeshInstance3D
var move_pool: Array[MeshInstance3D] = []
var move_cursor := 0
var _time := 0.0
var _selection_fade: Tween

func setup(owner: Node3D) -> void:

	mission = owner
	selection_ring = _make_ring("SelectionRing", 1.7, 0.56, 0.09, Color("#d9f6ff"), 0.0)
	search_feedback = _make_ring("SearchTargetFeedback", 1.5, 0.68, 0.09, Color("#57c8ff"), 0.0)
	focus_feedback = _make_ring("FocusTargetFeedback", 1.45, 0.78, 0.085, Color("#ff9a86"), 1.0)
	search_feedback.visible = false
	focus_feedback.visible = false
	for i in MOVE_POOL_SIZE:
		var marker := _make_ring("MoveClickFeedback%02d" % i, 1.15, 0.55, 0.085, Color("#e3f8ff"), 0.0)
		marker.visible = false
		move_pool.append(marker)

func _process(delta: float) -> void:
	if not is_instance_valid(mission):
		return
	_time += delta
	_update_command_lines(delta)
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
		_selection_fade = create_tween()
		_selection_fade.tween_method(func(value: float): _set_alpha(selection_ring, value), 0.0, 1.0, 0.14)

func play_move_feedback(point: Vector3) -> void:
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

func _update_command_lines(delta: float) -> void:
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
			continue
		_draw_command_line(line, member)

func _draw_command_line(line: Dictionary, member: Node3D) -> void:
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
	var segments: int = maxi(1, ceili(offset.length() / .25))
	mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for index: int in segments:
		var a := start.lerp(end, float(index) / segments)
		var b := start.lerp(end, float(index + 1) / segments)
		for vertex: Vector3 in [a - side, a + side, b + side, a - side, b + side, b - side]:
			mesh.surface_add_vertex(to_local(_ground_point(vertex, .045)))
	mesh.surface_end()
	var material: StandardMaterial3D = view.material_override as StandardMaterial3D
	var color: Color = COMMAND_LINE_COLOR
	color.a *= 1.0 - smoothstep(.2, COMMAND_LINE_SECONDS, float(line.elapsed))
	material.albedo_color = color

func play_search_feedback(point: Vector3) -> void:
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
