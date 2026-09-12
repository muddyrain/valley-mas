extends Node3D
signal completed(result: Dictionary)
signal notice(text: String)
signal watch_warning_changed(active: bool)
const City = preload("res://maps/city.gd")
const Survivor = preload("res://survivors/survivor.gd")
const Clock = preload("res://time/mission_clock.gd")
const Atmosphere = preload("res://blue_hour/atmosphere.gd")
const Visuals = preload("res://vfx/visuals.gd")
const Soundscape = preload("res://audio/soundscape.gd")
const SearchTask = preload("res://missions/search_task.gd")
const SquadInput = preload("res://missions/squad_input.gd")
const ExpeditionCamera = preload("res://missions/expedition_camera.gd")
const SpecialPower = preload("res://missions/special_power.gd")
const Modifiers = preload("res://core/effect_modifiers.gd")
var effects: RefCounted
var action_elapsed: float = 0.0
var watch_warning_active: bool:
	get:
		return active and effects != null and clock != null and effects.amount("warning_seconds") > 0 and clock.phase == clock.DAY and clock.remaining() <= effects.amount("warning_seconds")
var _last_watch_warning: bool = false
var powers: RefCounted
var catalog: RefCounted
var ledger: RefCounted
var campaign: RefCounted
var clock: RefCounted
var city: Node3D
var atmosphere: Node3D
var sound: Node
var camera: Camera3D
var camera_controller: Node
var survivors: Array[Node3D] = []
var enemies: Array[Node3D] = []
var enemy_pool: Array[Node3D] = []
var pickups: Array[Dictionary] = []
var rng := RandomNumberGenerator.new()
var active: bool = true
var focus_target: Node3D
var search_tasks: Dictionary = {}
var selected_search_id := ""
# The selected task is only the inspection target; every task keeps running independently.
var search_task: RefCounted:
	get: return search_tasks.get(selected_search_id)
var search_id: String:
	get: return selected_search_id if search_tasks.has(selected_search_id) else ""
var order: String = "守住阵位"
var search_status: String:
	get: return search_task.status(self) if search_task != null else ""
var extraction: bool = false
var extraction_left: float = 0.0
var closing_left: float = -1.0
var spawn_left: float = 20.0
var kills: int = 0
var invincible: bool = false
var time_scale: float = 1.0
var director_enabled: bool = true
var poi_selected_id: String = ""
var camera_center := Vector3.ZERO
var focus_repath: float = 0.0
var rally_point := Vector3.ZERO
var regroup_left := 0.0
var controls: RefCounted
var input_enabled := true
var manual_aim := false
var aim_point := Vector3.ZERO

func setup(content: RefCounted, resources: RefCounted, loadout: Array[String], seed_value: int = 0, run_state: RefCounted = null, locked_party: Array[String] = []) -> void:
	catalog = content
	ledger = resources
	campaign = run_state
	effects = campaign.passive_modifiers() if campaign != null else Modifiers.new()
	controls = SquadInput.new(self)
	ledger.begin()
	rally_point = catalog.map.bus_position
	rng.seed = seed_value if seed_value != 0 else Time.get_ticks_usec()
	if campaign != null:
		rng.seed = int(campaign.data.seed) + int(campaign.data.day) * 1009
	var clock_rules: Resource = catalog.map.duplicate()
	clock_rules.day_seconds += effects.amount("day_extension")
	clock = Clock.new(clock_rules)
	city = City.new()
	add_child(city)
	city.build(catalog.map)
	atmosphere = Atmosphere.new()
	add_child(atmosphere)
	atmosphere.setup(city)
	sound = Soundscape.new()
	add_child(sound)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = ExpeditionCamera.DEFAULT_SIZE
	camera.far = 180.0
	add_child(camera)
	camera.current = true
	var member_ids: Array
	if campaign == null:
		member_ids = catalog.survivors.slice(0, loadout.size()).map(func(member): return member.id)
	else:
		member_ids = campaign.data.members if locked_party.is_empty() else locked_party
	for i in range(member_ids.size()):
		var member_id: String = member_ids[i]
		var spec: Resource = (catalog.survivors[i] if campaign == null else campaign.member_template(member_id)).duplicate()
		var talent: Resource = catalog.by_id(catalog.traits, spec.trait_id).duplicate()
		var equipment: Resource
		if campaign == null:
			equipment = catalog.by_id(catalog.weapons, loadout[i])
		else:
			equipment = campaign.weapon(campaign.data.equipment[member_id])
			talent = campaign.member_trait(member_id)
			spec.id = member_id
			spec.max_hp *= campaign.health_multiplier()
		var survivor := Survivor.new()
		add_child(survivor)
		survivor.setup(spec, talent, equipment)
		survivor.enable_motion_presentation(self)
		survivor.effects = effects
		survivor.position = catalog.map.bus_position + formation(survivors.size())
		survivors.append(survivor)
	for entry in catalog.map.initial_enemies:
		spawn_enemy(entry.id, entry.position)
	clock.phase_changed.connect(_on_phase)
	spawn_left = clock.spawn_interval()
	powers = SpecialPower.new(self)
	camera_controller = ExpeditionCamera.new()
	add_child(camera_controller)
	camera_controller.setup(self)

