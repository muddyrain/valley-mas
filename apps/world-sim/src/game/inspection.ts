import type {
  ArmyGroup,
  Kingdom,
  Position,
  SimEvent,
  Tile,
  Unit,
  Village,
  VillageBuilding,
  WorldProjection,
} from '../sim/types';

const ARMY_PICK_RADIUS = 2.2;
const BUILDING_PICK_RADIUS = 1.5;
const VILLAGE_PICK_RADIUS = 2.5;
const UNIT_PICK_RADIUS = 1.2;

const TERRAIN_LABELS: Record<string, string> = {
  grass: '草地',
  forest: '森林',
  hill: '丘陵',
  water: '水域',
  sand: '沙地',
  snow: '雪地',
  lava: '熔岩',
};

const BIOME_LABELS: Record<string, string> = {
  temperate: '温带',
  woodland: '林地',
  highland: '高地',
  coast: '海岸',
  dryland: '旱地',
  frozen: '寒地',
  volcanic: '火山地',
};

const RESOURCE_LABELS: Record<string, string> = {
  food: '食物',
  wood: '木材',
  stone: '石料',
  iron: '铁矿',
};

const RACE_LABELS: Record<string, string> = {
  human: '人类',
  orc: '兽人',
  elf: '精灵',
  dwarf: '矮人',
};

const GENDER_LABELS: Record<string, string> = {
  male: '男',
  female: '女',
};

const UNIT_INTENT_LABELS: Record<string, string> = {
  idle: '空闲',
  seek_food: '寻找食物',
  eat: '进食',
  wander: '游荡',
  dead: '死亡',
};

const VILLAGE_STATUS_LABELS: Record<string, string> = {
  camp: '营地',
  stable: '稳定',
  declining: '衰退',
};

const KINGDOM_STATUS_LABELS: Record<string, string> = {
  rising: '兴起',
  stable: '稳定',
  declining: '衰退',
  fallen: '陨落',
};

const BUILDING_LABELS: Record<string, string> = {
  town_hall: '市政厅',
  house: '民居',
  storage: '仓库',
  farm: '农田',
  mine: '矿场',
  barrack: '兵营',
  dock: '码头',
};

const BUILDING_STATUS_LABELS: Record<string, string> = {
  active: '有效',
  abandoned: '废弃',
  ruined: '废墟',
};

const ARMY_STATUS_LABELS: Record<string, string> = {
  marching: '行军中',
  fighting: '交战中',
  retreating: '撤退中',
  disbanded: '已解散',
};

export type WorldSelection =
  | { type: 'none' }
  | { type: 'tile'; x: number; y: number }
  | { type: 'unit'; id: string }
  | { type: 'village'; id: string }
  | { type: 'kingdom'; id: string }
  | { type: 'building'; id: string }
  | { type: 'army'; id: string };

export type MapLabel = {
  id: string;
  text: string;
  position: Position;
  color: string;
};

export function selectWorldEntity(projection: WorldProjection, position: Position): WorldSelection {
  const army = findNearestWithin(
    projection.armies.filter((candidate) => candidate.status !== 'disbanded'),
    position,
    ARMY_PICK_RADIUS,
    (candidate) => candidate.position,
  );

  if (army) {
    return { type: 'army', id: army.id };
  }

  const building = findNearestWithin(
    projection.buildings,
    position,
    BUILDING_PICK_RADIUS,
    (candidate) => candidate.position,
  );

  if (building) {
    return { type: 'building', id: building.id };
  }

  const village = findNearestWithin(
    projection.villages,
    position,
    VILLAGE_PICK_RADIUS,
    (candidate) => candidate.center,
  );

  if (village) {
    return { type: 'village', id: village.id };
  }

  const territory = projection.territory.find(
    (tile) => tile.x === Math.floor(position.x) && tile.y === Math.floor(position.y),
  );

  if (territory) {
    return { type: 'village', id: territory.villageId };
  }

  const unit = findNearestWithin(projection.units, position, UNIT_PICK_RADIUS, (candidate) => ({
    x: candidate.position.x,
    y: candidate.position.y,
  }));

  if (unit) {
    return { type: 'unit', id: unit.id };
  }

  return { type: 'tile', x: Math.floor(position.x), y: Math.floor(position.y) };
}

