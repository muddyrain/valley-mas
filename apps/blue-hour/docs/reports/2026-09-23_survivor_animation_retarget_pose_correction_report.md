# Survivor Animation Retarget Pose Correction

## Scope

Corrected the retargeted upper-body poses for Xia Zhiyao without changing the character model, frozen `BH_Humanoid_Rig_v1` rest pose, weapon logic, or gameplay.

## Changes

- Updated `art/blender/scripts/integrate_survivor_animations.py` to derive each source bone's rotation delta relative to its posed parent and rest parent, then convert that delta between source and canonical parent rest frames.
- Added per-clip world-axis rotation corrections for shoulder/upper-arm, forearm, and hand chains in `survivor_idle`, `rifle_idle`, and `rifle_run`.
- Added `BH_ANIMATION_CLIPS` filtering so only selected clips need to be rebaked during pose calibration.
- Re-exported the three priority GLBs and rebuilt the shared `survivor_animations.tres` library.
- Moved the debug preview camera closer to make the survivor more legible in capture output.

## Validation

- Blender 5.2.1: exported all three selected clips with 22 mapped animation bones each.
- Godot 4.7.2 import: PASS.
- Animation library rebuild: 11 clips.
- `tests/survivor_animation_pipeline.gd`: 298 checks, 0 failures.
- Captured 1600x900 state screenshots and 150 preview frames under `test-output/survivor-animation/`.

## Visual QA

Status: NOT ACCEPTED.

- `idle.png`: arms are lowered compared with the previous near-horizontal pose, but remain too widely held for a relaxed idle.
- `rifle_idle.png`: arms move forward and elbows bend into a rifle-ready pose. The preview has no rifle mesh, so hand-to-weapon contact cannot be verified.
- `rifle_run.png`: the arms remain asymmetric and one arm lifts unnaturally during the loop.

The structural/runtime test proves track loading and playback only. It does not prove the poses are visually acceptable. Further per-frame arm-chain calibration and a preview with the existing weapon mesh are required before acceptance.

## Evidence

- `test-output/survivor-animation/idle.png`
- `test-output/survivor-animation/rifle_idle.png`
- `test-output/survivor-animation/rifle_run.png`
- `test-output/survivor-animation/xia_zhiyao_retarget_pose_correction.mp4`

## GitNexus

The local GitNexus index was up to date. Its symbol graph does not index the Python Blender `export_clip` function, so targeted impact analysis returned UNKNOWN / target not found. No MCP GitNexus tools were exposed in this environment.
