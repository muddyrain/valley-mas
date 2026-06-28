import { generateMap, type MapData, type Province } from '@/core/map';
import { applyScenarioToWorld } from '@/core/scenario';
import { RANDOM_SCENARIO } from '@/core/scenario/presets';
import { createPrngFromSeed } from '@/shared/math';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, Tick } from '@/shared/types';
import { asFactionId, asTick, TICKS_PER_YEAR } from '@/shared/types';
import { computeCapitalsAndCentroids } from './capitals';
import { runExpansionTick } from './expansion';
import { rebuildSettlements } from './settlements';
import type { SimStatus } from './types';

export type BalanceProbeOptions = {
  seeds?: readonly string[];
  provinceCount?: number;
  maxYears?: number;
  checkpointYears?: readonly number[];
  bounds?: { width: number; height: number };
};

export type StartBand = 'edge' | 'middle' | 'center';

export type BalanceFactionProbe = {
  factionId: FactionId;
  name: string;
  startBand: StartBand;
  birthRegionId: RegionId | null;
  birthEdgeDistance: number | null;
  finalRegions: number;
  survived: boolean;
  won: boolean;
};

export type BalanceSnapshot = {
  year: number;
  occupiedRatio: number;
  liveCount: number;
  largestShare: number;
  eliminated: number;
};

export type BalanceSeedReport = {
  seed: string;
  provinceCount: number;
  landCount: number;
  landRatio: number;
  finalYear: number;
  firstEliminationYear: number | null;
  terminalYear: number | null;
  totalCaptures: number;
  totalRepels: number;
  ownerChurnRegions: number;
  edgeStartCount: number;
  centerStartCount: number;
  middleStartCount: number;
  winnerStartBand: StartBand | null;
  factions: BalanceFactionProbe[];
  samples: BalanceSnapshot[];
  final: BalanceSnapshot;
};

export type BalanceAggregateReport = {
  seeds: readonly string[];
  provinceCount: number;
  maxYears: number;
  checkpointYears: readonly number[];
  seedReports: BalanceSeedReport[];
  averageLandRatio: number;
  averageYear50LargestShare: number;
  maxYear50LargestShare: number;
  averageFinalLiveCount: number;
  averageFinalEliminated: number;
  averageFirstEliminationYear: number | null;
  edgeStartSurvivalRate: number | null;
  centerStartSurvivalRate: number | null;
  edgeWinnerShare: number;
  centerWinnerShare: number;
  averageOwnerChurnRegions: number;
};

type ProbeState = {
  tick: Tick;
  map: MapData;
  factions: FactionSummary[];
  settlements: SettlementSummary[];
  status: SimStatus;
  winnerFactionId: FactionId | null;
};

const DEFAULT_BALANCE_SEEDS = [
  'balance-seed-001',
  'balance-seed-002',
  'balance-seed-003',
  'balance-seed-004',
  'balance-seed-005',
  'balance-seed-006',
  'balance-seed-007',
  'balance-seed-008',
  'balance-seed-009',
  'balance-seed-010',
  'balance-seed-011',
  'balance-seed-012',
  'balance-seed-013',
  'balance-seed-014',
  'balance-seed-015',
  'balance-seed-016',
  'balance-seed-017',
  'balance-seed-018',
  'balance-seed-019',
  'balance-seed-020',
] as const;

const DEFAULT_CHECKPOINT_YEARS = [0, 25, 50, 100, 200, 500] as const;

