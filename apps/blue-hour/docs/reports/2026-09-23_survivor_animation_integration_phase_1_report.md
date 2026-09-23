# Survivor Animation Integration Phase 1

## Task Summary

Integrated the eleven supplied Survivor FBX clips into the existing frozen `BH_Humanoid_Rig_v1` pipeline. The pipeline keeps Xia Zhiyao's original 23-bone Skeleton3D and uses one shared AnimationLibrary plus an AnimationTree state machine.

## Changed Files

- Added `assets/characters/survivors/animations/source/` with the eleven supplied FBX source files.
- Added 11 retargeted runtime GLB clips under `locomotion/`, `combat/`, and `reaction/`.
- Added `assets/characters/survivors/animations/survivor_animations.tres`.
- Added `art/blender/scripts/integrate_survivor_animations.py` for repeatable FBX to canonical-rig baking.
- Added `survivors/survivor_animation_pipeline.gd`.
- Added `scenes/debug/survivor_animation_preview.tscn`.
- Added `tests/build_survivor_animation_library.gd`, `tests/survivor_animation_probe.gd`, and `tests/survivor_animation_pipeline.gd`.
- Updated `docs/PLAN.md` with Phase 1 status.

## Implementation Details

- Xia Zhiyao and Su Wanxing runtime GLBs were inspected against the frozen 23-bone rig. No character model or source skeleton was copied or modified.
- Blender maps Mixamo bone names to the canonical 22 animated bones; `Root` remains the scene/gameplay root.
- Runtime names: `survivor_idle`, `survivor_walk`, `survivor_run`, `rifle_idle`, `rifle_run`, `rifle_shoot`, `unarmed_idle`, `knife_idle`, `knife_attack`, `hit_reaction`, `death`.
- AnimationTree states: `IDLE`, `WALK`, `RUN`, `RIFLE_IDLE`, `RIFLE_RUN`, `RIFLE_SHOOT`, `KNIFE_IDLE`, `ATTACK`, `HIT`, `DEATH`.
- No weapon system, enemy system, UI, gameplay movement, or model data was changed.

## Validation

- Blender 5.2.1: 11/11 source FBX clips exported as canonical-rig GLB clips, 22 mapped animated bones each.
- Godot 4.7.2 headless import: PASS for the new GLB assets.
- Godot `tests/survivor_animation_probe.gd`: PASS; imported clips expose canonical `Skeleton3D:<Bone>` tracks.
- Godot `tests/survivor_animation_pipeline.gd`: PASS, 289 structural/runtime checks / 0 failures. Xia keeps 23 bones, all 11 clips load, all 10 states start, and attack playback changes the canonical skeleton pose.
- Native 1600x900 state captures and a 10-second H.264 preview were generated under `test-output/survivor-animation/`.
- Visual QA is not accepted: idle and rifle-idle poses still show unnaturally horizontal arms. Structural tests do not prove retarget pose quality; the current retarget needs correction before animation acceptance.

## Known Issues

- The full project entrypoint remains blocked by an existing missing `res://data/weapon_modifier_registry.gd` preload in `weapons/weapon_modifiers.gd`. This is outside Phase 1 and was not patched.
- The requested AnimationTree editor screenshot is not included. The generated video is a runtime preview, not a final animation acceptance video because the arm poses remain incorrect.
- Phase 1 asset organization and graph setup are implemented; visual retarget acceptance remains incomplete.

## Environment

- Windows: Godot 4.7.2, Blender 5.2.1, Node.js and Git available. Godot import and animation-specific headless validation passed.
- No full Windows release build was attempted because the existing weapon preload parse error blocks the main project before gameplay starts.