export function buildInspectionLines(projection: WorldProjection, selection: WorldSelection) {
  switch (selection.type) {
    case 'none':
      return ['观察', '未选中实体', '左键点击军队、建筑、村庄、单位或地块查看详情。'];
    case 'tile':
      return buildTileLines(projection, selection.x, selection.y);
    case 'unit':
      return buildUnitLines(projection, selection.id);
    case 'village':
      return buildVillageLines(projection, selection.id);
    case 'kingdom':
      return buildKingdomLines(projection, selection.id);
    case 'building':
      return buildBuildingLines(projection, selection.id);
    case 'army':
      return buildArmyLines(projection, selection.id);
  }
}

export function filterEventsForSelection(
  projection: WorldProjection,
  selection: WorldSelection,
): SimEvent[] {
  if (selection.type === 'none' || selection.type === 'tile') {
    return projection.recentEvents;
  }

  return projection.recentEvents.filter((event) =>
    isEventRelatedToSelection(projection, event, selection),
  );
}

export function selectionKey(selection: WorldSelection) {
  switch (selection.type) {
    case 'none':
      return 'none';
    case 'tile':
      return `tile:${selection.x}:${selection.y}`;
    default:
      return `${selection.type}:${selection.id}`;
  }
}

export function selectNextKingdom(
  projection: WorldProjection,
  currentSelection: WorldSelection,
): WorldSelection {
  const activeKingdoms = projection.kingdoms.filter((kingdom) => kingdom.status !== 'fallen');

  if (activeKingdoms.length === 0) {
    return { type: 'none' };
  }

  if (currentSelection.type !== 'kingdom') {
    return { type: 'kingdom', id: activeKingdoms[0].id };
  }

  const currentIndex = activeKingdoms.findIndex((kingdom) => kingdom.id === currentSelection.id);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % activeKingdoms.length;

  return { type: 'kingdom', id: activeKingdoms[nextIndex].id };
}

export function buildMapLabels(projection: WorldProjection): MapLabel[] {
  const villageLabels = projection.villages.map((village) => ({
    id: `village:${village.id}`,
    text: `村庄 ${shortId(village.id)}`,
    position: {
      x: Math.round(village.center.x * 10) / 10,
      y: Math.round((village.center.y - 1.6) * 10) / 10,
    },
    color: '#f4f4f4',
  }));
  const kingdomLabels = projection.kingdoms
    .filter((kingdom) => kingdom.status !== 'fallen')
    .map((kingdom) => {
      const capital = projection.villages.find(
        (village) => village.id === kingdom.capitalVillageId,
      );

      return {
        id: `kingdom:${kingdom.id}`,
        text: `王国 ${shortId(kingdom.id)}`,
        position: {
          x: Math.round((capital?.center.x ?? 0) * 10) / 10,
          y: Math.round(((capital?.center.y ?? 0) - 3.2) * 10) / 10,
        },
        color: hexColor(kingdom.color),
      };
    });

  return [...villageLabels, ...kingdomLabels];
}

function buildTileLines(projection: WorldProjection, x: number, y: number) {
  const tile = projection.tiles.find((candidate) => candidate.x === x && candidate.y === y);
  const territory = projection.territory.find(
    (candidate) => candidate.x === x && candidate.y === y,
  );
  const village = territory
    ? projection.villages.find((candidate) => candidate.id === territory.villageId)
    : undefined;
  const kingdom = territory?.kingdomId
    ? projection.kingdoms.find((candidate) => candidate.id === territory.kingdomId)
    : undefined;
  const terrain = tile?.terrain ? labelFromMap(TERRAIN_LABELS, tile.terrain) : '未知';
  const biome = tile?.biome ? labelFromMap(BIOME_LABELS, tile.biome) : '未知';
  const resource = tile?.resource
    ? `${labelFromMap(RESOURCE_LABELS, tile.resource.type)} x ${Math.round(tile.resource.amount)}`
    : '无';
  const villageId = village ? `村庄 ${shortId(village.id)}` : '无';
  const kingdomId = kingdom ? `王国 ${shortId(kingdom.id)}` : '无';

  return [
    `地块 ${x},${y}`,
    `地形：${terrain}`,
    `生态：${biome}`,
    `资源：${resource}`,
    `村庄：${villageId}`,
    `王国：${kingdomId}`,
  ];
}