export function runBalanceProbe(options: BalanceProbeOptions = {}): BalanceAggregateReport {
  const seeds = options.seeds ?? DEFAULT_BALANCE_SEEDS;
  const provinceCount = options.provinceCount ?? 3000;
  const maxYears = options.maxYears ?? 500;
  const checkpointYears = normalizeCheckpointYears(options.checkpointYears ?? DEFAULT_CHECKPOINT_YEARS, maxYears);
  const bounds = options.bounds ?? { width: 1600, height: 1000 };
  const seedReports = seeds.map((seed) =>
    runSeedProbe({
      seed,
      provinceCount,
      maxYears,
      checkpointYears,
      bounds,
    }),
  );

  const year50Shares = seedReports.map((report) => getSampleAtOrBefore(report, 50).largestShare);
  const firstEliminationYears = seedReports
    .map((report) => report.firstEliminationYear)
    .filter((year): year is number => year != null);
  const factionReports = seedReports.flatMap((report) => report.factions);
  const edgeStarts = factionReports.filter((faction) => faction.startBand === 'edge');
  const centerStarts = factionReports.filter((faction) => faction.startBand === 'center');
  const winnerReports = factionReports.filter((faction) => faction.won);

  return {
    seeds,
    provinceCount,
    maxYears,
    checkpointYears,
    seedReports,
    averageLandRatio: average(seedReports.map((report) => report.landRatio)),
    averageYear50LargestShare: average(year50Shares),
    maxYear50LargestShare: Math.max(...year50Shares),
    averageFinalLiveCount: average(seedReports.map((report) => report.final.liveCount)),
    averageFinalEliminated: average(seedReports.map((report) => report.final.eliminated)),
    averageFirstEliminationYear:
      firstEliminationYears.length === 0 ? null : average(firstEliminationYears),
    edgeStartSurvivalRate: edgeStarts.length === 0 ? null : rate(edgeStarts, (faction) => faction.survived),
    centerStartSurvivalRate:
      centerStarts.length === 0 ? null : rate(centerStarts, (faction) => faction.survived),
    edgeWinnerShare: winnerReports.length === 0 ? 0 : rate(winnerReports, (faction) => faction.startBand === 'edge'),
    centerWinnerShare:
      winnerReports.length === 0 ? 0 : rate(winnerReports, (faction) => faction.startBand === 'center'),
    averageOwnerChurnRegions: average(seedReports.map((report) => report.ownerChurnRegions)),
  };
}

export function formatBalanceReport(report: BalanceAggregateReport): string {
  const lines = [
    'WorldSim balance report',
    `seeds=${report.seeds.length}`,
    `provinceCount=${report.provinceCount}`,
    `maxYears=${report.maxYears}`,
    `averageLandRatio=${formatPercent(report.averageLandRatio)}`,
    `averageYear50LargestShare=${formatPercent(report.averageYear50LargestShare)}`,
    `maxYear50LargestShare=${formatPercent(report.maxYear50LargestShare)}`,
    `averageFinalLiveCount=${report.averageFinalLiveCount.toFixed(2)}`,
    `averageFinalEliminated=${report.averageFinalEliminated.toFixed(2)}`,
    `averageFirstEliminationYear=${formatNullableNumber(report.averageFirstEliminationYear)}`,
    `edgeStartSurvivalRate=${formatNullablePercent(report.edgeStartSurvivalRate)}`,
    `centerStartSurvivalRate=${formatNullablePercent(report.centerStartSurvivalRate)}`,
    `edgeWinnerShare=${formatPercent(report.edgeWinnerShare)}`,
    `centerWinnerShare=${formatPercent(report.centerWinnerShare)}`,
    `averageOwnerChurnRegions=${report.averageOwnerChurnRegions.toFixed(1)}`,
    '',
    'seed | land | y50 largest | final live | eliminated | first elimination | owner churn | winner band',
  ];

  for (const seedReport of report.seedReports) {
    lines.push(
      [
        seedReport.seed,
        formatPercent(seedReport.landRatio),
        formatPercent(getSampleAtOrBefore(seedReport, 50).largestShare),
        String(seedReport.final.liveCount),
        String(seedReport.final.eliminated),
        seedReport.firstEliminationYear == null ? 'none' : String(seedReport.firstEliminationYear),
        String(seedReport.ownerChurnRegions),
        seedReport.winnerStartBand ?? 'none',
      ].join(' | '),
    );
  }

  return lines.join('\n');
}

