extends "res://direct_drive_qa.gd"
## Supplemental native cameras expose occluded shoulders, hair and ankle deformation.
func run() -> void:
    setup()
    stage()
    var specs: Array[Dictionary] = [
        {"name":"upper_front", "eye":Vector3(0,1.15,3), "at":Vector3(0,1.1,0), "size":1.0},
        {"name":"upper_back", "eye":Vector3(0,1.2,-3), "at":Vector3(0,1.13,0), "size":1.0},
        {"name":"upper_side", "eye":Vector3(3,1.1,0), "at":Vector3(0,1.1,0), "size":1.0},
        {"name":"feet_side", "eye":Vector3(3,.2,0), "at":Vector3(0,.17,0), "size":1.0}]
    for i: int in specs.size():
        var camera := viewports[i].get_camera_3d()
        camera.position = specs[i].eye
        camera.look_at(specs[i].at)
        camera.size = specs[i].size
    for id: String in IDS:
        for other: String in IDS:
            (actors[other] as Node3D).visible = other == id
        (skeletons[id] as Skeleton3D).reset_bone_poses()
        (skeletons[id] as Skeleton3D).force_update_all_bone_transforms()
        await process_frame
        await RenderingServer.frame_post_draw
        DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT+id+"/rest/"))
        for i: int in specs.size():
            viewports[i].get_texture().get_image().save_png(OUT+id+"/rest/"+specs[i].name+".png")
        for clip: StringName in CLIPS:
            var length := library.get_animation(clip).length
            (skeletons[id] as Skeleton3D).reset_bone_poses()
            for frame: int in 8:
                set_pose(id,clip,length*frame/8.0)
                await process_frame
                await RenderingServer.frame_post_draw
                for i: int in specs.size():
                    var dir := OUT+id+"/"+String(clip).to_lower()+"/details/"
                    DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
                    viewports[i].get_texture().get_image().save_png(dir+specs[i].name+"_%02d.png"%frame)
            print("DETAILS ",id," ",clip)
    quit()