func formation(index: int) -> Vector3:
	return [Vector3(-1.2, 0, 0), Vector3(1.2, 0, 0), Vector3(0, 0, -1.4), Vector3(0, 0, 1.4)][index % 4]

func debug_equip(index: int, equipment: Resource) -> void:
	var member: Node3D = survivors[index]
	if member.dead:
		return
	member.equip(equipment)
	if campaign != null:
		member.talent = campaign.member_trait(member.data.id)

func _physics_process(delta: float) -> void:
	if not active or time_scale <= 0:
		return
	var left := maxf(0.0, delta * time_scale)
	# Split at effect expiry so a clock freeze cannot eat the rest of a large frame.
	while left > 0 and active:
		var dt := minf(left, powers.next_expiry())
		_advance_world(dt)
		powers.advance(dt)
		left = maxf(0.0, left - dt)

func _advance_world(dt: float) -> void:
	action_elapsed += dt
	clock.advance(dt, effects.amount("freeze_day_clock") > 0)
	_sync_watch_warning()
	_update_director(dt)
	powers.refresh_target()
	for enemy: Node3D in enemies:
		enemy.refresh_stats(clock)
	for task in search_tasks.values():
		task.prepare(dt, self)
	_prune_tasks()
	regroup_left -= dt
	if regroup_left <= 0:
		refresh_regroup()
	for survivor in survivors:
		survivor.tick(dt, self)
	for enemy in enemies.duplicate():
		if enemy.active:
			enemy.tick(dt, self)
		else:
			_retire_enemy(enemy)
	if living().is_empty():
		_finish(true)
		return
	_update_focus(dt)
	for task in search_tasks.values():
		task.advance(dt, self)
	_prune_tasks()
	_update_pickups()
	_update_extraction(dt)

func _sync_watch_warning() -> void:
	if _last_watch_warning != watch_warning_active:
		_last_watch_warning = watch_warning_active
		watch_warning_changed.emit(watch_warning_active)

func movement_speed(member: Node3D, waypoint: Vector3, delta: float) -> float:
	var speed: float = member.data.move_speed * effects.multiplier("move_speed") * (1.0 + member.weapon.move_speed_modifier if member.weapon != null else 1.0)
	if not watch_warning_active or member.dead or member.boarding or delta <= 0:
		return speed
	var offset: Vector3 = waypoint - member.position
	var to_bus: Vector3 = catalog.map.bus_position - member.position
	if offset.length_squared() < 0.000001 or offset.dot(to_bus) <= 0:
		return speed
	var boosted: float = speed * effects.multiplier("return_speed")
	var next: Vector3 = member.position.move_toward(waypoint, boosted * delta)
	# A command towards home is insufficient: this actual path segment must approach it.
	if next.distance_squared_to(catalog.map.bus_position) < member.position.distance_squared_to(catalog.map.bus_position) - 0.000001:
		return boosted
	return speed

