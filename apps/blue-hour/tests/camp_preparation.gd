extends SceneTree

const Main = preload("res://core/main.gd")
const Store = preload("res://core/save_store.gd")
var checks: int = 0
var failures: Array[String] = []
var app: Node

class CountingStore extends RefCounted:
	var delegate: RefCounted
	var writes: int = 0
	var fail: bool = false
	func write(data: Dictionary, validator: Callable) -> String:
		writes += 1
		return "测试写入失败" if fail else delegate.write(data, validator)
	func read(validator: Callable = Callable()) -> Dictionary:
		return delegate.read(validator)

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func run() -> void:
	create_timer(90).timeout.connect(func() -> void: quit(2))
	app = Main.new()
	check(app.has_method("apply_preparation_action") and app.has_method("open_preparation"), "Formal Main exposes real preparation transactions and entry")
	if not failures.is_empty():
		app.free()
		quit(1)
		return
	app.save_path = "user://test-runs/preparation-%d.json" % OS.get_process_id()
	app.fresh_test_run = true
	root.add_child(app)
	for frame: int in 12:
		await process_frame
	var counted := CountingStore.new()
	counted.delegate = Store.new(app.save_path)
	app.store = counted
	var game: RefCounted = app.campaign
	game.new_run(772, "combat")
	game.data.food = 30
	game.data.scrap = 100
	var ids: Array = game.data.members.duplicate()
	var first: String = ids[0]
	var second: String = ids[1]
	var uid: String = game.data.equipment[first]
	var same_kind: Dictionary = game.item(uid).duplicate(true)
	same_kind.uid = "fixture-same-model"
	game.data.inventory.append(same_kind)
	app.show_shelter()
	for action: String in ["equip", "unequip", "buy", "train"]:
		var target: String = "" if action == "buy" else first
		var offer: String = game.data.shop[0].uid if action == "buy" else same_kind.uid
		var before: Dictionary = game.data.duplicate(true)
		check(counted.delegate.write(before, game.valid_state).is_empty(), action + ": initial fixture persisted")
		var disk: String = FileAccess.get_file_as_string(app.save_path)
		counted.fail = true
		var calls: int = counted.writes
		check(not app.apply_preparation_action(action, target, offer, before), action + ": failed write rejected")
		check(counted.writes == calls + 1, action + ": exactly one attempted save")
		check(game.data == before and FileAccess.get_file_as_string(app.save_path) == disk, action + ": complete memory and disk rollback")
		check(app.camp_ui.get_node("M03_ResourceBar/ResourceFood/Value").text == str(before.food), action + ": rollback HUD reads Campaign")
		app.save_error_dialog.hide()
		counted.fail = false
		calls = counted.writes
		check(app.apply_preparation_action(action, target, offer, before), action + ": successful transaction")
		check(counted.writes == calls + 1, action + ": one successful save")
		check(not app.apply_preparation_action(action, target, offer, before) and counted.writes == calls + 1, action + ": stale repeated input cannot commit again")
		check(counted.read(game.valid_state).data == JSON.parse_string(JSON.stringify(game.data)), action + ": persistent representation agrees")
	var before: Dictionary = game.data.duplicate(true)
	check(app.apply_preparation_action("equip", first, uid, before), "Transfer fixture has an actual original holder")
	before = game.data.duplicate(true)
	var disk: String = FileAccess.get_file_as_string(app.save_path)
	var transfer_writes: int = counted.writes
	counted.fail = true
	check(not app.apply_preparation_action("equip", second, uid, before), "Transfer save failure is rejected")
	check(counted.writes == transfer_writes + 1 and game.data == before and FileAccess.get_file_as_string(app.save_path) == disk, "Failed transfer restores both holders, stock and disk in one save attempt")
	app.save_error_dialog.hide()
	counted.fail = false
	check(app.apply_preparation_action("equip", second, uid, before), "Transfer uses actual member ID and weapon UID")
	check(game.data.equipment[second] == uid and game.data.equipment[first] != uid, "A transferred instance has one holder")
	check(not game.item(same_kind.uid).is_empty() and game.item(same_kind.uid).kind == game.item(uid).kind, "Same model instances remain distinct")
	before = game.data.duplicate(true)
	var calls: int = counted.writes
	check(not app.apply_preparation_action("buy", "", "missing-uid", before), "Unknown shop UID rejects a purchase with sufficient funds")
	for action: String in ["equip", "unequip", "buy", "train", "missing"]:
		check(not app.apply_preparation_action(action, "missing-member", "missing-uid", before), "Invalid request rejected: " + action)
	check(counted.writes == calls and game.data == before, "Invalid actions do not save or mutate")
	game.data.food = 0
	game.data.scrap = 0
	before = game.data.duplicate(true)
	check(not app.apply_preparation_action("train", first, "", before), "Insufficient food rejects training")
	check(not app.apply_preparation_action("buy", "", game.data.shop[1].uid, before), "Insufficient scrap rejects purchase")
	check(game.data == before, "Insufficient resources never change state")
	game.data.food = 100
	game.add_xp(first, 100)
	before = game.data.duplicate(true)
	check(not app.apply_preparation_action("train", first, "", before) and game.data == before, "Maximum level rejects training without charge")
	game.grant_effect("power", "aid")
	before = game.data.duplicate(true)
	counted.fail = true
	check(not app.apply_preparation_effect("power", "rage", "aid", before), "Owned ability replacement write failure rejected")
	check(game.data == before, "Failed owned ability replacement restores old slots and ownership")
	app.save_error_dialog.hide()
	counted.fail = false
	check(app.apply_preparation_effect("power", "rage", "aid", before), "Owned ability replacement uses existing capacity")
	check(game.data.power_slots == ["aid"] and not app.apply_preparation_effect("power", "rage", "aid", before), "Owned replacement commits once")
	before = game.data.duplicate(true)
	check(not app.apply_preparation_effect("power", "aid", "not-owned", before) and game.data == before, "Invalid replacement never loses previous ability")
	print("CAMP PREPARATION: %d checks, %d failures" % [checks, failures.size()])
	app.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
