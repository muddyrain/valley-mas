import bpy
import math
import os
import sys
from mathutils import Matrix, Quaternion, Vector


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE_ROOT = r"C:\Users\A\Downloads\幸存者动作"
RIG_PATH = os.path.join(PROJECT_ROOT, "art", "blender", "rigs", "BH_Humanoid_Rig_v1.blend")

CLIPS = {
    "Breathing Idle.fbx": ("locomotion", "survivor_idle", True),
    "Unarmed Idle.fbx": ("combat", "unarmed_idle", True),
    "Walking.fbx": ("locomotion", "survivor_walk", True),
    "Jogging.fbx": ("locomotion", "survivor_run", True),
    "Rifle Run.fbx": ("combat", "rifle_run", True),
    "Rifle Idle.fbx": ("combat", "rifle_idle", True),
    "Shoot Rifle.fbx": ("combat", "rifle_shoot", False),
    "Knife Idle.fbx": ("combat", "knife_idle", True),
    "Stabbing.fbx": ("combat", "knife_attack", False),
    "Hit Reaction.fbx": ("reaction", "hit_reaction", False),
	"Death.fbx": ("reaction", "death", False),
}

MIXAMO_TO_CANONICAL = {
    "mixamorig:Hips": "Hips",
    "mixamorig:Spine": "Spine",
    "mixamorig:Spine1": "Chest",
    "mixamorig:Spine2": "UpperChest",
    "mixamorig:Neck": "Neck",
    "mixamorig:Head": "Head",
    "mixamorig:LeftShoulder": "LeftShoulder",
    "mixamorig:LeftArm": "LeftUpperArm",
    "mixamorig:LeftForeArm": "LeftLowerArm",
    "mixamorig:LeftHand": "LeftHand",
    "mixamorig:RightShoulder": "RightShoulder",
    "mixamorig:RightArm": "RightUpperArm",
    "mixamorig:RightForeArm": "RightLowerArm",
    "mixamorig:RightHand": "RightHand",
    "mixamorig:LeftUpLeg": "LeftUpperLeg",
    "mixamorig:LeftLeg": "LeftLowerLeg",
    "mixamorig:LeftFoot": "LeftFoot",
    "mixamorig:LeftToeBase": "LeftToes",
    "mixamorig:RightUpLeg": "RightUpperLeg",
    "mixamorig:RightLeg": "RightLowerLeg",
    "mixamorig:RightFoot": "RightFoot",
    "mixamorig:RightToeBase": "RightToes",
}

POSE_CORRECTIONS = {
	"survivor_idle": {
		"LeftUpperArm": [((0.0, 1.0, 0.0), 52.0)],
		"RightUpperArm": [((0.0, 1.0, 0.0), -52.0)],
	},
	"rifle_idle": {
		"LeftUpperArm": [((0.0, 1.0, 0.0), -35.0), ((0.0, 0.0, 1.0), -42.0)],
		"RightUpperArm": [((0.0, 1.0, 0.0), 35.0), ((0.0, 0.0, 1.0), 42.0)],
		"LeftLowerArm": [((0.0, 0.0, 1.0), -40.0)],
		"RightLowerArm": [((0.0, 0.0, 1.0), 40.0)],
		"LeftHand": [((0.0, 0.0, 1.0), -4.0)],
		"RightHand": [((0.0, 0.0, 1.0), 4.0)],
	},
	"rifle_run": {
		"LeftUpperArm": [((0.0, 1.0, 0.0), 34.0)],
		"RightUpperArm": [((0.0, 1.0, 0.0), -34.0)],
		"LeftLowerArm": [((0.0, 0.0, 1.0), -26.0)],
		"RightLowerArm": [((0.0, 0.0, 1.0), 26.0)],
		"RightHand": [((1.0, 0.0, 0.0), 90.0)],
	},
}


def load_canonical_rig() -> bpy.types.Object:
	with bpy.data.libraries.load(RIG_PATH, link=False, relative=False) as (data_from, data_to):
		armature_name = next(name for name in data_from.objects if name == "BH_Humanoid_Rig_v1")
		data_to.objects = [armature_name]
	canonical = data_to.objects[0]
	bpy.context.scene.collection.objects.link(canonical)
	canonical.animation_data_create()
	return canonical