func damage_to(member: Node3D, target: Node3D) -> float:
	return effects.outgoing_damage(member.weapon.damage * member.talent.damage_multiplier, member.weapon.melee, target != null and target == powers.target())

func _process(delta: float) -> void:
	if controls != null:
		controls.update(delta)
	if camera_controller != null:
		camera_controller.update(delta)

func pan_camera(amount: Vector2) -> void:
	camera_controller.pan(amount)

func _update_camera() -> void:
	camera_controller.apply()

func center_squad() -> void:
	if living().is_empty():
		return
	camera_controller.center_squad()

func living() -> Array[Node3D]:
	var result: Array[Node3D] = []
	for survivor in survivors:
		if not survivor.dead:
			result.append(survivor)
	return result

func guards() -> Array[Node3D]:
	var result: Array[Node3D] = []
	for member in living():
		if task_for(member) == null:
			result.append(member)
	return result

func guards_center(exclude: Node3D = null) -> Vector3:
	var center := Vector3.ZERO
	var count := 0
	for member in guards():
		if member != exclude and not member.regrouping:
			center += member.position
			count += 1
	return center / count if count > 0 else rally_point

func refresh_regroup() -> void:
	regroup_left = 0.6
	if manual_aim:
		return
	for member in guards():
		if not member.regrouping:
			continue
		var destination := guards_center(member)
		if member.position.distance_to(destination) < 2.0:
			member.regrouping = false
			member.stop()
		else:
			member.order_move(destination, city)

func member_status(member: Node3D) -> String:
	if member.dead:
		return "阵亡"
	var task := task_for(member)
	if task != null:
		return ["前往搜索", "搜索中", "自卫 · 搜索暂停"][task.phase]
	if member.regrouping:
		return "归队中"
	return "归航中" if extraction else "掩护"

func squad_center() -> Vector3:
	var center := Vector3.ZERO
	var members := living()
	for member in members:
		center += member.position
	return center / maxi(1, members.size())

func nearest_survivor(point: Vector3) -> Node3D:
	var nearest: Node3D
	var best := INF
	for survivor in living():
		var distance := survivor.position.distance_squared_to(point)
		if distance < best:
			nearest = survivor
			best = distance
	return nearest

func _input(event: InputEvent) -> void:
	if controls != null:
		controls.observe(event)

func _unhandled_input(event: InputEvent) -> void:
	if controls != null:
		controls.handle(event)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT and controls != null:
		controls.reset()

func _exit_tree() -> void:
	if powers != null:
		powers.clear()
	for task in search_tasks.values():
		if is_instance_valid(task.worker) and task.worker.damaged.is_connected(task._on_damage):
			task.worker.damaged.disconnect(task._on_damage)

func task_for(member: Node3D) -> RefCounted:
	for task in search_tasks.values():
		if task.worker == member:
			return task
	return null

func _prune_tasks() -> void:
	for id in search_tasks.keys():
		if search_tasks[id].worker == null:
			search_tasks.erase(id)
	if not search_tasks.has(selected_search_id):
		selected_search_id = "" if search_tasks.is_empty() else str(search_tasks.keys()[0])

func _cancel_guard_order() -> void:
	end_aim()
	if focus_target != null and is_instance_valid(focus_target):
		focus_target.focus_ring.visible = false
	focus_target = null
	extraction = false
	extraction_left = catalog.map.extraction_seconds

func command_move(point: Vector3) -> void:
	if not active or closing_left >= 0:
		return
	_cancel_guard_order()
	var destination: Vector3 = city.nearest_open(point)
	rally_point = destination
	for i in range(survivors.size()):
		if task_for(survivors[i]) == null:
			survivors[i].regrouping = false
			survivors[i].order_move(city.nearest_open(destination + formation(i)), city)
	city.set_marker(destination)
	order = "前往阵位"

func command_stop() -> void:
	if not active or closing_left >= 0:
		return
	_cancel_guard_order()
	for survivor in guards():
		survivor.regrouping = false
		survivor.request_stop()
	city.marker.visible = false
	order = "停止移动 · 自动迎敌"

