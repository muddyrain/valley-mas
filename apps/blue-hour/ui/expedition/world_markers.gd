extends Node3D
## Reads the existing mission; selection is inspection only, never another command state.
const Marker = preload("res://ui/expedition/world_marker.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
const UPDATE_INTERVAL: float = 1.0 / 20.0
var mission: Node3D
var context: Control
var selected_member: Node3D
var group_target: MeshInstance3D
var danger: MeshInstance3D
var _pulse: float = 0.0
var return_zone: MeshInstance3D
var bus_marker: MeshInstance3D
var _return_zone_scale := Vector3.ONE
var _bus_marker_scale := Vector3.ONE
var _bus_label_scale := Vector3.ONE
var update_count: int = 0
var _update_elapsed: float = UPDATE_INTERVAL

func setup(target: Node3D, poi_context: Control) -> void:
	mission = target
	context = poi_context
	process_priority = 110
	# Movement feedback is rendered by WorldInteractionVfx's procedural ground ring.
	# Keep this node for compatibility with existing state code, but never show a
	# texture fallback at the destination (which reads as a black placeholder).
	group_target = Marker.create(self, "world_move_marker", .6, Vector3.ZERO)
	danger = Marker.create(self, "world_danger_marker", .85, Vector3.ZERO)
	group_target.hide()
	danger.hide()
	return_zone = mission.city.get_node("ReturnZone")
	bus_marker = mission.city.get_node("BusMarker")
	# Only the visual transform changes. The original mesh and boarding radius remain intact.
	return_zone.scale = Vector3.ONE * Visual.RETURN_ZONE_SCALE
	_return_zone_scale = return_zone.scale
	_bus_marker_scale = bus_marker.scale
	_bus_label_scale = mission.city.bus_label.scale
	for member: Node3D in mission.survivors:
		member.duty_ring.layers = 0
		# Hide legacy PNG/mesh selection rings; WorldInteractionVFX owns the new ring.
		member.selection_ring.visible = false

func _process(delta: float) -> void:
	if not is_instance_valid(mission):
		return
	_update_elapsed += delta
	if _update_elapsed < UPDATE_INTERVAL:
		return
	_update_elapsed = fmod(_update_elapsed, UPDATE_INTERVAL)
	update_count += 1
	_pulse += UPDATE_INTERVAL
	var return_hovered: bool = context.get_parent().extract_button.is_hovered()
	var return_needed: bool = mission.extraction or mission.clock.phase != mission.clock.DAY or mission.clock.remaining() <= 30
	return_zone.material_override.albedo_color = Visual.return_zone_tint(mission.extraction)
	bus_marker.material_override.albedo_color = Visual.world_tint(Visual.BUS_ACTIVE_ALPHA if return_needed or return_hovered else Visual.BUS_ALPHA, 1.25 if return_needed or return_hovered else 1.0)
	var beacon_pulse: float = .035 + (.055 if return_needed or return_hovered else .0)
	return_zone.scale = _return_zone_scale * (1.0 + beacon_pulse * (0.5 + 0.5 * sin(_pulse * TAU / 1.8)))
	bus_marker.scale = _bus_marker_scale * (1.0 + beacon_pulse * (0.5 + 0.5 * sin(_pulse * TAU / 1.45 + .8)))
	var label_pulse: float = .02 if not return_needed and not return_hovered else .06
	mission.city.bus_label.scale = _bus_label_scale * (1.0 + label_pulse * (0.5 + 0.5 * sin(_pulse * TAU / 1.45 + 1.2)))
	mission.city.bus_label.modulate = Visual.BUS_LABEL_ACTIVE if return_needed or return_hovered else Visual.BUS_LABEL_IDLE
	for member: Node3D in mission.survivors:
		var selected: bool = member == selected_member
		member.selection_ring.visible = false
		if selected and is_instance_valid(mission.world_interaction_vfx):
			mission.world_interaction_vfx.set_selected_member(member)
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		var busy: bool = mission.search_tasks.has(id)
		var hovered: bool = id == context.hovered_id
		var selected: bool = id == mission.poi_selected_id
		var focused: bool = hovered or selected
		var ui_anchor: Node3D = site.get("search_ui_anchor") as Node3D
		var anchor_point: Vector3 = ui_anchor.global_position if is_instance_valid(ui_anchor) else site.ring.global_position
		var visible_target: bool = mission.input_enabled and site.discovered and not site.searched and _in_view(anchor_point) and mission.exploration.is_visible(site.spec.entry)
		var discover_point: MeshInstance3D = site.get("discover_point") as MeshInstance3D
		if is_instance_valid(discover_point):
			discover_point.visible = visible_target and not busy and not focused
			if discover_point.visible:
				discover_point.global_position = anchor_point
				discover_point.scale = Vector3.ONE * (.92 + .08 * (0.5 + 0.5 * sin(_pulse * TAU / 1.15)))
				discover_point.material_override.albedo_color = Visual.world_tint(.68 + .08 * sin(_pulse * TAU / 1.15), 1.1)
		site.ring.visible = visible_target and (busy or focused)
		site.ring.set_image("world_search_marker" if busy else "world_interact_marker" if focused else "icon_vehicle" if site.vehicle else "icon_house")
		var marker_alpha: float = Visual.SEARCH_ALPHA if busy else Visual.SITE_HOVER_ALPHA
		if busy:
			marker_alpha *= .90 + .10 * (0.5 + 0.5 * sin(_pulse * TAU / Visual.SEARCH_ROTATION_SECONDS))
		site.ring.material_override.albedo_color = Visual.world_tint(marker_alpha)
		var highlight: MeshInstance3D = site.get("highlight") as MeshInstance3D
		if is_instance_valid(highlight):
			highlight.visible = false
			var highlight_alpha: float = marker_alpha * (1.08 if selected else .88)
			var highlight_tint: Color = Color("#72dce8") if selected else Color("#4dbdca")
			highlight_tint.a = clampf(highlight_alpha, 0.0, 1.0)
			highlight.material_override.albedo_color = highlight_tint
			var outline_pulse: float = .025 if not selected else .05
			highlight.scale = Vector3.ONE * (1.0 + outline_pulse * (0.5 + 0.5 * sin(_pulse * TAU / 1.6)))
		if busy:
			# A camera-facing quad rotates slowly in its own plane; Godot's full billboard
			# mode would discard the node's roll, so only this view resolves its basis.
			site.ring.material_override.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
			site.ring.global_basis = mission.camera.global_basis.orthonormalized() * Basis(Vector3.BACK, _pulse * TAU / Visual.SEARCH_ROTATION_SECONDS)
		else:
			site.ring.material_override.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
			site.ring.basis = Basis.IDENTITY
	group_target.visible = false
	group_target.position = mission.rally_point + Vector3(0, .8, 0)
	var threat: Node3D = mission.focus_target
	if not is_instance_valid(threat):
		threat = mission.powers.target()
	danger.visible = is_instance_valid(threat) and threat.active and mission.exploration.is_visible(threat.position)
	if danger.visible:
		danger.position = threat.position + Vector3.UP * 2.65
		danger.scale = Vector3.ONE * (.92 + .08 * (0.5 + 0.5 * sin(_pulse * TAU / 1.1)))
		threat.focus_ring.layers = 0
	for pickup: Dictionary in mission.pickups:
		if not pickup.view.has_node("WorldLootMarker"):
			# The marker only exists while a real pickup does; collection frees the parent.
			var loot := Marker.create(pickup.view, "icon_loot", .65, Vector3.UP * .85)
			loot.name = "WorldLootMarker"
			for child: Node in pickup.view.get_children():
				if child is MeshInstance3D and child.mesh is TorusMesh:
					child.hide()
		var loot_view: MeshInstance3D = pickup.view.get_node("WorldLootMarker")
		loot_view.visible = _in_view(loot_view.global_position) and mission.exploration.is_visible(pickup.view.global_position)

func _in_view(point: Vector3) -> bool:
	return not mission.camera.is_position_behind(point) and get_viewport().get_visible_rect().has_point(mission.camera.unproject_position(point))
