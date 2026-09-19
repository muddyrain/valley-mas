extends SceneTree
## Frozen public resources -> native candidate Skeleton3D; no controller, retarget or IK.
const LIBRARY_PATH := "res://assets/public_locomotion.tres"
const OUT := "res://evidence/"
var IDS: Array[String] = ["canonical"]
const CLIPS: Array[StringName] = [&"public_idle", &"public_walking", &"public_running"]
const VIEWS: Array[String] = ["front", "side", "three_quarter", "feet"]
var library: AnimationLibrary
var actors: Dictionary = {}
var players: Dictionary = {}
var skeletons: Dictionary = {}
var viewports: Array[SubViewport] = []
var failures: Array[String] = []
var assertions: int = 0

func _initialize() -> void:
    call_deferred("run")

func check(ok: bool, message: String) -> void:
    assertions += 1
    if not ok and not failures.has(message):
        failures.append(message)
        push_error(message)

func matrix(t: Transform3D) -> Array[float]:
    return [t.basis.x.x, t.basis.y.x, t.basis.z.x, t.origin.x,
        t.basis.x.y, t.basis.y.y, t.basis.z.y, t.origin.y,
        t.basis.x.z, t.basis.y.z, t.basis.z.z, t.origin.z]

func save_json(path: String, value: Variant) -> void:
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
    var file := FileAccess.open(path, FileAccess.WRITE)
    assert(file != null)
    file.store_string(JSON.stringify(value))

func binary(path: String, data: PackedByteArray) -> void:
    var file := FileAccess.open(OUT + path, FileAccess.WRITE)
    assert(file != null)
    file.store_buffer(data)

func setup() -> void:
    if "dual" in OS.get_cmdline_user_args():
        IDS = ["xia_zhiyao", "su_wanxing"]
    library = load(LIBRARY_PATH) as AnimationLibrary
    assert(library != null)
    for id: String in IDS:
        var actor := (load("res://candidates/" + id + ".glb") as PackedScene).instantiate() as Node3D
        root.add_child(actor)
        var skeleton := actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
        var player := AnimationPlayer.new()
        actor.add_child(player)
        player.root_node = player.get_path_to(skeleton.get_parent())
        player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
        check(player.add_animation_library(&"Public", library) == OK, id + " attach library")
        check(skeleton.get_bone_count() == 23, id + " 23 bones")
        check(actor.transform.is_equal_approx(Transform3D.IDENTITY), id + " root identity")
        check(skeleton.global_transform.is_equal_approx(Transform3D.IDENTITY), id + " skeleton identity")
        for modifier: Node in actor.find_children("*", "SkeletonModifier3D", true, false):
            check(not ("Retarget" in modifier.get_class() or "IK" in modifier.get_class()), id + " no retarget / IK")
        for name: StringName in CLIPS:
            var clip := library.get_animation(name)
            for track: int in clip.get_track_count():
                var path := clip.track_get_path(track)
                var target := player.get_node(player.root_node).get_node_or_null(NodePath(path.get_concatenated_names()))
                check(target == skeleton and skeleton.find_bone(path.get_subname(0)) >= 0, id + " track " + str(path))
        actors[id] = actor
        skeletons[id] = skeleton
        players[id] = player
    check((players[IDS[0]] as AnimationPlayer).get_animation_library(&"Public") == (players[IDS[-1]] as AnimationPlayer).get_animation_library(&"Public"), "same library instance")

func skeleton_data(s: Skeleton3D) -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    for bone: int in s.get_bone_count():
        var parent := s.get_bone_parent(bone)
        result.append({"name": s.get_bone_name(bone), "parent": s.get_bone_name(parent) if parent >= 0 else "", "rest": matrix(s.get_bone_rest(bone)), "global_rest": matrix(s.global_transform * s.get_bone_global_rest(bone))})
    return result

