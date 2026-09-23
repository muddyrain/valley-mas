# Weapon Upgrade Apply + Persistence Phase W2-4

## 1. Upgrade Apply design

`WeaponUpgradeApplier.apply(weapon, upgrade, run_id, seed)` validates the source instance and upgrade data before creating a deep-copied `WeaponInstance`. It checks the next level, weapon scope, duplicate history entry, candidate requirements, modifier registry availability, weapon tags, max stack, active conflict groups, and rarity special-effect slots. On failure it returns `{ok: false, error}` without changing the source instance. On success it returns the new instance for the caller to commit.

The resulting history entry records `upgrade_id`, `level_before`, `level_after`, `run_id`, `seed`, and a result snapshot containing modifier additions, stat changes, and the conflict group. The snapshot makes the applied result inspectable and independent from later candidate generation.

## 2. Applier implementation

`weapons/weapon_upgrade_applier.gd` implements the validation and copy-on-success operation. Applied instances advance to the upgrade's level and `instance_schema = 1`; the input object remains unchanged until the caller replaces its reference with the returned instance.

`core/equipment.gd` reconstructs derived weapon stats by applying modifiers from the base instance and upgrade history, then applying the history's stat changes. It still derives a copy of the shared `WeaponDefinition`; upgrade data never mutates the shared definition. Campaign selection, combat, HitEvent, DamageResolver, CombatVFXResolver, and UI flows are unchanged.

## 3. WeaponInstance fields and serialization

The runtime instance now exposes:

| Field | Default / behavior |
|---|---|
| `level` | 1 |
| `upgrade_history` | Empty array of per-upgrade dictionaries |
| `seed` | 0 until an owning run assigns a stable seed |
| `pending_upgrade` | Empty dictionary; reserved for a saved offer snapshot |
| `instance_schema` | New instances default to 1; loading a legacy dictionary without the field assigns 0 |

`to_dict()` keeps the existing five-key `uid/kind/rarity/modifiers/affix` payload. `to_dict(true)` is an explicit extended payload that also writes the five upgrade-state fields, and `from_dict()` reads either shape. Current Campaign inventory calls the legacy form, so this phase does not persist applied upgrades through Campaign Save/Load yet. The extended serializer has a focused round-trip test to validate the future migration payload.

## 4. Persistence impact and migration risk

No Campaign or SaveStore migration was performed. Campaign remains version 5, and the current SaveStore version-backup allowlist remains v1-v4. Existing items keep their `uid`, `kind`, `rarity`, `modifiers`, and `affix`; no weapon is rerolled and no legacy item gains serialized fields during restore.

Future Campaign v5→v6 work must cover:

- `core/campaign.gd`: permit version 6 in `valid_state()`, validate upgrade-state payloads, migrate v5 dictionaries with defaults, set `data.version = 6`, and update `_normalize_weapons()` so it does not erase extended fields.
- Recursive weapon dictionaries in `inventory`, `shop`, `day_rewards`, `pending`, `history`, and any copied reward/outcome payload; migration must preserve identity, rarity, modifier IDs, affix, and nesting location.
- `core/save_store.gd`: add v5 to the migration backup allowlist and preserve the exact pre-migration bytes in `.v5.bak` before writing v6.
- Fixtures and regression tests: nested v5 items, successful v5→v6 migration, invalid migration rollback, `.v5.bak` preservation, and identity/stat round trips.

The principal risk is silent field loss: Campaign currently recursively calls `WeaponInstance.from_dict(value).to_dict()` during normalization, and the default serializer deliberately emits only the old schema. A future migration must opt into the extended schema only after validation and backup succeed.

## 5. Tests

Expanded `tests/weapon_upgrade_candidates.gd` to cover apply success, copy-on-success atomicity, level and weapon rejection, modifier max stack, conflict groups, history metadata/result snapshot, derived stat reconstruction, shared-definition immutability, explicit extended serialization round trip, and legacy five-key serialization stability.

- `weapon_upgrade_candidates.gd`: 55 checks / 0 failures.
- `weapon_system.gd`: 474 checks / 0 failures.
- `weapon_rarity_profile.gd`: 32 checks / 0 failures.
- `save_catalog_compatibility.gd`: 9 checks / 0 failures.
- `weapon_combat_phase1a.gd`: 11 checks / 0 failures.
- `combat_animations.gd`: 3443 checks / 0 failures.
- `combat_animation_mission.gd`: 47 checks / 0 failures.
- All tests ran with Godot 4.7.2 headless. A full project import/build was not run; the existing project-wide MiniMap parse issue documented in W2-3 remains outside this phase.

## 6. Modified files

- `weapons/weapon_upgrade_applier.gd` (new)
- `weapons/weapon_instance.gd`
- `core/equipment.gd`
- `tests/weapon_upgrade_candidates.gd`
- `docs/PLAN.md`
- `docs/audit/weapon/weapon_upgrade_apply_persistence_phase_w2_4_report.md` (this report)

## 7. Follow-up

Before connecting upgrade selection to Campaign, freeze the owner of instance seed derivation and pending-offer lifecycle, then implement v5→v6 migration with recursive fixtures and backup rollback coverage. Keep the existing Campaign v5 writer on the five-key payload until that migration lands. Upgrade UI and drop generation remain later phases.
