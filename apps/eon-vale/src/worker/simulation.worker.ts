/// <reference lib="webworker" />

import type {
  Inspection,
  ResourceNodeSnapshot,
  TerritorySnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import { BuildingType, EntityKind, PlanningZoneKind, type WorldMap } from '@/shared/gameTypes';
import {
  createPrototypeSimulation,
  type PrototypeSimulation,
} from '@/simulation/core/prototypeSimulation';
import {
  createWorldSimulation,
  createWorldSimulationFromState,
  type WorldSimulation,
} from '@/simulation/core/worldSimulation';
import {
  querySubjectHistory,
  queryWorldHistory,
  recentWorldNotifications,
} from '@/simulation/history/worldHistory';
import { deriveKingdomObservation } from '@/simulation/kingdoms/kingdomObservation';
import { activeWars } from '@/simulation/kingdoms/kingdoms';
import { generateWorldMap } from '@/simulation/map/generateWorldMap';
import { editTerrain } from '@/simulation/map/terrainEditing';
import { loadWorldSave, serializeWorld } from '@/simulation/persistence/save';
import { createResourceNodeStore } from '@/simulation/resources/resourceNodes';
import { simulationTickIntervalMs } from '@/simulation/rules/runtimeRules';
import { resolveSettlementCapabilities } from '@/simulation/settlements/settlementCapabilities';
import {
  collectVillageWorkHotspots,
  countVillagePlanningZones,
  paintVillagePlanningZone,
} from '@/simulation/settlements/spatialPlanning';
import { nextVillageTierRequirement } from '@/simulation/systems/economy';
import { applyGodPower } from '@/simulation/systems/environment';
import { drainWorldMapDelta } from './mapDeltaSync';
import { type MapSyncReason, mapSyncRequiresFullRebuild } from './mapSyncPolicy';
import type { WorkerCommand, WorkerEvent } from './protocol';
import { createFullResourceSnapshot, drainResourceNodeDelta } from './resourceSync';
import { createFullTerritorySnapshot, drainTerritoryDelta } from './territorySync';

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let prototype: PrototypeSimulation | null = null;
let world: WorldSimulation | null = null;
let mode: 'world' | 'stress' = 'world';
let paused = false;
let speed: 1 | 2 | 4 | 8 = 1;
let lastSnapshotAt = 0;
let lastMapAt = 0;
let totalTickMs = 0;
let measuredTicks = 0;
let nextTickAt = performance.now();
const godCooldowns = new Map<string, number>();

function emit(event: WorkerEvent, transfers: Transferable[] = []): void {
  workerScope.postMessage(event, transfers);
}

function emitMap(
  source: WorldMap,
  changedChunks: number[],
  reason: MapSyncReason = 'periodic',
): void {
  const map: WorldMapSnapshot = {
    size: source.size,
    preset: source.preset,
    terrain: source.terrain.slice(),
    height: source.height.slice(),
    moisture: source.moisture.slice(),
    temperature: source.temperature.slice(),
    resourceFood: source.resourceFood.slice(),
    fire: source.fire.slice(),
    rain: source.rain.slice(),
    plague: source.plague.slice(),
    crops: source.crops.slice(),
    craters: source.craters.slice(),
    roads: source.roads.slice(),
    changedChunks,
    fullRebuild: mapSyncRequiresFullRebuild(reason),
  };
  source.dirtyMapCells.length = 0;
  emit({ type: 'world-map', map }, [
    map.terrain.buffer,
    map.height.buffer,
    map.moisture.buffer,
    map.temperature.buffer,
    map.resourceFood.buffer,
    map.fire.buffer,
    map.rain.buffer,
    map.plague.buffer,
    map.crops.buffer,
    map.craters.buffer,
    map.roads.buffer,
  ]);
}

function emitMapDelta(delta: WorldMapDelta): void {
  emit({ type: 'world-map-delta', delta }, [
    delta.cells.buffer,
    delta.terrain.buffer,
    delta.height.buffer,
    delta.moisture.buffer,
    delta.temperature.buffer,
    delta.resourceFood.buffer,
    delta.fire.buffer,
    delta.rain.buffer,
    delta.plague.buffer,
    delta.crops.buffer,
    delta.craters.buffer,
    delta.roads.buffer,
  ]);
}

function emitResourceSnapshot(resources: ResourceNodeSnapshot): void {
  emit({ type: 'world-resources', resources }, [
    resources.nodeIds.buffer,
    resources.active.buffer,
    resources.kind.buffer,
    resources.positionsX.buffer,
    resources.positionsZ.buffer,
    resources.amount.buffer,
    resources.stage.buffer,
    resources.variant.buffer,
  ]);
}

function emitTerritorySnapshot(territory: TerritorySnapshot): void {
  emit({ type: 'world-territory', territory }, [
    territory.cells.buffer,
    territory.villageIds.buffer,
    territory.claimStrength.buffer,
    territory.planningZoneKinds.buffer,
  ]);
}

function emitWorldDeltas(): void {
  if (!world) return;
  const mapDelta = drainWorldMapDelta(world.state.map);
  if (mapDelta) emitMapDelta(mapDelta);
  const resourceDelta = drainResourceNodeDelta(world.state.resourceNodes);
  if (resourceDelta) emitResourceSnapshot(resourceDelta);
  const territoryDelta = drainTerritoryDelta(world.state.territory);
  if (territoryDelta) emitTerritorySnapshot(territoryDelta);
}

function emitWorldMap(changedChunks: number[], reason: MapSyncReason = 'periodic'): void {
  if (!world) return;
  emitMap(world.state.map, changedChunks, reason);
}

function createWorldSnapshot(tickMs: number): WorldRenderSnapshot | null {
  if (!world) return null;
  const state = world.state;
  const count = state.entities.count;
  let humans = 0;
  let animals = 0;
  for (let entityId = 0; entityId < count; entityId += 1) {
    if (!state.entities.active[entityId]) continue;
    if (state.entities.kind[entityId] === EntityKind.Human) humans += 1;
    else animals += 1;
  }
  return {
    tick: state.tick,
    year: state.year,
    population: count,
    active: state.entities.active.slice(0, count),
    positionsX: state.entities.positionsX.slice(0, count),
    positionsZ: state.entities.positionsZ.slice(0, count),
    headings: state.entities.headings.slice(0, count),
    states: state.entities.states.slice(0, count),
    kinds: state.entities.kind.slice(0, count),
    villageIds: state.entities.villageIds.slice(0, count),
    kingdomIds: state.entities.kingdomIds.slice(0, count),
    health: state.entities.health.slice(0, count),
    infected: state.entities.infected.slice(0, count),
    professions: state.entities.professions.slice(0, count),
    levels: state.entities.levels.slice(0, count),
    roles: state.entities.roles.slice(0, count),
    weaponTiers: state.entities.weaponTiers.slice(0, count),
    armorTiers: state.entities.armorTiers.slice(0, count),
    ages: state.entities.age.slice(0, count),
    targetCells: state.entities.targetCells.slice(0, count),
    carriedResourceKinds: state.entities.carriedResourceKinds.slice(0, count),
    carriedResources: state.entities.carriedResources.slice(0, count),
    stats: {
      year: state.year,
      humans,
      animals,
      villages: state.villages.filter((village) => village.health > 0).length,
      kingdoms: state.kingdoms.filter((kingdom) => !kingdom.extinct).length,
      wars: activeWars(state),
      populationTrend: state.population.trend,
    },
    villages: structuredClone(state.villages),
    kingdoms: structuredClone(state.kingdoms),
    buildings: structuredClone(state.buildings),
    carcasses: structuredClone(state.carcasses),
    events: structuredClone(recentWorldNotifications(state)),
    historyRevision: state.nextEventId,
    settings: { ...state.settings },
    demographics: structuredClone(state.population),
    worldLaws: { ...state.worldLaws },
    ecology: structuredClone(state.ecology),
    metrics: {
      tickMs,
      averageTickMs: measuredTicks > 0 ? totalTickMs / measuredTicks : 0,
      completedPaths: world.metrics.completedPaths,
      pathQueue: world.metrics.pathQueue,
      neighbourCandidates: 0,
    },
  };
}

function inspect(command: Extract<WorkerCommand, { type: 'inspect' }>): Inspection | null {
  if (!world) return null;
  const state = world.state;
  if (command.target === 'entity') {
    const id = command.id;
    if (id < 0 || id >= state.entities.count || !state.entities.active[id]) return null;
    const village = state.villages.find(
      (candidate) => candidate.id === state.entities.villageIds[id],
    );
    const kingdom = state.kingdoms.find(
      (candidate) => candidate.id === state.entities.kingdomIds[id],
    );
    const target = state.entities.targetCells[id];
    const homeId = state.entities.homeBuildingIds[id] ?? 0;
    const workplaceId = state.entities.workBuildingIds[id] ?? 0;
    return {
      type: 'entity',
      id,
      lifeId: state.entities.lifeIds[id] ?? 0,
      favorite: state.favoriteLifeIds.includes(state.entities.lifeIds[id] ?? 0),
      name: state.entities.names[id] ?? `居民 ${id + 1}`,
      kind: state.entities.kind[id] ?? 0,
      age: state.entities.age[id] ?? 0,
      health: state.entities.health[id] ?? 0,
      hunger: state.entities.hunger[id] ?? 0,
      energy: state.entities.energy[id] ?? 0,
      profession: state.entities.professions[id] ?? 0,
      state: state.entities.states[id] ?? 0,
      villageName: village?.name ?? '无',
      kingdomName: kingdom?.name ?? '无',
      targetCell: target === undefined || target === 0xffff_ffff ? null : target,
      traits: state.entities.traits[id] ?? 0,
      level: state.entities.levels[id] ?? 1,
      experience: state.entities.experience[id] ?? 0,
      contribution: state.entities.contribution[id] ?? 0,
      role: state.entities.roles[id] ?? 0,
      weaponTier: state.entities.weaponTiers[id] ?? 0,
      armorTier: state.entities.armorTiers[id] ?? 0,
      sex: state.entities.sex[id] ?? 0,
      familyId: state.entities.familyIds[id] ?? 0,
      partnerName:
        (state.entities.partnerIds[id] ?? 0xffff_ffff) === 0xffff_ffff
          ? '无'
          : (state.entities.names[state.entities.partnerIds[id] ?? 0xffff_ffff] ?? '无'),
      parentNames: [state.entities.parentAIds[id], state.entities.parentBIds[id]].flatMap(
        (parentId) =>
          parentId === undefined || parentId === 0xffff_ffff
            ? []
            : [state.entities.names[parentId] ?? `居民 ${parentId + 1}`],
      ),
      malnutrition: state.entities.malnutrition[id] ?? 0,
      history: querySubjectHistory(state, {
        kind: 'entity',
        lifeId: state.entities.lifeIds[id] ?? 0,
      }),
      task: structuredClone(state.entities.tasks[id] ?? null),
      carriedResourceKind: state.entities.carriedResourceKinds[id] ?? 0,
      carriedResourceAmount: state.entities.carriedResources[id] ?? 0,
      homeName:
        homeId > 0
          ? `${BuildingType[state.buildings[homeId - 1]?.type ?? 0]} #${homeId}`
          : '无固定住所',
      workplaceName:
        workplaceId > 0
          ? `${BuildingType[state.buildings[workplaceId - 1]?.type ?? 0]} #${workplaceId}`
          : '无固定工位',
    };
  }
  if (command.target === 'village') {
    const village = state.villages.find((candidate) => candidate.id === command.id);
    if (!village) return null;
    const kingdom = state.kingdoms.find((candidate) => candidate.id === village.kingdomId);
    const operationalTypes = village.buildingIds.flatMap((buildingId) => {
      const building = state.buildings[buildingId - 1];
      return building?.completed && building.health > 0 ? [building.type] : [];
    });
    const counts = new Map<BuildingType, number>();
    for (const type of operationalTypes) counts.set(type, (counts.get(type) ?? 0) + 1);
    const requirement = nextVillageTierRequirement(village.tier);
    const zones = countVillagePlanningZones(state, village.id);
    const capabilities = resolveSettlementCapabilities(state, village);
    return {
      type: 'village',
      id: village.id,
      village: structuredClone(village),
      completedBuildings: village.buildingIds.filter((id) => state.buildings[id - 1]?.completed)
        .length,
      kingdomName: kingdom?.name ?? '无',
      development: {
        nextTier: requirement?.tier ?? null,
        population: village.population,
        requiredPopulation: requirement?.population ?? village.population,
        buildings: requirement
          ? Object.entries(requirement.buildings).map(([type, required]) => ({
              type: Number(type),
              current: counts.get(Number(type) as BuildingType) ?? 0,
              required: required ?? 0,
            }))
          : [],
      },
      planningZones: {
        residential: zones[PlanningZoneKind.Residential],
        production: zones[PlanningZoneKind.Production],
        defense: zones[PlanningZoneKind.Defense],
      },
      capabilities: {
        guardTrainingSlots: capabilities.guardTrainingSlots,
        territoryReachBonus: capabilities.territoryReachBonus,
        claimStrengthBonus: capabilities.claimStrengthBonus,
        captureBlockers: capabilities.captureBlockers,
        watchtowers: capabilities.watchtowers,
        watchRange: capabilities.watchRange,
        watchDamage: capabilities.watchDamage,
      },
      workHotspots: collectVillageWorkHotspots(state, village.id),
      history: querySubjectHistory(state, { kind: 'village', id: village.id }),
    };
  }
  if (command.target === 'building') {
    const building = state.buildings[command.id - 1];
    if (!building) return null;
    const village = state.villages.find((candidate) => candidate.id === building.villageId);
    const capability: Record<BuildingType, string> = {
      [BuildingType.TownCenter]: '聚落集会、建设计划与搬运调度',
      [BuildingType.Home]: '容纳家庭并提供完整睡眠恢复',
      [BuildingType.Farm]: '提供 3 个农务工位，承载播种与收割',
      [BuildingType.Storage]: '每类资源增加 120 容量并提供取送端点',
      [BuildingType.Barracks]: '提供 4 个守卫训练工位',
      [BuildingType.Road]: '提高陆地通行效率',
      [BuildingType.LoggingCamp]: '提供 3 个伐木工位并组织林业任务',
      [BuildingType.Mine]: '提供 3 个矿工工位并连接金属矿脉',
      [BuildingType.Workshop]: '提供 2 个工匠工位并制作工具与装备',
      [BuildingType.CouncilHall]: '扩大治理范围并加快领土巩固',
      [BuildingType.Wall]: '阻挡敌军推进占领，失守后停止生效',
      [BuildingType.Watchtower]: '警戒边境并攻击进入射程的敌军',
    };
    const inputs =
      building.type === BuildingType.Workshop
        ? '木材、金属'
        : building.type === BuildingType.Farm
          ? '农夫时间、可耕地'
          : building.type === BuildingType.Mine
            ? '矿工时间、金属矿脉'
            : building.type === BuildingType.Barracks
              ? '守卫训练时间'
              : '无持续输入';
    const outputs =
      building.type === BuildingType.Workshop
        ? '工具、装备'
        : building.type === BuildingType.Farm
          ? '可搬运食物'
          : building.type === BuildingType.Mine
            ? '可搬运金属'
            : building.type === BuildingType.Home
              ? '住房与休息'
              : building.type === BuildingType.Storage
                ? '受保护容量'
                : building.type === BuildingType.Barracks
                  ? '守卫经验与战备'
                  : building.type === BuildingType.CouncilHall
                    ? '治理范围与领土巩固'
                    : building.type === BuildingType.Wall
                      ? '占领阻断'
                      : building.type === BuildingType.Watchtower
                        ? '警戒火力与领土范围'
                        : '聚落能力';
    return {
      type: 'building',
      id: building.id,
      building: structuredClone(building),
      villageName: village?.name ?? '无所属聚落',
      workerNames: building.assignedWorkerIds.map(
        (entityId) => state.entities.names[entityId] ?? `居民 ${entityId + 1}`,
      ),
      capability: capability[building.type],
      inputs,
      outputs,
      stopReason:
        building.health <= 0
          ? '建筑已损毁'
          : !building.completed
            ? `施工阶段：${building.constructionPhase}`
            : building.workSlots > 0 && building.assignedWorkerIds.length === 0
              ? '暂无合适工人'
              : '正常运行',
    };
  }
  const kingdom = state.kingdoms.find((candidate) => candidate.id === command.id);
  if (!kingdom) return null;
  const villages = state.villages.filter((village) => kingdom.villageIds.includes(village.id));
  const observation = deriveKingdomObservation({
    size: state.map.size,
    villageIds: state.territory.villageIds,
    villages: state.villages,
    kingdoms: state.kingdoms,
  });
  const capital = state.villages.find((village) => village.id === kingdom.capitalVillageId);
  return {
    type: 'kingdom',
    id: kingdom.id,
    kingdom: structuredClone(kingdom),
    population: villages.reduce((sum, village) => sum + village.population, 0),
    resources: villages.reduce(
      (sum, village) => ({
        food: sum.food + village.resources.food,
        wood: sum.wood + village.resources.wood,
        stone: sum.stone + village.resources.stone,
      }),
      { food: 0, wood: 0, stone: 0 },
    ),
    capital: capital ? { id: capital.id, name: capital.name, x: capital.x, z: capital.z } : null,
    villages: villages
      .map((village) => ({
        id: village.id,
        name: village.name,
        population: village.population,
        tier: village.tier,
        isCapital: village.id === kingdom.capitalVillageId,
      }))
      .sort(
        (first, second) =>
          Number(second.isCapital) - Number(first.isCapital) ||
          second.tier - first.tier ||
          second.population - first.population,
      ),
    neighbours: observation.adjacencies
      .filter(
        (adjacency) =>
          adjacency.firstKingdomId === kingdom.id || adjacency.secondKingdomId === kingdom.id,
      )
      .flatMap((adjacency) => {
        const id =
          adjacency.firstKingdomId === kingdom.id
            ? adjacency.secondKingdomId
            : adjacency.firstKingdomId;
        const neighbour = state.kingdoms.find((candidate) => candidate.id === id);
        return neighbour
          ? [
              {
                id,
                name: neighbour.name,
                relation: kingdom.relations[id] ?? 0,
                sharedEdges: adjacency.sharedEdges,
                diagonalOnly: adjacency.diagonalOnly,
              },
            ]
          : [];
      }),
    history: querySubjectHistory(state, { kind: 'kingdom', id: kingdom.id }),
  };
}

workerScope.addEventListener('message', (event: MessageEvent<WorkerCommand>) => {
  const command = event.data;
  try {
    if (command.type === 'initialize-stress') {
      mode = 'stress';
      world = null;
      prototype = createPrototypeSimulation({
        population: command.population,
        seed: command.seed,
        pathBudget: command.population >= 1_000 ? 10 : 14,
      });
      totalTickMs = 0;
      measuredTicks = 0;
      emit({ type: 'ready', mode, population: command.population, seed: command.seed });
      emitMap(
        generateWorldMap(`${command.seed}:representative-map`, 128, 'archipelago'),
        [],
        'initialize',
      );
      emitResourceSnapshot(createFullResourceSnapshot(createResourceNodeStore(128)));
      return;
    }
    if (command.type === 'initialize-world') {
      mode = 'world';
      prototype = null;
      world = createWorldSimulation({
        seed: command.seed,
        initialHumans: command.initialHumans,
        mapSize: command.mapSize,
        preset: command.preset,
      });
      totalTickMs = 0;
      measuredTicks = 0;
      emit({ type: 'ready', mode, population: command.initialHumans, seed: command.seed });
      emitWorldMap([], 'initialize');
      emitResourceSnapshot(createFullResourceSnapshot(world.state.resourceNodes));
      emitTerritorySnapshot(createFullTerritorySnapshot(world.state.territory));
      return;
    }
    if (command.type === 'set-paused') {
      paused = command.paused;
      nextTickAt = performance.now();
    }
    if (command.type === 'set-speed') {
      speed = command.speed;
      nextTickAt = performance.now();
    }
    if (command.type === 'set-world-law' && world) {
      world.setWorldLaw(command.law, command.enabled);
    }
    if (command.type === 'map-edit' && world) {
      const changedChunks = editTerrain(
        world.state.map,
        {
          kind: command.tool,
          cell: command.cell,
          radius: command.radius,
        },
        world.state.resourceNodes,
      );
      void changedChunks;
      emitWorldDeltas();
    }
    if (command.type === 'spawn' && world) {
      const x = command.cell % world.state.map.size;
      const z = Math.floor(command.cell / world.state.map.size);
      world.spawn(command.kind, x, z, command.count);
    }
    if (command.type === 'god-power' && world) {
      const availableAt = godCooldowns.get(command.power) ?? 0;
      if (world.state.tick < availableAt) {
        emit({ type: 'notice', level: 'info', message: '神力尚未恢复' });
        return;
      }
      applyGodPower(world.state, command.power, command.cell, command.radius);
      godCooldowns.set(command.power, world.state.tick + 80);
      emitWorldDeltas();
    }
    if (command.type === 'inspect') emit({ type: 'inspection', inspection: inspect(command) });
    if (command.type === 'request-history' && world) {
      emit({
        type: 'world-history',
        archive: queryWorldHistory(world.state, { filter: command.filter }),
      });
    }
    if (command.type === 'set-favorite' && world) {
      const favorites = new Set(world.state.favoriteLifeIds);
      if (command.favorite) favorites.add(command.lifeId);
      else favorites.delete(command.lifeId);
      world.state.favoriteLifeIds = [...favorites];
      const entityId = Array.from(
        world.state.entities.lifeIds.slice(0, world.state.entities.count),
      ).indexOf(command.lifeId);
      if (entityId >= 0) {
        emit({
          type: 'inspection',
          inspection: inspect({ type: 'inspect', target: 'entity', id: entityId }),
        });
      }
    }
    if (command.type === 'set-construction-priority' && world) {
      const village = world.state.villages.find((candidate) => candidate.id === command.villageId);
      if (village) village.constructionPriority = command.priority;
      emit({
        type: 'inspection',
        inspection: inspect({ type: 'inspect', target: 'village', id: command.villageId }),
      });
    }
    if (command.type === 'paint-planning-zone' && world) {
      const changed = paintVillagePlanningZone(
        world.state,
        command.villageId,
        command.zone,
        command.cell,
        command.radius,
      );
      emitWorldDeltas();
      emit({
        type: 'notice',
        level: 'info',
        message: changed > 0 ? `已规划 ${changed} 格` : '只能规划本聚落的可通行领土',
      });
      emit({
        type: 'inspection',
        inspection: inspect({ type: 'inspect', target: 'village', id: command.villageId }),
      });
    }
    if (command.type === 'request-save' && world)
      emit({ type: 'save-data', encoded: serializeWorld(world.state) });
    if (command.type === 'load-save') {
      const restored = loadWorldSave(command.encoded);
      mode = 'world';
      prototype = null;
      world = createWorldSimulationFromState(restored);
      emit({ type: 'ready', mode, population: restored.entities.count, seed: restored.seed });
      emitWorldMap([], 'load');
      emitResourceSnapshot(createFullResourceSnapshot(world.state.resourceNodes));
      emitTerritorySnapshot(createFullTerritorySnapshot(world.state.territory));
      emit({ type: 'notice', level: 'info', message: '世界已载入' });
    }
  } catch (error) {
    emit({
      type: 'notice',
      level: 'error',
      message: error instanceof Error ? error.message : '操作失败',
    });
  }
});

function runSimulationTick(): void {
  if (paused) {
    nextTickAt = performance.now();
    setTimeout(runSimulationTick, 10);
    return;
  }
  const startedAt = performance.now();
  if (mode === 'stress' && prototype) {
    prototype.step();
  }
  if (mode === 'world' && world) {
    world.step();
  }
  const tickMs = performance.now() - startedAt;
  totalTickMs += tickMs;
  measuredTicks += 1;
  const now = performance.now();
  if (now - lastSnapshotAt >= 80) {
    lastSnapshotAt = now;
    if (mode === 'stress' && prototype) {
      const snapshot = prototype.snapshot();
      emit({ type: 'snapshot', snapshot }, [
        snapshot.positionsX.buffer,
        snapshot.positionsZ.buffer,
        snapshot.headings.buffer,
        snapshot.states.buffer,
      ]);
    }
    if (mode === 'world') {
      const snapshot = createWorldSnapshot(tickMs);
      if (snapshot) {
        emit({ type: 'world-snapshot', snapshot }, [
          snapshot.positionsX.buffer,
          snapshot.active.buffer,
          snapshot.positionsZ.buffer,
          snapshot.headings.buffer,
          snapshot.states.buffer,
          snapshot.kinds.buffer,
          snapshot.villageIds.buffer,
          snapshot.kingdomIds.buffer,
          snapshot.health.buffer,
          snapshot.infected.buffer,
          snapshot.professions.buffer,
          snapshot.levels.buffer,
          snapshot.roles.buffer,
          snapshot.weaponTiers.buffer,
          snapshot.armorTiers.buffer,
          snapshot.ages.buffer,
          snapshot.targetCells.buffer,
          snapshot.carriedResourceKinds.buffer,
          snapshot.carriedResources.buffer,
        ]);
      }
    }
  }
  if (mode === 'world' && world && now - lastMapAt >= 120) {
    lastMapAt = now;
    emitWorldDeltas();
  }
  const interval = simulationTickIntervalMs(speed);
  nextTickAt = Math.max(nextTickAt + interval, now - interval);
  setTimeout(runSimulationTick, Math.max(0, nextTickAt - performance.now()));
}

nextTickAt = performance.now();
runSimulationTick();
