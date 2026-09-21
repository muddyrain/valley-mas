extends RefCounted
# Only an unhandled ground press starts steering. Releases are observed even over UI.
var mission: Node3D
var pointer := Vector2.ZERO
var keys: Dictionary = {}
var following := false
var dragging := false
var aiming := false
var follow_left := 0.0

func _init(owner: Node3D) -> void:
	mission = owner

func reset() -> void:
	keys.clear()
	following = false
	dragging = false
	aiming = false
	mission.end_aim()

func observe(event: InputEvent) -> void:
	if event is InputEventMouse:
		pointer = event.position
	if event is InputEventKey and not event.pressed:
		keys.erase(event.physical_keycode)
		if event.physical_keycode == KEY_CTRL:
			aiming = false
			mission.end_aim()
	if event is InputEventMouseButton and not event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			following = false
		if event.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			dragging = false
	if event is InputEventMouseMotion and dragging and mission.input_enabled:
		mission.pan_camera(-event.relative * mission.camera.size / mission.get_viewport().get_visible_rect().size.y)

func ground_point() -> Variant:
	var ray: Vector3 = mission.camera.project_ray_normal(pointer)
	return Plane(Vector3.UP, 0).intersects_ray(mission.camera.project_ray_origin(pointer), ray)

func over_ui() -> bool:
	return mission.get_viewport().gui_get_hovered_control() != null

func handle(event: InputEvent) -> void:
	if not mission.input_enabled or not mission.active or mission.closing_left >= 0:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		keys[event.physical_keycode] = true
		if event.physical_keycode in [KEY_X, KEY_E, KEY_F, KEY_R]:
			following = false
			aiming = false
		match event.physical_keycode:
			KEY_CTRL:
				aiming = true
				update(0)
			KEY_X: mission.command_stop()
			KEY_E: mission.command_extract()
			KEY_F: mission.command_focus_nearest()
			KEY_R: mission.command_recall_all()
	if not event is InputEventMouseButton or not event.pressed:
		return
	pointer = event.position
	if event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
		if over_ui():
			return
		mission.camera_controller.zoom(-3.0 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 3.0)
		return
	if event.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
		dragging = true
		return
	if event.button_index != MOUSE_BUTTON_LEFT or aiming:
		return
	# World clicks dismiss inspection; clicking a POI below selects it again.
	mission.poi_selected_id = ""
	var origin: Vector3 = mission.camera.project_ray_origin(pointer)
	var query := PhysicsRayQueryParameters3D.create(origin, origin + mission.camera.project_ray_normal(pointer) * 200, 3)
	query.collide_with_areas = true
	var hit: Dictionary = mission.get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var collider: Object = hit.collider
	if collider.has_meta("site_id"):
		var id: String = collider.get_meta("site_id")
		if mission.city.sites.has(id) and mission.city.sites[id].discovered:
			mission.command_search(id, mission.selected_search_member)
	elif collider.has_meta("bus"):
		mission.command_extract()
	elif collider.has_meta("enemy"):
		mission.command_focus(collider.get_meta("enemy"))
	else:
		following = mission.command_move(hit.position)
		follow_left = 0.08

func update(delta: float) -> void:
	if not mission.active or not mission.input_enabled or mission.closing_left >= 0:
		reset()
		return
	var movement := Vector2(float(keys.has(KEY_D)) - float(keys.has(KEY_A)), float(keys.has(KEY_S)) - float(keys.has(KEY_W)))
	if movement.length() > 0:
		mission.pan_camera(movement.normalized() * delta * 22)
	if over_ui() or dragging:
		mission.end_aim()
		return
	var point = ground_point()
	if point == null:
		mission.end_aim()
		return
	if aiming:
		mission.command_aim(point)
	elif following:
		follow_left -= delta
		if follow_left <= 0:
			follow_left = 0.08
			if mission.rally_point.distance_to(point) > 0.65:
				mission.command_move(point)
