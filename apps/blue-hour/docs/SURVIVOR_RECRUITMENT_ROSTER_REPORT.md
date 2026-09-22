# Survivor Recruitment & Roster Foundation V1

## Architecture

- Ownership layer: `data/survivor_roster_manager.gd`
- State values: `LOCKED`, `DISCOVERED`, `RECRUITED`
- State storage: `Campaign.data.survivor_states`, keyed by stable `SUR_###` IDs
- Definition lookup: Manager resolves both stable IDs and existing template IDs to the same `SurvivorDefinition`
- Queries: all, discovered, recruited and available-party Survivors return definition resources; only RECRUITED entries are party eligible.
- Initial state: `SUR_001` and `SUR_002` are RECRUITED; `SUR_003` through `SUR_012` are LOCKED.
- Save flow: Campaign writes the manager state into the existing v5 save payload. Older saves without the field receive defaults, then current members are synchronized as RECRUITED.

No UI, NPC, dialogue, discovery event, Trait, XP, Level, animation, weapon or gameplay state machine was added or changed.

## Verification

`tests/survivor_recruitment_roster.gd`: 17 checks / 0 failures.

- Initial recruitment and locked roster
- LOCKED → DISCOVERED
- DISCOVERED → RECRUITED
- Direct recruitment of a locked Survivor rejected
- Legacy template ID and stable ID queries
- Available party query
- Save / Load state persistence
- Existing progression remains level one after roster persistence

Additional regression:

- Save catalog compatibility: 9 checks / 0 failures
- Survivor progression: 29 checks / 0 failures
- Character system: 12 SurvivorDefinitions and 12 Traits
- Godot Headless Import: PASS

## Result

`Survivor Recruitment & Roster Foundation V1: PASS`