func dump_meshes(id: String) -> Array[Dictionary]:
    var s := skeletons[id] as Skeleton3D
    var data: Array[Dictionary] = []
    for node: Node in (actors[id] as Node3D).find_children("*", "MeshInstance3D", true, false):
        var mesh := node as MeshInstance3D
        check(mesh.skin != null and mesh.get_node(mesh.skeleton) == s, id + " skin target resolves")
        var binds: Array[Dictionary] = []
        for bind: int in mesh.skin.get_bind_count():
            var name := mesh.skin.get_bind_name(bind)
            var bone := s.find_bone(name) if not name.is_empty() else mesh.skin.get_bind_bone(bind)
            check(bone >= 0, id + " bind resolves")
            binds.append({"bone": bone, "matrix": matrix(mesh.skin.get_bind_pose(bind))})
        for surface: int in mesh.mesh.get_surface_count():
            var a := mesh.mesh.surface_get_arrays(surface)
            var vertices: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
            var weights: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
            var joints: PackedInt32Array = a[Mesh.ARRAY_BONES]
            var indices: PackedInt32Array = a[Mesh.ARRAY_INDEX]
            var prefix := id + "_surface_" + str(data.size())
            binary(prefix + "_positions.bin", vertices.to_byte_array())
            binary(prefix + "_weights.bin", weights.to_byte_array())
            binary(prefix + "_joints.bin", joints.to_byte_array())
            binary(prefix + "_indices.bin", indices.to_byte_array())
            data.append({"prefix": prefix, "vertices": vertices.size(), "influences": weights.size() / vertices.size(), "binds": binds, "world_transform": matrix(mesh.global_transform)})
    return data

func set_pose(id: String, clip: StringName, time: float) -> void:
    var player := players[id] as AnimationPlayer
    player.play(&"Public/" + clip)
    player.seek(time, true)
    (skeletons[id] as Skeleton3D).force_update_all_bone_transforms()

func dump_samples(id: String, name: StringName) -> Dictionary:
    var clip := library.get_animation(name)
    var s := skeletons[id] as Skeleton3D
    var count := int(round(clip.length * 120.0))
    var samples: Array[Dictionary] = []
    var original_rest := skeleton_data(s)
    s.reset_bone_poses()
    for i: int in count + 1:
        # The final runtime sample is just before wrapping. Raw key endpoints are checked separately.
        var time := minf(i / 120.0, clip.length - 0.000001)
        set_pose(id, name, time)
        var poses: Array[Array] = []
        for b: int in s.get_bone_count():
            var pose := s.global_transform * s.get_bone_global_pose(b)
            check(pose.is_finite(), id + " finite pose")
            poses.append(matrix(pose))
        samples.append({"time": time, "poses": poses})
    check(original_rest == skeleton_data(s), id + " rest unchanged")
    check((actors[id] as Node3D).transform.is_equal_approx(Transform3D.IDENTITY), id + " no model offset")
    print("SAMPLED ", id, " ", name, " ", samples.size())
    return {"length": clip.length, "samples": samples}

func dump() -> void:
    var reference := (load("res://candidates/canonical.glb") as PackedScene).instantiate()
    root.add_child(reference)
    var ref_s := reference.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
    var result: Dictionary = {"engine": Engine.get_version_info().string, "library_sha256": FileAccess.get_sha256(LIBRARY_PATH), "reference_bones": skeleton_data(ref_s), "characters": {}, "clips": {}}
    reference.free()
    for name: StringName in CLIPS:
        var clip := library.get_animation(name)
        var endpoints: Array[Dictionary] = []
        for t: int in clip.get_track_count():
            var first: Variant = clip.track_get_key_value(t, 0)
            var last: Variant = clip.track_get_key_value(t, clip.track_get_key_count(t) - 1)
            var err: float = 0.0
            if clip.track_get_type(t) == Animation.TYPE_ROTATION_3D:
                err = (first as Quaternion).angle_to(last as Quaternion)
            elif clip.track_get_type(t) == Animation.TYPE_POSITION_3D:
                err = (first as Vector3).distance_to(last as Vector3)
            endpoints.append({"path": str(clip.track_get_path(t)), "type": clip.track_get_type(t), "endpoint_error": err, "interpolation": clip.track_get_interpolation_type(t), "keys": clip.track_get_key_count(t)})
        result.clips[name] = {"length": clip.length, "step": clip.step, "loop_mode": clip.loop_mode, "nominal_speed": clip.get_meta("nominal_speed"), "tracks": endpoints}
    for id: String in IDS:
        var character: Dictionary = {"bones": skeleton_data(skeletons[id]), "meshes": dump_meshes(id), "clips": {}}
        for name: StringName in CLIPS:
            character.clips[name] = dump_samples(id, name)
        result.characters[id] = character
    check(result.characters[IDS[0]].bones == result.characters[IDS[-1]].bones, "exact same imported rest / hierarchy")
    result["checks"] = assertions
    result["failures"] = failures
    result["shared_library_instance"] = (players[IDS[0]] as AnimationPlayer).get_animation_library(&"Public") == (players[IDS[-1]] as AnimationPlayer).get_animation_library(&"Public")
    result["resource_identity"] = {}
    for id: String in IDS:
        var ids: Dictionary = {"library_instance_id": str((players[id] as AnimationPlayer).get_animation_library(&"Public").get_instance_id()), "clip_instance_ids": {}, "candidate_sha256": FileAccess.get_sha256("res://candidates/"+id+".glb")}
        for clip: StringName in CLIPS:
            ids.clip_instance_ids[clip] = str((players[id] as AnimationPlayer).get_animation(&"Public/"+clip).get_instance_id())
        result.resource_identity[id] = ids
    save_json(OUT + ("dual-runtime-samples.json" if IDS.size() > 1 else "canonical-runtime-samples.json"), result)

