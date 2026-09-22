extends RefCounted
## Expedition owns interactions; the generated Town and its instances stay read-only.
const Catalog = preload("res://data/world_asset_catalog.gd")
const Loot = preload("res://maps/generation/loot_spawner.gd")
const HudMarker = preload("res://ui/expedition/world_marker.gd")
const Visuals = preload("res://vfx/visuals.gd")
const UNRESOLVED: String = "UNRESOLVED"
const RESOLVED_REACHABLE: String = "RESOLVED_REACHABLE"
const RESOLVED_UNREACHABLE: String = "RESOLVED_UNREACHABLE"

var building_searchables: Array[String] = []
var vehicle_searchables: Array[String] = []
var rejected: Dictionary = {}
var metrics: Dictionary = {}
var _mission: WeakRef
var _layer: Node3D
var _pending_resolution: Array[String] = []
var _background_started_usec: int = 0

func setup(mission: Node3D) -> void:
	var started: int = Time.get_ticks_usec()
	_mission = weakref(mission)
	_layer = Node3D.new()
	_layer.name = "ExpeditionSearchables"
	mission.add_child(_layer)
	var allowed: Dictionary = {}
	for item: Dictionary in mission.runtime_data.building_search_points:
		allowed[str(item.id)] = true
	for item: Dictionary in mission.runtime_data.building_entries:
		var id: String = str(item.id)
		var body: Node3D = mission.city.get_node_or_null("Buildings/" + id)
		if not allowed.has(id):
			rejected[id] = "NOT_SEARCHABLE"
			continue
		_register(id, Catalog.asset(str(item.asset)), body, item.search_interaction, false,
			item.primary_entrance, item.primary_entrance_forward)
	# Environment placement alone is not a gameplay opt-in. Require the same
	# explicit lootable contract used by the existing VehicleSpawner.
	var environment: Node3D = mission.runtime_data.environment_root
	var decorative_vehicles: int = 0
	for body: Node in environment.get_children():
		if not body is Node3D or not body.has_meta("environment_slot"):
			continue
		var definition: Resource = Catalog.asset(str(body.get("asset_id")))
		if definition == null or definition.category != "vehicles":
			continue
		var id: String = str(body.name)
		if not bool(body.get_meta("lootable", false)):
			rejected[id] = "NOT_SEARCHABLE"
			decorative_vehicles += 1
			continue
		var anchor: Node3D = body.get_node_or_null("Anchors/EntranceAnchor")
		if anchor == null:
			rejected[id] = "MISSING_INTERACTION_POINT"
			continue
		var entrance: Vector3 = mission.city.to_local(anchor.global_position)
		_register(id, definition, body, entrance, true, entrance, Vector3.ZERO)
	metrics = {"registration_ms": (Time.get_ticks_usec() - started) / 1000.0,
		"building_count": building_searchables.size(), "vehicle_count": vehicle_searchables.size(),
		"decorative_vehicle_count": decorative_vehicles}

static func definition_status(definition: Resource) -> String:
	if definition == null or not definition.searchable:
		return "NOT_SEARCHABLE"
	if not Loot.PROFILES.has(definition.loot_profile):
		return "MISSING_PROFILE"
	return "AVAILABLE"

