# WorldSim v2 Mechanics

## World

The world is a tile grid split into chunks. The foundation demo map defaults to 128 x 128 tiles. Full projection remains available for tests and tooling, while the Phaser render path now requests a camera viewport so visible tiles and entities can be culled through the chunk-indexed projection path. Each tile has terrain, biome, and optional resource deposits. Early terrain types are grass, forest, hill, water, sand, snow, and lava. Early biomes are temperate, woodland, highland, coast, dryland, frozen, and volcanic.

## Units

Units are autonomous life forms. The first slice supports:

- age
- health
- hunger
- reproduction cooldown
- gender
- race
- position
- current intent

Units seek food when hungry, eat nearby food, wander when stable, age over time, die from old age or starvation, and reproduce when local conditions allow.

## God Commands

The first god commands are:

- `spawn_unit`
- `place_resource`
- `change_terrain`
- `lightning`
- `set_speed`
- `pause`

Commands are not guaranteed to succeed. Rejections become events so UI and tests can observe why an action failed.

## Resources

Food is the first active resource. It exists as tile deposits and supports the life loop. PR-12C now exposes village and kingdom stores for food, wood, stone, and iron. Active mines can gather nearby stone or iron deposits into village stores, while wood gathering and material-based construction costs remain pending.

## Villages and Kingdoms

Villages now form after individual survival pressure is visible. A cluster of at least eight same-race units near enough food can found a camp. Founding units receive a stable `homeVillageId`; later same-race homeless units near the settlement can be adopted into that home village. The village stores gathered food and early materials, tracks home population, exposes housing capacity, consumes food on a fixed interval, and enters a declining state when inventory cannot satisfy residents.

The village `center` is an internal settlement anchor, not a visible building or capital marker. Population ownership is stable and does not depend on whether villagers are currently inside this anchor radius. The anchor supports village formation spacing, food search, and construction placement; player-facing village presence should come from buildings, territory, kingdom summaries, and later inspection panels.

- villages form from population clusters and local food pressure
- village population is counted by `homeVillageId`, while `villageId` only marks the current nearby village presence
- village food inventory is gathered from nearby food deposits
- active mines gather nearby stone or iron deposits into village material stores
- housing capacity caps village-supported reproduction
- food shortage causes village decline before later systems add migration, abandonment pressure, or war
- villages are abandoned only when their home population reaches zero, not when residents temporarily walk away
- buildings change capacity or production
- territory follows settlement and building influence
- kingdoms group villages and prepare diplomacy

Kingdoms form from village strength instead of player commands. A village with enough home population and active buildings can found a rising kingdom. Nearby same-race villages can join that kingdom. A kingdom tracks capital village, member villages, total home population, active buildings, active territory, food inventory, stable display color, and status. The founding capital is stable: it does not move just because another member village has more population. A replacement capital is chosen only when the current capital is no longer a valid member, such as after abandonment, removal, or capture. Replacement priority is highest active town hall tier, then active building count, then population, then deterministic village id order. If all member villages disappear, the kingdom becomes fallen and remains as history data for later UI. Territory projection now keeps both `villageId` and optional `kingdomId`, so diplomacy, war, and rendering can reason about ownership by kingdom without changing the simulation/rendering boundary.

## Diplomacy Pressure

Diplomacy is currently pressure-based rather than menu-driven. Active kingdoms compare nearby rivals each tick and maintain pairwise pressure. Each kingdom exposes its highest current `diplomacyPressure` and `diplomacyTargetKingdomId` in projection data.

Pressure comes from:

- border friction when rival village centers are close enough to represent a contested frontier
- resource pressure when either rival has low food per resident
- race modifiers, with orcs escalating faster, elves slower, dwarves slightly faster, and same-race rivalry reduced

When pressure crosses report tiers, the simulation emits `border_friction`, `resource_pressure`, and `diplomacy_pressure` events with cause data. When pressure crosses the declaration threshold, the simulation emits `war_declared`. PR-10 turns declarations into army movement, battles, casualties, retreat, and capture.

## Buildings and Territory

Villages spend food surplus on simple functional buildings. PR-12B starts turning the older
hut/storage/farm foundation into a clearer settlement chain:

- town hall is created when a village is founded and marks the visible settlement anchor
- town hall now acts as the upgrade gate for the rest of the chain
- house is the visible housing building; the first slice stores `tier: 1`, then can upgrade to tiers 2 and 3 for extra housing capacity
- storage increases village food capacity
- farm produces village food even after nearby deposits are exhausted
- mine can be built once when the village has a nearby hill, stone deposit, or iron deposit; it claims territory and marks future stone/iron access, but does not gather materials until PR-12C
- barrack can be built once after the basic food and housing chain is in place; it increases army mobilization from the capital village
- dock can be built once on a nearby walkable shore tile adjacent to water; it claims territory and marks future boat, trade, and colonization access, but does not launch ships yet

The first territory model is influence-based. Active buildings claim walkable tiles around their fixed positions, which keeps territory stable while villagers move. Territory is projection data for rendering, diplomacy, and war feedback; it does not yet block movement or create borders. Unaffiliated villages claim tiles with only `villageId`; villages inside a kingdom also stamp `kingdomId` on their territory tiles. The Phaser layer renders kingdom-owned territory with that kingdom's stable color, so captured villages visually switch to the attacker's color after ownership transfer.

When a village loses all population, its buildings are not deleted immediately. They become abandoned remnants. Abandoned buildings stay visible but no longer provide housing, storage, farm production, mine access, army mobilization bonuses, dock access, or active territory. PR-12C can now build on this chain with job-driven resource stores.

## Combat and War

War starts at the group level. A `war_declared` event can form an `ArmyGroup` from the aggressor kingdom's capital village. Army groups are projected as aggregate military units with position, target kingdom, target village, soldier count, morale, and status.

Barracks are the first building hook into war. If the capital village has an active barrack when an army group forms, the simulation raises both the mobilization ratio and the maximum soldier cap for that army. This keeps barracks functional without introducing individual soldier jobs before PR-12C.

The first war model intentionally avoids complex individual brawls:

- armies march toward a target village as grouped simulation objects
- battle resolution compares aggregate attacker strength against village defender strength
- casualties remove a small number of residents from the origin and target villages
- winning attackers can capture the target village for their kingdom
- armies disband after capture, retreat, or losing their target

This PR-10 model is enough for wars to start, move, cause casualties, and change village ownership. Later stages can add multiple armies, fronts, commanders, peace deals, occupation, culture, rebellion, and visible local fighters.

In the current UI, army groups render as triangular markers using their owning kingdom's color, with the outline preserving basic status feedback. This keeps war readable without turning every unit into a soldier.

## Race Identity

Race differences must affect behavior and survival pressure:

- humans expand steadily
- orcs consume more and escalate conflict sooner
- elves prefer forests and avoid unnecessary tree clearing
- dwarves prefer hills and mining

Visual differences are secondary.
