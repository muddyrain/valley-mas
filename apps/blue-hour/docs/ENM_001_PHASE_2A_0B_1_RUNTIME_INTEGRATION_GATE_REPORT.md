# ENM_001 Phase 2A-0B-1 Runtime Integration Gate

- AI mapping: Idle→Zombie_Idle; Wander/Investigate→Zombie_Walk; Chase→Zombie_Chase.
- Unified controller: `enemies/infected_animation_controller.gd`, 0.15s blend, bounded playback 0.85..1.15 Walk / 0.90..1.20 Chase.
- Per-instance variation: phase 0..0.9s, speed 0.95..1.05.
- Existing AI state machine retained; Attack / Dead logic unchanged and no new combat animation authored.

## Verification

`tests/enm_001_runtime_integration_gate.gd` used production Mission + EncounterDirector population (26 enemies) and passed Runtime path, state mappings, perception→Chase, noise→Investigate and phase randomization. `tests/infected_basic.gd`: 62 checks, 0 failures.

Production distributed capture (`tests/enm_001_expedition_locomotion_capture.gd`) outputs:

- `test-output/enm_001_expedition/01_idle_distributed.png`
- `test-output/enm_001_expedition/02_wander_distributed.png`
- `test-output/enm_001_expedition/03_investigate_noise.png`
- `test-output/enm_001_expedition/04_chase_visible.png`

Full UI harness `expedition_visual_runtime.gd` still times out in this checkout; targeted production capture completed successfully. No MP4 was produced.

Acceptance: Mapping PASS; Blend PASS; Playback PASS; Phase randomization PASS; Pants Bridge PASS by prior gates; Walk PASS; Chase PASS; multi-zombie sync PASS; production distributed capture PASS; full UI harness pending due timeout. Attack/Hit/Death deferred.
