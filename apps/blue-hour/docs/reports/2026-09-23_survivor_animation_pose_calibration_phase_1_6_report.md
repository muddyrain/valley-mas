# Survivor Animation Pose Calibration Phase 1.6

## Scope

Calibrated only the existing `survivor_idle`, `rifle_idle`, and `rifle_run` animations. The character mesh, 23-bone skeleton contract, weapon system, and gameplay remain unchanged.

## Changes

- Added a debug-only SMG preview attachment using the existing `weapon_submachine_gun_model.glb` and `long_gun.tres` attachment transform.
- Re-exported only the three requested clips. The AnimationLibrary still contains eleven animations.
- Tightened the idle upper-arm pose while retaining the source breathing motion.
- Added upper-arm, forearm, and wrist rotation corrections to the two rifle clips.
- Captured three SMG-equipped preview videos and updated the 1600x900 state screenshots.

## Validation

- GitNexus index refreshed and reports current.
- Blender 5.2.1 exported only the selected clips.
- Godot 4.7.2 imported the GLBs and rebuilt the 11-clip AnimationLibrary.
- `tests/survivor_animation_pipeline.gd`: 297 checks, 0 failures.
- The capture session contains 150 frames at 1600x900. Each state video repeats its captured 1-second, 15-frame sample four times to provide a 4-second review clip; it does not claim to represent a complete source animation cycle.

## Visual QA

Status: NOT ACCEPTED.

- Idle arms sit closer to the torso and the source breathing curve remains active.
- Rifle Idle holds the K9 SMG across the torso, but both hands do not accurately meet the grip points, the stock-to-shoulder relationship is not established, and the weapon crosses the face.
- Rifle Run weapon direction is improved from the previous near-vertical orientation, but the support hand does not remain on the foregrip and the arms do not maintain a consistent two-handed carry.

The generated videos are calibration evidence only. Per-frame grip alignment and a stable rifle-run carry remain outstanding.

## Evidence

- `test-output/survivor-animation/idle.png`
- `test-output/survivor-animation/rifle_idle.png`
- `test-output/survivor-animation/rifle_run.png`
- `test-output/survivor-animation/idle_smg_preview.mp4`
- `test-output/survivor-animation/rifle_idle_smg_preview.mp4`
- `test-output/survivor-animation/rifle_run_smg_preview.mp4`

## Boundaries

No character model, frozen skeleton, formal weapon data/controller, or gameplay code was changed. The preview attachment exists only in `scenes/debug/survivor_animation_preview.gd`.