function buildUnitLines(projection: WorldProjection, id: string) {
  const unit = projection.units.find((candidate) => candidate.id === id);

  if (!unit) {
    return ['单位', '选中单位已离开视野或消失。'];
  }

  return [
    `单位 ${shortId(unit.id)}`,
    `种族：${labelFromMap(RACE_LABELS, unit.race)}`,
    `性别：${labelFromMap(GENDER_LABELS, unit.gender)}`,
    `状态：${labelFromMap(UNIT_INTENT_LABELS, unit.intent)}`,
    `生命：${Math.round(unit.hp)}`,
    `饥饿：${Math.round(unit.hunger)}`,
    `归属村庄：${unit.homeVillageId ? `村庄 ${shortId(unit.homeVillageId)}` : '无'}`,
    `当前位置：${formatPosition(unit.position)}`,
  ];
}

function buildVillageLines(projection: WorldProjection, id: string) {
  const village = projection.villages.find((candidate) => candidate.id === id);

  if (!village) {
    return ['村庄', '选中村庄已消失。'];
  }

  const kingdom = village.kingdomId
    ? projection.kingdoms.find((candidate) => candidate.id === village.kingdomId)
    : undefined;
  const buildings = projection.buildings.filter((building) => building.villageId === village.id);
  const activeArmies = projection.armies.filter(
    (army) => army.originVillageId === village.id && army.status !== 'disbanded',
  );

  return [
    `村庄 ${shortId(village.id)}`,
    `种族：${labelFromMap(RACE_LABELS, village.race)}`,
    `状态：${labelFromMap(VILLAGE_STATUS_LABELS, village.status)}`,
    `所属王国：${kingdom ? `王国 ${shortId(kingdom.id)}` : '无'}`,
    `人口：${village.population}`,
    `住房：${village.housingCapacity}`,
    `食物：${Math.round(village.foodInventory)} / ${village.foodCapacity}`,
    `材料：木材 ${Math.round(village.woodInventory)}, 石料 ${Math.round(
      village.stoneInventory,
    )}, 铁矿 ${Math.round(village.ironInventory)}`,
    `建筑：${buildings.length}`,
    `领土：${village.territoryTiles}`,
    `军队：${activeArmies.length}`,
    `中心：${formatPosition(village.center)}`,
  ];
}

function buildKingdomLines(projection: WorldProjection, id: string) {
  const kingdom = projection.kingdoms.find((candidate) => candidate.id === id);

  if (!kingdom) {
    return ['王国', '选中王国已消失。'];
  }

  const activeArmies = projection.armies.filter(
    (army) => army.kingdomId === kingdom.id && army.status !== 'disbanded',
  );

  return [
    `王国 ${shortId(kingdom.id)}`,
    `种族：${labelFromMap(RACE_LABELS, kingdom.race)}`,
    `状态：${labelFromMap(KINGDOM_STATUS_LABELS, kingdom.status)}`,
    `首都：村庄 ${shortId(kingdom.capitalVillageId)}`,
    `村庄：${kingdom.villageIds.length}`,
    `人口：${kingdom.population}`,
    `建筑：${kingdom.buildingCount}`,
    `领土：${kingdom.territoryTiles}`,
    `库存：${Math.round(kingdom.foodInventory)}`,
    `材料：木材 ${Math.round(kingdom.woodInventory)}, 石料 ${Math.round(
      kingdom.stoneInventory,
    )}, 铁矿 ${Math.round(kingdom.ironInventory)}`,
    `外交压力：${Math.round(kingdom.diplomacyPressure)}`,
    `压力目标：${
      kingdom.diplomacyTargetKingdomId ? `王国 ${shortId(kingdom.diplomacyTargetKingdomId)}` : '无'
    }`,
    `军队：${activeArmies.length}`,
  ];
}

