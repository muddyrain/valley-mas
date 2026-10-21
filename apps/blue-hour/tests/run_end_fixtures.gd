extends RefCounted
## Isolated Campaign API fixtures, never evidence of playing a production sortie.

const Catalog = preload("res://data/catalog.gd")
const Campaign = preload("res://core/campaign.gd")
const TEMPLATES: Array[String] = ["xia_zhiyao", "su_wanxing", "lin_jianyue", "lu_qinghe", "gu_yuan", "tang_zhi", "xu_zhaoning", "shen_yanchuan", "he_linchuan", "cheng_mo", "song_shiyu", "zhou_ye"]

static func fresh(count: int) -> RefCounted:
	var game := Campaign.new(Catalog.new())
	game.new_run(772, "", TEMPLATES.slice(0, count))
	return game

static func stage(game: RefCounted, food: int, lost: Array = []) -> bool:
	if not game.start_action():
		return false
	var returned: Array = game.data.members.filter(func(id: String) -> bool: return id not in lost)
	return game.stage_result({"returned_ids": returned, "lost_ids": lost.duplicate(), "food": food, "scrap": 3, "weapons": [], "wiped": returned.is_empty(), "seconds": 10.0, "kills": lost.size()})

static func victory(count: int) -> RefCounted:
	var game := fresh(count)
	for day: int in game.catalog.loop.end_day:
		assert(stage(game, count))
		assert(game.commit_day())
	return game

static func combat_loss(count: int) -> RefCounted:
	var game := fresh(count)
	assert(stage(game, 0, game.data.members.duplicate()))
	assert(game.commit_day())
	return game

static func hunger_loss(count: int) -> RefCounted:
	var game := fresh(count)
	game.data.food = 0
	assert(stage(game, 0))
	assert(game.commit_day())
	assert(stage(game, 0))
	assert(game.commit_day())
	return game

static func mixed_victory() -> RefCounted:
	var game := fresh(4)
	assert(stage(game, 0, [TEMPLATES[0]]))
	assert(game.commit_day())
	game.data.food = 0
	assert(stage(game, 0))
	assert(game.commit_day())
	assert(stage(game, 1))
	assert(game.commit_day([TEMPLATES[1]]))
	while game.data.status == "shelter":
		assert(stage(game, 1))
		assert(game.commit_day())
	return game