func _register(id: String, definition: Resource, body: Node3D, search_interaction: Vector3, vehicle: bool,
		primary_entrance: Vector3, primary_entrance_forward: Vector3) -> void:
	var mission: Node3D = _mission.get_ref()
	var status: String = definition_status(definition)
	if status != "AVAILABLE" or body == null:
		rejected[id] = status if body != null else "MISSING_INSTANCE"
		return
	if mission.city.sites.has(id):
		rejected[id] = "DUPLICATE_RUNTIME_ID"
		return
	var spec: Dictionary = {"id": id, "asset": definition.id,
		"name": definition.display_name if not definition.display_name.is_empty() else definition.id,
		"entry": search_interaction, "entrance_point": primary_entrance,
		"search_interaction_point": search_interaction, "primary_entrance_forward": primary_entrance_forward,
		"pos": body.position,
		"poi_type": definition.poi_type, "category": definition.category,
		"runtime_search": true, "search_status": UNRESOLVED}
	Loot.apply(spec, definition.loot_profile)
	var root := Node3D.new()
	root.name = "Search_" + id
	_layer.add_child(root)
	var ring: Node3D = HudMarker.create(root, "world_interact_marker", .7, search_interaction + Vector3.UP)
	ring.hide()
	var anchor := Marker3D.new()
	root.add_child(anchor)
	anchor.name = "SearchUIAnchor"
	var ui_anchor: Dictionary = _resolve_search_ui_anchor(body, search_interaction,
		primary_entrance, primary_entrance_forward, vehicle)
	anchor.global_position = ui_anchor.position
	# The former AABB wireframe was a debug-shaped cue. Discoverability now uses
	# a small world marker at the authored UI anchor instead.
	var highlight: MeshInstance3D = null
	var discover_point: MeshInstance3D = HudMarker.create(root, "world_discover_marker", .46, Vector3.ZERO)
	discover_point.name = "SearchDiscoverPoint"
	discover_point.global_position = anchor.global_position
	discover_point.hide()
	Visuals.hit_area(root, "site_id", id, 1.1)
	var entrance_hit: Node3D = root.get_child(root.get_child_count() - 1)
	entrance_hit.position = search_interaction
	# Independent ray-only proxies let a click on the actual model resolve its
	# site, without binding metadata or adding children to frozen Town instances.
	for original: Node in body.find_children("*", "CollisionShape3D", true, false):
		if not original.get_parent() is StaticBody3D or original.disabled or original.shape == null:
			continue
		var hit := Area3D.new()
		hit.collision_layer = 2
		hit.collision_mask = 0
		hit.set_meta("site_id", id)
		root.add_child(hit)
		hit.global_transform = original.global_transform
		var shape := CollisionShape3D.new()
		shape.shape = original.shape
		shape.scale = Vector3.ONE * 1.01
		hit.add_child(shape)
	mission.city.sites[id] = {"spec": spec, "progress": 0.0, "searched": false,
		"discovered": false, "ring": ring, "body": body, "vehicle": vehicle,
		"search_anchor": anchor, "search_ui_anchor": anchor, "search_ui_anchor_source": ui_anchor.source,
		"highlight": highlight, "discover_point": discover_point, "entrance_hit": entrance_hit}
	if vehicle:
		vehicle_searchables.append(id)
	else:
		building_searchables.append(id)

func resolve_navigation() -> void:
	var started: int = Time.get_ticks_usec()
	var mission: Node3D = _mission.get_ref()
	var origin: Vector3 = mission.city.spawn_positions(1)[0]
	for id: String in building_searchables + vehicle_searchables:
		_resolve_navigation_site(mission, origin, id)
	_record_resolution(started)

func start_background_resolution() -> void:
	_pending_resolution.clear()
	for id: String in building_searchables + vehicle_searchables:
		if _status(id) == UNRESOLVED:
			_pending_resolution.append(id)
	_background_started_usec = Time.get_ticks_usec()
	metrics["background_total"] = _pending_resolution.size()
	metrics["background_resolved"] = 0
	metrics["background_complete"] = _pending_resolution.is_empty()
	metrics["background_compute_ms"] = 0.0

func resolve_navigation_background(budget_ms: float = 6.0) -> void:
	if _pending_resolution.is_empty():
		return
	var mission: Node3D = _mission.get_ref()
	if mission == null or not bool(mission.runtime_data.get("navigation_available", false)):
		return
	var origin: Vector3 = mission.city.spawn_positions(1)[0]
	var batch_started: int = Time.get_ticks_usec()
	var resolved: int = 0
	while not _pending_resolution.is_empty():
		var id: String = _pending_resolution.pop_front()
		_resolve_navigation_site(mission, origin, id)
		resolved += 1
		if resolved >= 1 and (Time.get_ticks_usec() - batch_started) / 1000.0 >= budget_ms:
			break
	var elapsed_ms: float = (Time.get_ticks_usec() - batch_started) / 1000.0
	metrics["background_compute_ms"] = float(metrics.get("background_compute_ms", 0.0)) + elapsed_ms
	metrics["max_resolve_batch_ms"] = maxf(float(metrics.get("max_resolve_batch_ms", 0.0)), elapsed_ms)
	metrics["background_resolved"] = int(metrics.background_total) - _pending_resolution.size()
	if _pending_resolution.is_empty():
		_complete_background_resolution(mission)

