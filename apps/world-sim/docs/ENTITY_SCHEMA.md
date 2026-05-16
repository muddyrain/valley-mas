# WorldSim - 实体 Schema

> 版本：v0.1 · 日期：2026-05-15  
> 这份文档定义运行时对象的字段、归属和最小生命周期。

## 1. 通用原则

- 实体字段要稳定
- 配置字段和实例字段分开
- 能由配置推导的内容不要重复存两份
- 影响存档的字段必须有版本意识

## 2. 核心实体

v0.1 先使用 TypeScript interface 作为最小 schema 草案。后续如果引入运行时校验，字段名和语义必须从这里迁移，不另起一套。

```ts
type EntityId = string;
type RaceId = "human" | "orc" | "elf" | "dwarf";
type TerrainType = "grass" | "forest" | "mountain" | "water" | "desert" | "snow" | "lava";
type UnitState = "Idle" | "Wander" | "Harvest" | "Build" | "Rest" | "Sleep" | "March" | "Attack" | "Flee" | "Dead";

type Position = {
  x: number;
  y: number;
};

interface WorldSchema {
  seed: string;
  width: number;
  height: number;
  tiles: TileSchema[];
  systems: Record<string, unknown>;
  time: TimeSchema;
  events: EventSchema[];
}

interface TileSchema {
  x: number;
  y: number;
  terrainType: TerrainType;
  ownerFactionId?: EntityId;
  resourceId?: string;
  resourceType?: "food" | "wood" | "stone" | "iron";
  resourceAmount?: number;
  resourceCapacity?: number;
  fogState?: "unknown" | "revealed" | "visible";
}

interface UnitSchema {
  id: EntityId;
  name: string;
  race: RaceId;
  factionId: EntityId;
  age: number;
  gender: "male" | "female";
  hp: number;
  vitality: number;
  job: string;
  state: UnitState;
  position: Position;
  traits: string[];
}

interface FactionSchema {
  id: EntityId;
  name: string;
  race: RaceId;
  color: string;
  capitalPosition: Position;
  leaderUnitId?: EntityId;
  population: number;
  territoryCount: number;
  relations: Record<EntityId, string>;
  inventory: Record<string, number>;
}

interface BuildingSchema {
  id: EntityId;
  type: string;
  factionId: EntityId;
  position: Position;
  hp: number;
  progress: number;
  progressRequired: number;
  status: "queued" | "building" | "complete";
  ownerTileIds: string[];
}

interface TimeSchema {
  tick: number;
  year: number;
  day: number;
  speed: 0 | 1 | 2 | 4;
}

interface EventSchema {
  id: EntityId;
  type: string;
  time: TimeSchema;
  sourceId?: EntityId;
  targetId?: EntityId;
  payload: Record<string, unknown>;
}
```

### 2.1 World

- `seed`
- `width`
- `height`
- `tiles`
- `systems`
- `time`
- `events`

### 2.2 Tile

- `x`
- `y`
- `terrainType`
- `ownerFactionId`
- `resourceId`
- `fogState`

### 2.3 Unit

- `id`
- `name`
- `race`
- `factionId`
- `age`
- `gender`
- `hp`
- `vitality`
- `job`
- `state`
- `position`
- `traits`
- `inventory`

### 2.4 Faction

- `id`
- `name`
- `race`
- `color`
- `capitalPosition`
- `leaderUnitId`
- `population`
- `territoryCount`
- `relations`
- `inventory`

### 2.5 Building

- `id`
- `type`
- `factionId`
- `position`
- `hp`
- `progress`
- `ownerTileIds`

### 2.6 Event

- `id`
- `type`
- `time`
- `sourceId`
- `targetId`
- `payload`

## 3. 推荐补充实体

- `Culture`
- `Clan`
- `SuccessionRule`
- `WorldPhase`
- `ReplayFrame`

这些实体可以晚一点实现，但字段入口要先预留。

## 4. 版本规则

- 重大字段变化必须写迁移说明
- 不要靠 UI 文案代替 schema 变更
- 旧存档字段要有兼容期

## 5. 最小要求

任何新增系统至少要回答：

- 它归哪个实体
- 哪些字段是实例态
- 哪些字段是配置态
- 哪些字段要进存档
- 哪些字段只用于运行时

## 6. 写权限

- `WorldScene` 不能直接写 `WorldSchema`
- UI 只能提交 `SimCommand`
- 系统只能修改自己负责的字段
- 跨实体修改必须通过系统事件记录原因
