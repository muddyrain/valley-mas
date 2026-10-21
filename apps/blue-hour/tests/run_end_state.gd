extends SceneTree

const Fixtures = preload("res://tests/run_end_fixtures.gd")
const Summary = preload("res://ui/run_end_summary.gd")
const Store = preload("res://core/save_store.gd")
var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	run.call_deferred()

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	for count: int in [1, 2, 3, 4, 8, 12]:
		var game: RefCounted = Fixtures.victory(count)
		check(game.valid_state(game.data), "Valid won fixture: %d" % count)
		var before: Dictionary = game.data.duplicate(true)
		var result: Dictionary = Summary.from_campaign(game)
		check(result.members.size() == count and result.alive_count == count, "Exact actual membership: %d" % count)
		var ids: Array[String] = []
		for member: Dictionary in result.members:
			check(member.member_id not in ids and member.member_id in game.data.members, "Stable unique member ID")
			ids.append(member.member_id)
			check(member.status == "alive", "Only current living members are marked alive")
			var definition: Resource = game.member_template(member.member_id)
			check(member.survivor_id == definition.survivor_id and member.portrait_path == definition.portrait_path, "Definition owns identity and portrait")
		check(result.food == game.data.food and result.scrap == game.data.scrap and result.day == game.data.day, "Final values are exact")
		for repeat: int in 20:
			Summary.from_campaign(game)
		check(game.data == before and not game.commit_day(), "Summary is read-only; terminal settlement cannot repeat")
	var mixed: RefCounted = Fixtures.mixed_victory()
	check(mixed.valid_state(mixed.data), "Mixed fixture remains save-valid")
	var result: Dictionary = Summary.from_campaign(mixed)
	var statuses: Dictionary = {}
	for member: Dictionary in result.members:
		statuses[member.member_id] = member.status
	check(result.members.size() == 4 and result.alive_count == 1, "Includes historical losses without padding")
	check(statuses.xia_zhiyao == "combat" and statuses.su_wanxing == "alive" and statuses.lin_jianyue == "starved" and statuses.lu_qinghe == "starved", "Combat and hunger causes come from their history IDs")
	for game: RefCounted in [Fixtures.combat_loss(2), Fixtures.hunger_loss(2)]:
		check(game.valid_state(game.data), "Lost fixture is save-valid")
		result = Summary.from_campaign(game)
		check(result.alive_count == 0 and result.members.size() == 2, "Zero survivors retain real historical cards")
		check(not result.reason.is_empty(), "True failure has a reason")
		var store := Store.new("user://test-runs/run-end-state-%d.json" % OS.get_process_id())
		check(store.write(game.data, game.valid_state).is_empty(), "Terminal state saves")
		var restored: RefCounted = Fixtures.fresh(1)
		check(restored.restore(store.read(restored.valid_state).data), "Terminal state restores")
		check(Summary.from_campaign(restored) == result, "Terminal summary survives save/restore exactly")
		var saved: String = FileAccess.get_file_as_string(store.path)
		Summary.from_campaign(restored)
		check(FileAccess.get_file_as_string(store.path) == saved, "Displaying terminal never writes save")
	# Legacy migration may populate roster with unused templates: history + living IDs remain authoritative.
	var sparse: RefCounted = Fixtures.combat_loss(1)
	sparse.data.roster["unused"] = {"template": "zhou_ye", "level": 1}
	check(Summary.from_campaign(sparse).members.size() == 1, "Never enumerate whole roster/catalog/unlocked directory")
	var legacy: Dictionary = Fixtures.combat_loss(1).data.duplicate(true)
	legacy.version = 1
	var migrated: RefCounted = Fixtures.fresh(1)
	check(migrated.restore(legacy), "Real v1 migration accepts terminal fixture")
	check(migrated.data.roster.size() > 1 and Summary.from_campaign(migrated).members.size() == 1, "v1 migration's full catalog never becomes a fictional Run roster")
	sparse.data.history = [{"returned_ids": ["xia_zhiyao"]}]
	result = Summary.from_campaign(sparse)
	check(result.members[0].status == "unknown", "Missing loss evidence is never invented")
	check(result.reason.contains("记录不详"), "Missing terminal cause is explicit")
	sparse.data.history = []
	check(Summary.from_campaign(sparse).members.is_empty(), "No evidence creates no fictional members")
	check(Summary.from_campaign(Fixtures.fresh(2)).is_empty(), "Nonterminal has no result page")
	print("RUN END STATE: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