func resolve_priority(id: String) -> String:
	var mission: Node3D = _mission.get_ref()
	if mission == null or not mission.city.sites.has(id):
		return RESOLVED_UNREACHABLE
	if _status(id) == UNRESOLVED:
		var started: int = Time.get_ticks_usec()
		_resolve_navigation_site(mission, mission.city.spawn_positions(1)[0], id)
		_pending_resolution.erase(id)
		metrics["priority_resolve_count"] = int(metrics.get("priority_resolve_count", 0)) + 1
		var elapsed_ms: float = (Time.get_ticks_usec() - started) / 1000.0
		metrics["priority_resolve_ms"] = float(metrics.get("priority_resolve_ms", 0.0)) + elapsed_ms
		metrics["background_compute_ms"] = float(metrics.get("background_compute_ms", 0.0)) + elapsed_ms
		metrics["background_resolved"] = int(metrics.get("background_total", 0)) - _pending_resolution.size()
		if _pending_resolution.is_empty():
			_complete_background_resolution(mission)
	return _status(id)

func background_complete() -> bool:
	return bool(metrics.get("background_complete", false))

func unresolved_count() -> int:
	return _pending_resolution.size()

func _resolve_navigation_site(mission: Node3D, origin: Vector3, id: String) -> void:
	var site: Dictionary = mission.city.sites[id]
	if str(site.spec.search_status) != UNRESOLVED:
		return
	var entrance: Vector3 = site.spec.search_interaction_point
	# At most 2 m from the authored entrance; never search from the center
	# or ask navigation to cross collision to reach a marker.
	var point: Vector3 = mission.city.navigation.nearest(entrance, 2.0)
	if not point.is_finite() or mission.city.path(origin, point).is_empty():
		site.spec.search_status = RESOLVED_UNREACHABLE
		rejected[id] = site.spec.search_status
		return
	site.spec.entry = point
	site.spec.search_status = RESOLVED_REACHABLE
	rejected.erase(id)
	site.ring.position = point + Vector3.UP
	site.entrance_hit.position = point

func _record_resolution(started: int) -> void:
	metrics.navigation_resolve_ms = (Time.get_ticks_usec() - started) / 1000.0
	metrics.resolve_mean_ms = metrics.navigation_resolve_ms / maxi(1, building_searchables.size() + vehicle_searchables.size())
	metrics.build_ms = metrics.registration_ms + metrics.navigation_resolve_ms

func _complete_background_resolution(mission: Node3D) -> void:
	if bool(metrics.get("background_complete", false)):
		return
	metrics["background_complete"] = true
	_record_resolution(_background_started_usec)
	if mission.load_profile != null:
		mission.load_profile.stages["search_navigation_resolve"] = metrics.background_compute_ms
		mission.load_profile.measure("search_navigation_resolve_background_elapsed", _background_started_usec)

func _status(id: String) -> String:
	var mission: Node3D = _mission.get_ref()
	if mission == null or not mission.city.sites.has(id):
		return RESOLVED_UNREACHABLE
	return str(mission.city.sites[id].spec.search_status)

