extends RefCounted
## One task owns entry, search and exit. Site progress survives cancellation.
enum Phase { IDLE, ASSIGNED, MOVING_TO_ENTRANCE, ENTERING, SEARCHING_INSIDE, EXITING, COMPLETE, CANCELLED, SEARCHING_OUTSIDE, DEFEND }
const TRANSITION_SECONDS: float = .3
var site_id: String = ""
var worker: Node3D
var phase: Phase = Phase.IDLE
var safe_left: float = 0.0
var resume_seconds: float = 0.0
var transition_left: float = 0.0
var exit_worker: Node3D
var outcome: Phase = Phase.CANCELLED
var search_started: bool = false

func allows_move_override() -> bool:
	# Defense and a return to the doorway must not turn a started search into approach.
	return not search_started and phase in [Phase.ASSIGNED, Phase.MOVING_TO_ENTRANCE, Phase.DEFEND]

func assign(id: String, member: Node3D, mission: Node3D) -> void:
	site_id = id
	mission.city.sites[id].search_cancelled = false
	worker = member
	phase = Phase.ASSIGNED
	worker.regrouping = false
	worker.damaged.connect(_on_damage)
	resume_seconds = mission.catalog.map.search_resume_seconds
	worker.order_move(mission.city.sites[id].spec.entry, mission.city)
	phase = Phase.MOVING_TO_ENTRANCE

func release(mission: Node3D, completed: bool = false) -> void:
	if not is_instance_valid(worker):
		return
	outcome = Phase.COMPLETE if completed else Phase.CANCELLED
	phase = outcome
	if worker.damaged.is_connected(_on_damage):
		worker.damaged.disconnect(_on_damage)
	worker.searching = false
	worker.stop()
	worker.regrouping = not worker.dead
	if worker.inside_building:
		exit_worker = worker
		if not mission.city.sites[site_id].spec.get("runtime_search", false):
			exit_worker.position = mission.city.sites[site_id].spec.entry
		exit_worker.visible = true
		transition_left = TRANSITION_SECONDS
		phase = Phase.EXITING
		exit_worker.set_search_opacity(0)
		# The search assignment ends as soon as recall/completion is requested.
		# Keep only the visual exit transition so the world card does not linger.
		worker = null
		mission.exiting_tasks.append(self)
	else:
		worker.set_search_opacity(1)
	worker = null
	safe_left = 0
	mission.refresh_regroup()
	if not completed:
		mission.city.sites[site_id].search_cancelled = true
		mission.search_cancelled.emit(site_id)

func advance_exit(delta: float) -> void:
	transition_left = maxf(0, transition_left - delta)
	exit_worker.set_search_opacity(1.0 - transition_left / TRANSITION_SECONDS)
	if transition_left <= .000001:
		exit_worker.inside_building = false
		exit_worker.set_search_opacity(1)
		exit_worker = null
		phase = outcome

func _on_damage() -> void:
	if worker == null or worker.inside_building:
		return
	safe_left = resume_seconds
	phase = Phase.DEFEND
	worker.searching = false
	worker.set_search_opacity(1)
	worker.stop()

func _threatened(mission: Node3D) -> bool:
	for enemy: Node3D in mission.enemies:
		if enemy.active and enemy.position.distance_to(worker.position) < mission.catalog.map.search_danger_radius and mission.city.line_clear(worker.position, enemy.position):
			return true
	return false

func _defend() -> void:
	safe_left = resume_seconds
	phase = Phase.DEFEND
	worker.searching = false
	worker.stop()
	if worker.inside_building:
		worker.visible = true
		transition_left = TRANSITION_SECONDS
		worker.set_search_opacity(0)

