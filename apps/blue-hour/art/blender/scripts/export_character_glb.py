"""Export the rest mesh + named skeleton + skin, never actions or animation tracks."""
from pathlib import Path
import bpy
from create_humanoid_rig import definition
from inspect_character_glb import inspect


def export_character(rig, meshes, output):
    expected = {bone['name']: bone['parent'] for bone in definition()}
    actual = {bone.name: bone.parent.name if bone.parent else None for bone in rig.data.bones}
    if actual != expected:
        raise ValueError('Rig does not match the v1 topology')
    if bpy.data.actions:
        raise ValueError('Actions are outside this pipeline stage')
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=False, export_skins=True,
        export_all_influences=False, export_def_bones=False,
        export_rest_position_armature=True, export_apply=False,
        export_cameras=False, export_lights=False, export_materials='EXPORT',
    )
    audit = inspect(output)
    if audit['bone_count'] != 23 or audit['skin_count'] != 1 or audit['animation_count'] != 0:
        raise ValueError('Exported GLB lost its skeleton or contains animations')
    if audit['unweighted_vertices'] or audit['maximum_weight_sum_error'] > 0.0001:
        raise ValueError('Exported weights are not normalized')
    return audit
