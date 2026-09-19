extends SceneTree
## Sample only approved Animation resources and the unchanged production rig.

const OUT: String = "res://"
const SOURCE: String = "res://assets/characters/survivor_animation_template/source/survivor_animation_template.fbx"
const CLIPS: String = "res://assets/characters/survivor_animation_template/animations/"

func _initialize() -> void:
    call_deferred("run")

func vector(value: Vector3) -> Array[float]:
    return [value.x, value.y, value.z]

func matrix(value: Transform3D) -> Array:
    return [[value.basis.x.x, value.basis.y.x, value.basis.z.x, value.origin.x],
        [value.basis.x.y, value.basis.y.y, value.basis.z.y, value.origin.y],
        [value.basis.x.z, value.basis.y.z, value.basis.z.z, value.origin.z], [0, 0, 0, 1]]

func describe(actor: Node3D) -> Dictionary:
    var skeleton: Skeleton3D = actor.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
    skeleton.reset_bone_poses()
    var bones: Array[Dictionary] = []
    for index: int in skeleton.get_bone_count():
        bones.append({"name": str(skeleton.get_bone_name(index)), "parent": skeleton.get_bone_parent(index), "rest": matrix(skeleton.get_bone_rest(index)), "world": matrix(skeleton.global_transform * skeleton.get_bone_global_rest(index))})
    var meshes: Array[Dictionary] = []
    for node: Node in actor.find_children("*", "MeshInstance3D", true, false):
        var mesh: MeshInstance3D = node as MeshInstance3D
        assert(mesh.skin != null and mesh.get_node(mesh.skeleton) == skeleton)
        var binds: Array[Dictionary] = []
        for bind: int in mesh.skin.get_bind_count():
            binds.append({"bone": skeleton.find_bone(mesh.skin.get_bind_name(bind)), "pose": matrix(mesh.skin.get_bind_pose(bind))})
        for surface: int in mesh.mesh.get_surface_count():
            var arrays: Array = mesh.mesh.surface_get_arrays(surface)
            var vertices: Array = []
            for vertex: Vector3 in arrays[Mesh.ARRAY_VERTEX]:
                vertices.append(vector(vertex))
            meshes.append({"name": str(mesh.name), "world": matrix(mesh.global_transform), "binds": binds, "vertices": vertices, "weights": Array(arrays[Mesh.ARRAY_WEIGHTS]), "indices": Array(arrays[Mesh.ARRAY_BONES])})
    return {"bones": bones, "skeleton_world": matrix(skeleton.global_transform), "skeleton_path": str(actor.get_path_to(skeleton)), "meshes": meshes}

func save_json(path: String, value: Dictionary) -> void:
    var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
    assert(file != null)
    file.store_string(JSON.stringify(value))
    file.close()

func run() -> void:
    var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://source-rig.json"))
    var target := (load("res://candidates/canonical.glb") as PackedScene).instantiate() as Node3D
    root.add_child(target)
    await process_frame
    data.target = describe(target)
    for id: String in ["xia_zhiyao", "su_wanxing"]:
        var candidate := (load("res://candidates/"+id+".glb") as PackedScene).instantiate() as Node3D
        root.add_child(candidate)
        var bones: Array = describe(candidate).bones
        assert(bones.size() == data.target.bones.size())
        for b: Dictionary in data.target.bones:
            var matches := bones.filter(func(x: Dictionary) -> bool: return x.name == b.name)
            assert(matches.size() == 1)
            assert(matches[0].rest == b.rest, "Frozen canonical Rest mismatch: " + b.name)
            assert(matches[0].world == b.world, "Frozen canonical global Rest mismatch: " + b.name)
            var target_parent: String = data.target.bones[int(b.parent)].name if int(b.parent) >= 0 else ""
            var candidate_parent: String = bones[int(matches[0].parent)].name if int(matches[0].parent) >= 0 else ""
            assert(target_parent == candidate_parent, "Frozen hierarchy mismatch: " + b.name)
        candidate.free()
    save_json("res://rigs.json", data)
    target.free()
    print("CANONICAL REST MATCH: both candidates")
    quit()