func command_search(id: String) -> void:
	if not active or closing_left >= 0 or not city.sites.has(id) or city.sites[id].searched:
		return
	poi_selected_id = id
	var site: Dictionary = city.sites[id]
	if search_tasks.has(id):
		selected_search_id = id
		return
	var nearest: Node3D
	var best := INF
	for member in living():
		if member.boarding or task_for(member) != null:
			continue
		var route: PackedVector3Array = city.path(member.position, site.spec.entry)
		if route.is_empty():
			continue
		var distance := member.position.distance_squared_to(site.spec.entry)
		if distance < best:
			best = distance
			nearest = member
	if nearest == null:
		notice.emit("没有空闲且可抵达的队员 · 可先召回一人")
		return
	extraction = false
	extraction_left = catalog.map.extraction_seconds
	var task := SearchTask.new()
	search_tasks[id] = task
	selected_search_id = id
	task.assign(id, nearest, self)
	notice.emit("%s 前往搜索 %s" % [nearest.data.display_name, site.spec.name])

func command_reassign(index: int) -> void:
	if not active or closing_left >= 0 or search_id.is_empty() or index < 0 or index >= survivors.size():
		return
	var member = survivors[index]
	if member.dead or member.boarding or task_for(member) != null:
		return
	var id := search_id
	if city.path(member.position, city.sites[id].spec.entry).is_empty():
		notice.emit("该队员无法抵达入口")
		return
	search_task.assign(id, member, self)
	notice.emit("改派 %s · 搜索进度保留" % member.data.display_name)

func command_recall(id: String = "") -> void:
	if id.is_empty():
		id = search_id
	if not active or closing_left >= 0 or not search_tasks.has(id):
		return
	search_tasks[id].release(self)
	_prune_tasks()
	notice.emit("搜索者归队 · 进度保留")

func command_recall_all() -> void:
	if not active or closing_left >= 0:
		return
	_release_tasks()
	if controls != null:
		controls.reset()
	command_move(rally_point)
	notice.emit("全队集合 · 搜索进度保留")

func _release_tasks() -> void:
	for task in search_tasks.values():
		task.release(self)
	search_tasks.clear()
	selected_search_id = ""

func command_aim(point: Vector3) -> void:
	if not active or closing_left >= 0 or not input_enabled:
		return
	if not manual_aim:
		_cancel_guard_order()
	manual_aim = true
	aim_point = Vector3(point.x, 0, point.z)
	for member in guards():
		member.regrouping = false
		member.stop()
	city.set_marker(aim_point)
	order = "指向射击 · 松开 Ctrl 自动迎敌"

func end_aim() -> void:
	if manual_aim:
		manual_aim = false
		order = "守住阵位 · 自动迎敌"
		city.marker.visible = false

func command_focus(target: Node3D) -> void:
	if not active or closing_left >= 0 or target == null or not target.active:
		return
	_cancel_guard_order()
	focus_target = target
	target.focus_ring.visible = true
	focus_repath = 0
	order = "集火 · " + target.data.display_name

func command_focus_nearest() -> void:
	var target: Node3D
	var best := INF
	for enemy in enemies:
		if not enemy.active:
			continue
		var distance := guards_center().distance_squared_to(enemy.position)
		if distance < best:
			target = enemy
			best = distance
	if target != null:
		command_focus(target)
	else:
		notice.emit("附近没有目标")

func _update_focus(delta: float) -> void:
	if focus_target == null:
		return
	if not is_instance_valid(focus_target) or not focus_target.active:
		_finish_focus()
		return
	focus_repath -= delta
	if focus_repath > 0:
		return
	focus_repath = 0.65
	for survivor in guards():
		if survivor.regrouping or survivor.weapon == null:
			continue
		if survivor.position.distance_to(focus_target.position) > survivor.weapon.attack_range * 0.85 or not city.line_clear(survivor.position, focus_target.position):
			survivor.order_move(focus_target.position, city)
		else:
			survivor.stop()

