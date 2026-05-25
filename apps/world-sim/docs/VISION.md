# WorldSim v2 Vision

## Core Promise

WorldSim v2 is a god-sandbox civilization simulator inspired by the WorldBox design loop:

1. The world exists before the player acts.
2. Life tries to survive without direct control.
3. Villages and kingdoms emerge from survival pressure.
4. The player changes conditions through god powers.
5. The world responds through visible, replayable consequences.

The player does not assign jobs, click units to move, or micro-manage battles. Player actions enter the simulation as god commands: spawn life, place resources, reshape terrain, harm, bless, or provoke. The simulation decides what happens next.

## Design North Star

Every system must answer one question: does it make the world feel more alive when the player is watching?

Good systems create cause and effect:

- Food shortage causes migration, death, lower birth rate, or conflict.
- Terrain shapes settlement and war.
- Villages create territory because people live there, not because a UI paints tiles.
- Kingdoms fight because pressure accumulates, not because borders merely touch.
- God powers matter because they alter the conditions that life and civilization react to.

## WorldBox Alignment Target

WorldSim should converge toward the WorldBox-style play loop, not a generic RTS or city builder. The player should mainly create conditions, watch civilizations emerge, and intervene with god powers. Civilizations should visibly gather resources, construct homes, expand territory, form settlements, colonize new land, fight, collapse, and leave ruins without direct player management.

Near-term iterations must prioritize the parts that make the small-people development loop feel correct:

- visible forest/resource depletion from wood gathering
- more frequent and readable house construction under population pressure
- territory growth that feels like settlement expansion, not only sparse building influence
- autonomous village expansion before kingdom-level diplomacy tools
- clear events explaining why a settlement grew, stalled, expanded, or declined

## Civilization Spine Rework Target

The next structural pass should make the early-to-mid civilization loop read like a single lived chain instead of a set of adjacent systems. The target spine is:

1. **Life seed**: units are placed into a terrain and resource context, then survive through hunger, foraging, wandering, and reproduction.
2. **Camp founding**: a same-race cluster near food creates a named camp with a visible town hall, first food reserve, and stable home ownership.
3. **Settlement work loop**: residents create visible pressure through housing demand, wood gathering, construction sites, food storage, farm work, and material gathering.
4. **Town density**: growth turns surplus into more houses, farms, storage, upgrades, and clear level changes before the game asks the player to reason about diplomacy.
5. **Frontier expansion**: settled activity expands soft territory first, then mature towns send settlers to nearby food-rich land and keep the new village inside the parent kingdom.
6. **Kingdom pressure**: multiple villages aggregate into a kingdom, create colored ownership, generate frontier/resource pressure, expose village loyalty, and eventually send grouped armies.
7. **Collapse memory**: starvation, lightning, capture, or depopulation leaves abandoned buildings and ruins so the map remembers what happened.

This rework starts with the first three stages because they decide whether the world feels alive before the player sees kingdoms. The first implementation target is not deeper UI or more commands; it is a more legible village-growth spine: every expansion, stall, and territorial spread should have a visible cause and an inspection/event explanation. Expansion explanations should only appear once a settlement is actually mature enough to be judged as a frontier parent; ordinary young villages should read as growing, not as failed colonizers.

The first PR-12F slice now gives each settlement an explicit projected growth phase (`camp`, `hamlet`, `village`, `town`, or `frontier`) and one projected primary intention. The phase explains what the settlement has become; the intention explains what it is trying to do next. This keeps early civilization readable without giving the player RTS-style control.

Phase changes now enter the recent-event story, and a deterministic early-settlement observation report records phase, intention, blocker, stores, construction, and territory over time. Balance adjustments to the early gates should be made from this observable story rather than by changing thresholds blindly.

## Current v2 Scope

The first v2 slice deliberately avoids full WorldBox parity. It establishes the foundation:

- Pure simulation truth outside Phaser.
- Deterministic seed and replay behavior. The interactive demo starts a fresh seed when no URL seed is supplied, while `?seed=...` keeps a world reproducible for debugging and comparison.
- Multi-origin civilization starts on larger worlds, so normal play can produce multiple villages, kingdoms, border pressure, and later rebellion conditions instead of one capital-centered realm every time.
- Tile, chunk, biome, and resource data.
- Units with hunger, age, health, death, birth, movement, stable home village membership, and simple needs.
- Villages that emerge from local population and food pressure, with food/material stores, storage capacity, housing, and decline state.
- Village buildings that turn surplus into housing, storage, windmill-centered farm production, mine access, military capacity, shore access, and settlement influence; storage is now pressure-sensitive and settlement-scale-aware, so near-full material stores or future upgrade capacity limits can drive autonomous warehouse expansion beyond a tiny fixed count in larger towns.
- Autonomous building placement that reads as local choice: homes cluster without covering resources, farms follow useful land, mines follow ore and hills, military buildings sit toward the settlement edge, docks follow shorelines, and buildings never stack onto the same tile or crowd the first available tile.
- Readable settlement growth signals: visible resource depletion, windmill farmland rings, construction and gathering work sites, food reserve diagnostics, farmer coverage, growth blockers, earlier house pressure, storage pressure, capacity blockers, and stable territory spread from settlement cores, buildings, and frontier preparation rather than temporary work pulses.
- Kingdoms that emerge from strong villages and aggregate capital, members, population, buildings, territory, food/material stores, and storage capacity.
- Village loyalty, unrest, and sustained rebellion-preparation projection inside kingdoms, so distance from capital, overextension, food pressure, war pressure, and strong frontier towns become readable before rebellion mechanics are allowed to split the realm.
- Diplomacy pressure that turns border friction, resource shortage, and race tendencies into observable declaration causes.
- Minimal grouped war that lets declarations create armies, casualties, and village ownership changes without full single-unit combat.
- God commands for spawning life, placing food, changing terrain, lightning, pause, and speed.
- Phaser projection that only renders a read-only snapshot.

Diplomacy, war, species-specific culture, religions, families, disasters, monsters, and large-scale optimization are staged in `ROADMAP.md`.

## Permanent Product Rules

- Players are gods, not RTS commanders.
- Unit autonomy is the center of the game.
- UI can observe and issue commands, but cannot mutate simulation state directly.
- Visuals are projections of world state, not the state itself.
- Big numbers are achieved with layered simulation: visible individuals nearby, grouped or statistical populations far away.
- Every new gameplay idea must first pass a WorldBox consistency check: does it make the world feel more alive through autonomy, pressure, readable cause/effect, and meaningful god intervention; if not, it needs a design justification or should be deferred.
