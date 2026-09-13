extends Node3D
## Reads the existing mission; selection is inspection only, never another command state.
const Marker = preload("res://ui/expedition/world_marker.gd")
const Visual = preload("res://ui/expedition/hud_visual_profile.gd")
var mission: Node3D
var context: Control
var selected_member: Node3D
var group_target: MeshInstance3D
var danger: MeshInstance3D
var _pulse: float = 0.0
var return_zone: MeshInstance3D
var bus_marker: MeshInstance3D

func setup(target: Node3D, poi_context: Control) -> void:
	mission = target
	context = poi_context
	process_priority = 110
	group_target = Marker.create(self, "icon_team", .6, Vector3.ZERO)
	danger = Marker.create(self, "world_danger_marker", .85, Vector3.ZERO)
	group_target.hide()
	danger.hide()
	return_zone = mission.city.get_node("ReturnZone")
	bus_marker = mission.city.get_node("BusMarker")
	# Only the visual transform changes. The original mesh and boarding radius remain intact.
	return_zone.scale = Vector3.ONE * Visual.RETURN_ZONE_SCALE
	for member: Node3D in mission.survivors:
		member.duty_ring.layers = 0
		# Hide legacy PNG/mesh selection rings; WorldInteractionVFX owns the new ring.
		member.selection_ring.visible = false

func _process(delta: float) -> void:
	if not is_instance_valid(mission):
		return
	_pulse += delta
	var return_hovered: bool = context.get_parent().extract_button.is_hovered()
	var return_needed: bool = mission.extraction or mission.clock.phase != mission.clock.DAY or mission.clock.remaining() <= 30
	return_zone.material_override.albedo_color = Visual.return_zone_tint(mission.extraction)
	bus_marker.material_override.albedo_color = Visual.world_tint(Visual.BUS_ACTIVE_ALPHA if return_needed or return_hovered else Visual.BUS_ALPHA, 1.25 if return_needed or return_hovered else 1.0)
	mission.city.bus_label.modulate = Visual.BUS_LABEL_ACTIVE if return_needed or return_hovered else Visual.BUS_LABEL_IDLE
	for member: Node3D in mission.survivors:
		var selected: bool = member == selected_member
		member.selection_ring.visible = false
		if selected and is_instance_valid(mission.world_interaction_vfx):
			mission.world_interaction_vfx.set_selected_member(member)
	for id: String in mission.city.sites:
		var site: Dictionary = mission.city.sites[id]
		var busy: bool = mission.search_tasks.has(id)
		var hovered: bool = id == context.displayed_id
		var near: bool = site.spec.entry.distance_to(mission.squad_center()) <= 16.0
		site.ring.visible = mission.input_enabled and site.discovered and not site.searched and _in_view(site.ring.global_position) and mission.exploration.is_visible(site.spec.entry) and (busy or hovered or near)
		site.ring.set_image("world_search_marker" if busy else "world_interact_marker" if hovered else "icon_vehicle" if site.vehicle else "icon_house")
		site.ring.material_override.albedo_color = Visual.world_tint(Visual.SEARCH_ALPHA if busy else Visual.SITE_HOVER_ALPHA if hovered else Visual.SITE_ALPHA)
		if busy:
			# A camera-facing quad rotates slowly in its own plane; Godot's full billboard
			# mode would discard the node's roll, so only this view resolves its basis.
			site.ring.material_override.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
			site.ring.global_basis = mission.camera.global_basis.orthonormalized() * Basis(Vector3.BACK, _pulse * TAU / Visual.SEARCH_ROTATION_SECONDS)
		else:
			site.ring.material_override.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
			site.ring.basis = Basis.IDENTITY
	group_target.visible = mission.input_enabled and not mission.extraction and mission.order == "前往阵位" and mission.guards().any(func(member: Node3D): return not member.path.is_empty())
	group_target.position = mission.rally_point + Vector3(0, .8, 0)
	var threat: Node3D = mission.focus_target
	if not is_instance_valid(threat):
		threat = mission.powers.target()
	danger.visible = is_instance_valid(threat) and threat.active and mission.exploration.is_visible(threat.position)
	if danger.visible:
		danger.position = threat.position + Vector3.UP * 2.65
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