func snapshot(id: String) -> Dictionary:
	var mission: Node3D = _mission.get_ref()
	if mission == null or not mission.city.sites.has(id):
		return {}
	var site: Dictionary = mission.city.sites[id]
	var state: Dictionary = mission.search_target_state(id)
	return {"runtime_id": id, "source_definition_id": site.spec.asset,
		"search_type": "vehicle" if site.vehicle else "building", "world_position": site.body.position,
		"interaction_point": site.spec.entry, "entrance_point": site.spec.entrance_point,
		"search_interaction_point": site.spec.search_interaction_point,
		"search_ui_anchor": site.search_ui_anchor.global_position,
		"search_ui_anchor_source": site.search_ui_anchor_source,
		"primary_entrance_forward": site.spec.primary_entrance_forward,
		"search_duration": site.spec.search_seconds, "loot_profile": site.spec.loot_profile,
		"is_available": state.can_search, "is_active": state.worker != null,
		"is_completed": state.completed, "assigned_survivor_id": state.worker.data.id if state.worker != null else "",
		"status": site.spec.search_status, "state": state.state}

func _resolve_search_ui_anchor(body: Node3D, fallback: Vector3, entrance: Vector3,
		entrance_forward: Vector3, vehicle: bool) -> Dictionary:
	var authored: Node3D = body.get_node_or_null("SearchUIAnchor") as Node3D
	if authored == null:
		authored = body.get_node_or_null("Anchors/SearchUIAnchor") as Node3D
	if authored != null:
		return {"position": authored.global_position, "source": "explicit"}
	if vehicle:
		return {"position": fallback + Vector3.UP * 0.55, "source": "vehicle_interaction"}
	var outward: Vector3 = entrance_forward
	outward.y = 0.0
	if outward.length_squared() > 0.001:
		return {"position": entrance + outward.normalized() * 0.75 + Vector3.UP * 0.65,
			"source": "entrance_offset"}
	return {"position": fallback + Vector3.UP * 0.65, "source": "interaction_fallback"}

func _create_hover_highlight(root: Node3D, body: Node3D, fallback: Vector3) -> MeshInstance3D:
	var highlight := MeshInstance3D.new()
	highlight.name = "SearchHoverHighlight"
	highlight.visible = false
	highlight.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(0.35, 0.84, 0.94, 0.52)
	material.emission_enabled = true
	material.emission = Color(0.18, 0.55, 0.72)
	material.emission_energy_multiplier = 1.15
	highlight.material_override = material
	var lines := ImmediateMesh.new()
	var bounds: Dictionary = _world_bounds(body)
	var box: AABB = bounds.aabb if bool(bounds.get("valid", false)) else AABB(fallback - Vector3(1.2, 0.1, 1.2), Vector3(2.4, 2.4, 2.4))
	var min_point: Vector3 = box.position - Vector3.ONE * 0.05
	var max_point: Vector3 = box.end + Vector3.ONE * 0.05
	var corners: Array[Vector3] = [
		Vector3(min_point.x, min_point.y, min_point.z), Vector3(max_point.x, min_point.y, min_point.z),
		Vector3(max_point.x, min_point.y, max_point.z), Vector3(min_point.x, min_point.y, max_point.z),
		Vector3(min_point.x, max_point.y, min_point.z), Vector3(max_point.x, max_point.y, min_point.z),
		Vector3(max_point.x, max_point.y, max_point.z), Vector3(min_point.x, max_point.y, max_point.z)]
	var edges: Array[int] = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
	lines.surface_begin(Mesh.PRIMITIVE_LINES, material)
	for index: int in edges:
		lines.surface_add_vertex(corners[index])
	lines.surface_end()
	highlight.mesh = lines
	root.add_child(highlight)
	return highlight

func _world_bounds(body: Node3D) -> Dictionary:
	var result := AABB()
	var valid: bool = false
	for node: Node in body.find_children("*", "CollisionShape3D", true, false):
		var shape_node := node as CollisionShape3D
		if shape_node == null or shape_node.disabled or shape_node.shape == null:
			continue
		var local_bounds: AABB = shape_node.shape.get_debug_mesh().get_aabb()
		var world_bounds := AABB()
		for corner: int in 8:
			var point: Vector3 = shape_node.global_transform * local_bounds.get_endpoint(corner)
			if corner == 0:
				world_bounds = AABB(point, Vector3.ZERO)
			else:
				world_bounds = world_bounds.expand(point)
		if not valid:
			result = world_bounds
			valid = true
		else:
			result = result.merge(world_bounds)
	return {"valid": valid, "aabb": result}
