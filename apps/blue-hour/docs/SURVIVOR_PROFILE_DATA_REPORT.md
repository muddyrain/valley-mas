# Survivor Profile Data V1

## Architecture

- Profile Resource: `data/survivor_profile.gd`
- Profile data: `data/profiles/sur_001_xia_zhiyao.tres` through `sur_012_song_shiyu.tres`
- Registry: `data/catalog.gd` and `data/character_registry.gd`
- Association: each `SurvivorDefinition.survivor_id` resolves to the matching Profile `id`; legacy template IDs are accepted by `CharacterRegistry.get_profile()`.
- Scope: narrative data only. Trait, XP, animation, weapon and gameplay systems are unchanged.

The source data table does not define ages. Profiles therefore use `age = 0` as an explicit unknown value rather than inventing canon. The field is serialized and ready for a later data-only update.

## Verification

`tests/survivor_profile_data.gd` checks:

- all 12 resources load and validate;
- Profile IDs are unique;
- every production SurvivorDefinition resolves to the matching profile;
- CharacterRegistry supports both legacy IDs and `SUR_###` IDs;
- Save/Load preserves the existing campaign membership data.

Run with `./run.ps1 -Mode test` or run the focused script through Godot headless.

## Result

Focused Profile verification: PASS (91 checks, 0 failures).

Survivor Profile Data V1: PASS.

The full `run.ps1 -Mode test` suite reached the existing `camp_departure` failure (`get_global_rect` on a null Camp UI node) after earlier suites passed. That failure is outside the Profile data layer and is not counted against this feature.
