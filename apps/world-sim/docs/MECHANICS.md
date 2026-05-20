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

Food is the first active resource. It exists as tile deposits and supports the life loop. PR-12C now exposes village and kingdom stores for food, wood, stone, and iron. Wood deposits sit on forest tiles and render as small map markers, and stone/iron deposits on hills also render as visible markers so material sources are readable. Builders gather nearby wood into village stores, active mines can gather nearby stone or iron deposits, and villages can open a small early stone quarry when no rare natural hill is close enough. Building construction now uses material costs instead of spending food. Residents can also draw food from their home village stores when nearby tile food runs out. Food is reserved for feeding people and for prosperity-style gates. Early camp villages also use a lighter food drain so the first 30-person settlement can bootstrap before the farm/build loop is online.

## Villages and Kingdoms

Villages now form after individual survival pressure is visible. A cluster of at least eight same-race units near enough food can found a camp. Founding units receive a stable `homeVillageId`; later same-race homeless units near the settlement can be adopted into that home village. The village stores gathered food and early materials, tracks home population, exposes housing capacity, consumes food on a fixed interval, and enters a declining state when inventory cannot satisfy residents.

The village `center` is an internal settlement anchor, not a visible building or capital marker. Population ownership is stable and does not depend on whether villagers are currently inside this anchor radius. The anchor supports village formation spacing, food search, and construction placement; player-facing village presence now comes from named village labels, level tags, buildings, territory, kingdom summaries, and inspection panels.

Villages also carry a race-themed name and a growth level:

- village names are generated when the settlement is founded
- the map label shows `村名 · Lv.x`, while capital villages show `首都 · 村名 · Lv.x`
- village level is derived from population, housing capacity, town hall tier, and building count, then clamped to a small readable range
- village inspection shows the village name, level, and whether it is the capital
- village inspection also shows a short growth label, and level-up events now enter the recent event stream
- kingdom inspection shows the capital village by name and level when available

- villages form from population clusters and local food pressure
- village population is counted by `homeVillageId`, while `villageId` only marks the current nearby village presence
- village food inventory is gathered from nearby food deposits and can be shared back to nearby residents through the village store
- active mines gather nearby stone or iron deposits into village material stores
- housing capacity caps village-supported reproduction
- food shortage causes village decline before later systems add migration, abandonment pressure, or war; camp villages have a gentler early drain so they can survive the bootstrap phase
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

Villages spend material stores on simple functional buildings. PR-12B starts turning the older
hut/storage/farm foundation into a clearer settlement chain, and PR-12C shifts construction away from food costs:

- town hall is created when a village is founded and marks the visible settlement anchor
- town hall now acts as the upgrade gate for the rest of the chain
- house is the visible housing building; the first slice stores `tier: 1`, then can upgrade to tiers 2 and 3 for extra housing capacity, and its construction is wood-driven rather than food-driven
- storage increases village food capacity and costs wood
- farm produces village food when the village has assigned farmer jobs, even after nearby deposits are exhausted, and costs wood
- mine can be built once after the village has a house, storage, and at least one farm; it prefers a nearby hill, stone deposit, or iron deposit, but can open a shallow stone quarry if no natural mine site is close enough
- barrack can be built once after the basic chain and mining economy can supply stone; it costs wood plus stone and increases army mobilization from the capital village
- dock can be built once on a nearby walkable shore tile adjacent to water; it costs wood, claims territory, and marks future boat, trade, and colonization access, but does not launch ships yet

The first territory model is influence-based. Active buildings claim walkable tiles around their fixed positions, which keeps territory stable while villagers move. Territory is projection data for rendering, diplomacy, and war feedback; it does not yet block movement or create borders. Unaffiliated villages claim tiles with only `villageId`; villages inside a kingdom also stamp `kingdomId` on their territory tiles. The Phaser layer renders kingdom-owned territory with that kingdom's stable color, draws only the outer boundary outline instead of every grid edge, and brightens the selected village or kingdom's territory so ownership is easier to read. Captured villages visually switch to the attacker's color after ownership transfer.

When a village loses all population, its buildings are not deleted immediately. They become abandoned remnants. Abandoned buildings stay visible but no longer provide housing, storage, farm production, mine access, army mobilization bonuses, dock access, or active territory. PR-12C can now build on this chain with job-driven resource stores.

## Village Jobs and Resources

Villages now assign a small aggregate workforce each simulation tick. This is not per-citizen inventory or full worker pathfinding; it is a cheap village-level job model that makes the resource economy readable while preserving the PR-11 scale target.

- farmers exist from the start as a small default workforce, keep early villages alive, and make farm food production stronger once farms appear
- builders reserve a small part of the workforce and gather nearby wood deposits into village stores
- miners are assigned when active mines exist and move nearby stone or iron deposits into village stores; early quarries provide a small stone deposit so normal settlements can visibly enter the mining chain
- soldiers are assigned when barracks exist, but army formation still uses the existing aggregate mobilization model

Food, wood, stone, and iron stores are projected to the UI and shown in village and kingdom inspection panels. Houses, storage, farms, mines, barracks, docks, and house upgrades now use material costs; construction time is driven by builder jobs. Village food stores now also act as a fallback supply for residents when local ground food is exhausted. Town hall upgrade gates still use food surplus as a prosperity signal until the later city-growth pass replaces or deepens that model.

## Combat and War

War starts at the group level. A `war_declared` event can form an `ArmyGroup` from the aggressor kingdom's capital village. Army groups are projected as aggregate military units with position, target kingdom, target village, soldier count, morale, and status.

Barracks are the first building hook into war. If the capital village has an active barrack when an army group forms, the simulation raises both the mobilization ratio and the maximum soldier cap for that army. PR-12C now exposes village-level soldier jobs, and those trained soldiers now feed army formation and battle strength as a first pass, while detailed soldier mustering and per-fighter combat remain later depth.

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