function runSeedProbe(input: {
  seed: string;
  provinceCount: number;
  maxYears: number;
  checkpointYears: readonly number[];
  bounds: { width: number; height: number };
}): BalanceSeedReport {
  const state = createInitialState(input);
  const samples: BalanceSnapshot[] = [snapshotState(state)];
  const checkpoints = new Set(input.checkpointYears.filter((year) => year > 0));
  const maxTicks = input.maxYears * TICKS_PER_YEAR;
  const ownerChangeCounts = new Uint16Array(state.map.provinces.length);
  let firstEliminationYear: number | null = null;
  let terminalYear: number | null = null;
  let totalCaptures = 0;
  let totalRepels = 0;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const nextTick = asTick(tick);
    const result = runExpansionTick({
      tick: nextTick,
      map: state.map,
      factions: state.factions,
      settlements: state.settlements,
      rng: createPrngFromSeed(`tick-${input.seed}-${nextTick}`),
    });

    totalCaptures += result.events.filter((event) => event.type === 'capture').length;
    totalRepels += result.events.filter((event) => event.type === 'repel').length;

    state.tick = nextTick;
    if (result.patches.length > 0) {
      for (const patch of result.patches) {
        const id = patch.regionId as unknown as number;
        if (id >= 0 && id < ownerChangeCounts.length) {
          ownerChangeCounts[id] += 1;
        }
      }
      state.map = applyPatches(state.map, result.patches);
      state.factions = refreshFactionTerritories(state.map, state.factions);
      state.settlements = rebuildSettlements({
        map: state.map,
        factions: state.factions,
        previous: state.settlements,
        tick: nextTick,
      });
    }

    for (const event of result.events) {
      if (event.type === 'eliminate' && firstEliminationYear == null) {
        firstEliminationYear = tickToYear(nextTick);
      }
      if (event.type === 'victory' || event.type === 'stalemate') {
        state.status = event.type;
        state.winnerFactionId = event.attackerId;
        if (terminalYear == null) terminalYear = tickToYear(nextTick);
      }
    }

    const year = tickToYear(nextTick);
    if (tick % TICKS_PER_YEAR === 0 && checkpoints.has(year)) {
      samples.push(snapshotState(state));
    }
    if (state.status === 'victory' || state.status === 'stalemate') break;
  }

  const final = snapshotState(state);
  if (!samples.some((sample) => sample.year === final.year)) samples.push(final);

  const factions = buildFactionProbe(state);
  const winner = factions.find((faction) => faction.won);

  return {
    seed: input.seed,
    provinceCount: input.provinceCount,
    landCount: countLandProvinces(state.map),
    landRatio: countLandProvinces(state.map) / Math.max(1, state.map.provinces.length),
    finalYear: final.year,
    firstEliminationYear,
    terminalYear,
    totalCaptures,
    totalRepels,
    ownerChurnRegions: Array.from(ownerChangeCounts).filter((count) => count > 1).length,
    edgeStartCount: factions.filter((faction) => faction.startBand === 'edge').length,
    centerStartCount: factions.filter((faction) => faction.startBand === 'center').length,
    middleStartCount: factions.filter((faction) => faction.startBand === 'middle').length,
    winnerStartBand: winner?.startBand ?? null,
    factions,
    samples,
    final,
  };
}

function createInitialState(input: {
  seed: string;
  provinceCount: number;
  bounds: { width: number; height: number };
}): ProbeState {
  let nextFactionId = 1;
  const scenarioRng = createPrngFromSeed(`${input.seed}:scenario`);
  const scenario = {
    ...RANDOM_SCENARIO,
    factions:
      RANDOM_SCENARIO.factionsFactory?.(scenarioRng, {
        includeChinese: true,
        includeForeign: true,
      }) ?? RANDOM_SCENARIO.factions,
  };
  let map = generateMap({
    seed: input.seed,
    provinceCount: input.provinceCount,
    bounds: input.bounds,
  });
  const applyResult = applyScenarioToWorld({
    map,
    scenario,
    rng: createPrngFromSeed(`${input.seed}:spawns`),
    mintFactionId: () => asFactionId(nextFactionId++),
  });
  map = applyPatches(
    map,
    applyResult.ownership.map((item) => ({
      regionId: item.regionId,
      fromOwnerId: null,
      toOwnerId: item.factionId,
    })),
  );

  const factionsRaw: FactionSummary[] = applyResult.factionAssignments.map((assignment) => ({
    id: assignment.factionId,
    name: assignment.factionName,
    leader: assignment.leader,
    colorHex: assignment.colorHex,
    birthRegionId: assignment.birthRegionId,
    capitalRegionId: assignment.birthRegionId,
    centroidRegionId: assignment.birthRegionId,
    regions: 0,
    population: 0,
  }));

  const factions = refreshFactionTerritories(map, factionsRaw);
  const settlements = rebuildSettlements({
    map,
    factions,
    tick: asTick(0),
  });

  return {
    tick: asTick(0),
    map,
    factions,
    settlements,
    status: 'running',
    winnerFactionId: null,
  };
}

