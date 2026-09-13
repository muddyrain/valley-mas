extends CanvasLayer
## F3 is a live inspector; the existing F1 menu remains the paused command menu.
var mission: Node3D
var label: Label
var geometry: MeshInstance3D
var lines := ImmediateMesh.new()
var refresh_left: float = 0.0
var selected: Node3D

func setup(owner: Node3D) -> void:
	mission = owner
	layer = 30
	var panel := PanelContainer.new()
	panel.position = Vector2(18, 96)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.015, 0.025, 0.04, 0.9)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", style)
	add_child(panel)
	label = Label.new()
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_font_size_override("font_size", 14)
	panel.add_child(label)
	geometry = MeshInstance3D.new()
	geometry.mesh = lines
	geometry.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.vertex_color_use_as_albedo = true
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	geometry.material_override = material
	mission.add_child(geometry)
	visible = false
	geometry.hide()

func _input(event: InputEvent) -> void:
	if not OS.is_debug_build():
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F3:
		visible = not visible
		geometry.visible = visible
		refresh_left = 0
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if not visible or not is_instance_valid(mission):
		return
	refresh_left -= delta
	if refresh_left > 0:
		return
	refresh_left = 0.1
	var counts: Dictionary = {}
	var alive: int = 0
	var senses: int = 0
	var paths: int = 0
	for enemy: Node3D in mission.enemies:
		if enemy.active:
			alive += 1
			var state_name: String = enemy.State.keys()[enemy.state]
			counts[state_name] = int(counts.get(state_name, 0)) + 1
			senses += enemy.perception_queries
			paths += enemy.path_queries
	if is_instance_valid(mission.focus_target) and mission.focus_target.active:
		selected = mission.focus_target
	label.text = "ENCOUNTER [F3]\nAlive Zombies: %d\nInitial Spawn: %d\nDaytime Spawn: %d\nBlue Hour Spawn: %d\nCurrent Phase: %s\nNoise Events: %d (total %d)\nNext Spawn: %.1fs\nSense / Path queries: %d / %d\n%s" % [alive, mission.encounter.initial_spawned, mission.encounter.daytime_spawned, mission.encounter.blue_hour_spawned, mission.clock.encounter_phase_name(), mission.noise.events.size(), mission.noise.total_emitted, mission.spawn_left, senses, paths, str(counts)]
	if is_instance_valid(selected) and selected.active:
		label.text += "\n\nState: %s\nTarget: %s\nInterest: %s\nHeard Noise: %s" % [selected.State.keys()[selected.state], selected.target.data.display_name if is_instance_valid(selected.target) else "None", str(selected.interest_position), selected.heard_noise if not selected.heard_noise.is_empty() else "None"]
	else:
		selected = null
		label.text += "\n\nClick an infected to inspect."
	_draw_ranges()

func _draw_ranges() -> void:
	lines.clear_surfaces()
	if selected == null and mission.noise.events.is_empty():
		return
	lines.surface_begin(Mesh.PRIMITIVE_LINES)
	if selected != null:
		var config: Resource = mission.catalog.map.encounter
		var origin: Vector3 = selected.position + Vector3.UP * .12
		_circle(origin, config.pistol_noise_radius * selected.hearing_scale * config.hearing_multiplier, Color(0.25, 0.65, 1, .5))
		var radius: float = config.visual_range_day * selected.visual_multiplier
		var yaw: float = selected.rig.rotation.y
		var half_angle: float = deg_to_rad(config.visual_fov * .5)
		var previous: Vector3 = origin - Vector3(sin(yaw - half_angle), 0, cos(yaw - half_angle)) * radius
		_segment(origin, previous, Color.YELLOW)
		for step: int in range(1, 33):
			var angle: float = yaw - half_angle + half_angle * 2 * step / 32.0
			var next: Vector3 = origin - Vector3(sin(angle), 0, cos(angle)) * radius
			_segment(previous, next, Color.YELLOW)
			previous = next
		_segment(previous, origin, Color.YELLOW)
	for event: RefCounted in mission.noise.events:
		var progress: float = clampf((mission.noise.elapsed - event.emitted_at) / mission.catalog.map.encounter.noise_lifetime, 0, 1)
		_circle(event.world_position + Vector3.UP * .16, event.radius * lerpf(.15, 1, progress), Color(.25, .7, 1, 1.0 - progress))
	lines.surface_end()

func _circle(center: Vector3, radius: float, color: Color) -> void:
	for step: int in range(64):
		var a: float = TAU * step / 64
		var b: float = TAU * (step + 1) / 64
		_segment(center + Vector3(cos(a), 0, sin(a)) * radius, center + Vector3(cos(b), 0, sin(b)) * radius, color)

func _segment(a: Vector3, b: Vector3, color: Color) -> void:
	lines.surface_set_color(color)
	lines.surface_add_vertex(a)
	lines.surface_set_color(color)
	lines.surface_add_vertex(b)
