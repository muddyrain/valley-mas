import bpy
import math
import os
import sys
import tempfile
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(__file__))
from merge_survivor_animation_channels import merge_clip_channels


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCE_ROOT = os.environ.get(
	"BH_ANIMATION_SOURCE_ROOT",
	os.path.join(PROJECT_ROOT, "assets", "characters", "survivors", "animations", "source"),
)
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
	},
	"rifle_run": {
	},
}


RIFLE_HAND_BASIS = Matrix((
	(-1.0, 0.0, 0.0),
	(0.0, -0.8, -0.6),
	(0.0, -0.6, 0.8),
))
RIFLE_FORWARD = Matrix.Rotation(math.pi, 3, "Z")
RIFLE_PREVIEW_SCALE = 0.84


def point_bone(canonical: bpy.types.Object, bone_name: str, direction: Vector) -> None:
	pose_bone = canonical.pose.bones[bone_name]
	current = pose_bone.matrix.copy()
	rotation = (current.to_3x3() @ Vector((0.0, 1.0, 0.0))).rotation_difference(direction.normalized())
	pose_bone.matrix = Matrix.LocRotScale(current.translation, rotation @ current.to_quaternion(), current.to_scale())
	bpy.context.view_layer.update()


def solve_arm(canonical: bpy.types.Object, side: str, wrist: Vector, pole: Vector) -> None:
	upper = canonical.pose.bones[f"{side}UpperArm"]
	lower = canonical.pose.bones[f"{side}LowerArm"]
	start = upper.head.copy()
	reach = wrist - start
	distance = min(reach.length, upper.bone.length + lower.bone.length - 0.001)
	axis = reach.normalized()
	upper_length = upper.bone.length
	lower_length = lower.bone.length
	along = (upper_length * upper_length - lower_length * lower_length + distance * distance) / (2.0 * distance)
	height = math.sqrt(max(0.0, upper_length * upper_length - along * along))
	bend = pole - axis * pole.dot(axis)
	bend.normalize()
	elbow = start + axis * along + bend * height
	point_bone(canonical, upper.name, elbow - start)
	point_bone(canonical, lower.name, wrist - lower.head)


def solve_run_arms(canonical: bpy.types.Object, source: bpy.types.Object) -> None:
	# Mixamo's jogging wrists stay below the shoulders; the generic rest-pose delta lifts them above the head.
	source_basis = source.matrix_world.to_3x3()
	target_basis = canonical.matrix_world.inverted().to_3x3()
	for side in ("Left", "Right"):
		source_upper = source.pose.bones[f"mixamorig:{side}Arm"]
		source_lower = source.pose.bones[f"mixamorig:{side}ForeArm"]
		source_hand = source.pose.bones[f"mixamorig:{side}Hand"]
		target_upper = canonical.pose.bones[f"{side}UpperArm"]
		target_lower = canonical.pose.bones[f"{side}LowerArm"]
		source_reach = (source_upper.bone.length + source_lower.bone.length) * source.matrix_world.to_scale().x
		target_reach = (target_upper.bone.length + target_lower.bone.length) * canonical.matrix_world.to_scale().x
		scale = target_reach / source_reach
		wrist_delta = target_basis @ (source_basis @ (source_hand.head - source_upper.head)) * scale
		elbow_delta = target_basis @ (source_basis @ (source_lower.head - source_upper.head))
		solve_arm(canonical, side, target_upper.head + wrist_delta, elbow_delta)


def settle_death_legs(canonical: bpy.types.Object, progress: float) -> None:
	# The source Death ends with a wide split; converge the ankles only after the body has landed.
	weight = max(0.0, min(1.0, (progress - 0.7) / 0.2))
	if weight <= 0.0:
		return
	weight = weight * weight * (3.0 - 2.0 * weight)
	hip = canonical.pose.bones["Hips"].head
	for side, offset in (
		("Left", Vector((0.18, -0.60, -0.03))),
		("Right", Vector((-0.13, -0.55, -0.03))),
	):
		upper = canonical.pose.bones[f"{side}UpperLeg"]
		lower = canonical.pose.bones[f"{side}LowerLeg"]
		foot = canonical.pose.bones[f"{side}Foot"]
		foot_rotation = foot.matrix.to_quaternion()
		ankle = foot.head.lerp(hip + offset, weight)
		start = upper.head.copy()
		reach = ankle - start
		distance = min(reach.length, upper.bone.length + lower.bone.length - 0.001)
		axis = reach.normalized()
		along = (upper.bone.length ** 2 - lower.bone.length ** 2 + distance ** 2) / (2.0 * distance)
		height = math.sqrt(max(0.0, upper.bone.length ** 2 - along ** 2))
		pole = lower.head - start
		bend = pole - axis * pole.dot(axis)
		bend.normalize()
		knee = start + axis * along + bend * height
		point_bone(canonical, upper.name, knee - start)
		point_bone(canonical, lower.name, ankle - lower.head)
		foot.matrix = Matrix.LocRotScale(foot.head, foot_rotation, Vector((1.0, 1.0, 1.0)))
		bpy.context.view_layer.update()


