# SUR_004 陆清禾「应急处理」V1

## Architecture

- Trait data: `data/traits/emergency_response.tres`
  - `modifier_hook = periodic_effect`
  - interval `10s`, radius `6m`, target `LOWEST_HP_ALLY`
  - levels `5% / 6% / 7% / 8% / 10%`
- Scheduler: `core/periodic_effect_runtime.gd` emits the existing generic `heal` event.
- Handler: `core/heal_effect_handler.gd` converts the percentage into actual HP, ignores full/dead targets and clamps to Max HP.
- Gameplay: `missions/mission.gd` registers all valid periodic providers and applies only the generic `heal` event; no survivor-name branch exists.

## Verification

- Timer: 10-second boundary, no early or per-frame trigger.
- Target selector: lowest living ally within 6m; higher HP and dead allies excluded.
- Heal amount: Lv1 heals 5% Max HP; Lv5 heals 10% Max HP.
- Boundary: full HP is unchanged; dead targets are unchanged; healing cannot exceed Max HP.
- Lifecycle/Save: Periodic runtime state restores provider and Trait Level.
- Real Mission integration: 16/16 checks passed.
- Periodic foundation: 13/13 checks passed.
- Team Aura: 21/21 checks passed.
- Trait Foundation: 44/44 checks passed.
- Godot Headless Import: PASS.

## Scope

No changes were made to the Periodic scheduler contract, models, rig, skin, locomotion, ground, XP, Level, HUD, Aura or SUR_008. SUR_008 remains data-only.

`SUR_004 Lu Qinghe Emergency Care V1: PASS`
