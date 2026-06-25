import { describe, expect, it, vi } from 'vitest';
import { generateMap, type MapData } from '../src/core/map';
import { applyScenarioToWorld } from '../src/core/scenario';
import { RANDOM_SCENARIO } from '../src/core/scenario/presets';
import { computeCapitalsAndCentroids, runExpansionTick, type SimStatus } from '../src/core/sim';
import { createPrngFromSeed } from '../src/shared/math';
import type { FactionId, FactionSummary, Tick } from '../src/shared/types';
import { asFactionId, asTick, TICKS_PER_YEAR } from '../src/shared/types';

const LONG_RUN_SEED = 'worldsim-longrun-3000-v1';
const PROVINCE_COUNT = 3000;
const MAX_YEARS = 500;
const CHECKPOINT_YEARS = [0, 50, 100, 150, 200, 300, 400, 500] as const;

type LongRunState = {
  tick: Tick;
  map: MapData;
  factions: FactionSummary[];
  status: SimStatus;
  winnerFactionId: FactionId | null;
};

type LongRunSnapshot = {
  year: number;
  occupied: number;
  occupiedRatio: number;
  liveCount: number;
  largestRegions: number;
  largestShare: number;
  eliminated: number;
  status: SimStatus;
  winner: string;
};

type LongRunReport = {
  seed: string;
  provinceCount: number;
  finalYear: number;
  firstEliminationYear: number | null;
  terminalYear: number | null;
  totalCaptures: number;
  totalRepels: number;
  samples: LongRunSnapshot[];
  final: LongRunSnapshot;
};

describe('3000-province long-run convergence', () => {
  it('keeps a fixed seed converging over 500 simulated years', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const report = runLongRunProbe();

      console.info(formatReport(report));

      expect(report.final.occupied).toBe(PROVINCE_COUNT);
      expect(report.firstEliminationYear).not.toBeNull();
      expect(report.firstEliminationYear as number).toBeLessThanOrEqual(200);
      expect(report.final.liveCount).toBeLessThanOrEqual(3);
      expect(report.final.status === 'victory' || report.final.liveCount <= 3).toBe(true);
      expect(report.totalCaptures).toBeGreaterThan(PROVINCE_COUNT);
      expect(report.totalRepels).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
    }
  }, 60_000);
});

function runLongRunProbe(): LongRunReport {
  const state = createInitialState();
  const samples: LongRunSnapshot[] = [snapshotState(state)];
  const checkpoints = new Set<number>(CHECKPOINT_YEARS.slice(1));
  const maxTicks = MAX_YEARS * TICKS_PER_YEAR;
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
      rng: createPrngFromSeed(`tick-${LONG_RUN_SEED}-${nextTick}`),
    });

    totalCaptures += result.events.filter((event) => event.type === 'capture').length;
    totalRepels += result.events.filter((event) => event.type === 'repel').length;

    state.tick = nextTick;
    if (result.patches.length > 0) {
      state.map = applyPatches(state.map, result.patches);
      state.factions = refreshFactionTerritories(state.map, state.factions);
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
    if (state.status === 'victory' || state.status === 'stalemate') {
      break;
    }
  }

  const final = snapshotState(state);
  if (!samples.some((sample) => sample.year === final.year)) {
    samples.push(final);
  }

  return {
    seed: LONG_RUN_SEED,
    provinceCount: PROVINCE_COUNT,
    finalYear: final.year,
    firstEliminationYear,
    terminalYear,
    totalCaptures,
    totalRepels,
    samples,
    final,
  };
}

function createInitialState(): LongRunState {
  let nextFactionId = 1;
  const scenarioRng = createPrngFromSeed(`${LONG_RUN_SEED}:scenario`);
  const scenario = {
    ...RANDOM_SCENARIO,
    factions:
      RANDOM_SCENARIO.factionsFactory?.(scenarioRng, {
        includeChinese: true,
        includeForeign: true,
      }) ?? RANDOM_SCENARIO.factions,
  };
  let map = generateMap({
    seed: LONG_RUN_SEED,
    provinceCount: PROVINCE_COUNT,
    bounds: { width: 1600, height: 1000 },
  });
  const applyResult = applyScenarioToWorld({
    map,
    scenario,
    rng: createPrngFromSeed(`${LONG_RUN_SEED}:spawns`),
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

  const factions: FactionSummary[] = applyResult.factionAssignments.map((assignment) => ({
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

  return {
    tick: asTick(0),
    map,
    factions: refreshFactionTerritories(map, factions),
    status: 'running',
    winnerFactionId: null,
  };
}

function applyPatches(
  map: MapData,
  patches: Array<{ regionId: number; toOwnerId: FactionId | null }>,
): MapData {
  const provinces = map.provinces.map((province) => ({ ...province }));
  for (const patch of patches) {
    const province = provinces[patch.regionId as number];
    if (province) province.ownerFactionId = patch.toOwnerId;
  }
  return { ...map, provinces };
}

function refreshFactionTerritories(map: MapData, factions: FactionSummary[]): FactionSummary[] {
  const regionsByFaction = new Map<FactionId, number>();
  for (const province of map.provinces) {
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

function snapshotState(state: LongRunState): LongRunSnapshot {
  const occupied = state.factions.reduce((sum, faction) => sum + faction.regions, 0);
  const liveFactions = state.factions.filter((faction) => faction.regions > 0);
  const largest = liveFactions.reduce<FactionSummary | null>(
    (best, faction) => (best == null || faction.regions > best.regions ? faction : best),
    null,
  );
  return {
    year: tickToYear(state.tick),
    occupied,
    occupiedRatio: occupied / state.map.provinces.length,
    liveCount: liveFactions.length,
    largestRegions: largest?.regions ?? 0,
    largestShare: occupied > 0 ? (largest?.regions ?? 0) / occupied : 0,
    eliminated: state.factions.length - liveFactions.length,
    status: state.status,
    winner:
      state.winnerFactionId == null
        ? ''
        : (state.factions.find((faction) => faction.id === state.winnerFactionId)?.name ?? ''),
  };
}

function tickToYear(tick: Tick): number {
  return Math.floor((tick as unknown as number) / TICKS_PER_YEAR);
}

function formatReport(report: LongRunReport): string {
  const lines = [
    '3000-province long-run convergence report',
    `seed=${report.seed}`,
    `provinceCount=${report.provinceCount}`,
    `finalYear=${report.finalYear}`,
    `firstEliminationYear=${report.firstEliminationYear ?? 'none'}`,
    `terminalYear=${report.terminalYear ?? 'none'}`,
    `totalCaptures=${report.totalCaptures}`,
    `totalRepels=${report.totalRepels}`,
    'year | occupied | live | eliminated | largestShare | status | winner',
  ];
  for (const sample of report.samples) {
    lines.push(
      [
        pad(sample.year, 4),
        pad(sample.occupied, 8),
        pad(sample.liveCount, 4),
        pad(sample.eliminated, 10),
        `${(sample.largestShare * 100).toFixed(1).padStart(6)}%`,
        sample.status.padStart(9),
        sample.winner,
      ].join(' | '),
    );
  }
  return lines.join('\n');
}

function pad(value: number, width: number): string {
  return String(value).padStart(width);
}
