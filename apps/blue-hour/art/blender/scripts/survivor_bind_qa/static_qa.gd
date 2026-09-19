extends "res://direct_drive_qa.gd"
## Static skeletal probes, never saved as Animation or applied to Rest.
func bend(skeleton: Skeleton3D, bone: String, axis: Vector3, degrees: float) -> void:
    var i := skeleton.find_bone(bone)
    var global_rest := skeleton.get_bone_global_rest(i).basis.orthonormalized()
    var local_axis := global_rest.inverse() * axis
    var rest_rotation := skeleton.get_bone_rest(i).basis.orthonormalized().get_rotation_quaternion()
    skeleton.set_bone_pose_rotation(i, rest_rotation * Quaternion(local_axis.normalized(), deg_to_rad(degrees)))

func run() -> void:
    setup()
    stage()
    var tests: Array[String] = ["t_rest", "arm_45", "arm_90", "elbow_90", "knee_90"]
    var result: Dictionary = {}
    for id: String in IDS:
        for other: String in IDS:
            (actors[other] as Node3D).visible = other == id
        var skeleton := skeletons[id] as Skeleton3D
        result[id] = {}
        for pose: String in tests:
            (players[id] as AnimationPlayer).stop()
            skeleton.reset_bone_poses()
            match pose:
                "arm_45":
                    bend(skeleton, "LeftUpperArm", Vector3(0,0,1), -45)
                    bend(skeleton, "RightUpperArm", Vector3(0,0,1), 45)
                "arm_90":
                    bend(skeleton, "LeftUpperArm", Vector3(0,1,0), -90)
                    bend(skeleton, "RightUpperArm", Vector3(0,1,0), 90)
                "elbow_90":
                    bend(skeleton, "LeftLowerArm", Vector3(0,1,0), -90)
                    bend(skeleton, "RightLowerArm", Vector3(0,1,0), 90)
                "knee_90":
                    bend(skeleton, "LeftUpperLeg", Vector3(1,0,0), -30)
                    bend(skeleton, "LeftLowerLeg", Vector3(1,0,0), 90)
            skeleton.force_update_all_bone_transforms()
            var matrices: Array[Array] = []
            for i: int in skeleton.get_bone_count():
                matrices.append(matrix(skeleton.global_transform * skeleton.get_bone_global_pose(i)))
            result[id][pose] = matrices
            await process_frame
            await RenderingServer.frame_post_draw
            var dir := OUT+id+"/static/"+pose+"/"
            DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
            for i: int in VIEWS.size():
                viewports[i].get_texture().get_image().save_png(dir+VIEWS[i]+".png")
            print("STATIC ",id," ",pose)
    save_json(OUT+"static-poses.json",result)
    quit()
