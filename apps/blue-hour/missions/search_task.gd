extends RefCounted
# One assignment owns its worker; site progress belongs to the city and survives release.
enum Phase { APPROACH, WORK, DEFEND }
var site_id := ""
var worker: Node3D
var phase := Phase.APPROACH
var safe_left := 0.0
var resume_seconds := 0.0

func assign(id: String, member: Node3D, mission: Node3D) -> void:
	release(mission)
	site_id = id
	worker = member
	worker.regrouping = false
	worker.damaged.connect(_on_damage)
	resume_seconds = mission.catalog.map.search_resume_seconds
	safe_left = 0.0
	phase = Phase.APPROACH
	worker.order_move(mission.city.sites[id].spec.entry, mission.city)

func release(mission: Node3D) -> void:
	if is_instance_valid(worker):
		if worker.damaged.is_connected(_on_damage):
			worker.damaged.disconnect(_on_damage)
		worker.searching = false
		worker.stop()
		worker.regrouping = not worker.dead
	worker = null
	site_id = ""
	safe_left = 0.0
	mission.refresh_regroup()

func _on_damage() -> void:
	safe_left = resume_seconds
	phase = Phase.DEFEND
	worker.searching = false
	worker.stop()

func _threatened(mission: Node3D) -> bool:
	for enemy in mission.enemies:
		if enemy.active and enemy.position.distance_to(worker.position) < mission.catalog.map.search_danger_radius and mission.city.line_clear(worker.position, enemy.position):
			return true
	return false

func prepare(delta: float, mission: Node3D) -> void:
	if worker == null:
		return
	if worker.dead:
		mission.notice.emit("搜索者阵亡 · 进度保留")
		release(mission)
		return
	worker.searching = false
	safe_left = maxf(0, safe_left - delta)
	if _threatened(mission):
		safe_left = resume_seconds
	if safe_left > 0:
		phase = Phase.DEFEND
		worker.stop()
		return
	var entry: Vector3 = mission.city.sites[site_id].spec.entry
	if worker.position.distance_to(entry) > mission.catalog.map.search_radius:
		phase = Phase.APPROACH
		if worker.path.is_empty():
			worker.order_move(entry, mission.city)
		return
	phase = Phase.WORK
	worker.stop()
	worker.searching = true

func advance(delta: float, mission: Node3D) -> void:
	if worker == null:
		return
	# Enemies act after prepare; a hit/death this frame must win over completion.
	if worker.dead:
		prepare(0, mission)
		return
	if not worker.searching or safe_left > 0 or _threatened(mission):
		return
	var site: Dictionary = mission.city.sites[site_id]
	var seconds: float = mission.effects.search_seconds(site.spec.search_seconds, worker.talent.search_multiplier)
	site.progress = minf(1.0, site.progress + delta / seconds)
	mission.city.update_site(site_id)
	if site.progress >= 1.0:
		site.searched = true
		mission.city.update_site(site_id)
		mission.drop_loot(site.spec.entry, site.spec.food, site.spec.scrap, mission.reward_for_site(site_id))
		mission.notice.emit("%s 搜索完成 · %s 归队" % [site.spec.name, worker.data.display_name])
		release(mission)

func status(mission: Node3D) -> String:
	if worker == null:
		return ""
	var site: Dictionary = mission.city.sites[site_id]
	var action: String = ["前往入口", "搜索中", "遇险自卫 · 搜索暂停"][phase]
	return "%s · %s\n%s · %d%%" % [worker.data.display_name, site.spec.name, action, site.progress * 100]