function buildFactionProbe(state: ProbeState): BalanceFactionProbe[] {
  const largest = state.factions.reduce<FactionSummary | null>(
    (best, faction) => (best == null || faction.regions > best.regions ? faction : best),
    null,
  );
  return state.factions.map((faction) => {
    const birthProvince =
      faction.birthRegionId == null
        ? null
        : state.map.provinces[faction.birthRegionId as unknown as number];
    const birthEdgeDistance = birthProvince == null ? null : getEdgeDistance(state.map, birthProvince);
    return {
      factionId: faction.id,
      name: faction.name,
      startBand: birthProvince == null ? 'middle' : getStartBand(state.map, birthProvince),
      birthRegionId: faction.birthRegionId,
      birthEdgeDistance,
      finalRegions: faction.regions,
      survived: faction.regions > 0,
      won: largest?.id === faction.id && faction.regions > 0,
    };
  });
}

function applyPatches(
  map: MapData,
  patches: Array<{ regionId: number | RegionId; toOwnerId: FactionId | null }>,
): MapData {
  const provinces = map.provinces.map((province) => ({ ...province }));
  for (const patch of patches) {
    const province = provinces[patch.regionId as unknown as number];
    if (province && province.terrain !== 'ocean') province.ownerFactionId = patch.toOwnerId;
  }
  return { ...map, provinces };
}

function refreshFactionTerritories(map: MapData, factions: FactionSummary[]): FactionSummary[] {
  const regionsByFaction = new Map<FactionId, number>();
  for (const province of map.provinces) {
    if (province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    regionsByFaction.set(owner, (regionsByFaction.get(owner) ?? 0) + 1);
  }
  const capitals = computeCapitalsAndCentroids(map, factions);
  return factions.map((faction) => {
    const capital = capitals.get(faction.id);
    return {
      ...faction,
      regions: regionsByFaction.get(faction.id) ?? 0,
      capitalRegionId: capital?.capital ?? null,
      centroidRegionId: capital?.centroid ?? null,
    };
  });
}

function snapshotState(state: ProbeState): BalanceSnapshot {
  const occupied = state.factions.reduce((sum, faction) => sum + faction.regions, 0);
  const landCount = countLandProvinces(state.map);
  const liveFactions = state.factions.filter((faction) => faction.regions > 0);
  const largest = liveFactions.reduce<FactionSummary | null>(
    (best, faction) => (best == null || faction.regions > best.regions ? faction : best),
    null,
  );
  return {
    year: tickToYear(state.tick),
    occupiedRatio: occupied / Math.max(1, landCount),
    liveCount: liveFactions.length,
    largestShare: occupied > 0 ? (largest?.regions ?? 0) / occupied : 0,
    eliminated: state.factions.length - liveFactions.length,
  };
}

function getSampleAtOrBefore(report: BalanceSeedReport, targetYear: number): BalanceSnapshot {
  const sorted = report.samples
    .slice()
    .sort((a, b) => Math.abs(a.year - targetYear) - Math.abs(b.year - targetYear));
  return sorted[0] ?? report.final;
}

function getStartBand(map: MapData, province: Province): StartBand {
  const minDim = Math.max(1, Math.min(map.meta.bounds.width, map.meta.bounds.height));
  const edgeDistance = getEdgeDistance(map, province);
  if (edgeDistance <= minDim * 0.18) return 'edge';
  if (edgeDistance >= minDim * 0.34) return 'center';
  return 'middle';
}

function getEdgeDistance(map: MapData, province: Province): number {
  return Math.min(
    province.centroid.x,
    province.centroid.y,
    map.meta.bounds.width - province.centroid.x,
    map.meta.bounds.height - province.centroid.y,
  );
}

function normalizeCheckpointYears(years: readonly number[], maxYears: number): readonly number[] {
  return Array.from(new Set([0, ...years.filter((year) => year > 0 && year <= maxYears), maxYears])).sort(
    (a, b) => a - b,
  );
}

function countLandProvinces(map: MapData): number {
  return map.provinces.reduce(
    (sum, province) => sum + (province.terrain === 'ocean' ? 0 : 1),
    0,
  );
}

function tickToYear(tick: Tick): number {
  return Math.floor((tick as unknown as number) / TICKS_PER_YEAR);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return items.filter(predicate).length / items.length;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNullablePercent(value: number | null): string {
  return value == null ? 'n/a' : formatPercent(value);
}

function formatNullableNumber(value: number | null): string {
  return value == null ? 'n/a' : value.toFixed(1);
}
