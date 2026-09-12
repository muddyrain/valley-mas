extends RefCounted
## POI profiles choose initial encounters; mission.gd retains pooling and the time director.

const PROFILES: Dictionary = {"street": "ENM_001_infected_basic_a", "service": "ENM_001_infected_basic_a"}

static func resolve(sites: Array[Dictionary], spawn_points: Array[Vector3]) -> Array[Dictionary]:
	var encounters: Array[Dictionary] = []
	for index: int in range(mini(sites.size(), spawn_points.size())):
		encounters.append({"id": PROFILES[sites[index].enemy_profile], "position": spawn_points[index], "poi_id": sites[index].id})
	return encounters
