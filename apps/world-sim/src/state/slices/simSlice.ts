import type { StateCreator } from 'zustand';
import type { SimEventType, SimPatch, SimStatus } from '@/core/sim';
import {
  advanceSettlementSieges,
  advanceWarStates,
  applyCapitalFallWarShocks,
  applyRecentConquestPatches,
  collectRevoltRegionIds,
  computeCapitalsAndCentroids,
  getSettlementRevoltOutbreaks,
  getSettlementRevoltWarnings,
  rebuildCapitalSettlements,
  runExpansionTick,
  selectBorderWarDeclarations,
} from '@/core/sim';
import { createPrngFromSeed, type RandomSource } from '@/shared/math';
import type {
  FactionId,
  FactionSummary,
  LogEvent,
  LogEventCategory,
  LogEventLevel,
  ReplayCapitalUpdate,
  ReplayFrame,
  ReplayPatch,
  ReplayRankingRow,
  SettlementSummary,
  SimMode,
  SimSpeedTier,
  Tick,
  WarSummary,
} from '@/shared/types';
import { asEventId, asTick, asWarId } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import { mintFactionId } from './factionSlice';
import { type LogSlice, MAX_LOG_ENTRIES } from './logSlice';
import type { MapSlice } from './mapSlice';
import type { ReplaySlice } from './replaySlice';
import type { SettlementSlice } from './settlementSlice';

const SIM_LOG_LEVEL_BY_TYPE: Record<SimEventType, LogEventLevel> = {
  capture: 'battle',
  repel: 'battle',
  eliminate: 'system',
  victory: 'system',
  stalemate: 'system',
  revolt_warning: 'warn',
};

const SIM_LOG_CATEGORY_BY_TYPE: Record<SimEventType, LogEventCategory> = {
  capture: 'occupy',
  repel: 'repel',
  eliminate: 'eliminate',
  victory: 'victory',
  stalemate: 'stalemate',
  revolt_warning: 'revolt',
};

const MAX_ACTIVE_REVOLT_WARS = 2;
const REVOLT_OUTBREAK_COOLDOWN_TICKS = 80;
const MAX_REGIONS_PER_REVOLT = 2;

export interface SimSlice {
  /** 当前 tick（占位/驱动器共用） */
  tick: Tick;
  /** 当前播放速度档位 */
  speed: SimSpeedTier;
  /** 是否暂停（独立于 speed，便于一键暂停/继续） */
  paused: boolean;
  /** Live 推演 vs Replay 回放 */
  mode: SimMode;
  /** 模拟运行状态机：idle / running / victory / stalemate */
  status: SimStatus;
  /** 胜利方 / 终局存活势力。仅在 victory / stalemate 时填充 */
  winnerFactionId: FactionId | null;
  /** 上一次内核 tick 触发的事件数；用于 LogPanel 简单的「忙碌指示」 */
  lastTickEventCount: number;
  /** 最近一次发布的快照版本号；Phase 5 用于通知渲染层「数据已变」 */
  snapshotVersion: number;
  /** 每个州最近一次被占领的 tick；用于治理、忠诚和叛乱的短期记忆。 */
  recentConquests: Map<number, Tick>;
  /** 当前仍在持续的最小战争关系：普通边境战争、叛乱战争与停战。 */
  activeWars: WarSummary[];

  setSpeed: (speed: SimSpeedTier) => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setMode: (mode: SimMode) => void;
  /** 调试用：手动推进 1 tick（即便处于 idle 也会驱动一次内核） */
  advanceTick: (n?: number) => void;
  /** 把 sim 切换到 running 状态。已有出生地的势力直接开打；否则也允许，等用户改局后再继续。 */
  startSim: () => void;
  /** 重置 tick / status / winner / paused，但保留地图与势力 */
  resetSim: () => void;
  /** 重置战局：清空地图所有占领、清势力出生信息，并复位 sim 状态机。势力定义本身保留 */
  resetBattle: () => void;
}

type Deps = SimSlice & MapSlice & FactionSlice & LogSlice & ReplaySlice & SettlementSlice;

