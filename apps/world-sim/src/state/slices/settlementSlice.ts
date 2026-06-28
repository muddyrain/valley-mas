import type { StateCreator } from 'zustand';
import type { MapData } from '@/core/map';
import { TERRAIN_LABEL } from '@/core/map';
import { rebuildCapitalSettlements } from '@/core/sim';
import type {
  LogEvent,
  RegionId,
  ReplayFrame,
  ReplayRankingRow,
  SettlementId,
  SettlementSummary,
  WarSummary,
} from '@/shared/types';
import { asEventId, asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import type { LogSlice } from './logSlice';
import { MAX_LOG_ENTRIES } from './logSlice';
import type { MapSlice } from './mapSlice';
import type { ReplaySlice } from './replaySlice';
import type { SimSlice } from './simSlice';
import type { UiSlice } from './uiSlice';

export interface SettlementSlice {
  settlements: SettlementSummary[];
  setSettlements: (settlements: SettlementSummary[]) => void;
  rebuildSettlementsFromFactions: () => void;
  blessSettlement: (settlementId: SettlementId) => void;
  curseSettlement: (settlementId: SettlementId) => void;
  inciteSettlementRevolt: (settlementId: SettlementId) => void;
  pacifySettlementUnrest: (settlementId: SettlementId) => void;
  accelerateSettlementCivilization: (settlementId: SettlementId) => void;
  strikeSettlementDisaster: (settlementId: SettlementId) => void;
  freezeWarsAtRegion: (regionId: RegionId) => boolean;
  terraformRegion: (regionId: RegionId) => boolean;
  applyDivineToolAtRegion: (regionId: RegionId) => boolean;
}

type Deps = SettlementSlice & MapSlice & FactionSlice & SimSlice & LogSlice & ReplaySlice & UiSlice;

const DIVINE_FREEZE_TRUCE_TICKS = 24;

export const createSettlementSlice: StateCreator<Deps, [], [], SettlementSlice> = (set, get) => ({
  settlements: [],

  setSettlements: (settlements) => set({ settlements }),

  rebuildSettlementsFromFactions: () => {
    const state = get();
    set({
      settlements: rebuildCapitalSettlements({
        map: state.map,
        factions: state.factions,
        previous: state.settlements,
        tick: state.tick,
      }),
    });
  },

  blessSettlement: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '祝福',
      tool: 'bless-settlement',
      eventText: '获得祝福',
      loyaltyDelta: 0.22,
      unrestDelta: -0.25,
      revoltProgressDelta: -0.3,
    }),

  curseSettlement: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '诅咒',
      tool: 'curse-settlement',
      eventText: '遭到诅咒',
      loyaltyDelta: -0.24,
      unrestDelta: 0.28,
      revoltProgressDelta: 0.22,
    }),

  inciteSettlementRevolt: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '煽动',
      tool: 'incite-revolt',
      eventText: '遭到煽动',
      loyaltyDelta: -0.12,
      unrestDelta: 0.22,
      revoltProgressDelta: 0.35,
    }),

  pacifySettlementUnrest: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '平息',
      tool: 'pacify-unrest',
      eventText: '得到平息',
      loyaltyDelta: 0.14,
      unrestDelta: -0.32,
      revoltProgressDelta: -0.35,
    }),

  accelerateSettlementCivilization: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '加速',
      tool: 'accelerate-civilization',
      eventText: '获得文明加速',
      populationMultiplier: 1.18,
      developmentDelta: 0.16,
      loyaltyDelta: 0.08,
      unrestDelta: -0.12,
      revoltProgressDelta: -0.08,
    }),

  strikeSettlementDisaster: (settlementId) =>
    applyDivineSettlementEffect(get, set, settlementId, {
      label: '灾害',
      tool: 'strike-disaster',
      eventText: '遭遇灾害',
      populationMultiplier: 0.78,
      developmentDelta: -0.18,
      loyaltyDelta: -0.1,
      unrestDelta: 0.24,
      revoltProgressDelta: 0.12,
    }),

  freezeWarsAtRegion: (regionId) => {
    const state = get();
    const map = state.map;
    if (!map) return false;
    const province = map.provinces[regionId as unknown as number];
    if (!province || province.terrain === 'ocean') return false;

    const updatedWars: WarSummary[] = [];
    const activeWarsNext = state.activeWars.map((war) => {
      if (war.status !== 'active' || !isWarTouchingRegion(map, war, regionId)) return war;
      const nextWar: WarSummary = {
        ...war,
        status: 'truce',
        fatigue: 0,
        lastContactTick: state.tick,
        truceUntilTick: asTick((state.tick as unknown as number) + DIVINE_FREEZE_TRUCE_TICKS),
      };
      updatedWars.push(nextWar);
      return nextWar;
    });
    if (updatedWars.length === 0) return false;

    const event: LogEvent = {
      id: asEventId(Date.now() * 1000),
      tick: state.tick,
      level: 'system',
      category: 'divine',
      message: `战争被冻结（${updatedWars.length} 场）`,
    };
    const logs =
      state.logs.length >= MAX_LOG_ENTRIES ? state.logs.slice(-MAX_LOG_ENTRIES + 1) : state.logs;

    set({
      activeWars: activeWarsNext,
      logs: [...logs, event],
      lastTickEventCount: state.lastTickEventCount + 1,
      snapshotVersion: state.snapshotVersion + 1,
    });
    state.recordDivineFeedback(regionId, 'freeze-war');

    if (state.replayMode !== 'recording') return true;
    const frame: ReplayFrame = {
      tick: state.tick,
      patches: [],
      events: [event],
      rankings: buildReplayRankings(state.factions),
      updatedWars,
      status: state.status,
      winnerFactionId: state.winnerFactionId,
    };
    get().recordFrame(frame);
    return true;
  },

  terraformRegion: (regionId) => {
    const state = get();
    const map = state.map;
    if (!map) return false;
    const index = regionId as unknown as number;
    const province = map.provinces[index];
    if (!province || province.terrain === 'ocean') return false;

    const targetTerrain = state.divineTerrain;
    if (province.terrain === targetTerrain) return false;

    const previousTerrain = province.terrain;
    const nextProvinces = map.provinces.map((item) =>
      item.id === regionId ? { ...item, terrain: targetTerrain } : item,
    );
    const event: LogEvent = {
      id: asEventId(Date.now() * 1000),
      tick: state.tick,
      level: 'system',
      category: 'divine',
      message: `州 #${index} 地形变为${TERRAIN_LABEL[targetTerrain]}`,
      factionId: province.ownerFactionId ?? undefined,
    };
    const logs =
      state.logs.length >= MAX_LOG_ENTRIES ? state.logs.slice(-MAX_LOG_ENTRIES + 1) : state.logs;

    set({
      map: { ...map, provinces: nextProvinces },
      logs: [...logs, event],
      lastTickEventCount: state.lastTickEventCount + 1,
      snapshotVersion: state.snapshotVersion + 1,
    });
    state.recordDivineFeedback(regionId, 'terraform-region');

    if (state.replayMode !== 'recording') return true;
    const frame: ReplayFrame = {
      tick: state.tick,
      patches: [],
      events: [event],
      rankings: buildReplayRankings(state.factions),
      terrainUpdates: [
        {
          regionId,
          from: previousTerrain,
          to: targetTerrain,
        },
      ],
      status: state.status,
      winnerFactionId: state.winnerFactionId,
    };
    get().recordFrame(frame);
    return true;
  },

  applyDivineToolAtRegion: (regionId) => {
    const state = get();
    if (state.divineTool === 'none') return false;
    if (state.divineTool === 'freeze-war') return state.freezeWarsAtRegion(regionId);
    if (state.divineTool === 'terraform-region') return state.terraformRegion(regionId);

    const settlement = state.settlements.find((item) => item.regionId === regionId);
    if (!settlement) return false;

    const province = state.map?.provinces[regionId as unknown as number];
    if (!province || province.terrain === 'ocean' || province.ownerFactionId !== settlement.factionId) {
      return false;
    }

    if (state.divineTool === 'bless-settlement') {
      state.blessSettlement(settlement.id);
      return true;
    }
    if (state.divineTool === 'curse-settlement') {
      state.curseSettlement(settlement.id);
      return true;
    }
    if (state.divineTool === 'incite-revolt') {
      state.inciteSettlementRevolt(settlement.id);
      return true;
    }
    if (state.divineTool === 'pacify-unrest') {
      state.pacifySettlementUnrest(settlement.id);
      return true;
    }
    if (state.divineTool === 'accelerate-civilization') {
      state.accelerateSettlementCivilization(settlement.id);
      return true;
    }
    state.strikeSettlementDisaster(settlement.id);
    return true;
  },
});