def export_clip(filename: str, category: str, animation_name: str, loop: bool) -> dict:
	bpy.ops.object.select_all(action="SELECT")
	bpy.ops.object.delete(use_global=False)
	canonical = load_canonical_rig()
	bpy.ops.import_scene.fbx(filepath=os.path.join(SOURCE_ROOT, filename), automatic_bone_orientation=False)
	source = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE" and obj != canonical)
	source_action = source.animation_data.action
	start = int(math.floor(source_action.frame_range[0]))
	end = int(math.ceil(source_action.frame_range[1]))
	canonical_bones = canonical.data.bones
	source_bones = source.data.bones
	bone_map = {
		source_name: canonical_name
		for source_name, canonical_name in MIXAMO_TO_CANONICAL.items()
		if source_bones.get(source_name) is not None and canonical_bones.get(canonical_name) is not None
	}
	if len(bone_map) != 22:
		raise RuntimeError(f"{filename}: expected 22 mapped bones, got {len(bone_map)}")
	canonical_action = bpy.data.actions.new(animation_name)
	canonical.animation_data.action = canonical_action
	frame_samples = list(range(start, end + 1))
	if (end - start) % 1:
		frame_samples.append(end)
	for frame in frame_samples:
		bpy.context.scene.frame_set(frame)
		for source_name, canonical_name in bone_map.items():
			source_bone = source_bones[source_name]
			source_pose = source.pose.bones[source_name]
			target_bone = canonical_bones[canonical_name]
			target_pose = canonical.pose.bones[canonical_name]
			source_parent_rest = source_bones[source_bone.parent.name].matrix_local if source_bone.parent else Matrix.Identity(4)
			target_parent_rest = canonical_bones[target_bone.parent.name].matrix_local if target_bone.parent else Matrix.Identity(4)
			source_parent_pose = source.pose.bones[source_bone.parent.name].matrix if source_bone.parent else Matrix.Identity(4)
			source_rest_local = source_parent_rest.inverted() @ source_bone.matrix_local
			target_rest_local = target_parent_rest.inverted() @ target_bone.matrix_local
			source_pose_local = source_parent_pose.inverted() @ source_pose.matrix
			source_local_delta = source_pose_local.to_quaternion() @ source_rest_local.to_quaternion().inverted()
			source_parent_world = source.matrix_world.to_quaternion() @ source_parent_rest.to_quaternion()
			target_parent_world = canonical.matrix_world.to_quaternion() @ target_parent_rest.to_quaternion()
			parent_frame_map = target_parent_world.inverted() @ source_parent_world
			target_local_delta = parent_frame_map @ source_local_delta @ parent_frame_map.inverted()
			target_pose_local = target_local_delta @ target_rest_local.to_quaternion()
			target_pose.rotation_mode = "QUATERNION"
			target_pose.rotation_quaternion = target_rest_local.to_quaternion().inverted() @ target_pose_local
			correction = POSE_CORRECTIONS.get(animation_name, {}).get(canonical_name)
			if correction:
				bpy.context.view_layer.update()
				pose_matrix = target_pose.matrix.copy()
				pose_position, pose_rotation, pose_scale = pose_matrix.decompose()
				corrected_rotation = pose_rotation
				for axis, angle_degrees in correction:
					world_correction = Quaternion(Vector(axis), math.radians(angle_degrees))
					corrected_rotation = world_correction @ corrected_rotation
				target_pose.matrix = Matrix.LocRotScale(pose_position, corrected_rotation, pose_scale)
				bpy.context.view_layer.update()
			target_pose.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=canonical_name)
	canonical_action.use_frame_range = True
	canonical_action.frame_start = start
	canonical_action.frame_end = end
	canonical_action.use_cyclic = loop
	source.animation_data_clear()
	bpy.data.objects.remove(source, do_unlink=True)
	for obj in list(bpy.context.scene.objects):
		if obj.type == "MESH":
			bpy.data.objects.remove(obj, do_unlink=True)
	bpy.data.actions.remove(source_action)
	for action in list(bpy.data.actions):
		if action != canonical_action:
			bpy.data.actions.remove(action)

	# Export only the canonical skeleton and baked action; Godot's original character mesh stays the sole skin.
	bpy.ops.object.select_all(action="DESELECT")
	canonical.select_set(True)
	bpy.context.view_layer.objects.active = canonical
	output_dir = os.path.join(PROJECT_ROOT, "assets", "characters", "survivors", "animations", category)
	os.makedirs(output_dir, exist_ok=True)
	output_path = os.path.join(output_dir, f"{animation_name}.glb")
	bpy.ops.export_scene.gltf(
		filepath=output_path,
		export_format="GLB",
		use_selection=True,
		export_animations=True,
		export_skins=True,
		export_apply=False,
		export_force_sampling=True,
		export_frame_range=True,
		export_frame_step=1,
	)
	return {"source": filename, "animation": animation_name, "bones": len(bone_map), "frames": len(frame_samples), "path": output_path}


def main() -> None:
	if not os.path.isdir(SOURCE_ROOT):
		raise RuntimeError(f"Animation source directory not found: {SOURCE_ROOT}")
	requested = {name.strip() for name in os.environ.get("BH_ANIMATION_CLIPS", "").split(",") if name.strip()}
	selected = {
		filename: definition
		for filename, definition in CLIPS.items()
		if not requested or definition[1] in requested
	}
	results = [export_clip(filename, *definition) for filename, definition in selected.items()]
	print("SURVIVOR_ANIMATION_EXPORT", results)


if __name__ == "__main__":
	main()