export const createSimSlice: StateCreator<Deps, [], [], SimSlice> = (set, get) => {
  let logSeq = 1;

  const driveOneTick = (): void => {
    const state = get();
    if (state.status === 'victory' || state.status === 'stalemate') return;

    const map = state.map;
    if (!map) return;

    const factions = state.factions;
    const nextTick = asTick(state.tick + 1);

    const rng: RandomSource = createPrngFromSeed(`tick-${state.seed}-${nextTick}`);
    const declaredWars: WarSummary[] = [];
    for (const candidate of selectBorderWarDeclarations({
      map,
      factions,
      wars: state.activeWars,
    })) {
      declaredWars.push({
        id: mintWarId(state.activeWars, declaredWars),
        kind: 'border',
        status: 'active',
        attackerFactionId: candidate.attackerFactionId,
        defenderFactionId: candidate.defenderFactionId,
        startedTick: nextTick,
        lastContactTick: nextTick,
        fatigue: 0,
        attackerStartRegions: factions.find((faction) => faction.id === candidate.attackerFactionId)?.regions ?? 0,
        defenderStartRegions: factions.find((faction) => faction.id === candidate.defenderFactionId)?.regions ?? 0,
      });
    }
    const warsForTick = declaredWars.length > 0 ? state.activeWars.concat(declaredWars) : state.activeWars;
    const result = runExpansionTick({
      tick: nextTick,
      map,
      factions,
      settlements: state.settlements,
      activeWars: warsForTick,
      rng,
    });

    const newLogs: LogEvent[] = [];
    let nextStatus: SimStatus = state.status === 'idle' ? 'idle' : 'running';
    let winnerFactionId: FactionId | null = state.winnerFactionId;

    const factionById = new Map<FactionId, FactionSummary>(
      factions.map((f: FactionSummary) => [f.id, f]),
    );
    const factionNameById = new Map<FactionId, string>(
      factions.map((f: FactionSummary) => [f.id, f.name]),
    );

    const pushLog = (
      level: LogEventLevel,
      category: LogEventCategory,
      message: string,
      factionId: FactionId | null | undefined,
    ): void => {
      newLogs.push({
        id: asEventId(Date.now() * 1000 + logSeq++),
        tick: nextTick,
        level,
        category,
        message,
        factionId: factionId ?? undefined,
      });
    };

    for (const war of declaredWars) {
      const attackerName = factionNameById.get(war.attackerFactionId) ?? '一方';
      const defenderName = factionNameById.get(war.defenderFactionId) ?? '另一方';
      pushLog(
        'diplomacy',
        'diplomacy',
        `${attackerName} 对 ${defenderName} 宣战`,
        war.attackerFactionId,
      );
    }

    for (const event of result.events) {
      const level = SIM_LOG_LEVEL_BY_TYPE[event.type];
      const category = SIM_LOG_CATEGORY_BY_TYPE[event.type];
      // 主条目：从攻方视角描述
      const primaryFactionId = event.attackerId ?? event.defenderId ?? null;
      pushLog(level, category, event.message, primaryFactionId);

      // 派生条目：capture 同时记一条「失地」（仅当原本有守方时；空州占领没有失地）
      if (event.type === 'capture' && event.defenderId != null) {
        const defenderName = factionNameById.get(event.defenderId) ?? '敌方';
        const attackerName =
          event.attackerId != null ? (factionNameById.get(event.attackerId) ?? '敌方') : '敌方';
        const regionRef = event.regionId == null ? '边境州' : `#${event.regionId}`;
        pushLog(
          'battle',
          'lose',
          `${defenderName} 失去 ${regionRef}（被 ${attackerName} 攻陷）`,
          event.defenderId,
        );
      }

      if (event.type === 'victory') {
        nextStatus = 'victory';
        winnerFactionId = event.attackerId;
      } else if (event.type === 'stalemate') {
        nextStatus = 'stalemate';
        winnerFactionId = event.attackerId;
      }
    }

    let nextMap = map;
    const ensureNextMapMutable = () => {
      if (nextMap === map) {
        nextMap = {
          ...map,
          provinces: map.provinces.map((p) => ({ ...p })),
        };
      }
      return nextMap;
    };
    if (result.patches.length > 0) {
      ensureNextMapMutable();
      for (const patch of result.patches) {
        const idx = patch.regionId as unknown as number;
        const province = nextMap.provinces[idx];
        if (province && province.terrain !== 'ocean') province.ownerFactionId = patch.toOwnerId;
      }
    }

    let factionsNext = refreshFactionsFromMap(nextMap, factions, state.settlements);
    const factionNextById = new Map<FactionId, FactionSummary>(
      factionsNext.map((f: FactionSummary) => [f.id, f]),
    );
    let capitalFallCount = 0;
    const reportedCapitalFalls = new Set<FactionId>();
    const capitalFallShockFactionIds = new Set<FactionId>();
    for (const patch of result.patches) {
      if (patch.fromOwnerId == null || patch.toOwnerId == null || patch.fromOwnerId === patch.toOwnerId) {
        continue;
      }
      if (reportedCapitalFalls.has(patch.fromOwnerId)) continue;
      const previousFaction = factionById.get(patch.fromOwnerId);
      if (previousFaction?.capitalRegionId !== patch.regionId) continue;

      const defenderName = factionNameById.get(patch.fromOwnerId) ?? '守方';
      const attackerName = factionNameById.get(patch.toOwnerId) ?? '攻方';
      const relocatedCapital = factionNextById.get(patch.fromOwnerId)?.capitalRegionId ?? null;
      const relocationText =
        relocatedCapital == null
          ? '，已无可迁都之地'
          : `，迁都 #${relocatedCapital as unknown as number}`;
      pushLog(
        'system',
        'capital',
        `${defenderName} 都城 #${patch.regionId as unknown as number} 陷落${relocationText}（被 ${attackerName} 攻陷）`,
        patch.fromOwnerId,
      );
      reportedCapitalFalls.add(patch.fromOwnerId);
      capitalFallShockFactionIds.add(patch.fromOwnerId);
      capitalFallCount++;
    }
    let recentConquestsNext = applyRecentConquestPatches({
      previous: state.recentConquests,
      patches: result.patches,
      currentTick: nextTick,
    });
    let settlementsNext = rebuildCapitalSettlements({
      map: nextMap,
      factions: factionsNext,
      previous: state.settlements,
      tick: nextTick,
      recentConquests: recentConquestsNext,
      capitalFallShockFactionIds,
    });
    const revoltWarnings = getSettlementRevoltWarnings({
      previous: state.settlements,
      current: settlementsNext,
    });
    const factionNameByNextId = new Map<FactionId, string>(
      factionsNext.map((f: FactionSummary) => [f.id, f.name]),
    );
    for (const warning of revoltWarnings) {
      const settlement = warning.settlement;
      const factionName = factionNameByNextId.get(settlement.factionId) ?? '未知势力';
      pushLog(
        'warn',
        'revolt',
        `${factionName} 的 ${settlement.name} 叛乱酝酿（忠诚=${formatPercent(settlement.loyalty)}，动荡=${formatPercent(settlement.unrest)}，进度=${formatPercent(settlement.revoltProgress)}）`,
        settlement.factionId,
      );
    }
    const revoltPatches: SimPatch[] = [];
    const rebelFactions: FactionSummary[] = [];
    const newWars: WarSummary[] = [...declaredWars];
    const revoltOutbreaks = getSettlementRevoltOutbreaks({
      previous: state.settlements,
      current: settlementsNext,
    });
    let remainingRevoltSlots = Math.max(0, MAX_ACTIVE_REVOLT_WARS - countActiveRevoltWars(warsForTick));
    if (hasRecentRevoltOutbreak(warsForTick, nextTick)) {
      remainingRevoltSlots = 0;
    }
    for (const outbreak of revoltOutbreaks) {
      if (remainingRevoltSlots <= 0) break;
      const settlement = outbreak.settlement;
      const regionIndex = settlement.regionId as unknown as number;
      const province = nextMap.provinces[regionIndex];
      if (!province || province.terrain === 'ocean' || province.ownerFactionId !== settlement.factionId) {
        continue;
      }
      const parent = factionsNext.find((faction) => faction.id === settlement.factionId);
      if (!parent || parent.regions <= 1) continue;
      const revoltRegionIds = collectRevoltRegionIds({
        map: nextMap,
        rootRegionId: settlement.regionId,
        parentFactionId: settlement.factionId,
        parentCapitalRegionId: parent.capitalRegionId,
        currentTick: nextTick,
        recentConquests: recentConquestsNext,
        maxRegions: Math.min(MAX_REGIONS_PER_REVOLT, Math.max(1, parent.regions - 1)),
      });
      if (revoltRegionIds.length === 0) continue;

      const rebelId = mintFactionId();
      const rebelFaction: FactionSummary = {
        id: rebelId,
        name: `${settlement.name}义军`,
        leader: `${settlement.name}首领`,
        colorHex: pickRebelColor(rebelId),
        birthRegionId: settlement.regionId,
        capitalRegionId: settlement.regionId,
        centroidRegionId: settlement.regionId,
        regions: revoltRegionIds.length,
        population: Math.max(0, Math.floor(settlement.population * (0.55 + revoltRegionIds.length * 0.08))),
      };

      ensureNextMapMutable();
      for (const regionId of revoltRegionIds) {
        const idx = regionId as unknown as number;
        nextMap.provinces[idx] = {
          ...nextMap.provinces[idx],
          ownerFactionId: rebelId,
        };
        revoltPatches.push({
          regionId,
          fromOwnerId: settlement.factionId,
          toOwnerId: rebelId,
          tick: nextTick,
        });
      }
      rebelFactions.push(rebelFaction);
      const revoltWar: WarSummary = {
        id: mintWarId(state.activeWars, newWars),
        kind: 'revolt',
        status: 'active',
        attackerFactionId: rebelId,
        defenderFactionId: settlement.factionId,
        startedTick: nextTick,
        lastContactTick: nextTick,
        fatigue: 0,
        attackerStartRegions: rebelFaction.regions,
        defenderStartRegions: Math.max(0, parent.regions - revoltRegionIds.length),
        sourceSettlementId: settlement.id,
      };
      newWars.push(revoltWar);
      pushLog(
        'system',
        'revolt',
        `${settlement.name} 举旗叛乱，脱离 ${parent.name}（响应州=${revoltRegionIds.length}，忠诚=${formatPercent(settlement.loyalty)}，动荡=${formatPercent(settlement.unrest)}，进度=${formatPercent(settlement.revoltProgress)}）`,
        rebelId,
      );
      pushLog(
        'diplomacy',
        'diplomacy',
        `${rebelFaction.name} 与 ${parent.name} 爆发叛乱战争`,
        rebelId,
      );
      remainingRevoltSlots--;
    }

    if (revoltPatches.length > 0) {
      const factionsWithRebels = [...factionsNext, ...rebelFactions];
      recentConquestsNext = applyRecentConquestPatches({
        previous: recentConquestsNext,
        patches: revoltPatches,
        currentTick: nextTick,
      });
      factionsNext = refreshFactionsFromMap(nextMap, factionsWithRebels, settlementsNext);
      settlementsNext = rebuildCapitalSettlements({
        map: nextMap,
        factions: factionsNext,
        previous: settlementsNext,
        tick: nextTick,
        recentConquests: recentConquestsNext,
      });
    }

    const allPatches = result.patches.concat(revoltPatches);
    const warsBeforeProgress = newWars.length > 0 ? state.activeWars.concat(newWars) : state.activeWars;
    const siegeProgress = advanceSettlementSieges({
      wars: warsBeforeProgress,
      settlements: state.settlements,
      events: result.events,
      tick: nextTick,
      map: nextMap,
    });
    const warProgress = advanceWarStates({
      map: nextMap,
      factions: factionsNext,
      wars: siegeProgress.wars,
      tick: nextTick,
    });
    const capitalShockProgress = applyCapitalFallWarShocks({
      wars: warProgress.wars,
      fallenFactionIds: capitalFallShockFactionIds,
      tick: nextTick,
    });
    const updatedWars = mergeUpdatedWars(
      siegeProgress.updatedWars,
      warProgress.updatedWars,
      capitalShockProgress.updatedWars,
    );
    for (const transition of warProgress.transitions) {
      const attackerName = factionNameByNextId.get(transition.war.attackerFactionId) ?? '一方';
      const defenderName = factionNameByNextId.get(transition.war.defenderFactionId) ?? '另一方';
      if (transition.type === 'truce') {
        const reasonText = transition.reason === 'fatigue' ? '因战事疲惫' : '';
        pushLog(
          'diplomacy',
          'diplomacy',
          `${attackerName} 与 ${defenderName} ${reasonText}停战`,
          transition.war.attackerFactionId,
        );
      } else if (transition.type === 'ended') {
        const winnerName =
          transition.winnerFactionId == null ? '无人' : (factionNameByNextId.get(transition.winnerFactionId) ?? '胜方');
        const loserName =
          transition.loserFactionId == null ? '一方' : (factionNameByNextId.get(transition.loserFactionId) ?? '败方');
        pushLog(
          'diplomacy',
          'diplomacy',
          `${winnerName} 结束与 ${loserName} 的战争`,
          transition.winnerFactionId ?? transition.war.attackerFactionId,
        );
      } else {
        pushLog(
          'diplomacy',
          'diplomacy',
          `${attackerName} 与 ${defenderName} 停战期结束`,
          transition.war.attackerFactionId,
        );
      }
    }
    const logsNext = newLogs.length > 0 ? appendLogs(state.logs, newLogs) : state.logs;

    set({
      tick: nextTick,
      map: nextMap,
      factions: factionsNext,
      settlements: settlementsNext,
      recentConquests: recentConquestsNext,
      activeWars: capitalShockProgress.wars,
      logs: logsNext,
      status: nextStatus,
      winnerFactionId,
      lastTickEventCount:
        result.events.length +
        capitalFallCount +
        revoltWarnings.length +
        revoltPatches.length +
        newWars.length +
        siegeProgress.updatedWars.length +
        capitalShockProgress.updatedWars.length +
        warProgress.transitions.length,
      snapshotVersion: state.snapshotVersion + 1,
    });

    // Phase 11：把本 tick 录入 replay。仅在录制模式下追加；回放模式期间 sim 已被外层暂停，不会进来。
    if (state.replayMode === 'recording') {
      const patches: ReplayPatch[] = allPatches.map((p) => ({
        regionId: p.regionId as unknown as number,
        from: p.fromOwnerId == null ? null : (p.fromOwnerId as unknown as number),
        to: p.toOwnerId == null ? null : (p.toOwnerId as unknown as number),
      }));
      const rankings: ReplayRankingRow[] = factionsNext.map((f) => ({
        factionId: f.id as unknown as number,
        regions: f.regions ?? 0,
      }));
      const capitalUpdates = getCapitalUpdates(factions, factionsNext);
      const frame: ReplayFrame = {
        tick: nextTick,
        patches,
        events: newLogs,
        rankings,
        capitalUpdates: capitalUpdates.length === 0 ? undefined : capitalUpdates,
        newFactions:
          rebelFactions.length === 0
            ? undefined
            : rebelFactions.map((f) => ({
                id: f.id,
                name: f.name,
                leader: f.leader,
                colorHex: f.colorHex,
                birthRegionId: f.birthRegionId,
                capitalRegionId: f.capitalRegionId ?? f.birthRegionId,
                population: f.population,
              })),
        newWars: newWars.length === 0 ? undefined : newWars,
        updatedWars: updatedWars.length === 0 ? undefined : updatedWars,
        endedWarIds: warProgress.endedWarIds.length === 0 ? undefined : warProgress.endedWarIds,
        status: nextStatus,
        winnerFactionId,
      };
      get().recordFrame(frame);
    }
  };

  return {
    tick: asTick(0),
    speed: '1x',
    paused: true,
    mode: 'live',
    status: 'idle',
    winnerFactionId: null,
    lastTickEventCount: 0,
    snapshotVersion: 0,
    recentConquests: new Map(),
    activeWars: [],

    setSpeed: (speed) =>
      set((s) => ({
        speed,
        paused: speed === 'paused',
        status: s.status === 'idle' && speed !== 'paused' ? 'running' : s.status,
      })),

    setPaused: (paused) => set({ paused }),

    togglePaused: () =>
      set((s) => {
        const next = !s.paused;
        return {
          paused: next,
          // 取消暂停时若速度档位是 paused，自动恢复到 1x，否则用户点了「继续」也不会推进
          speed: !next && s.speed === 'paused' ? '1x' : s.speed,
          status: s.status === 'idle' && !next ? 'running' : s.status,
        };
      }),

    setMode: (mode) => set({ mode }),

    advanceTick: (n = 1) => {
      for (let i = 0; i < Math.max(1, n); i++) {
        driveOneTick();
      }
    },

    startSim: () =>
      set((s) => ({
        status: s.status === 'victory' || s.status === 'stalemate' ? s.status : 'running',
        paused: false,
        speed: s.speed === 'paused' ? '1x' : s.speed,
      })),

    resetSim: () =>
      set({
        tick: asTick(0),
        speed: '1x',
        paused: true,
        mode: 'live',
        status: 'idle',
        winnerFactionId: null,
        lastTickEventCount: 0,
        snapshotVersion: 0,
        recentConquests: new Map(),
        activeWars: [],
      }),

    resetBattle: () => {
      const state = get();
      const map = state.map;
      const nextMap =
        map == null
          ? null
          : {
              ...map,
              provinces: map.provinces.map((p) => ({ ...p, ownerFactionId: null })),
            };
      const factionsNext = state.factions.map((f) => ({
        ...f,
        birthRegionId: null,
        capitalRegionId: null,
        centroidRegionId: null,
        regions: 0,
      }));
      set({
        ...(nextMap ? { map: nextMap } : {}),
        factions: factionsNext,
        settlements: [],
        recentConquests: new Map(),
        activeWars: [],
        tick: asTick(0),
        speed: '1x',
        paused: true,
        mode: 'live',
        status: 'idle',
        winnerFactionId: null,
        lastTickEventCount: 0,
        snapshotVersion: 0,
      });

      get().captureBaseline();
    },
  };
};

