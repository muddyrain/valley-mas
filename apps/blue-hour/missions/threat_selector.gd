extends RefCounted
## Replace this selector when the full threat system exists.

static func select(enemies: Array[Node3D], origin: Vector3) -> Node3D:
	var chosen: Node3D
	var best_rank := -1
	var best_distance := INF
	for enemy: Node3D in enemies:
		if not is_instance_valid(enemy) or not enemy.active:
			continue
		var rank: int = enemy.data.threat_rank
		var distance := origin.distance_squared_to(enemy.position)
		if rank > best_rank or (rank == best_rank and distance < best_distance):
			chosen = enemy
			best_rank = rank
			best_distance = distance
	return chosen