type GetState = () => Deps;
type SetState = (partial: Partial<Deps>) => void;

function applyDivineSettlementEffect(
  get: GetState,
  set: SetState,
  settlementId: SettlementId,
  effect: {
    label: '祝福' | '诅咒' | '煽动' | '平息' | '加速' | '灾害';
    tool: Exclude<Deps['divineTool'], 'none'>;
    eventText: string;
    populationMultiplier?: number;
    developmentDelta?: number;
    loyaltyDelta: number;
    unrestDelta: number;
    revoltProgressDelta: number;
  },
): void {
  const state = get();
  const settlement = state.settlements.find((item) => item.id === settlementId);
  if (!settlement) return;

  const updated: SettlementSummary = {
    ...settlement,
    population: round1(Math.max(1, settlement.population * (effect.populationMultiplier ?? 1))),
    development: round2(clamp01(settlement.development + (effect.developmentDelta ?? 0))),
    loyalty: round2(clamp01(settlement.loyalty + effect.loyaltyDelta)),
    unrest: round2(clamp01(settlement.unrest + effect.unrestDelta)),
    revoltProgress: round2(clamp01(settlement.revoltProgress + effect.revoltProgressDelta)),
  };
  const settlementsNext = state.settlements.map((item) =>
    item.id === settlementId ? updated : item,
  );
  const event: LogEvent = {
    id: asEventId(Date.now() * 1000),
    tick: state.tick,
    level: 'system',
    category: 'divine',
    message: `${updated.name}${effect.eventText}（忠诚=${formatPercent(updated.loyalty)}，动荡=${formatPercent(updated.unrest)}）`,
    factionId: updated.factionId,
  };
  const logs =
    state.logs.length >= MAX_LOG_ENTRIES ? state.logs.slice(-MAX_LOG_ENTRIES + 1) : state.logs;

  set({
    settlements: settlementsNext,
    logs: [...logs, event],
    lastTickEventCount: state.lastTickEventCount + 1,
    snapshotVersion: state.snapshotVersion + 1,
  });
  state.recordDivineFeedback(updated.regionId, effect.tool);

  if (state.replayMode !== 'recording') return;
  const frame: ReplayFrame = {
    tick: state.tick,
    patches: [],
    events: [event],
    rankings: buildReplayRankings(state.factions),
    settlementUpdates: [
      {
        settlementId: updated.id,
        population: updated.population,
        development: updated.development,
        loyalty: updated.loyalty,
        unrest: updated.unrest,
        revoltProgress: updated.revoltProgress,
      },
    ],
    status: state.status,
    winnerFactionId: state.winnerFactionId,
  };
  get().recordFrame(frame);
}

function buildReplayRankings(factions: Deps['factions']): ReplayRankingRow[] {
  return factions.map((faction) => ({
    factionId: faction.id as unknown as number,
    regions: faction.regions ?? 0,
  }));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isWarTouchingRegion(map: MapData, war: WarSummary, regionId: RegionId): boolean {
  if (war.siegeProgress?.some((progress) => progress.regionId === regionId)) return true;

  const province = map.provinces[regionId as unknown as number];
  if (!province || province.ownerFactionId == null) return false;

  const owner = province.ownerFactionId;
  const opponent =
    owner === war.attackerFactionId
      ? war.defenderFactionId
      : owner === war.defenderFactionId
        ? war.attackerFactionId
        : null;
  if (opponent == null) return false;

  return province.neighbors.some((neighborId) => {
    const neighbor = map.provinces[neighborId as unknown as number];
    return neighbor?.terrain !== 'ocean' && neighbor?.ownerFactionId === opponent;
  });
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}