function appendLogs(prev: LogEvent[], next: LogEvent[]): LogEvent[] {
  const combined = [...prev, ...next];
  const milestones = combined.filter(isMilestoneLog);
  const recentNormal = combined.filter((log) => !isMilestoneLog(log)).slice(-MAX_LOG_ENTRIES);
  return [...milestones, ...recentNormal].sort((a, b) => {
    const tickDelta = Number(a.tick) - Number(b.tick);
    if (tickDelta !== 0) return tickDelta;
    return Number(a.id) - Number(b.id);
  });
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isMilestoneLog(log: LogEvent): boolean {
  return (
    log.category === 'capital' ||
    log.category === 'eliminate' ||
    log.category === 'victory' ||
    log.category === 'stalemate'
  );
}

function mergeUpdatedWars(
  ...groups: Array<readonly WarSummary[]>
): WarSummary[] {
  const byId = new Map<number, WarSummary>();
  for (const group of groups) {
    for (const war of group) {
      byId.set(war.id as unknown as number, war);
    }
  }
  return Array.from(byId.values());
}

function countActiveRevoltWars(wars: readonly WarSummary[]): number {
  return wars.filter((war) => war.kind === 'revolt' && war.status === 'active').length;
}

function hasRecentRevoltOutbreak(wars: readonly WarSummary[], currentTick: Tick): boolean {
  return wars.some(
    (war) =>
      war.kind === 'revolt' &&
      Number(currentTick) - Number(war.startedTick) < REVOLT_OUTBREAK_COOLDOWN_TICKS,
  );
}

function refreshFactionsFromMap(
  map: NonNullable<MapSlice['map']>,
  factions: FactionSummary[],
  settlements: readonly SettlementSummary[] = [],
): FactionSummary[] {
  const regionsByFaction = new Map<FactionId, number>();
  for (const province of map.provinces) {
    if (province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    regionsByFaction.set(owner, (regionsByFaction.get(owner) ?? 0) + 1);
  }

  const capitalCandidatesByFaction = new Map<FactionId, SettlementSummary[]>();
  for (const settlement of settlements) {
    const candidates = capitalCandidatesByFaction.get(settlement.factionId) ?? [];
    candidates.push(settlement);
    capitalCandidatesByFaction.set(settlement.factionId, candidates);
  }

  const capitalsByFaction = computeCapitalsAndCentroids(
    map,
    factions.map((f) => ({
      id: f.id,
      capitalRegionId: f.capitalRegionId,
      capitalCandidates: capitalCandidatesByFaction.get(f.id),
    })),
  );
  return factions.map((f) => {
    const capInfo = capitalsByFaction.get(f.id);
    return {
      ...f,
      regions: regionsByFaction.get(f.id) ?? 0,
      capitalRegionId: capInfo ? capInfo.capital : f.capitalRegionId,
      centroidRegionId: capInfo ? capInfo.centroid : f.centroidRegionId,
    };
  });
}

function getCapitalUpdates(
  previous: readonly FactionSummary[],
  current: readonly FactionSummary[],
): ReplayCapitalUpdate[] {
  const previousById = new Map(previous.map((faction) => [faction.id, faction]));
  const updates: ReplayCapitalUpdate[] = [];
  for (const faction of current) {
    const previousFaction = previousById.get(faction.id);
    if (!previousFaction) continue;
    if (previousFaction.capitalRegionId === faction.capitalRegionId) continue;
    updates.push({
      factionId: faction.id,
      capitalRegionId: faction.capitalRegionId,
      centroidRegionId: faction.centroidRegionId,
    });
  }
  return updates;
}

function pickRebelColor(id: FactionId): string {
  const hue = 18 + (((id as unknown as number) * 37) % 36);
  return hslToHex(hue, 78, 56);
}

function mintWarId(existing: readonly WarSummary[], pending: readonly WarSummary[]): WarSummary['id'] {
  const maxId = existing.concat(pending).reduce((max, war) => {
    return Math.max(max, war.id as unknown as number);
  }, 0);
  return asWarId(maxId + 1);
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const k = (n: number) => (n + h / 30) % 12;
  const channel = (n: number) => {
    const v = lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * v)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