def solve_rifle_pose(canonical: bpy.types.Object) -> None:
	# The weapon follows RightHand; the carry follows shoulder motion and chest heading.
	chest = canonical.pose.bones["UpperChest"]
	chest_delta = chest.matrix @ chest.bone.matrix_local.inverted()
	heading = Quaternion(Vector((0.0, 0.0, 1.0)), chest_delta.to_quaternion().to_euler("XYZ").z)
	right_shoulder = canonical.pose.bones["RightShoulder"]
	grip_wrist = right_shoulder.head + heading @ Vector((-0.10, -0.18, -0.06))
	grip_basis = heading @ RIFLE_HAND_BASIS.to_quaternion()
	gun_origin = grip_wrist + grip_basis @ Vector((0.0, 0.05, 0.005))
	foregrip = gun_origin + heading @ (
		RIFLE_FORWARD @ (Vector((-0.03, 0.205, -0.008)) * RIFLE_PREVIEW_SCALE)
	)
	support_wrist = foregrip + heading @ Vector((0.015, 0.055, 0.02))
	left_shoulder = canonical.pose.bones["LeftShoulder"]
	shoulder_direction = heading @ Vector((0.05, -0.10, -0.01))
	point_bone(canonical, left_shoulder.name, shoulder_direction)
	solve_arm(canonical, "Right", grip_wrist, heading @ Vector((-1.0, 0.0, -0.7)))
	solve_arm(canonical, "Left", support_wrist, heading @ Vector((1.0, 0.0, -0.7)))
	right_hand = canonical.pose.bones["RightHand"]
	right_hand.matrix = Matrix.LocRotScale(right_hand.head, grip_basis, Vector((1.0, 1.0, 1.0)))
	bpy.context.view_layer.update()
	left_hand = canonical.pose.bones["LeftHand"]
	left_rest = left_hand.bone.matrix_local.to_quaternion()
	left_direction = heading @ Vector((0.0, -1.0, 0.0))
	left_rotation = (left_rest @ Vector((0.0, 1.0, 0.0))).rotation_difference(left_direction)
	left_hand.matrix = Matrix.LocRotScale(left_hand.head, left_rotation @ left_rest, Vector((1.0, 1.0, 1.0)))
	bpy.context.view_layer.update()


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
	bpy.context.scene.frame_set(start)
	source_hip_origin = source.matrix_world @ source.pose.bones["mixamorig:Hips"].head
	death_scale = canonical.data.bones["Hips"].head_local.z / source_hip_origin.z if animation_name == "death" else 1.0
	for frame in frame_samples:
		bpy.context.scene.frame_set(frame)
		if animation_name == "death":
			canonical.pose.bones["Hips"].location = Vector((0.0, 0.0, 0.0))
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
		if animation_name in ("rifle_idle", "rifle_run"):
			solve_rifle_pose(canonical)
		elif animation_name == "survivor_run":
			solve_run_arms(canonical, source)
		elif animation_name == "death":
			bpy.context.view_layer.update()
			source_hip = source.matrix_world @ source.pose.bones["mixamorig:Hips"].head
			hip_offset = canonical.matrix_world.inverted().to_3x3() @ (source_hip - source_hip_origin) * death_scale
			hips = canonical.pose.bones["Hips"]
			pose_matrix = hips.matrix.copy()
			pose_matrix.translation += hip_offset
			hips.matrix = pose_matrix
			bpy.context.view_layer.update()
			settle_death_legs(canonical, (frame - start) / (end - start))
			hips.keyframe_insert(data_path="location", frame=frame, group="Hips")
		for canonical_name in bone_map.values():
			canonical.pose.bones[canonical_name].keyframe_insert(
				data_path="rotation_quaternion", frame=frame, group=canonical_name
			)
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
	with tempfile.TemporaryDirectory(prefix="blue_hour_animation_") as temporary:
		candidate_path = os.path.join(temporary, f"{animation_name}.glb")
		bpy.ops.export_scene.gltf(
			filepath=candidate_path,
			export_format="GLB",
			use_selection=True,
			export_animations=True,
			export_skins=True,
			export_apply=False,
			export_force_sampling=True,
			export_frame_range=True,
			export_frame_step=1,
		)
		if animation_name in ("survivor_run", "death") and os.path.isfile(output_path):
			merge_clip_channels(output_path, candidate_path, output_path, animation_name)
		else:
			os.replace(candidate_path, output_path)
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