function buildBuildingLines(projection: WorldProjection, id: string) {
  const building = projection.buildings.find((candidate) => candidate.id === id);

  if (!building) {
    return ['建筑', '选中建筑已离开视野或消失。'];
  }

  const village = projection.villages.find((candidate) => candidate.id === building.villageId);
  const kingdom = village?.kingdomId
    ? projection.kingdoms.find((candidate) => candidate.id === village.kingdomId)
    : undefined;

  return [
    `建筑 ${shortId(building.id)}`,
    `类型：${labelFromMap(BUILDING_LABELS, building.type)}`,
    `等级：${building.tier || 1}`,
    `状态：${labelFromMap(BUILDING_STATUS_LABELS, building.status)}`,
    `村庄：村庄 ${shortId(building.villageId)}`,
    `王国：${kingdom ? `王国 ${shortId(kingdom.id)}` : '无'}`,
    `建造时间：第 ${building.builtAtTick} 刻`,
    `位置：${formatPosition(building.position)}`,
  ];
}

function buildArmyLines(projection: WorldProjection, id: string) {
  const army = projection.armies.find((candidate) => candidate.id === id);

  if (!army) {
    return ['军队', '选中军队已离开视野或解散。'];
  }

  return [
    `军队 ${shortId(army.id)}`,
    `状态：${labelFromMap(ARMY_STATUS_LABELS, army.status)}`,
    `所属王国：王国 ${shortId(army.kingdomId)}`,
    `目标王国：王国 ${shortId(army.targetKingdomId)}`,
    `出发村庄：村庄 ${shortId(army.originVillageId)}`,
    `目标村庄：村庄 ${shortId(army.targetVillageId)}`,
    `士兵：${army.soldierCount}`,
    `士气：${army.morale.toFixed(2)}`,
    `位置：${formatPosition(army.position)}`,
  ];
}

function isEventRelatedToSelection(
  projection: WorldProjection,
  event: SimEvent,
  selection: Exclude<WorldSelection, { type: 'none' } | { type: 'tile' }>,
) {
  const payload = event.payload ?? {};

  if (selection.type === 'unit') {
    return event.unitId === selection.id || payload.unitId === selection.id;
  }

  if (selection.type === 'building') {
    const building = projection.buildings.find((candidate) => candidate.id === selection.id);
    return (
      payload.buildingId === selection.id ||
      event.message.includes(selection.id) ||
      Boolean(building && payload.villageId === building.villageId)
    );
  }

  if (selection.type === 'army') {
    return payload.armyId === selection.id || event.message.includes(selection.id);
  }

  if (selection.type === 'village') {
    const village = projection.villages.find((candidate) => candidate.id === selection.id);

    return (
      payload.villageId === selection.id ||
      event.message.includes(selection.id) ||
      Boolean(
        village?.kingdomId &&
          (payload.kingdomId === village.kingdomId ||
            payload.targetKingdomId === village.kingdomId),
      )
    );
  }

  if (selection.type === 'kingdom') {
    return (
      payload.kingdomId === selection.id ||
      payload.targetKingdomId === selection.id ||
      event.message.includes(selection.id)
    );
  }

  return false;
}

function findNearestWithin<T>(
  candidates: T[],
  position: Position,
  radius: number,
  getPosition: (candidate: T) => Position,
) {
  let nearest: T | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateDistance = distance(position, getPosition(candidate));

    if (candidateDistance <= radius && candidateDistance < nearestDistance) {
      nearest = candidate;
      nearestDistance = candidateDistance;
    }
  }

  return nearest;
}

function formatPosition(position: Position) {
  return `${Math.round(position.x)},${Math.round(position.y)}`;
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hexColor(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function shortId(id: string) {
  const suffix = id.split('-').at(-1) ?? id;
  return /^\d+$/.test(suffix) ? suffix : id;
}

function labelFromMap(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

// Keep the type imports above visible to TypeScript as the feature grows.
type _InspectableEntity = ArmyGroup | Kingdom | Tile | Unit | Village | VillageBuilding;
