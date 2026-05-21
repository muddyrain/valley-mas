import { describe, expect, it } from 'vitest';
import type { WorldProjection } from '../sim';
import {
  buildConflictSummaryLines,
  buildInspectionLines,
  buildKingdomOverviewLines,
  buildMapLabels,
  buildTerritoryBorderSegments,
  filterEventsForSelection,
  formatEventSummary,
  isTerritoryTileSelected,
  selectNextKingdom,
  selectWorldEntity,
  type WorldSelection,
} from './inspection';

describe('world inspection helpers', () => {
  it('selects the most specific visible entity near a click point', () => {
    const projection = createProjection();

    expect(selectWorldEntity(projection, { x: 31.2, y: 31.1 })).toEqual({
      type: 'army',
      id: 'army-1',
    });
    expect(selectWorldEntity(projection, { x: 24, y: 22 })).toEqual({
      type: 'building',
      id: 'building-1',
    });
    expect(selectWorldEntity(projection, { x: 20.2, y: 20.1 })).toEqual({
      type: 'village',
      id: 'village-1',
    });
    expect(selectWorldEntity(projection, { x: 18, y: 18 })).toEqual({
      type: 'village',
      id: 'village-1',
    });
    expect(selectWorldEntity(projection, { x: 1, y: 1 })).toEqual({
      type: 'tile',
      x: 1,
      y: 1,
    });
  });

  it('builds inspection copy for selected villages, armies, buildings, and tiles', () => {
    const projection = createProjection();

    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '村庄 1',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '名称：晨林村',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '等级：3',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '成长：小镇，正在向更高等级发展',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '首都：是',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '所属王国：王国 1',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '材料：木材 3, 石料 5, 铁矿 1',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '职业：农民 4, 建筑工 2, 矿工 1, 士兵 3',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '成长阻塞：住房紧张、缺少木材',
    );
    expect(buildInspectionLines(projection, { type: 'village', id: 'village-1' })).toContain(
      '建设计划：扩建民居',
    );
    expect(buildInspectionLines(projection, { type: 'army', id: 'army-1' })).toContain('军队 1');
    expect(buildInspectionLines(projection, { type: 'army', id: 'army-1' })).toContain(
      '训练士兵：5',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-1' })).toContain(
      '建筑 1',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-1' })).toContain(
      '类型：民居',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-2' })).toContain(
      '状态：废弃',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-2' })).toContain(
      '废弃时间：第 30 刻',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-3' })).toContain(
      '状态：废墟',
    );
    expect(buildInspectionLines(projection, { type: 'building', id: 'building-3' })).toContain(
      '成墟时间：第 80 刻',
    );
    expect(buildInspectionLines(projection, { type: 'tile', x: 1, y: 1 })).toContain('地块 1,1');
    expect(buildInspectionLines(projection, { type: 'tile', x: 1, y: 1 })).toContain('地形：草地');
    expect(buildInspectionLines(projection, { type: 'kingdom', id: 'kingdom-1' })).toContain(
      '王国 1',
    );
    expect(buildInspectionLines(projection, { type: 'kingdom', id: 'kingdom-1' })).toContain(
      '首都：晨林村（等级 3）',
    );
    expect(buildInspectionLines(projection, { type: 'kingdom', id: 'kingdom-1' })).toContain(
      '成员村庄：晨林村',
    );
    expect(buildInspectionLines(projection, { type: 'kingdom', id: 'kingdom-1' })).toContain(
      '出征：军队 1 -> 河湾村（12 人，行军中）',
    );
  });

  it('builds compact kingdom and conflict summaries for the world HUD', () => {
    const projection = createProjection();

    expect(buildKingdomOverviewLines(projection)).toEqual([
      '王国 1：24 人 / 1 村 / 压力 42 -> 王国 2',
    ]);
    expect(buildConflictSummaryLines(projection)).toEqual([
      '王国 1 -> 王国 2：12 兵，目标 河湾村，行军中',
    ]);
  });

  it('builds map labels with village names, levels, and capital markers', () => {
    const projection = createProjection();
    const labels = buildMapLabels(projection);
    const highLevelProjection = createProjection();

    highLevelProjection.villages[1].level = 4;

    expect(labels.some((label) => label.text === '首都 · 晨林村 · Lv.3')).toBe(true);
    expect(labels.some((label) => label.text === '河湾村 · Lv.2')).toBe(true);
    expect(
      buildMapLabels(highLevelProjection).some((label) => label.text === '河湾村 · Lv.4 ★'),
    ).toBe(true);
  });

  it('builds readable growth and building event summaries', () => {
    expect(
      formatEventSummary({
        id: 'event-growth',
        tick: 20,
        type: 'village_leveled_up',
        message: 'village-1 reached level 4',
        payload: { villageId: 'village-1', name: '晨林村', level: 4, previousLevel: 3 },
      }),
    ).toBe('晨林村成长为 Lv.4 城镇');
    expect(
      formatEventSummary({
        id: 'event-upgrade',
        tick: 21,
        type: 'building_upgraded',
        message: 'building-1 upgraded to tier 2',
        payload: { villageId: 'village-1', type: 'town_hall', tier: 2 },
      }),
    ).toBe('市政厅升级到 2 级');
    expect(
      formatEventSummary({
        id: 'event-built',
        tick: 22,
        type: 'building_built',
        message: 'building-2 house built',
        payload: { villageId: 'village-1', type: 'house' },
      }),
    ).toBe('民居建造完成');
    expect(
      formatEventSummary({
        id: 'event-ruined',
        tick: 120,
        type: 'building_ruined',
        message: 'building-2 ruined after abandonment',
        payload: { villageId: 'village-1', type: 'house' },
      }),
    ).toBe('民居沦为废墟');
    expect(
      formatEventSummary({
        id: 'event-border',
        tick: 30,
        type: 'border_friction',
        message: 'kingdom-1 and kingdom-2 border friction',
        payload: { kingdomAId: 'kingdom-1', kingdomBId: 'kingdom-2', pressure: 18 },
      }),
    ).toBe('王国 1 与王国 2 边境摩擦，压力 18');
    expect(
      formatEventSummary({
        id: 'event-resource',
        tick: 31,
        type: 'resource_pressure',
        message: 'kingdom-1 and kingdom-2 resource pressure',
        payload: { kingdomAId: 'kingdom-1', kingdomBId: 'kingdom-2', pressure: 24 },
      }),
    ).toBe('王国 1 与王国 2 因资源紧张升压 24');
    expect(
      formatEventSummary({
        id: 'event-war',
        tick: 32,
        type: 'war_declared',
        message: 'kingdom-1 declared war on kingdom-2',
        payload: { aggressorKingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2', pressure: 80 },
      }),
    ).toBe('王国 1 向王国 2 宣战，压力 80');
    expect(
      formatEventSummary({
        id: 'event-army',
        tick: 33,
        type: 'army_formed',
        message: 'army-1 formed',
        payload: {
          kingdomId: 'kingdom-1',
          targetKingdomId: 'kingdom-2',
          soldiers: 12,
          targetVillageId: 'village-2',
        },
      }),
    ).toBe('王国 1 集结 12 人军队，目标村庄 2');
    expect(
      formatEventSummary({
        id: 'event-battle',
        tick: 34,
        type: 'battle_resolved',
        message: 'army-1 battle resolved',
        payload: {
          attackerKingdomId: 'kingdom-1',
          defenderKingdomId: 'kingdom-2',
          attackerCasualties: 2,
          defenderCasualties: 5,
          captured: false,
        },
      }),
    ).toBe('王国 1 与王国 2 交战：攻方损失 2，守方损失 5');
    expect(
      formatEventSummary({
        id: 'event-capture',
        tick: 35,
        type: 'village_captured',
        message: 'village-2 captured',
        payload: {
          villageId: 'village-2',
          attackerKingdomId: 'kingdom-1',
          defenderKingdomId: 'kingdom-2',
        },
      }),
    ).toBe('王国 1 占领村庄 2');
  });

  it('marks selected village and kingdom territory tiles', () => {
    const projection = createProjection();
    const territoryTile = projection.territory[0];

    expect(
      isTerritoryTileSelected(projection, { type: 'village', id: 'village-1' }, territoryTile),
    ).toBe(true);
    expect(
      isTerritoryTileSelected(projection, { type: 'kingdom', id: 'kingdom-1' }, territoryTile),
    ).toBe(true);
    expect(isTerritoryTileSelected(projection, { type: 'tile', x: 18, y: 18 }, territoryTile)).toBe(
      false,
    );
  });

  it('builds territory borders only around exposed edges', () => {
    const projection = createProjection();
    const segments = buildTerritoryBorderSegments(projection, { type: 'kingdom', id: 'kingdom-1' });

    expect(segments).toHaveLength(6);
    expect(
      segments.some(
        (segment) =>
          segment.x1 === 19 && segment.y1 === 18 && segment.x2 === 19 && segment.y2 === 19,
      ),
    ).toBe(false);
  });

  it('filters recent events to the selected story context', () => {
    const projection = createProjection();

    expect(
      filterEventsForSelection(projection, { type: 'village', id: 'village-1' }).map(
        (event) => event.type,
      ),
    ).toEqual(['building_built', 'war_declared', 'army_formed']);
    expect(
      filterEventsForSelection(projection, { type: 'army', id: 'army-1' }).map(
        (event) => event.type,
      ),
    ).toEqual(['army_formed']);
    expect(
      filterEventsForSelection(projection, { type: 'kingdom', id: 'kingdom-1' }).map(
        (event) => event.type,
      ),
    ).toEqual(['war_declared', 'army_formed']);
    expect(
      filterEventsForSelection(projection, { type: 'none' }).map((event) => event.type),
    ).toEqual(['building_built', 'war_declared', 'army_formed', 'resource_placed']);
  });

  it('cycles active kingdom selection and builds map labels', () => {
    const projection = createProjection();

    expect(selectNextKingdom(projection, { type: 'none' })).toEqual({
      type: 'kingdom',
      id: 'kingdom-1',
    });
    expect(selectNextKingdom(projection, { type: 'kingdom', id: 'kingdom-1' })).toEqual({
      type: 'kingdom',
      id: 'kingdom-1',
    });
    expect(buildMapLabels(projection)).toEqual([
      {
        id: 'village:village-1',
        text: '首都 · 晨林村 · Lv.3',
        position: { x: 20, y: 18.4 },
        color: '#ffcd75',
      },
      {
        id: 'village:village-2',
        text: '河湾村 · Lv.2',
        position: { x: 30, y: 28.4 },
        color: '#f4f4f4',
      },
      {
        id: 'kingdom:kingdom-1',
        text: '王国 1',
        position: { x: 20, y: 16.8 },
        color: '#ffcd75',
      },
    ]);
  });
});

