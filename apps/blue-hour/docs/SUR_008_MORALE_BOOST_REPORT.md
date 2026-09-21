# SUR_008 程茉「鼓舞士气」Runtime V1

## Architecture

- Trait data: `data/traits/morale_boost.tres`
- Scheduler: existing `core/periodic_effect_runtime.gd`
- Buff lifecycle: `core/buff_effect_handler.gd`
- Gameplay hooks: `missions/mission.gd` applies and expires `crit_rate` modifiers; `weapons/combat/instant_hit_resolver.gd` reads the active chance and marks critical hits with the shared 2x critical damage multiplier.
- The modifier is stored per effect type on the target. Re-apply replaces the same type and does not stack; different effect types occupy separate entries.

## Configuration

- Interval: 20 seconds
- Radius: 6 meters
- Target filter: `ALL_TEAM`, including the provider
- Duration: 6 seconds
- Levels: `+5% / +7% / +9% / +11% / +13%`

## Verification

- Timer: no event before 20 seconds.
- Target selection: provider and in-range ally receive the buff; a 6.1m ally is excluded.
- Apply: Lv1 exposes 0.05 critical chance; Lv5 exposes 0.13.
- Duration: the modifier is removed at six seconds.
- Refresh: same effect type remains a single active modifier and refreshes its value/duration.
- Save/Load: periodic provider state and active buff state restore, then expire normally.
- Regression: the existing periodic scheduler contract and SUR_004 heal path remain unchanged.

`SUR_008 Cheng Mo Morale Boost V1: PASS`
