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

## Current v2 Scope

The first v2 slice deliberately avoids full WorldBox parity. It establishes the foundation:

- Pure simulation truth outside Phaser.
- Deterministic seed and replay behavior.
- Tile, chunk, biome, and resource data.
- Units with hunger, age, health, death, birth, movement, stable home village membership, and simple needs.
- Villages that emerge from local population and food pressure, with inventory, housing, and decline state.
- Village buildings that turn surplus into housing, storage, farm production, and settlement influence.
- Kingdoms that emerge from strong villages and aggregate capital, members, population, buildings, territory, and food.
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
