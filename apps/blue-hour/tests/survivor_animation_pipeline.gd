extends SceneTree

const Pipeline = preload("res://survivors/survivor_animation_pipeline.gd")
const XIA_SCENE = preload("res://assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb")
const EXPECTED_CLIPS: Array[StringName] = [
	&"survivor_idle", &"survivor_walk", &"survivor_run", &"rifle_idle", &"rifle_run",
	&"rifle_shoot", &"unarmed_idle", &"knife_idle", &"knife_attack", &"hit_reaction", &"death",
]
const PREVIEW_STATES: Array[StringName] = [&"IDLE", &"WALK", &"RUN", &"RIFLE_IDLE", &"RIFLE_RUN", &"RIFLE_SHOOT", &"KNIFE_IDLE", &"ATTACK", &"HIT", &"DEATH"]

var checks: int = 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var capture: bool = OS.get_environment("BH_CAPTURE") == "1"
	if capture:
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://test-output/survivor-animation"))
	var preview := load("res://scenes/debug/survivor_animation_preview.tscn").instantiate() as Node3D
	root.add_child(preview)
	var model := preview.get_node("XiaZhiyao") as Node3D
	var pipeline := Pipeline.new()
	model.add_child(pipeline)
	check(pipeline.initialize(model), "Xia Zhiyao initializes on the existing survivor skeleton")
	if pipeline.target == null:
		_finish()
		return
	check(pipeline.target.get_bone_count() == 23, "The target retains the frozen 23-bone Skeleton3D")
	check(pipeline.library.get_animation_list().size() == EXPECTED_CLIPS.size(), "All eleven named clips enter one AnimationLibrary")
	for clip_name: StringName in EXPECTED_CLIPS:
		check(pipeline.library.has_animation(clip_name), "%s exists in AnimationLibrary" % clip_name)
		if not pipeline.library.has_animation(clip_name):
			continue
		var animation := pipeline.library.get_animation(clip_name)
		check(animation.get_track_count() >= 22, "%s targets the canonical animated bones" % clip_name)
		for track_index: int in animation.get_track_count():
			check(animation.track_get_path(track_index).get_subname(0) in [&"Hips", &"Spine", &"Chest", &"UpperChest", &"Neck", &"Head", &"LeftShoulder", &"LeftUpperArm", &"LeftLowerArm", &"LeftHand", &"RightShoulder", &"RightUpperArm", &"RightLowerArm", &"RightHand", &"LeftUpperLeg", &"LeftLowerLeg", &"LeftFoot", &"LeftToes", &"RightUpperLeg", &"RightLowerLeg", &"RightFoot", &"RightToes"], "%s uses canonical bone paths" % clip_name)
	check(pipeline.tree.active, "AnimationTree is active")
	for state_name: StringName in PREVIEW_STATES:
		check(pipeline.play_state(state_name, true), "%s state can start" % state_name)
		for frame: int in (15 if capture else 6):
			pipeline.advance(1.0 / 30.0 if capture else 0.04)
			await process_frame
		check(pipeline.playback.get_current_node() == state_name, "%s is active in AnimationTree" % state_name)
		if capture:
			await RenderingServer.frame_post_draw
			var image := root.get_viewport().get_texture().get_image()
			image.save_png("res://test-output/survivor-animation/%s.png" % String(state_name.to_lower()))
			for frame: int in 15:
				pipeline.advance(1.0 / 30.0)
				await process_frame
				await RenderingServer.frame_post_draw
				root.get_viewport().get_texture().get_image().save_png("res://test-output/survivor-animation/frame-%04d.png" % (PREVIEW_STATES.find(state_name) * 15 + frame))
	var baseline: Transform3D = pipeline.target.get_bone_global_pose(pipeline.target.find_bone("RightUpperArm"))
	pipeline.play_state(&"ATTACK", true)
	for frame: int in 8:
		pipeline.advance(0.04)
		await process_frame
	var attack_pose: Transform3D = pipeline.target.get_bone_global_pose(pipeline.target.find_bone("RightUpperArm"))
	check(not baseline.is_equal_approx(attack_pose), "AnimationTree changes Xia's canonical Skeleton3D pose")
	var output := {"checks": checks, "failures": failures, "bone_count": pipeline.target.get_bone_count(), "clips": EXPECTED_CLIPS, "states": PREVIEW_STATES}
	var file := FileAccess.open("res://test-output/survivor-animation-validation.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(output, "\t"))
	print("SURVIVOR ANIMATION PIPELINE: %d checks; failures=%s" % [checks, failures])
	_finish()

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)

func _finish() -> void:
	quit(0 if failures.is_empty() else 1)