func _finish_focus() -> void:
	if is_instance_valid(focus_target):
		focus_target.focus_ring.visible = false
	focus_target = null
	for member in guards():
		if not member.regrouping:
			member.stop()
	order = "守住阵位 · 自动迎敌"

func choose_target(survivor: Node3D) -> Node3D:
	var priority: Node3D = powers.target()
	if priority != null and _can_hit(survivor, priority):
		return priority
	if task_for(survivor) == null and focus_target != null and is_instance_valid(focus_target) and focus_target.active and _can_hit(survivor, focus_target):
		return focus_target
	var nearest: Node3D
	var best := INF
	for enemy in enemies:
		if enemy.active and _can_hit(survivor, enemy):
			var distance := survivor.position.distance_squared_to(enemy.position)
			if distance < best:
				nearest = enemy
				best = distance
	return nearest

func _can_hit(survivor: Node3D, target: Node3D) -> bool:
	return survivor.weapon != null and survivor.position.distance_to(target.position) <= survivor.weapon.attack_range and city.line_clear(survivor.position, target.position)

func attack(survivor: Node3D, target: Node3D) -> void:
	if is_instance_valid(target):
		survivor.combat.try_attack(survivor, self, target.position, target)

func effects_hit(from: Vector3, to: Vector3, color: Color) -> void:
	Visuals.tracer(self, from + Vector3.UP, to + Vector3.UP, color, true)

func spawn_enemy(id: String, point: Vector3) -> Node3D:
	if not active or closing_left >= 0 or enemies.size() >= catalog.map.enemy_limit:
		return null
	var data: Resource = catalog.by_id(catalog.enemies, id)
	if data == null:
		return null
	var enemy: Node3D
	for cached in enemy_pool:
		if cached.data.id == id:
			enemy = cached
			break
	if enemy != null:
		enemy_pool.erase(enemy)
		enemy.reset_for_spawn(rng.randf_range(0.1, 0.6), clock)
	else:
		enemy = data.scene.instantiate()
		add_child(enemy)
		enemy.setup(data, rng.randf_range(0.1, 0.6), clock)
	enemy.position = city.nearest_open(point)
	enemies.append(enemy)
	return enemy

func _retire_enemy(enemy: Node3D) -> void:
	kills += 1
	if focus_target == enemy:
		_finish_focus()
	var food := 1 if rng.randf() < enemy.data.food_drop_chance else 0
	var scrap := 1 if rng.randf() < enemy.data.scrap_drop_chance else 0
	if food + scrap > 0:
		drop_loot(enemy.position, food, scrap)
	enemies.erase(enemy)
	enemy.focus_ring.visible = false
	enemy_pool.append(enemy)

func _update_director(delta: float) -> void:
	if not director_enabled or closing_left >= 0:
		return
	spawn_left -= delta
	if spawn_left > 0:
		return
	spawn_left = clock.spawn_interval()
	var count := 1 if clock.phase == clock.DAY else (2 if clock.phase == clock.BLUE_HOUR else mini(8, 2 + clock.threat_level()))
	for i in range(count):
		var pool: PackedStringArray = [catalog.map.day_enemy_pool, catalog.map.blue_enemy_pool, catalog.map.night_enemy_pool][clock.phase]
		var id: String = pool[rng.randi_range(0, pool.size() - 1)]
		var point: Vector3 = catalog.map.spawn_points[rng.randi_range(0, catalog.map.spawn_points.size() - 1)]
		spawn_enemy(id, point)

func drop_loot(point: Vector3, food: int, scrap: int, weapon_item: Dictionary = {}) -> void:
	var view := Node3D.new()
	add_child(view)
	view.position = point
	Visuals.loot_crate(view)
	Visuals.ring(view, Vector3(0, 0.1, 0), 0.7, Color("#a4eab1"))
	pickups.append({"view": view, "food": food, "scrap": scrap, "weapon": weapon_item})