function createProjection(): WorldProjection {
  return {
    tick: 12,
    seed: 'inspection-test',
    width: 64,
    height: 64,
    terrainRevision: 1,
    speed: 1,
    paused: false,
    tiles: [
      { x: 1, y: 1, terrain: 'grass', biome: 'temperate' },
      { x: 18, y: 18, terrain: 'forest', biome: 'woodland' },
    ],
    units: [
      {
        id: 'unit-1',
        race: 'human',
        gender: 'female',
        position: { x: 20, y: 20 },
        hp: 100,
        hunger: 8,
        ageTicks: 4000,
        reproductionCooldownTicks: 0,
        intent: 'wander',
        homeVillageId: 'village-1',
      },
    ],
    villages: [
      {
        id: 'village-1',
        name: '晨林村',
        level: 3,
        race: 'human',
        kingdomId: 'kingdom-1',
        center: { x: 20, y: 20 },
        population: 24,
        foodInventory: 80,
        foodCapacity: 120,
        woodInventory: 3,
        stoneInventory: 5,
        ironInventory: 1,
        jobs: {
          farmer: 4,
          builder: 2,
          miner: 1,
          soldier: 3,
        },
        growthBlockers: ['housing_pressure', 'missing_wood'],
        buildPlan: 'expand_housing',
        housingCapacity: 30,
        territoryTiles: 12,
        foundedAtTick: 2,
        status: 'stable',
      },
      {
        id: 'village-2',
        name: '河湾村',
        level: 2,
        race: 'human',
        center: { x: 30, y: 30 },
        population: 12,
        foodInventory: 42,
        foodCapacity: 120,
        woodInventory: 1,
        stoneInventory: 0,
        ironInventory: 0,
        jobs: {
          farmer: 2,
          builder: 1,
          miner: 0,
          soldier: 0,
        },
        growthBlockers: [],
        buildPlan: 'idle',
        housingCapacity: 18,
        territoryTiles: 8,
        foundedAtTick: 6,
        status: 'stable',
      },
    ],
    kingdoms: [
      {
        id: 'kingdom-1',
        race: 'human',
        color: 0xffcd75,
        capitalVillageId: 'village-1',
        villageIds: ['village-1'],
        population: 24,
        buildingCount: 1,
        territoryTiles: 12,
        foodInventory: 80,
        woodInventory: 3,
        stoneInventory: 5,
        ironInventory: 1,
        diplomacyPressure: 42,
        diplomacyTargetKingdomId: 'kingdom-2',
        foundedAtTick: 4,
        status: 'stable',
      },
    ],
    buildings: [
      {
        id: 'building-1',
        villageId: 'village-1',
        type: 'house',
        status: 'active',
        position: { x: 24, y: 22 },
        builtAtTick: 8,
        tier: 1,
      },
      {
        id: 'building-2',
        villageId: 'village-1',
        type: 'storage',
        status: 'abandoned',
        position: { x: 26, y: 22 },
        builtAtTick: 9,
        abandonedAtTick: 30,
        tier: 1,
      },
      {
        id: 'building-3',
        villageId: 'village-1',
        type: 'farm',
        status: 'ruined',
        position: { x: 28, y: 22 },
        builtAtTick: 10,
        abandonedAtTick: 40,
        ruinedAtTick: 80,
        tier: 1,
      },
    ],
    armies: [
      {
        id: 'army-1',
        kingdomId: 'kingdom-1',
        targetKingdomId: 'kingdom-2',
        originVillageId: 'village-1',
        targetVillageId: 'village-2',
        position: { x: 31, y: 31 },
        soldierCount: 12,
        trainedSoldiers: 5,
        morale: 0.8,
        formedAtTick: 10,
        status: 'marching',
      },
    ],
    territory: [
      { x: 18, y: 18, villageId: 'village-1', kingdomId: 'kingdom-1' },
      { x: 19, y: 18, villageId: 'village-1', kingdomId: 'kingdom-1' },
    ],
    workSites: [],
    recentEvents: [
      {
        id: 'event-1',
        tick: 8,
        type: 'building_built',
        message: 'building-1 house built',
        payload: { villageId: 'village-1', type: 'house' },
      },
      {
        id: 'event-2',
        tick: 9,
        type: 'war_declared',
        message: 'kingdom-1 declared war',
        payload: { kingdomId: 'kingdom-1', targetKingdomId: 'kingdom-2' },
      },
      {
        id: 'event-3',
        tick: 10,
        type: 'army_formed',
        message: 'army-1 formed',
        payload: {
          armyId: 'army-1',
          kingdomId: 'kingdom-1',
          originVillageId: 'village-1',
          targetVillageId: 'village-2',
        },
      },
      {
        id: 'event-4',
        tick: 11,
        type: 'resource_placed',
        message: 'food placed',
      },
    ],
    stats: {
      population: 1,
      villages: 1,
      kingdoms: 1,
      fallenKingdoms: 0,
      buildings: 3,
      activeArmies: 1,
      activeBuildings: 1,
      abandonedBuildings: 1,
      ruinedBuildings: 1,
      territoryTiles: 2,
      foodTiles: 0,
      totalFood: 0,
      totalVillageFood: 80,
      totalVillageWood: 3,
      totalVillageStone: 5,
      totalVillageIron: 1,
      housingCapacity: 30,
    },
  };
}

const _typeCheckSelection: WorldSelection = { type: 'none' };
