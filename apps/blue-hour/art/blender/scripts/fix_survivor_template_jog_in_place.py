import bpy
import os

SOURCE = r"C:\Users\A\Downloads\meshytmp2\Meshy_AI_survivor_animation_te_biped\Meshy_AI_survivor_animation_te_biped_Meshy_AI_Meshy_Merged_Animations.fbx"
OUTPUT = r"C:\Users\A\Downloads\survivor_animation_template_jog_in_place.fbx"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SOURCE)
armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
action = next(action for action in bpy.data.actions if "01a0a570" in action.name)
bag = action.layers[0].strips[0].channelbags[0]
hip_curves = [fc for fc in bag.fcurves if fc.data_path == 'pose.bones["Hips"].location']
if not hip_curves:
    raise RuntimeError("Hips location curves were not found")

axis_data = {}
for curve in hip_curves:
    if curve.array_index != 1:
        continue
    first = curve.evaluate(curve.range()[0])
    last = curve.evaluate(curve.range()[1])
    axis_data["first"] = first
    axis_data["last"] = last
    start, end = curve.range()
    span = end - start
    for key in curve.keyframe_points:
        t = (key.co.x - start) / span if span else 0.0
        key.co.y -= first + (last - first) * t
    curve.update()

armature.animation_data_create()
armature.animation_data.action = action
for obj in bpy.context.selected_objects:
    obj.select_set(False)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.export_scene.fbx(
    filepath=OUTPUT,
    use_selection=False,
    object_types={"ARMATURE", "MESH"},
    bake_anim=True,
    bake_anim_use_all_actions=True,
    bake_anim_use_nla_strips=False,
    bake_anim_use_all_bones=True,
    add_leaf_bones=False,
    path_mode="COPY",
)
print("JOG_HIPS_Y_DETREND", axis_data)
print("OUTPUT", OUTPUT)
