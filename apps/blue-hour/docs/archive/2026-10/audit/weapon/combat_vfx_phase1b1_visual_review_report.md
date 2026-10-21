# Combat VFX Phase 1B.1 Visual Review

## Scope

This review validates the existing Combat VFX Framework with a fixed, close camera. It does not change combat architecture, weapon definitions, weapon values, models, or gameplay logic.

## Review Harness

- Scene script: `tests/combat_vfx_review.gd`
- Fixed orthographic camera and staged infected targets
- Review-only neutral lighting
- Exploration fog hidden in the harness so the full-screen gameplay visibility tint does not mask VFX
- Existing combat/VFX path is used for every shot

## Captured Material

- Video: `test-output/combat_vfx_review/combat_vfx_review.mp4`
- Duration: 13.0 seconds, 195 frames at 15 FPS, 1600x900
- Screenshots:
  - `test-output/combat_vfx_review/01_p9_fire.png`
  - `test-output/combat_vfx_review/02_a21_tracer.png`
  - `test-output/combat_vfx_review/03_s12_multi_pellet.png`
  - `test-output/combat_vfx_review/04_multi_target_hit.png`

## Visual Findings

- P9 muzzle flash: clearly visible as a short warm flash at the weapon muzzle.
- A21 continuous fire: repeated fire and target feedback are visible in the reel. The tracer lifetime is short, so the A21 path is intermittent in still frames; the clearest trajectory evidence is provided by the S12 spread capture.
- S12 pellet spread: multiple tracer lines and simultaneous target feedback are clearly visible.
- Hit response: the existing bright hit burst and enemy shader flash produce immediate impact readability.
- Enemy flash: the flash is easy to notice, but the current white overlay is intentionally strong and can dominate the character silhouette during the peak frame.
- Style fit: the warm cream/orange effects against the cool blue street and simplified character silhouettes read consistently with the Anime/Q版 Roguelite direction.

## Verification

- `combat_vfx_review.gd` headless run: 195 frames, 0 failures.
- Native capture: 195 PNG frames and 4 screenshots generated.
- MP4 encoding: successful with H.264/yuv420p; ffprobe reports 13.0 seconds at 15 FPS.
- Encoding guard: passed for the review harness.
- `git diff --check`: passed for the review harness change.

## Gameplay Impact

None. The only source change is the isolated visual review harness. CombatVFXResolver, WeaponCombatController, HitEvent, Enemy.apply_hit, weapon definitions, and weapon values were not changed for this review.

## Recommendation

The current framework is suitable for the next integration review. If polish is scheduled, first evaluate reducing peak shader flash intensity or duration so the feedback remains legible without fully washing out the enemy model. No new effect system is required for that iteration.
