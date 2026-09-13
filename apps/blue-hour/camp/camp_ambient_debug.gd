extends Node3D
## Opt-in world diagnostics; no changes to the Camp HUD.
var director: Node
var _lines := ImmediateMesh.new()
var _labels: Dictionary = {}
var _elapsed := 0.0

func setup(ambient: Node) -> void:
	director = ambient
	var instance := MeshInstance3D.new()
	instance.mesh = _lines
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.vertex_color_use_as_albedo = true
	material.no_depth_test = true
	instance.material_override = material
	add_child(instance)
	for id: String in director.camp.members:
		var label := Label3D.new()
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.no_depth_test = true
		label.font_size = 32
		label.pixel_size = 0.008
		add_child(label)
		_labels[id] = label

func _process(delta: float) -> void:
	if not is_instance_valid(director):
		return
	_elapsed += delta
	if _elapsed < 0.10:
		return
	_elapsed = 0.0
	_lines.clear_surfaces()
	_lines.surface_begin(Mesh.PRIMITIVE_LINES)
	for poi: Dictionary in director.pois:
		var color := Color.LIME_GREEN if poi.enabled else Color.INDIAN_RED
		if director.reservations.has(poi.id):
			color = Color.ORANGE
		var center: Vector3 = poi.position + Vector3.UP * 0.08
		for index: int in range(32):
			var a := TAU * index / 32.0
			var b := TAU * (index + 1) / 32.0
			_line(center + Vector3(cos(a), 0, sin(a)) * poi.safe_radius,
					center + Vector3(cos(b), 0, sin(b)) * poi.safe_radius, color)
		_line(center, center + Vector3.UP * 0.6, color)
		_line(center, center + (Vector3(poi.facing) - Vector3(poi.position)).normalized() * 0.65, color)
	for id: String in director.camp.members:
		var actor: Node3D = director.camp.members[id]
		var label: Label3D = _labels[id]
		label.global_position = actor.global_position + Vector3.UP * 2.0
		label.text = "%s\n%s -> %s\nstuck %.2fs / repath %d" % [id, director.state_for(id),
			director.poi_for(id), director.stuck_for(id), director.repath_count[id]]
		var path: PackedVector3Array = actor.agent.get_current_navigation_path()
		if actor.moving:
			for index: int in range(1, path.size()):
				_line(path[index - 1] + Vector3.UP * 0.1, path[index] + Vector3.UP * 0.1, Color.CYAN)
			_line(actor.global_position + Vector3.UP * 0.15, actor.destination + Vector3.UP * 0.15, Color.YELLOW)
	_lines.surface_end()

func _line(a: Vector3, b: Vector3, color: Color) -> void:
	_lines.surface_set_color(color)
	_lines.surface_add_vertex(a)
	_lines.surface_set_color(color)
	_lines.surface_add_vertex(b)
