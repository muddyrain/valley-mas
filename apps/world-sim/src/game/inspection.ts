import type {
  ArmyGroup,
  Kingdom,
  Position,
  SimEvent,
  TerritoryTile,
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

const VILLAGE_GROWTH_PHASE_LABELS: Record<string, string> = {
  camp: '营地',
  hamlet: '村落',
  village: '村庄',
  town: '城镇',
  frontier: '扩张前线',
};

const VILLAGE_GROWTH_BLOCKER_LABELS: Record<string, string> = {
  housing_pressure: '住房紧张',
  missing_wood: '缺少木材',
  missing_stone: '缺少石料',
  missing_iron: '缺少铁矿',
  storage_full: '仓储接近满载',
  insufficient_storage: '仓储容量不足',
  no_wood_source: '无可达木材',
  insufficient_builders: '建筑工不足',
  low_food_reserve: '食物储备偏低',
  no_buildable_land: '缺少可建设土地',
};

const VILLAGE_BUILD_PLAN_LABELS: Record<string, string> = {
  expand_housing: '扩建民居',
  expand_farms: '扩建农田',
  expand_storage: '扩建仓储',
  expand_mining: '建设矿场',
  expand_military: '建设兵营',
  expand_dock: '建设码头',
  prepare_expansion: '准备分村',
  waiting_population_pressure: '等待人口增长',
  waiting_resources: '等待资源',
  waiting_land: '等待土地',
  idle: '暂无扩建',
};

const TERRITORY_SOURCE_LABELS: Record<string, string> = {
  settlement_core: '聚落核心',
  building: '建筑影响',
  work_site: '施工/采集活动',
  frontier: '扩张准备',
};

const EXPANSION_REASON_LABELS: Record<string, string> = {
  prepare_expansion: '已具备拓荒条件',
  waiting_land: '缺少合适新址',
  waiting_resources: '缺少拓荒食物或木材',
  waiting_population_pressure: '人口或住房压力不足',
};

const LOYALTY_REASON_LABELS: Record<string, string> = {
  capital: '首都核心',
  stable: '内政稳定',
  capital_distance: '距离首都过远',
  overextended_kingdom: '王国过度扩张',
  food_pressure: '食物压力',
  war_pressure: '战争压力',
  strong_frontier: '边疆实力过强',
  recently_captured: '新近被征服',
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
  farm: '风车农田',
  mine: '矿场',
  barrack: '兵营',
  dock: '码头',
};

const BUILDING_STATUS_LABELS: Record<string, string> = {
  constructing: '建设中',
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

export type MapLabelDetailLevel = 'overview' | 'regional' | 'local';

export type MapLabelOptions = {
  detailLevel?: MapLabelDetailLevel;
  selection?: WorldSelection;
};

export type TerritoryBorderSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  selected: boolean;
  alpha: number;
  width: number;
};

export type EventTimelineCategory =
  | 'god'
  | 'growth'
  | 'building'
  | 'war'
  | 'rebellion'
  | 'life'
  | 'resource'
  | 'diplomacy'
  | 'system';

const GROWTH_LABELS: Record<number, string> = {
  1: '营地',
  2: '村落',
  3: '小镇',
  4: '城镇',
  5: '成熟城市',
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

export function classifyEvent(event: SimEvent): { id: EventTimelineCategory; label: string } {
  if (
    event.sourceCommandId ||
    event.type === 'command_accepted' ||
    event.type === 'command_rejected' ||
    event.type === 'resource_placed' ||
    event.type === 'terrain_changed' ||
    event.type === 'lightning_struck' ||
    event.type === 'speed_changed' ||
    event.type === 'pause_changed'
  ) {
    return { id: 'god', label: '神力' };
  }

  if (event.type === 'rebellion_succeeded' || event.payload?.rebellion === true) {
    return { id: 'rebellion', label: '叛乱' };
  }

  if (
    event.type === 'war_declared' ||
    event.type === 'peace_forced' ||
    event.type === 'army_formed' ||
    event.type === 'battle_resolved' ||
    event.type === 'village_captured' ||
    event.type === 'army_disbanded'
  ) {
    return { id: 'war', label: '战争' };
  }

  if (
    event.type === 'building_built' ||
    event.type === 'building_upgraded' ||
    event.type === 'building_ruined'
  ) {
    return { id: 'building', label: '建设' };
  }

  if (
    event.type === 'village_founded' ||
    event.type === 'village_leveled_up' ||
    event.type === 'village_phase_changed' ||
    event.type === 'village_expansion_status' ||
    event.type === 'village_declining' ||
    event.type === 'village_abandoned' ||
    event.type === 'kingdom_founded' ||
    event.type === 'kingdom_joined' ||
    event.type === 'kingdom_capital_changed' ||
    event.type === 'kingdom_fallen'
  ) {
    return { id: 'growth', label: '成长' };
  }

  if (
    event.type === 'unit_spawned' ||
    event.type === 'unit_born' ||
    event.type === 'unit_died' ||
    event.type === 'unit_ate'
  ) {
    return { id: 'life', label: '生命' };
  }

  if (event.type === 'resource_pressure') {
    return { id: 'resource', label: '资源' };
  }

  if (event.type === 'border_friction' || event.type === 'diplomacy_pressure') {
    return { id: 'diplomacy', label: '外交' };
  }

  return { id: 'system', label: '世界' };
}

export function buildEventTimelineLines(
  projection: WorldProjection,
  input: {
    selection: WorldSelection;
    favorite?: WorldSelection;
    followed?: WorldSelection;
    lastCommandId?: string;
    limit?: number;
  },
) {
  const limit = input.limit ?? 5;
  const eventSelection = resolveObservationEventSelection(input);
  const commandEvents = input.lastCommandId
    ? projection.recentEvents.filter((event) => event.sourceCommandId === input.lastCommandId)
    : [];
  const contextEvents =
    eventSelection.type === 'none' || eventSelection.type === 'tile'
      ? projection.recentEvents
      : filterEventsForSelection(projection, eventSelection);
  const timelineEvents = uniqueEventsById([...commandEvents, ...contextEvents])
    .sort((left, right) => right.tick - left.tick || right.id.localeCompare(left.id))
    .slice(0, limit);
  const timelineLines =
    input.lastCommandId && commandEvents.length > 0
      ? buildGroupedGodCommandTimelineLines(timelineEvents, input.lastCommandId, limit)
      : timelineEvents.map(formatTimelineEventLine);

  return [
    `事件来源：${timelineSourceLabel({
      eventSelection,
      hasCommandEvents: commandEvents.length > 0,
      selection: input.selection,
      favorite: input.favorite,
      followed: input.followed,
    })}`,
    ...(timelineLines.length > 0 ? timelineLines : ['暂无相关事件']),
  ];
}

function buildGroupedGodCommandTimelineLines(events: SimEvent[], commandId: string, limit: number) {
  const commandEvents = events.filter((event) => event.sourceCommandId === commandId);
  const otherEvents = events.filter((event) => event.sourceCommandId !== commandId);

  if (commandEvents.length === 0) {
    return events.map(formatTimelineEventLine);
  }

  const headingEvent =
    commandEvents.find((event) => event.type === 'command_accepted') ?? commandEvents[0];
  const latestTick = Math.max(...commandEvents.map((event) => event.tick));
  const headingSummary = formatEventSummary(headingEvent) ?? headingEvent.message;
  const resultLines = commandEvents
    .filter((event) => event.id !== headingEvent.id)
    .sort((left, right) => left.tick - right.tick || left.id.localeCompare(right.id))
    .map((event) => `  -> ${formatGodConsequenceSummary(event)}`);
  const groupedLines = [`第 ${latestTick} 刻 · 神力后果：${headingSummary}`, ...resultLines];

  return [...groupedLines, ...otherEvents.map(formatTimelineEventLine)].slice(0, limit);
}

function formatTimelineEventLine(event: SimEvent) {
  const category = classifyEvent(event);
  const summary = formatEventSummary(event) ?? event.message;

  return `第 ${event.tick} 刻 · ${category.label}：${summary}`;
}

function formatGodConsequenceSummary(event: SimEvent) {
  if (event.type === 'unit_died' && event.sourceCommandId) {
    return '生命因神力死亡';
  }

  return formatEventSummary(event) ?? event.message;
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

export function isTrackableSelection(selection: WorldSelection) {
  return selection.type !== 'none' && selection.type !== 'tile';
}

export function resolveObservationEventSelection(input: {
  selection: WorldSelection;
  favorite?: WorldSelection;
  followed?: WorldSelection;
}): WorldSelection {
  if (isTrackableSelection(input.selection)) {
    return input.selection;
  }

  return input.followed ?? input.favorite ?? input.selection;
}

export function buildObservationFocusLines(
  projection: WorldProjection,
  input: { favorite?: WorldSelection; followed?: WorldSelection },
) {
  const lines: string[] = [];

  if (input.favorite) {
    lines.push(`关注：${describeSelection(projection, input.favorite)}`);
  }

  if (input.followed) {
    lines.push(`追踪：${describeSelection(projection, input.followed)}`);
  }

  return lines.length > 0 ? lines : ['观察：未关注对象'];
}

export function resolveSelectionPosition(
  projection: WorldProjection,
  selection: WorldSelection,
): Position | undefined {
  switch (selection.type) {
    case 'none':
      return undefined;
    case 'tile':
      return { x: selection.x, y: selection.y };
    case 'unit':
      return projection.units.find((unit) => unit.id === selection.id)?.position;
    case 'village':
      return projection.villages.find((village) => village.id === selection.id)?.center;
    case 'kingdom': {
      const kingdom = projection.kingdoms.find((candidate) => candidate.id === selection.id);
      return projection.villages.find((village) => village.id === kingdom?.capitalVillageId)
        ?.center;
    }
    case 'building':
      return projection.buildings.find((building) => building.id === selection.id)?.position;
    case 'army':
      return projection.armies.find((army) => army.id === selection.id)?.position;
  }
}

export function buildKingdomOverviewLines(projection: WorldProjection, limit = 4): string[] {
  const activeKingdoms = projection.kingdoms
    .filter((kingdom) => kingdom.status !== 'fallen')
    .sort((a, b) => b.population - a.population || a.id.localeCompare(b.id));

  if (activeKingdoms.length === 0) {
    return ['无活跃王国'];
  }

  return activeKingdoms.slice(0, limit).map((kingdom) => {
    const pressureTarget = kingdom.diplomacyTargetKingdomId
      ? ` -> 王国 ${shortId(kingdom.diplomacyTargetKingdomId)}`
      : '';

    return `王国 ${shortId(kingdom.id)}：${kingdom.population} 人 / ${
      kingdom.villageIds.length
    } 村 / 压力 ${Math.round(kingdom.diplomacyPressure)}${pressureTarget}`;
  });
}

export function buildConflictSummaryLines(projection: WorldProjection, limit = 4): string[] {
  const activeArmies = projection.armies
    .filter((army) => army.status !== 'disbanded')
    .sort((a, b) => b.soldierCount - a.soldierCount || a.id.localeCompare(b.id));

  if (activeArmies.length === 0) {
    const tenseKingdoms = projection.kingdoms
      .filter((kingdom) => kingdom.status !== 'fallen' && kingdom.diplomacyPressure > 0)
      .sort((a, b) => b.diplomacyPressure - a.diplomacyPressure || a.id.localeCompare(b.id));

    return tenseKingdoms.length > 0
      ? tenseKingdoms
          .slice(0, limit)
          .map(
            (kingdom) =>
              `王国 ${shortId(kingdom.id)} -> ${
                kingdom.diplomacyTargetKingdomId
                  ? `王国 ${shortId(kingdom.diplomacyTargetKingdomId)}`
                  : '未知目标'
              }：压力 ${Math.round(kingdom.diplomacyPressure)}`,
          )
      : ['暂无战争'];
  }

  return activeArmies.slice(0, limit).map((army) => {
    const targetVillage = projection.villages.find(
      (village) => village.id === army.targetVillageId,
    );
    const targetLabel = targetVillage?.name ?? `村庄 ${shortId(army.targetVillageId)}`;
    const occupation =
      army.status === 'fighting' && army.occupationProgress !== undefined
        ? `，攻占 ${Math.round(army.occupationProgress)}%`
        : '';

    return `王国 ${shortId(army.kingdomId)} -> 王国 ${shortId(army.targetKingdomId)}：${
      army.soldierCount
    } 兵，目标 ${targetLabel}，${labelFromMap(ARMY_STATUS_LABELS, army.status)}${occupation}`;
  });
}

export function buildMapLabels(
  projection: WorldProjection,
  options: MapLabelOptions = {},
): MapLabel[] {
  const detailLevel = options.detailLevel ?? 'local';
  const selectedVillageId =
    options.selection?.type === 'village' ? options.selection.id : undefined;
  const conflictFocusVillageIds = buildConflictFocusVillageIds(projection);
  const villageLabels = projection.villages.map((village, index) => {
    const kingdom = village.kingdomId
      ? projection.kingdoms.find((candidate) => candidate.id === village.kingdomId)
      : undefined;
    const isCapital = kingdom?.capitalVillageId === village.id;

    return {
      label: {
        id: `village:${village.id}`,
        text: `${village.rebellionPlan === 'prepare_rebellion' ? '叛乱 · ' : ''}${
          village.rebellionPlan !== 'prepare_rebellion' && village.unrestPlan === 'low_loyalty'
            ? '不稳 · '
            : ''
        }${village.expansionPlan === 'prepare_expansion' ? '拓荒 · ' : ''}${
          isCapital ? '首都 · ' : ''
        }${village.name} · Lv.${village.level}${village.level >= 4 ? ' ★' : ''}`,
        position: {
          x: Math.round(village.center.x * 10) / 10,
          y: Math.round((village.center.y - 1.6) * 10) / 10,
        },
        color: kingdom ? hexColor(kingdom.color) : '#f4f4f4',
      },
      score: mapLabelPriority({
        isSelected: village.id === selectedVillageId,
        isCapital,
        isRebel: village.rebellionPlan === 'prepare_rebellion',
        isUnstable: village.unrestPlan === 'low_loyalty',
        isConflictFocus: conflictFocusVillageIds.has(village.id),
        isExpanding: village.expansionPlan === 'prepare_expansion',
        level: village.level,
        population: village.population,
        index,
      }),
    };
  });
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

  return [
    ...villageLabels
      .sort(
        (left, right) => right.score - left.score || left.label.id.localeCompare(right.label.id),
      )
      .slice(0, mapVillageLabelLimit(detailLevel))
      .map((candidate) => candidate.label),
    ...kingdomLabels,
  ];
}

function buildConflictFocusVillageIds(projection: WorldProjection) {
  const villageIds = new Set<string>();

  for (const army of projection.armies) {
    if (army.status === 'disbanded') {
      continue;
    }

    villageIds.add(army.originVillageId);
    villageIds.add(army.targetVillageId);
  }

  for (const event of projection.recentEvents) {
    if (event.type !== 'rebellion_succeeded' && event.type !== 'war_declared') {
      continue;
    }

    for (const key of [
      'villageId',
      'rebellionVillageId',
      'parentCapitalVillageId',
      'rebelCapitalVillageId',
    ]) {
      const villageId = payloadString(event, key);

      if (villageId) {
        villageIds.add(villageId);
      }
    }
  }

  return villageIds;
}

export function isTerritoryTileSelected(
  _projection: WorldProjection,
  selection: WorldSelection,
  territoryTile: TerritoryTile,
) {
  if (selection.type === 'village') {
    return territoryTile.villageId === selection.id;
  }

  if (selection.type === 'kingdom') {
    return territoryTile.kingdomId === selection.id;
  }

  return false;
}

export function buildTerritoryBorderSegments(
  projection: WorldProjection,
  selection: WorldSelection,
) {
  const territoryByPosition = new Map(
    projection.territory.map((tile) => [`${tile.x}:${tile.y}`, tile] as const),
  );

  return projection.territory.flatMap<TerritoryBorderSegment>((tile) => {
    const kingdom = tile.kingdomId
      ? projection.kingdoms.find((candidate) => candidate.id === tile.kingdomId)
      : undefined;
    const selected = isTerritoryTileSelected(projection, selection, tile);
    const color = kingdom?.color ?? 0xffffff;

    return [
      makeBorderSegment(territoryByPosition, tile, 'top', color, selected, selection),
      makeBorderSegment(territoryByPosition, tile, 'right', color, selected, selection),
      makeBorderSegment(territoryByPosition, tile, 'bottom', color, selected, selection),
      makeBorderSegment(territoryByPosition, tile, 'left', color, selected, selection),
    ].filter((segment): segment is TerritoryBorderSegment => Boolean(segment));
  });
}

export function formatEventSummary(event: SimEvent) {
  if (event.type === 'command_accepted') {
    if (event.message.includes('Force war')) {
      return '神力外交开战已接受';
    }

    if (event.message.includes('Force peace')) {
      return '神力外交和平已接受';
    }

    return '神力命令已接受';
  }

  if (event.type === 'command_rejected') {
    const commandType = payloadString(event, 'commandType');

    return commandType ? `神力命令被拒绝：${commandType}` : '神力命令被拒绝';
  }

  if (event.type === 'resource_placed') {
    const amount = payloadNumber(event, 'amount', 0);
    const resource = event.message.includes('food') ? '食物' : '资源';

    return amount > 0 ? `神力投放${resource} x ${amount}` : `神力投放${resource}`;
  }

  if (event.type === 'terrain_changed') {
    const terrain = payloadString(event, 'terrain');
    const terrainLabel = terrain ? labelFromMap(TERRAIN_LABELS, terrain) : '地形';

    return `神力改变地形为${terrainLabel}`;
  }

  if (event.type === 'lightning_struck') {
    const damage = payloadNumber(event, 'damage', 0);

    return damage > 0 ? `神力闪电造成 ${damage} 伤害` : '神力闪电打击';
  }

  if (event.type === 'unit_spawned' && event.sourceCommandId) {
    const race = payloadString(event, 'race');
    const raceLabel = race ? labelFromMap(RACE_LABELS, race) : '生命';

    return `神力召唤${raceLabel}`;
  }

  if (event.type === 'village_expansion_status') {
    const name = typeof event.payload?.name === 'string' ? event.payload.name : '村庄';
    const plan = typeof event.payload?.plan === 'string' ? event.payload.plan : undefined;
    const labels: Record<string, string> = {
      prepare_expansion: '正在准备拓荒',
      waiting_land: '缺少合适新址',
      waiting_resources: '缺少拓荒资源',
      waiting_population_pressure: '等待更多人口压力',
    };
    const statusLabel = plan ? labels[plan] : undefined;

    return `${name}${statusLabel || '正在评估扩张'}`;
  }

  if (event.type === 'village_phase_changed') {
    const name = typeof event.payload?.name === 'string' ? event.payload.name : '村庄';
    const phase = typeof event.payload?.phase === 'string' ? event.payload.phase : undefined;
    const transitionLabels: Record<string, string> = {
      camp: '重新成为营地',
      hamlet: '形成村落',
      village: '发展为村庄',
      town: '发展为城镇',
      frontier: '进入扩张前线',
    };
    const transitionLabel = phase ? transitionLabels[phase] : undefined;

    return `${name}${transitionLabel || '正在变化'}`;
  }

  if (event.type === 'village_leveled_up') {
    const name = typeof event.payload?.name === 'string' ? event.payload.name : '村庄';
    const level = typeof event.payload?.level === 'number' ? event.payload.level : undefined;

    return level ? `${name}成长为 Lv.${level} ${growthLabel(level)}` : `${name}正在成长`;
  }

  if (event.type === 'building_upgraded') {
    const type = typeof event.payload?.type === 'string' ? event.payload.type : undefined;
    const tier = typeof event.payload?.tier === 'number' ? event.payload.tier : undefined;
    const building = type ? labelFromMap(BUILDING_LABELS, type) : '建筑';

    return tier ? `${building}升级到 ${tier} 级` : `${building}完成升级`;
  }

  if (event.type === 'building_built') {
    const type = typeof event.payload?.type === 'string' ? event.payload.type : undefined;
    const building = type ? labelFromMap(BUILDING_LABELS, type) : '建筑';

    return `${building}建造完成`;
  }

  if (event.type === 'building_ruined') {
    const type = typeof event.payload?.type === 'string' ? event.payload.type : undefined;
    const building = type ? labelFromMap(BUILDING_LABELS, type) : '建筑';

    return `${building}沦为废墟`;
  }

  if (event.type === 'border_friction') {
    return `${kingdomPairLabel(event)} 边境摩擦，压力 ${payloadNumber(event, 'pressure', 0)}`;
  }

  if (event.type === 'resource_pressure') {
    return `${kingdomPairLabel(event)} 因资源紧张升压 ${payloadNumber(event, 'pressure', 0)}`;
  }

  if (event.type === 'diplomacy_pressure') {
    return `${kingdomPairLabel(event)} 外交压力升至 ${payloadNumber(event, 'pressure', 0)}`;
  }

  if (event.type === 'rebellion_succeeded') {
    const village = payloadString(event, 'villageId');
    const parent = payloadString(event, 'parentKingdomId');
    const rebel = payloadString(event, 'rebelKingdomId');
    const supporterCount = payloadNumber(event, 'supporterCount', 0);
    const reason = payloadString(event, 'reason');
    const reasonText = reason ? ` 因${labelFromMap(LOYALTY_REASON_LABELS, reason)}` : '';

    return `${villageLabel(village)}${reasonText}脱离${kingdomLabel(parent)}，成立${kingdomLabel(
      rebel,
    )}，${supporterCount} 个村庄响应`;
  }

  if (event.type === 'war_declared') {
    const aggressor = payloadString(event, 'aggressorKingdomId');
    const target = payloadString(event, 'targetKingdomId');

    if (event.payload?.rebellion === true) {
      const parent = payloadString(event, 'parentKingdomId') ?? aggressor;
      const rebel = payloadString(event, 'rebelKingdomId') ?? target;
      const sourceVillage = payloadString(event, 'rebellionVillageId');

      return `内战：${kingdomLabel(parent)} 镇压${kingdomLabel(rebel)}（源自${villageLabel(
        sourceVillage,
      )}叛乱），压力 ${payloadNumber(event, 'pressure', 0)}`;
    }

    const prefix = event.payload?.forced === true ? '神力强制：' : '';

    return `${prefix}${kingdomLabel(aggressor)} 向${kingdomLabel(target)} 宣战，压力 ${payloadNumber(
      event,
      'pressure',
      0,
    )}`;
  }

  if (event.type === 'peace_forced') {
    const kingdomA = payloadString(event, 'kingdomAId');
    const kingdomB = payloadString(event, 'kingdomBId');

    return `神力强制：${kingdomLabel(kingdomA)} 与${kingdomLabel(kingdomB)} 停战`;
  }

  if (event.type === 'army_formed') {
    const kingdom = payloadString(event, 'kingdomId');
    const soldiers = payloadNumber(event, 'soldiers', 0);
    const targetVillage = payloadString(event, 'targetVillageId');

    return `${kingdomLabel(kingdom)} 集结 ${soldiers} 人军队，目标${villageLabel(targetVillage)}`;
  }

  if (event.type === 'battle_resolved') {
    const attacker = payloadString(event, 'attackerKingdomId');
    const defender = payloadString(event, 'defenderKingdomId');
    const attackerCasualties = payloadNumber(event, 'attackerCasualties', 0);
    const defenderCasualties = payloadNumber(event, 'defenderCasualties', 0);
    const captured = Boolean(event.payload?.captured);
    const occupationProgress = payloadNumber(event, 'occupationProgress', captured ? 100 : 0);

    return `${kingdomLabel(attacker)} 与${kingdomLabel(defender)} 交战：攻方损失 ${attackerCasualties}，守方损失 ${defenderCasualties}${
      captured ? '，目标被占领' : `，攻占 ${occupationProgress}% 后撤退`
    }`;
  }

  if (event.type === 'village_captured') {
    const attacker = payloadString(event, 'attackerKingdomId');
    const villageId = payloadString(event, 'villageId');

    return `${kingdomLabel(attacker)} 占领${villageLabel(villageId)}`;
  }

  return undefined;
}

function growthLabel(level: number) {
  return GROWTH_LABELS[level] ?? '聚落';
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
  const territorySource = territory
    ? labelFromMap(TERRITORY_SOURCE_LABELS, territory.source)
    : '无';

  return [
    `地块 ${x},${y}`,
    `地形：${terrain}`,
    `生态：${biome}`,
    `资源：${resource}`,
    `村庄：${villageId}`,
    `王国：${kingdomId}`,
    `领土来源：${territorySource}`,
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
    `名称：${village.name}`,
    `等级：${village.level}`,
    `成长：${growthLabel(village.level)}${
      village.level < 5 ? '，正在向更高等级发展' : '，已达到当前成长上限'
    }`,
    `阶段：${labelFromMap(VILLAGE_GROWTH_PHASE_LABELS, village.growthPhase)}`,
    `种族：${labelFromMap(RACE_LABELS, village.race)}`,
    `状态：${labelFromMap(VILLAGE_STATUS_LABELS, village.status)}`,
    `所属王国：${kingdom ? `王国 ${shortId(kingdom.id)}` : '无'}`,
    `首都：${kingdom?.capitalVillageId === village.id ? '是' : '否'}`,
    ...buildLoyaltyLines(village),
    ...buildUnrestLines(village),
    ...buildRebellionLines(village),
    ...buildVillageCivilWarLines(projection, village),
    `人口：${village.population}`,
    `住房：${village.housingCapacity}`,
    `食物：${Math.round(village.foodInventory)} / ${village.foodCapacity}`,
    `材料：木材 ${Math.round(village.woodInventory)} / ${village.woodCapacity}, 石料 ${Math.round(
      village.stoneInventory,
    )} / ${village.stoneCapacity}, 铁矿 ${Math.round(village.ironInventory)} / ${
      village.ironCapacity
    }`,
    ...buildVillageFoodDiagnosticLines(village),
    `职业：农民 ${village.jobs.farmer}, 建筑工 ${village.jobs.builder}, 矿工 ${village.jobs.miner}, 士兵 ${
      village.jobs.soldier
    }, 劳力 ${village.jobs.laborer}`,
    `成长阻塞：${
      village.growthBlockers.length > 0
        ? village.growthBlockers
            .map((blocker) => labelFromMap(VILLAGE_GROWTH_BLOCKER_LABELS, blocker))
            .join('、')
        : '无'
    }`,
    `主要阻塞：${
      village.primaryGrowthBlocker
        ? labelFromMap(VILLAGE_GROWTH_BLOCKER_LABELS, village.primaryGrowthBlocker)
        : '无'
    }`,
    `建设计划：${villagePlanLabel(village.buildPlan, village.expansionPlan, village)}`,
    `主要意图：${villagePlanLabel(village.primaryIntention, village.expansionPlan, village)}`,
    ...buildExpansionReasonLines(village.expansionPlan),
    ...buildExpansionHintLines(village.expansionPlan),
    `建筑：${buildings.length}`,
    `领土：${village.territoryTiles}`,
    `军队：${activeArmies.length}`,
    `中心：${formatPosition(village.center)}`,
  ];
}

function buildVillageFoodDiagnosticLines(village: WorldProjection['villages'][number]) {
  const reserveTarget = Math.round(village.foodReserveTarget);
  const reserveBalance = Math.round(village.foodReserveBalance);
  const balanceText =
    reserveBalance >= 0 ? `结余 ${reserveBalance}` : `缺口 ${Math.abs(reserveBalance)}`;
  const activeFarmCount = village.activeFarmCount;
  const maintainedFarmCount = village.maintainedFarmCount;
  const farmCoverage =
    activeFarmCount <= 0
      ? '暂无农田'
      : maintainedFarmCount >= activeFarmCount
        ? '全覆盖'
        : '农夫不足';

  return [
    `食物储备：${Math.round(village.foodInventory)} / ${reserveTarget}（${balanceText}）`,
    `农田维护：${maintainedFarmCount} / ${activeFarmCount}（${farmCoverage}）`,
    `食物状态：${foodStatusLabel(village, reserveBalance, farmCoverage)}`,
  ];
}

function foodStatusLabel(
  village: WorldProjection['villages'][number],
  reserveBalance: number,
  farmCoverage: string,
) {
  const storageLimited = village.foodCapacity < village.foodReserveTarget;
  const lowReserve = reserveBalance < 0;
  const farmerShortage = farmCoverage === '农夫不足';

  if (storageLimited) {
    return farmerShortage ? '仓储不足，且农夫不足' : '仓储不足';
  }

  if (lowReserve) {
    return farmerShortage ? '储备偏低，且农夫不足' : '储备偏低';
  }

  if (farmerShortage) {
    return '农夫不足';
  }

  return '充足';
}

function buildUnrestLines(village: Village) {
  if (village.unrestPlan !== 'low_loyalty') {
    return [];
  }

  return [
    `不稳原因：${
      village.loyaltyReason ? labelFromMap(LOYALTY_REASON_LABELS, village.loyaltyReason) : '无'
    }`,
    '内政提示：忠诚偏低',
  ];
}

function buildRebellionLines(village: Village) {
  if (village.rebellionPlan !== 'prepare_rebellion') {
    return [];
  }

  const progress = Math.round(village.rebellionProgress ?? 0);

  return [
    `叛乱原因：${
      village.rebellionReason ? labelFromMap(LOYALTY_REASON_LABELS, village.rebellionReason) : '无'
    }`,
    `叛乱进度：${progress}%`,
    '内政提示：正在秘密组织独立',
  ];
}

function buildLoyaltyLines(village: Village) {
  if (village.loyalty === undefined) {
    return [];
  }

  return [
    `忠诚：${Math.round(village.loyalty)}`,
    `内政原因：${
      village.loyaltyReason ? labelFromMap(LOYALTY_REASON_LABELS, village.loyaltyReason) : '无'
    }`,
  ];
}

function buildExpansionReasonLines(plan: string | undefined) {
  if (!plan) {
    return [];
  }

  const reason = EXPANSION_REASON_LABELS[plan];

  return reason ? [`扩张原因：${reason}`] : [];
}

function buildExpansionHintLines(plan: string | undefined) {
  switch (plan) {
    case 'prepare_expansion':
      return ['边疆提示：正在准备分村，领土边缘会出现扩张准备区'];
    case 'waiting_land':
      return ['边疆提示：正在寻找食物充足且距离合适的新址'];
    case 'waiting_resources':
      return ['边疆提示：正在等待拓荒所需食物和木材'];
    case 'waiting_population_pressure':
      return ['边疆提示：正在等待更多居民或住房压力'];
    default:
      return [];
  }
}

function villagePlanLabel(
  plan: string,
  expansionPlan?: string,
  village?: Pick<WorldProjection['villages'][number], 'growthBlockers' | 'primaryGrowthBlocker'>,
) {
  if (plan === 'waiting_population_pressure' && expansionPlan === 'waiting_population_pressure') {
    return '等待扩张压力';
  }

  if (plan === 'waiting_resources') {
    return waitingResourceLabel(village, expansionPlan);
  }

  return labelFromMap(VILLAGE_BUILD_PLAN_LABELS, plan);
}

function waitingResourceLabel(
  village:
    | Pick<WorldProjection['villages'][number], 'growthBlockers' | 'primaryGrowthBlocker'>
    | undefined,
  expansionPlan?: string,
) {
  const blockers = new Set(village?.growthBlockers ?? []);
  const primary = village?.primaryGrowthBlocker;
  const lacksFood = blockers.has('low_food_reserve') || primary === 'low_food_reserve';
  const lacksWood = blockers.has('missing_wood') || primary === 'missing_wood';
  const lacksBuildMaterial =
    blockers.has('missing_stone') ||
    blockers.has('missing_iron') ||
    primary === 'missing_stone' ||
    primary === 'missing_iron';

  if (expansionPlan === 'waiting_resources') {
    if (lacksFood && lacksWood) {
      return '等待拓荒食物和木材';
    }

    if (lacksFood) {
      return '等待拓荒食物';
    }

    if (lacksWood) {
      return '等待拓荒木材';
    }

    return '等待拓荒资源';
  }

  if (lacksWood) {
    return '等待木材';
  }

  if (lacksFood) {
    return '等待食物';
  }

  if (lacksBuildMaterial) {
    return '等待建造材料';
  }

  return '等待人口增长';
}

function buildKingdomLines(projection: WorldProjection, id: string) {
  const kingdom = projection.kingdoms.find((candidate) => candidate.id === id);

  if (!kingdom) {
    return ['王国', '选中王国已消失。'];
  }

  const activeArmies = projection.armies.filter(
    (army) => army.kingdomId === kingdom.id && army.status !== 'disbanded',
  );
  const capital = projection.villages.find(
    (candidate) => candidate.id === kingdom.capitalVillageId,
  );
  const memberVillages = kingdom.villageIds
    .map((villageId) => projection.villages.find((village) => village.id === villageId))
    .filter((village): village is WorldProjection['villages'][number] => Boolean(village));
  const campaigns = activeArmies.map((army) => {
    const targetVillage = projection.villages.find(
      (village) => village.id === army.targetVillageId,
    );
    const targetLabel = targetVillage?.name ?? `村庄 ${shortId(army.targetVillageId)}`;

    return `军队 ${shortId(army.id)} -> ${targetLabel}（${army.soldierCount} 人，${labelFromMap(
      ARMY_STATUS_LABELS,
      army.status,
    )}${
      army.status === 'fighting' && army.occupationProgress !== undefined
        ? `，攻占 ${Math.round(army.occupationProgress)}%`
        : ''
    }）`;
  });

  return [
    `王国 ${shortId(kingdom.id)}`,
    `种族：${labelFromMap(RACE_LABELS, kingdom.race)}`,
    `状态：${labelFromMap(KINGDOM_STATUS_LABELS, kingdom.status)}`,
    `首都：${
      capital
        ? `${capital.name}（等级 ${capital.level}）`
        : `村庄 ${shortId(kingdom.capitalVillageId)}`
    }`,
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
    ...buildKingdomCivilWarLines(projection, kingdom),
    `军队：${activeArmies.length}`,
    `成员村庄：${
      memberVillages.length > 0
        ? memberVillages.map((village) => village.name).join('、')
        : kingdom.villageIds.map((villageId) => `村庄 ${shortId(villageId)}`).join('、') || '无'
    }`,
    ...(campaigns.length > 0 ? campaigns.map((campaign) => `出征：${campaign}`) : ['出征：无']),
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
    ...(building.status === 'constructing'
      ? [
          `进度：${Math.round(building.constructionProgress ?? 0)} / ${
            building.constructionWorkRequired ?? 0
          }`,
        ]
      : []),
    ...(building.status === 'abandoned' && building.abandonedAtTick !== undefined
      ? [`废弃时间：第 ${building.abandonedAtTick} 刻`]
      : []),
    ...(building.status === 'ruined' && building.ruinedAtTick !== undefined
      ? [`成墟时间：第 ${building.ruinedAtTick} 刻`]
      : []),
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
    ...buildArmyCivilWarLines(projection, army),
    `出发村庄：村庄 ${shortId(army.originVillageId)}`,
    `目标村庄：村庄 ${shortId(army.targetVillageId)}`,
    `士兵：${army.soldierCount}`,
    `训练士兵：${army.trainedSoldiers}`,
    `士气：${army.morale.toFixed(2)}`,
    ...(army.occupationProgress !== undefined
      ? [`攻占进度：${Math.round(army.occupationProgress)}%`]
      : []),
    `位置：${formatPosition(army.position)}`,
  ];
}

function buildVillageCivilWarLines(
  projection: WorldProjection,
  village: WorldProjection['villages'][number],
) {
  const event = findCivilWarEventForVillage(projection, village);

  if (!event) {
    return [];
  }

  const parent = civilWarParentKingdomId(event);
  const rebel = civilWarRebelKingdomId(event);
  const sourceVillage = payloadString(event, 'rebellionVillageId');

  if (sourceVillage === village.id) {
    return [`内战：源自本村叛乱，${kingdomLabel(parent)} 正在镇压${kingdomLabel(rebel)}`];
  }

  if (village.kingdomId === rebel) {
    return [`内战：所属${kingdomLabel(rebel)} 正在反抗${kingdomLabel(parent)}`];
  }

  if (village.kingdomId === parent) {
    return [`内战：所属${kingdomLabel(parent)} 正在镇压${kingdomLabel(rebel)}`];
  }

  return [];
}

function buildKingdomCivilWarLines(projection: WorldProjection, kingdom: Kingdom) {
  const event = findCivilWarEventForKingdom(projection, kingdom.id);

  if (!event) {
    return [];
  }

  const parent = civilWarParentKingdomId(event);
  const rebel = civilWarRebelKingdomId(event);
  const sourceVillage = payloadString(event, 'rebellionVillageId');

  if (kingdom.id === parent) {
    return [`内战：正在镇压${kingdomLabel(rebel)}，源自${villageLabel(sourceVillage)}叛乱`];
  }

  if (kingdom.id === rebel) {
    return [`内战：正在反抗${kingdomLabel(parent)}，源自${villageLabel(sourceVillage)}叛乱`];
  }

  return [];
}

function buildArmyCivilWarLines(projection: WorldProjection, army: ArmyGroup) {
  const event = findCivilWarEventForArmy(projection, army);

  if (!event) {
    return [];
  }

  const parent = civilWarParentKingdomId(event);
  const rebel = civilWarRebelKingdomId(event);
  const sourceVillage = payloadString(event, 'rebellionVillageId');

  return [
    `内战：${kingdomLabel(parent)} 镇压${kingdomLabel(rebel)}，源自${villageLabel(
      sourceVillage,
    )}叛乱`,
  ];
}

function findCivilWarEventForVillage(
  projection: WorldProjection,
  village: WorldProjection['villages'][number],
) {
  return findLatestCivilWarEvent(projection, (event) => {
    const parent = civilWarParentKingdomId(event);
    const rebel = civilWarRebelKingdomId(event);

    return (
      payloadString(event, 'rebellionVillageId') === village.id ||
      payloadString(event, 'parentCapitalVillageId') === village.id ||
      payloadString(event, 'rebelCapitalVillageId') === village.id ||
      (village.kingdomId !== undefined &&
        (village.kingdomId === parent || village.kingdomId === rebel))
    );
  });
}

function findCivilWarEventForKingdom(projection: WorldProjection, kingdomId: string) {
  return findLatestCivilWarEvent(projection, (event) => {
    const parent = civilWarParentKingdomId(event);
    const rebel = civilWarRebelKingdomId(event);

    return kingdomId === parent || kingdomId === rebel;
  });
}

function findCivilWarEventForArmy(projection: WorldProjection, army: ArmyGroup) {
  return findLatestCivilWarEvent(projection, (event) => {
    const parent = civilWarParentKingdomId(event);
    const rebel = civilWarRebelKingdomId(event);

    return (
      (army.kingdomId === parent && army.targetKingdomId === rebel) ||
      (army.kingdomId === rebel && army.targetKingdomId === parent)
    );
  });
}

function findLatestCivilWarEvent(
  projection: WorldProjection,
  predicate: (event: SimEvent) => boolean,
) {
  return [...projection.recentEvents]
    .reverse()
    .find(
      (event) =>
        event.type === 'war_declared' && event.payload?.rebellion === true && predicate(event),
    );
}

function uniqueEventsById(events: SimEvent[]) {
  const seen = new Set<string>();
  const unique: SimEvent[] = [];

  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }

    seen.add(event.id);
    unique.push(event);
  }

  return unique;
}

function timelineSourceLabel(input: {
  eventSelection: WorldSelection;
  hasCommandEvents: boolean;
  selection: WorldSelection;
  favorite?: WorldSelection;
  followed?: WorldSelection;
}) {
  if (input.hasCommandEvents) {
    return '最近神力';
  }

  if (isTrackableSelection(input.selection)) {
    return '当前选择';
  }

  if (input.followed && input.eventSelection === input.followed) {
    return '追踪对象';
  }

  if (input.favorite && input.eventSelection === input.favorite) {
    return '关注对象';
  }

  return '世界';
}

function civilWarParentKingdomId(event: SimEvent) {
  return payloadString(event, 'parentKingdomId') ?? payloadString(event, 'aggressorKingdomId');
}

function civilWarRebelKingdomId(event: SimEvent) {
  return payloadString(event, 'rebelKingdomId') ?? payloadString(event, 'targetKingdomId');
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
      payload.rebellionVillageId === selection.id ||
      payload.parentCapitalVillageId === selection.id ||
      payload.rebelCapitalVillageId === selection.id ||
      event.message.includes(selection.id) ||
      Boolean(
        village?.kingdomId &&
          (payload.kingdomId === village.kingdomId ||
            payload.aggressorKingdomId === village.kingdomId ||
            payload.targetKingdomId === village.kingdomId),
      )
    );
  }

  if (selection.type === 'kingdom') {
    return (
      payload.kingdomId === selection.id ||
      payload.aggressorKingdomId === selection.id ||
      payload.targetKingdomId === selection.id ||
      payload.parentKingdomId === selection.id ||
      payload.rebelKingdomId === selection.id ||
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

function describeSelection(projection: WorldProjection, selection: WorldSelection) {
  switch (selection.type) {
    case 'none':
      return '未选中对象';
    case 'tile':
      return `地块 ${selection.x},${selection.y}`;
    case 'unit':
      return `单位 ${shortId(selection.id)}`;
    case 'village': {
      const village = projection.villages.find((candidate) => candidate.id === selection.id);
      return village?.name ?? `村庄 ${shortId(selection.id)}`;
    }
    case 'kingdom':
      return `王国 ${shortId(selection.id)}`;
    case 'building':
      return `建筑 ${shortId(selection.id)}`;
    case 'army':
      return `军队 ${shortId(selection.id)}`;
  }
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hexColor(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function kingdomPairLabel(event: SimEvent) {
  const left = payloadString(event, 'kingdomAId') ?? payloadString(event, 'attackerKingdomId');
  const right = payloadString(event, 'kingdomBId') ?? payloadString(event, 'defenderKingdomId');

  return `${kingdomLabel(left)} 与${kingdomLabel(right)}`;
}

function kingdomLabel(id: string | undefined) {
  return id ? `王国 ${shortId(id)}` : '未知王国';
}

function villageLabel(id: string | undefined) {
  return id ? `村庄 ${shortId(id)}` : '未知村庄';
}

function payloadString(event: SimEvent, key: string) {
  const value = event.payload?.[key];

  return typeof value === 'string' ? value : undefined;
}

function payloadNumber(event: SimEvent, key: string, fallback: number) {
  const value = event.payload?.[key];

  return typeof value === 'number' ? Math.round(value) : fallback;
}

function shortId(id: string) {
  const suffix = id.split('-').at(-1) ?? id;
  return /^\d+$/.test(suffix) ? suffix : id;
}

function labelFromMap(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

function mapVillageLabelLimit(detailLevel: MapLabelDetailLevel) {
  if (detailLevel === 'overview') {
    return 8;
  }

  if (detailLevel === 'regional') {
    return 12;
  }

  return 16;
}

function mapLabelPriority(input: {
  isSelected: boolean;
  isCapital: boolean;
  isRebel: boolean;
  isUnstable: boolean;
  isConflictFocus: boolean;
  isExpanding: boolean;
  level: number;
  population: number;
  index: number;
}) {
  return (
    (input.isSelected ? 10_000 : 0) +
    (input.isConflictFocus ? 7_000 : 0) +
    (input.isRebel ? 5_000 : 0) +
    (input.isUnstable ? 3_500 : 0) +
    (input.isCapital ? 2_500 : 0) +
    (input.isExpanding ? 1_500 : 0) +
    input.level * 100 +
    Math.min(input.population, 99) -
    input.index / 1_000
  );
}

function territoryOwnerKey(tile: TerritoryTile) {
  return tile.kingdomId ? `kingdom:${tile.kingdomId}` : `village:${tile.villageId}`;
}

function makeBorderSegment(
  territoryByPosition: Map<string, TerritoryTile>,
  tile: TerritoryTile,
  edge: 'top' | 'right' | 'bottom' | 'left',
  color: number,
  selected: boolean,
  selection: WorldSelection,
) {
  const neighbor = findAdjacentTerritoryTile(territoryByPosition, tile.x, tile.y, edge);

  if (
    selection.type === 'village' &&
    tile.villageId !== selection.id &&
    neighbor?.villageId === selection.id
  ) {
    return undefined;
  }

  if (neighbor && territoryOwnerKey(neighbor) === territoryOwnerKey(tile)) {
    const selectedVillageNeighbor =
      selection.type === 'village' && selected && neighbor.villageId !== tile.villageId;

    if (!selectedVillageNeighbor) {
      return undefined;
    }
  }

  const alpha = selected ? 0.95 : tile.surface === 'water' ? 0.28 : 0.42;
  const width = selected ? 2 : 1;

  switch (edge) {
    case 'top':
      return { x1: tile.x, y1: tile.y, x2: tile.x + 1, y2: tile.y, color, selected, alpha, width };
    case 'right':
      return {
        x1: tile.x + 1,
        y1: tile.y,
        x2: tile.x + 1,
        y2: tile.y + 1,
        color,
        selected,
        alpha,
        width,
      };
    case 'bottom':
      return {
        x1: tile.x,
        y1: tile.y + 1,
        x2: tile.x + 1,
        y2: tile.y + 1,
        color,
        selected,
        alpha,
        width,
      };
    case 'left':
      return { x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y + 1, color, selected, alpha, width };
  }
}

function findAdjacentTerritoryTile(
  territoryByPosition: Map<string, TerritoryTile>,
  x: number,
  y: number,
  edge: 'top' | 'right' | 'bottom' | 'left',
) {
  switch (edge) {
    case 'top':
      return territoryByPosition.get(`${x}:${y - 1}`);
    case 'right':
      return territoryByPosition.get(`${x + 1}:${y}`);
    case 'bottom':
      return territoryByPosition.get(`${x}:${y + 1}`);
    case 'left':
      return territoryByPosition.get(`${x - 1}:${y}`);
  }
}

// Keep the type imports above visible to TypeScript as the feature grows.
type _InspectableEntity = ArmyGroup | Kingdom | Tile | Unit | Village | VillageBuilding;
