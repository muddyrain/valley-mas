# Weapon ModifierData Resource Phase W2-1 Delivery Report

## Task Summary

Moved the six existing weapon modifier rules from a code-owned dictionary into independent `WeaponModifierData` Resources. Existing IDs, multipliers, melee filtering, derived weapon behavior, save shape, and combat/VFX flow remain unchanged.

## Changed Files

- Added `data/weapon_modifier_data.gd` and its Godot UID.
- Added `data/weapon_modifier_registry.gd` and its Godot UID.
- Added six resources under `data/weapons/modifiers/`.
- Updated `weapons/weapon_modifiers.gd`, `ui/weapon_browser.gd`, `tests/weapon_system.gd`, and `tests/expedition_combat_capture.gd`.
- Updated `docs/PLAN.md` and added the audit report at `docs/audit/weapon/weapon_modifierdata_resource_phase_w2_1_report.md`.
- No WeaponDefinition, WeaponInstance save structure, combat events, damage resolver, VFX resolver, weapon balance, or new weapon content changed.

## Implementation Details

`WeaponModifierRegistry` loads six independent Resource definitions and resolves stable IDs with duplicate-ID validation. `WeaponModifiers` remains as a compatibility API used by Equipment, while its data source now comes from the Registry. Weapon Browser reads the Resource description; the old displayed label text is preserved exactly.

The Expedition Combat Capture harness now accepts an optional output directory restricted to `res://test-output/`; this kept the existing `expedition_combat_capture` and `combat_vfx_review` evidence untouched. New capture output is in `test-output/weapon_modifier_resource_capture/`.

## Validation

- `[Windows]` Godot 4.7.2 import passed.
- `[Windows]` Weapon System: 451 checks / 0 failures; the same test passed against the embedded Release pack.
- `[Windows]` Weapon Combat Phase 1A: 11 checks / 0 failures.
- `[Windows]` Combat VFX Phase 1B: 25 checks / 0 failures.
- `[Windows]` Expedition capture: 375 frames, 25 seconds, four screenshots, 153 hit events, zero failures.
- `[Windows]` Direct Windows Release export passed. Independent headless and native weapon startup passed. Embedded-pack art showcase (56 assets), weapon visuals, and combat animations passed in headless/native modes.
- `tests/encounter_combat.gd` had 1 existing timing failure: the first natural shot registered at 0.00 seconds instead of the expected 5–15 seconds. This is outside the Modifier resource path.
- Standard `run.ps1 build` stopped before export at `tests/survivor_command.gd`: “Line follows the moving survivor's feet”. The Release preset was exported directly afterward and its executable/package checks passed; the standard aggregate pre-export suite remains blocked.
- GitNexus did not index the affected GDScript class/method symbols; direct source search identified Equipment and Weapon Browser as consumers. No commit was requested or made.
- Encoding Guard: PASS for all changed GDScript, Resource, and Markdown files.
- `git diff --check`: PASS; Git only reported existing CRLF normalization warnings for unrelated `data/catalog.gd` and `run.ps1`.

## Known Issues

The repository-wide build gate and `encounter_combat` timing test remain failing at unrelated behavior checks. Rarity Profile, UpgradeData, upgrade selection, and random modifier rolls are not implemented in this phase.

## Environment

- `[Windows]` Godot 4.7.2 used; Blender not used; Node and Git available.
- `[macOS]` unavailable; no macOS validation performed.