func stage() -> void:
    var environment := WorldEnvironment.new()
    environment.environment = Environment.new()
    environment.environment.background_mode = Environment.BG_COLOR
    environment.environment.background_color = Color("#293442")
    environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    environment.environment.ambient_light_color = Color.WHITE
    environment.environment.ambient_light_energy = 0.3
    root.add_child(environment)
    var light := DirectionalLight3D.new()
    light.rotation_degrees = Vector3(-40, -25, 0)
    light.light_energy = 0.65
    light.shadow_enabled = true
    root.add_child(light)
    var plane := MeshInstance3D.new()
    var ground := PlaneMesh.new()
    ground.size = Vector2(8, 8)
    plane.mesh = ground
    var material := StandardMaterial3D.new()
    material.albedo_color = Color("#68727b")
    material.roughness = 1.0
    plane.material_override = material
    root.add_child(plane)
    for view: String in VIEWS:
        var viewport := SubViewport.new()
        viewport.size = Vector2i(640, 640)
        viewport.world_3d = root.world_3d
        viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
        viewport.msaa_3d = Viewport.MSAA_4X
        root.add_child(viewport)
        var camera := Camera3D.new()
        camera.projection = Camera3D.PROJECTION_ORTHOGONAL
        camera.size = 1.95
        viewport.add_child(camera)
        var target := Vector3(0, 0.80, 0)
        match view:
            "front": camera.position = Vector3(0, 0.86, 4)
            "side": camera.position = Vector3(4, 0.86, 0)
            "three_quarter": camera.position = Vector3(2.8, 1.12, 3.6)
            "feet":
                camera.position = Vector3(2.2, 0.45, 3.0)
                target = Vector3(0, 0.18, 0)
                camera.size = 0.95
        camera.look_at(target)
        camera.make_current()
        viewports.append(viewport)

func capture() -> void:
    stage()
    var smoke := "smoke" in OS.get_cmdline_user_args()
    for id: String in IDS:
        for other: String in IDS:
            (actors[other] as Node3D).visible = other == id
        for clip: StringName in CLIPS:
            var length := library.get_animation(clip).length
            var fps: int = 30 if clip == &"public_idle" else (120 if clip == &"public_walking" else 60)
            var count := int(round(length * fps))
            (skeletons[id] as Skeleton3D).reset_bone_poses()
            for view: String in VIEWS:
                DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT + id + "/" + String(clip).to_lower() + "/" + view))
            for frame: int in (1 if smoke else count):
                set_pose(id, clip, frame / float(fps))
                await process_frame
                await RenderingServer.frame_post_draw
                for i: int in VIEWS.size():
                    var pixels := viewports[i].get_texture().get_image()
                    check(pixels.save_png(OUT + id + "/" + String(clip).to_lower() + "/" + VIEWS[i] + "/%04d.png" % frame) == OK, "save native frame")
            print("CAPTURED ", id, " ", clip, " frames=", (1 if smoke else count), " views=4")
    save_json(OUT + ("capture-smoke.json" if smoke else ("dual-capture.json" if IDS.size() > 1 else "canonical-capture.json")), {"checks": assertions, "failures": failures, "fps": {"public_idle":30,"public_walking":120,"public_running":60}, "resolution": [640,640], "source_sha256": FileAccess.get_sha256(LIBRARY_PATH)})

func run() -> void:
    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
    setup()
    if "capture" in OS.get_cmdline_user_args():
        await capture()
    else:
        dump()
    print("DIRECT DRIVE HARNESS: checks=", assertions, " failures=", failures)
    for id: String in IDS:
        (actors[id] as Node3D).queue_free()
    await process_frame
    quit(0 if failures.is_empty() else 1)
