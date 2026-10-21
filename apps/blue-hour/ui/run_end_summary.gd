extends RefCounted
## Read-only projection. Catalog availability is never evidence of Run membership.

static func from_campaign(campaign: RefCounted) -> Dictionary:
	var state: Dictionary = campaign.data
	if state.get("status") not in ["won", "lost"]:
		return {}
	var ids: Array[String] = []
	var losses: Dictionary = {}
	for entry: Dictionary in state.get("history", []):
		for key: String in ["returned_ids", "lost_ids", "starved_ids", "stayed_ids"]:
			for id: String in entry.get(key, []):
				if id not in ids:
					ids.append(id)
		for id: String in entry.get("lost_ids", []):
			losses[id] = "combat"
		for id: String in entry.get("starved_ids", []):
			losses[id] = "starved"
	for id: String in state.members:
		if id not in ids:
			ids.append(id)
	var members: Array[Dictionary] = []
	for id: String in ids:
		var definition: Resource = campaign.member_template(id)
		members.append({
			"member_id": id,
			"survivor_id": definition.survivor_id if definition != null else "",
			"display_name": definition.display_name if definition != null else id,
			"portrait_path": definition.portrait_path if definition != null else "",
			"status": "alive" if id in state.members else str(losses.get(id, "unknown")),
		})
	var reason: String = ""
	if state.status == "lost":
		var last: Dictionary = state.history.back() if not state.history.is_empty() else {}
		var combat: bool = not last.get("lost_ids", []).is_empty()
		var starved: bool = not last.get("starved_ids", []).is_empty()
		if combat and starved:
			reason = "战斗伤亡与连续缺粮 · 无人生还"
		elif starved:
			reason = "连续缺粮 · 无人生还"
		elif combat:
			reason = "小队战斗全灭"
		else:
			reason = "无人生还 · 结束原因记录不详"
	return {"status": state.status, "day": int(state.day), "end_day": int(campaign.catalog.loop.end_day), "food": int(state.food), "scrap": int(state.scrap), "alive_count": state.members.size(), "members": members, "reason": reason}