func prepare(delta: float, mission: Node3D) -> void:
	if worker == null:
		return
	if worker.dead:
		mission.notice.emit("搜索者阵亡 · 进度保留")
		release(mission)
		return
	if phase == Phase.SEARCHING_INSIDE:
		if _threatened(mission):
			_defend()
		return
	if phase == Phase.DEFEND and worker.inside_building:
		transition_left = maxf(0, transition_left - delta)
		worker.set_search_opacity(1.0 - transition_left / TRANSITION_SECONDS)
		if transition_left <= .000001:
			worker.inside_building = false
			worker.set_search_opacity(1)
		return
	if phase == Phase.ENTERING:
		if _threatened(mission):
			_defend()
			return
		transition_left = maxf(0, transition_left - delta)
		worker.set_search_opacity(transition_left / TRANSITION_SECONDS)
		if transition_left <= .000001:
			worker.visible = false
			worker.set_search_opacity(1)
			worker.searching = true
			phase = Phase.SEARCHING_INSIDE
		return
	worker.searching = false
	safe_left = maxf(0, safe_left - delta)
	if _threatened(mission):
		safe_left = resume_seconds
	if safe_left > 0:
		phase = Phase.DEFEND
		worker.stop()
		return
	var site: Dictionary = mission.city.sites[site_id]
	var entry: Vector3 = site.spec.entry
	var radius: float = .1 if site.spec.get("runtime_search", false) else mission.catalog.map.search_radius if site.vehicle else .15
	if worker.position.distance_to(entry) > radius:
		phase = Phase.MOVING_TO_ENTRANCE
		if worker.path.is_empty():
			worker.order_move(entry, mission.city)
		return
	worker.stop()
	worker.searching = true
	search_started = true
	if site.vehicle:
		phase = Phase.SEARCHING_OUTSIDE
	else:
		if not site.spec.get("runtime_search", false):
			worker.position = entry
		worker.inside_building = true
		phase = Phase.ENTERING
		transition_left = TRANSITION_SECONDS

func advance(delta: float, mission: Node3D) -> void:
	if worker == null:
		return
	if worker.dead:
		prepare(0, mission)
		return
	if phase != Phase.SEARCHING_INSIDE and (phase != Phase.SEARCHING_OUTSIDE or safe_left > 0 or _threatened(mission)):
		return
	var site: Dictionary = mission.city.sites[site_id]
	var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, worker.talent.search_multiplier)
	if site.searched:
		release(mission, true)
		return
	var remaining: float = (1.0 - site.progress) * seconds
	# Compare seconds with a microsecond tolerance, so accumulated float error
	# cannot leave a finished search at 99% for one more simulation tick.
	site.progress = 1.0 if delta >= remaining - 0.000001 else site.progress + maxf(0.0, delta) / seconds
	if site.progress >= 1.0:
		site.searched = true
		mission.city.update_site(site_id)
		var loot: Dictionary = mission.resolve_site_loot(site)
		# Cache the resolved legacy totals on the site so existing HUD/tests and
		# settlement paths observe the same result as the new resolver.
		site.spec.food = int(loot.food)
		site.spec.scrap = int(loot.scrap)
		var worker_name: String = worker.data.display_name
		loot.weapon = mission.reward_for_site(site_id)
		mission.drop_loot(site.spec.entry, int(loot.food), int(loot.scrap), loot.weapon, {"id": site_id, "worker_name": worker_name})
		release(mission, true)
		mission.search_completed.emit(site_id, worker_name, loot)

func action_label() -> String:
	match phase:
		Phase.ENTERING: return "进入建筑"
		Phase.SEARCHING_INSIDE, Phase.SEARCHING_OUTSIDE: return "搜索中"
		Phase.EXITING: return "走出建筑"
		Phase.DEFEND: return "自卫 · 搜索暂停"
	return "前往入口"

func status(mission: Node3D) -> String:
	if worker == null:
		return ""
	var site: Dictionary = mission.city.sites[site_id]
	return "%s · %s\n%s · %d%%" % [worker.data.display_name, site.spec.name, action_label(), site.progress * 100]
