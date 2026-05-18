# WorldSim v2 Mechanics

## World

The world is a tile grid split into chunks. Each tile has terrain, biome, and optional resource deposits. Early terrain types are grass, forest, hill, water, sand, snow, and lava. Early biomes are temperate, woodland, highland, coast, dryland, frozen, and volcanic.

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

Food is the first active resource. It exists as tile deposits and supports the life loop. Later resources such as wood, stone, and iron must become meaningful through village and building systems, not through decorative counters.

## Villages and Kingdoms

Villages and kingdoms are intentionally not part of the first code slice. They must emerge after individual survival works:

- villages form from population clusters and local food pressure
- buildings change capacity or production
- territory follows settlement influence
- kingdoms group villages and produce diplomacy

## Combat and War

War starts later at the group level. The model should prefer armies, fronts, morale, and casualties before visible individual brawls. Nearby battles may project individual fighters, but distant battles should use grouped simulation.

## Race Identity

Race differences must affect behavior and survival pressure:

- humans expand steadily
- orcs consume more and escalate conflict sooner
- elves prefer forests and avoid unnecessary tree clearing
- dwarves prefer hills and mining

Visual differences are secondary.
