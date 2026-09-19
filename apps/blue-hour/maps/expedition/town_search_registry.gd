extends RefCounted
## Expedition owns interactions; the generated Town and its instances stay read-only.
const Catalog = preload("res://data/world_asset_catalog.gd")
const Loot = preload("res://maps/generation/loot_spawner.gd")
const HudMarker = preload("res://ui/expedition/world_marker.gd")
const Visuals = preload("res://vfx/visuals.gd")

var building_searchables: Array[String] = []
var vehicle_searchables: Array[String] = []
var rejected: Dictionary = {}
var metrics: Dictionary = {}
var _mission: WeakRef
var _layer: Node3D

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
		_register(id, Catalog.asset(str(item.asset)), body, item.position, false)
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
		_register(id, definition, body, mission.city.to_local(anchor.global_position), true)
	metrics = {"registration_ms": (Time.get_ticks_usec() - started) / 1000.0,
		"building_count": building_searchables.size(), "vehicle_count": vehicle_searchables.size(),
		"decorative_vehicle_count": decorative_vehicles}

static func definition_status(definition: Resource) -> String:
	if definition == null or not definition.searchable:
		return "NOT_SEARCHABLE"
	if not Loot.PROFILES.has(definition.loot_profile):
		return "MISSING_PROFILE"
	return "AVAILABLE"

func _register(id: String, definition: Resource, body: Node3D, entrance: Vector3, vehicle: bool) -> void:
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
		"entry": entrance, "entrance_point": entrance, "pos": body.position,
		"poi_type": definition.poi_type, "category": definition.category,
		"runtime_search": true, "search_status": "NAVIGATION_NOT_READY"}
	Loot.apply(spec, definition.loot_profile)
	var root := Node3D.new()
	root.name = "Search_" + id
	_layer.add_child(root)
	var ring: Node3D = HudMarker.create(root, "world_interact_marker", .7, entrance + Vector3.UP)
	ring.hide()
	var anchor := Marker3D.new()
	root.add_child(anchor)
	anchor.position = entrance + Vector3.UP * 2.0
	Visuals.hit_area(root, "site_id", id, 1.1)
	var entrance_hit: Node3D = root.get_child(root.get_child_count() - 1)
	entrance_hit.position = entrance
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
		"search_anchor": anchor, "entrance_hit": entrance_hit}
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

func resolve_navigation_staged() -> void:
	var started := Time.get_ticks_usec()
	var mission: Node3D = _mission.get_ref()
	var origin: Vector3 = mission.city.spawn_positions(1)[0]
	var batch_started := Time.get_ticks_usec()
	var max_batch_ms := 0.0
	for id: String in building_searchables + vehicle_searchables:
		_resolve_navigation_site(mission, origin, id)
		var elapsed := (Time.get_ticks_usec() - batch_started) / 1000.0
		max_batch_ms = maxf(max_batch_ms, elapsed)
		if elapsed >= 12.0:
			await mission.get_tree().process_frame
			if DisplayServer.get_name() != "headless":
				await RenderingServer.frame_post_draw
			batch_started = Time.get_ticks_usec()
	metrics["max_resolve_batch_ms"] = max_batch_ms
	_record_resolution(started)

func _resolve_navigation_site(mission: Node3D, origin: Vector3, id: String) -> void:
	var site: Dictionary = mission.city.sites[id]
	var entrance: Vector3 = site.spec.entrance_point
	# At most 2 m from the authored entrance; never search from the center
	# or ask navigation to cross collision to reach a marker.
	var point: Vector3 = mission.city.navigation.nearest(entrance, 2.0)
	if not point.is_finite() or mission.city.path(origin, point).is_empty():
		site.spec.search_status = "SEARCH_REJECTED_UNREACHABLE"
		rejected[id] = site.spec.search_status
		return
	site.spec.entry = point
	site.spec.search_status = "AVAILABLE"
	rejected.erase(id)
	site.ring.position = point + Vector3.UP
	site.search_anchor.position = point + Vector3.UP * 2.0
	site.entrance_hit.position = point

func _record_resolution(started: int) -> void:
	metrics.navigation_resolve_ms = (Time.get_ticks_usec() - started) / 1000.0
	metrics.resolve_mean_ms = metrics.navigation_resolve_ms / maxi(1, building_searchables.size() + vehicle_searchables.size())
	metrics.build_ms = metrics.registration_ms + metrics.navigation_resolve_ms

func snapshot(id: String) -> Dictionary:
	var mission: Node3D = _mission.get_ref()
	if mission == null or not mission.city.sites.has(id):
		return {}
	var site: Dictionary = mission.city.sites[id]
	var state: Dictionary = mission.search_target_state(id)
	return {"runtime_id": id, "source_definition_id": site.spec.asset,
		"search_type": "vehicle" if site.vehicle else "building", "world_position": site.body.position,
		"interaction_point": site.spec.entry, "entrance_point": site.spec.entrance_point,
		"search_duration": site.spec.search_seconds, "loot_profile": site.spec.loot_profile,
		"is_available": state.can_search, "is_active": state.worker != null,
		"is_completed": state.completed, "assigned_survivor_id": state.worker.data.id if state.worker != null else "",
		"status": site.spec.search_status, "state": state.state}