func reward_for_site(id: String) -> Dictionary:
	if campaign == null:
		return {}
	var action: Resource = catalog.by_id(catalog.today_actions, str(campaign.data.get("selected_action", "")))
	if action != null and id not in action.weapon_sites:
		return {}
	var value: Dictionary = campaign.data.day_rewards.get(id, {})
	return value if value.is_empty() or campaign.item(value.uid).is_empty() else {}

func _update_pickups() -> void:
	for pickup in pickups.duplicate():
		for survivor in living():
			if survivor.position.distance_to(pickup.view.position) <= catalog.map.pickup_radius:
				var gained: Vector2i = ledger.collect_resources(pickup.food, pickup.scrap, effects.multiplier("resource_yield"))
				var message := "+%d 食物   +%d 废料" % [gained.x, gained.y]
				if not pickup.weapon.is_empty():
					ledger.add_weapon(pickup.weapon)
					message += "\n获得 " + campaign.gear.title(pickup.weapon)
				notice.emit(message)
				sound.play_cue("loot")
				pickup.view.queue_free()
				pickups.erase(pickup)
				break

func command_extract() -> void:
	if not active or closing_left >= 0:
		return
	_release_tasks()
	if controls != null:
		controls.reset()
	command_move(catalog.map.bus_position)
	extraction = true
	extraction_left = catalog.map.extraction_seconds
	order = "全队归航"
	notice.emit("巴士等待全队抵达")

func board_count() -> int:
	var count := 0
	for survivor in living():
		if survivor.position.distance_to(catalog.map.bus_position) <= catalog.map.board_radius:
			count += 1
	return count

func _update_extraction(delta: float) -> void:
	if closing_left >= 0:
		closing_left -= delta
		if closing_left <= 0:
			_finish(false)
		return
	if not extraction:
		city.bus_label.text = "归航巴士"
		return
	var members := living()
	if board_count() != members.size():
		extraction_left = catalog.map.extraction_seconds
		city.bus_label.text = "等待队员 %d/%d" % [board_count(), members.size()]
		return
	extraction_left = maxf(0, extraction_left - delta)
	city.bus_label.text = "巴士准备 %.1fs · %d/%d" % [extraction_left, board_count(), members.size()]
	if extraction_left <= 0:
		closing_left = 1.4
		order = "全员上车 · 车门关闭"
		for survivor in members:
			survivor.boarding = true
			survivor.stop()
			create_tween().tween_property(survivor, "scale", Vector3.ZERO, 0.65)
		create_tween().tween_property(city.bus_door, "position:x", city.bus_door.position.x + 0.8, 1.0)
		sound.play_cue("home")

func _finish(wiped: bool) -> void:
	if not active:
		return
	active = false
	powers.clear()
	_sync_watch_warning()
	_release_tasks()
	if controls != null:
		controls.reset()
	var returned: Array[String] = []
	var lost: Array[String] = []
	var returned_ids: Array[String] = []
	var lost_ids: Array[String] = []
	for survivor in survivors:
		if survivor.dead:
			lost.append(survivor.data.display_name)
			lost_ids.append(survivor.data.id)
		else:
			returned.append(survivor.data.display_name)
			returned_ids.append(survivor.data.id)
	var result: Dictionary = ledger.finish(returned, lost, action_elapsed, kills, wiped)
	result.returned_ids = returned_ids
	result.lost_ids = lost_ids
	completed.emit(result)

func _on_phase(phase: int) -> void:
	for enemy: Node3D in enemies:
		enemy.refresh_stats(clock)
	atmosphere.set_phase(phase)
	sound.set_phase(phase)
	spawn_left = minf(spawn_left, clock.spawn_interval())
	notice.emit(["白昼 · 搜集物资", "BLUE HOUR · 全队准备归航", "NIGHT · 夜间警戒持续升级"][phase])

func debug_clear_enemies() -> void:
	for enemy in enemies:
		enemy.active = false
		enemy.visible = false
		enemy.collision_disable()
		enemy.focus_ring.visible = false
		enemy_pool.append(enemy)
	enemies.clear()
	if focus_target != null:
		_finish_focus()
