extends "res://direct_drive_qa.gd"
## Same public keys, cameras and lighting for direct sleeve comparisons.

func run() -> void:
    IDS = ["xia_zhiyao", "su_wanxing"]
    setup()
    stage()
    var specs: Array[Dictionary] = [
        {"name":"upper_side", "eye":Vector3(3,1.13,0), "at":Vector3(0,1.10,0), "size":0.94},
        {"name":"three_quarter", "eye":Vector3(2.8,1.22,3.6), "at":Vector3(0,1.10,0), "size":1.08},
        {"name":"upper_front", "eye":Vector3(0,1.13,3), "at":Vector3(0,1.10,0), "size":1.05},
        {"name":"upper_back", "eye":Vector3(0,1.16,-3), "at":Vector3(0,1.10,0), "size":1.05}]
    for i: int in specs.size():
        var camera := viewports[i].get_camera_3d()
        camera.position = specs[i].eye
        camera.look_at(specs[i].at)
        camera.size = specs[i].size
    var only_probe := "probe" in OS.get_cmdline_user_args()
    for id: String in IDS:
        for other: String in IDS:
            (actors[other] as Node3D).visible = other == id
        for variant: String in ["reference", "polished"]:
            var actor := actors[id] as Node3D
            var player := players[id] as AnimationPlayer
            var skeleton := skeletons[id] as Skeleton3D
            var reference: Node3D
            if variant == "reference":
                actor.visible = false
                reference = (load("res://candidates/"+id+"_reference.glb") as PackedScene).instantiate() as Node3D
                root.add_child(reference)
                var ref_skeleton := reference.find_children("*","Skeleton3D",true,false)[0] as Skeleton3D
                var ref_player := AnimationPlayer.new()
                reference.add_child(ref_player)
                ref_player.root_node = ref_player.get_path_to(ref_skeleton.get_parent())
                ref_player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
                ref_player.add_animation_library(&"Public",library)
                players[id] = ref_player
                skeletons[id] = ref_skeleton
            for frame: int in (8 if only_probe else 40):
                var time := frame / 12.0 if only_probe else frame / 60.0
                set_pose(id,&"public_running",time)
                await process_frame
                await RenderingServer.frame_post_draw
                for i: int in specs.size():
                    var dir: String = OUT+id+"/"+variant+"/"+specs[i].name+"/"
                    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
                    check(viewports[i].get_texture().get_image().save_png(dir+"%04d.png"%frame)==OK,"save upper frame")
            for i: int in 4:
                set_pose(id,&"public_idle",[0.0,4.5,10.25,13.0][i])
                await process_frame
                await RenderingServer.frame_post_draw
                var dir := OUT+id+"/"+variant+"/idle/"
                DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
                check(viewports[2].get_texture().get_image().save_png(dir+"upper_front_%02d.png"%i)==OK,"save idle upper")
                var front_camera := viewports[2].get_camera_3d()
                front_camera.position = Vector3(0,.86,4)
                front_camera.size = 1.95
                front_camera.look_at(Vector3(0,.80,0))
                await process_frame
                await RenderingServer.frame_post_draw
                check(viewports[2].get_texture().get_image().save_png(dir+"front_%02d.png"%i)==OK,"save idle front")
                front_camera.position = specs[2].eye
                front_camera.look_at(specs[2].at)
                front_camera.size = specs[2].size
            if is_instance_valid(reference):
                reference.free()
                players[id] = player
                skeletons[id] = skeleton
                actor.visible = true
            print("UPPER CAPTURE ",id," ",variant)
    save_json(OUT+"upper-capture.json",{"checks":assertions,"failures":failures,"fps":60,"probe":only_probe})
    quit(0 if failures.is_empty() else 1)
